// ==============================================================
// 官公需情報ポータル → DB 同期
//
// 流れ:
//   1. 直近 sinceDays 日の公告を、件名が広告系のものだけ取得
//   2. Key で upsert（公告文が変わったものだけ再判定に回す）
//   3. 未判定・変更ありのものを AI 判定（1回の実行で上限あり）
//   4. 期限切れは消さずに残し、画面側で expiresAt で落とす
// ==============================================================

import { createHash } from "crypto";
import { db } from "@/lib/db";
import { fetchRecentTenders, type KkjTender } from "./kkj";
import type { TenderOrdererType } from "@/generated/prisma/client";
import { classifyTenders, type ClassifyInput } from "./classify";

/** 日次実行で見に行く期間（公告の差し替えを拾えるよう、少し重ねて取る） */
export const DEFAULT_SINCE_DAYS = 14;

/**
 * 実行時間の予算。エンドポイントは300秒で切られる（超えると 502 になり、
 * それまでの判定も返せない）ので、240秒で新しい判定バッチを始めるのをやめる。
 */
const RUN_BUDGET_MS = 240_000;

/** 1回の実行で AI 判定に回す上限。実際には RUN_BUDGET_MS の方が先に効くことが多い */
const MAX_CLASSIFY_PER_RUN = 400;

/** DB書き込みの同時実行数。数百件を1件ずつ待つと取得より時間がかかる */
const DB_CONCURRENCY = 10;

/** 開札日等が入っていない公告を、いつまで一覧に出すか */
const FALLBACK_VALID_DAYS = 45;

export interface TenderSyncStats {
  fetched: number;
  hits: number;
  splitByPrefecture: boolean;
  created: number;
  updated: number;
  classified: number;
  skipped: number;
  pending: number;
  matched: number;
  failedBatches: number;
  failedPrefectures: string[];
}

function hashContent(parts: (string | null | undefined)[]): string {
  return createHash("sha256").update(parts.map((p) => p ?? "").join("|")).digest("hex");
}

/**
 * 一覧から落とす基準日。
 * 開札日 → 入札開始日 → 納入期限 の順に見て、いずれも無ければ公告日+45日。
 * 日付が公告データに入らない自治体が多いので、これは推定値である。
 */
function resolveExpiresAt(t: KkjTender): Date | null {
  const explicit = t.openingDate ?? t.submissionDate ?? t.periodEndTime;
  if (explicit) return explicit;
  if (t.cftIssueDate) {
    return new Date(t.cftIssueDate.getTime() + FALLBACK_VALID_DAYS * 86_400_000);
  }
  return null;
}

/**
 * 発注者の区分を機関名から見分ける。
 * CityName は「機関の所在地」であって発注者ではない（国の出先機関にも市名が入る）ため、
 * 機関名の末尾が市区町村名かどうかで判定する。
 *   「岩手県盛岡市」→ MUNICIPAL ／「国土交通省北海道開発局」(所在地=札幌市) → OTHER
 */
export function resolveOrdererType(t: KkjTender): TenderOrdererType {
  const org = t.organizationName ?? "";
  if (!org) return "OTHER";
  if (t.cityName && org.endsWith(t.cityName)) return "MUNICIPAL";
  if (t.prefectureName && org.startsWith(t.prefectureName)) return "PREFECTURAL";
  return "OTHER";
}

function toRecord(t: KkjTender) {
  return {
    kkjKey: t.key,
    projectName: t.projectName,
    organizationName: t.organizationName,
    prefectureName: t.prefectureName,
    cityName: t.cityName,
    lgCode: t.lgCode,
    cityCode: t.cityCode,
    ordererType: resolveOrdererType(t),
    category: t.category,
    procedureType: t.procedureType,
    certification: t.certification,
    location: t.location,
    documentUrl: t.documentUrl,
    fileType: t.fileType,
    description: t.description,
    attachmentUrls: t.attachmentUrls,
    cftIssueDate: t.cftIssueDate,
    submissionDate: t.submissionDate,
    openingDate: t.openingDate,
    periodEndTime: t.periodEndTime,
    expiresAt: resolveExpiresAt(t),
    contentHash: hashContent([t.projectName, t.description, t.procedureType]),
  };
}

export async function runTenderSync(
  sinceDays: number = DEFAULT_SINCE_DAYS,
): Promise<TenderSyncStats> {
  // 予算は取得も含めた実行全体で測る（取得だけで数十秒かかることがある）
  const startedAt = Date.now();
  const stats: TenderSyncStats = {
    fetched: 0,
    hits: 0,
    splitByPrefecture: false,
    created: 0,
    updated: 0,
    classified: 0,
    skipped: 0,
    pending: 0,
    matched: 0,
    failedBatches: 0,
    failedPrefectures: [],
  };

  // ── 1. 取得
  const { items, hits, splitByPrefecture, failedPrefectures } =
    await fetchRecentTenders(sinceDays);
  stats.fetched = items.length;
  stats.hits = hits;
  stats.splitByPrefecture = splitByPrefecture;
  stats.failedPrefectures = failedPrefectures;
  if (items.length === 0) return stats;

  const existing = await db.tender.findMany({
    where: { kkjKey: { in: items.map((i) => i.key) } },
    select: { kkjKey: true, contentHash: true, fitCheckedAt: true },
  });
  const existingByKey = new Map(existing.map((e) => [e.kkjKey, e]));

  const needsAi: ClassifyInput[] = [];

  // ── 2. upsert（DB往復が数百回になるので、まとめて流す）
  for (let i = 0; i < items.length; i += DB_CONCURRENCY) {
    await Promise.all(
      items.slice(i, i + DB_CONCURRENCY).map(async (item) => {
        const record = toRecord(item);
        const data = { ...record, lastSyncedAt: new Date() };
        await db.tender.upsert({
          where: { kkjKey: item.key },
          create: data,
          update: data,
        });
      }),
    );
  }

  for (const item of items) {
    const record = toRecord(item);
    const prev = existingByKey.get(item.key);
    if (prev) stats.updated++;
    else stats.created++;

    // 公告文が変わっていない & 判定済みなら AI を呼ばない
    if (prev?.contentHash === record.contentHash && !!prev?.fitCheckedAt) {
      stats.skipped++;
    } else {
      needsAi.push({
        kkjKey: item.key,
        projectName: item.projectName,
        organizationName: item.organizationName,
        category: item.category,
        procedureType: item.procedureType,
        description: item.description,
      });
    }
  }

  // ── 3. AI 判定（公告日が新しいものから。溢れた分は次回に持ち越す）
  const order = new Map(items.map((i) => [i.key, i.cftIssueDate?.getTime() ?? 0]));
  needsAi.sort((a, b) => (order.get(b.kkjKey) ?? 0) - (order.get(a.kkjKey) ?? 0));
  const target = needsAi.slice(0, MAX_CLASSIFY_PER_RUN);
  stats.pending = needsAi.length - target.length;

  if (target.length > 0) {
    const { classified, failedBatches, notStarted } = await classifyTenders(target, {
      deadline: startedAt + RUN_BUDGET_MS,
      // バッチごとに保存する。まとめて保存すると時間切れで全部失う
      onResults: async (results) => {
        await Promise.all(
          results.map((r) =>
            db.tender.update({
              where: { kkjKey: r.kkjKey },
              data: {
                fit: r.fit,
                workType: r.workType,
                fitReason: r.reason,
                fitEvidence: r.evidence,
                needsQualification: r.needsQualification,
                fitCheckedAt: new Date(),
              },
            }),
          ),
        );
        stats.matched += results.filter((r) => r.fit === "MATCH").length;
      },
    });
    stats.classified = classified;
    stats.failedBatches = failedBatches;
    stats.pending += notStarted;
  }

  return stats;
}
