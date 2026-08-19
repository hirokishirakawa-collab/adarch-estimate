// ==============================================================
// jGrants → DB 同期
//
// 流れ:
//   1. 募集中の制度を広めのキーワードで洗い出す（id で重複排除）
//   2. 詳細を取り、HTMLを落として保存
//   3. 判定を付ける
//        - curated に載っている制度 … 人が確認した内容をそのまま採用（◎を付けられるのはここだけ）
//        - それ以外               … 本文が新規/変更されたものだけ AI 判定
//   4. 今回の募集中リストに居なくなった制度は isActive=false（消さずに残す）
// ==============================================================

import { createHash } from "crypto";
import { db } from "@/lib/db";
import {
  fetchAllOpenSubsidies,
  fetchDetails,
  stripHtml,
  splitSlashList,
  parseDate,
  type JgrantsDetail,
  type JgrantsSummary,
} from "./jgrants";
import { classifySubsidies, type ClassifyInput } from "./classify";
import { findCurated } from "./curated";

/**
 * 1回の同期でAI判定にかける上限。
 * 初回は母集団が丸ごと未判定なので、ここで区切って複数日に分けて仕上げる。
 * 判定できなかった分は fitCheckedAt が null のまま残り、次回の実行で拾われる。
 */
const MAX_AI_PER_RUN = 120;

export interface SyncStats {
  fetched: number;
  created: number;
  updated: number;
  deactivated: number;
  curatedApplied: number;
  aiClassified: number;
  aiSkipped: number;
  /** 上限に当たって今回は判定を見送った件数（次回に持ち越し） */
  aiDeferred: number;
  failedKeywords: string[];
  failedBatches: number;
}

function hashContent(parts: (string | null | undefined)[]): string {
  return createHash("sha256").update(parts.map((p) => p ?? "").join("|")).digest("hex");
}

/** 一覧と詳細をあわせて、DBに入れる形に整える */
function toRecord(summary: JgrantsSummary, detail: JgrantsDetail | undefined) {
  const detailText = stripHtml(detail?.detail);
  const areas = splitSlashList(summary.target_area_search);

  return {
    jgrantsId: summary.id,
    name: summary.name,
    title: summary.title,
    catchPhrase: detail?.subsidy_catch_phrase ?? null,
    institutionName: summary.institution_name ?? detail?.institution_name ?? null,
    detailText: detailText || null,
    usePurpose: detail?.use_purpose ?? null,
    industry: detail?.industry ?? null,
    targetEmployees: summary.target_number_of_employees ?? null,
    targetAreas: areas,
    subsidyRate: detail?.subsidy_rate ?? null,
    // jGrants は上限なしを 0 で返すことがある。0円の補助金は無いので null に寄せる
    maxLimit: summary.subsidy_max_limit && summary.subsidy_max_limit > 0
      ? BigInt(summary.subsidy_max_limit)
      : null,
    acceptanceStart: parseDate(summary.acceptance_start_datetime),
    acceptanceEnd: parseDate(summary.acceptance_end_datetime),
    detailUrl:
      detail?.front_subsidy_detail_page_url ??
      `https://www.jgrants-portal.go.jp/subsidy/${summary.id}`,
    contentHash: hashContent([
      summary.title,
      detailText,
      detail?.use_purpose,
      detail?.industry,
    ]),
  };
}

export async function runSubsidySync(): Promise<SyncStats> {
  const stats: SyncStats = {
    fetched: 0,
    created: 0,
    updated: 0,
    deactivated: 0,
    curatedApplied: 0,
    aiClassified: 0,
    aiSkipped: 0,
    aiDeferred: 0,
    failedKeywords: [],
    failedBatches: 0,
  };

  // ── 1. 募集中の母集団
  const { summaries, failedKeywords } = await fetchAllOpenSubsidies();
  stats.fetched = summaries.length;
  stats.failedKeywords = failedKeywords;
  if (summaries.length === 0) return stats;

  // ── 2. 詳細取得
  const details = await fetchDetails(summaries.map((s) => s.id));

  // 既存レコード（変更検知と、AI判定を省くため）
  const existing = await db.subsidy.findMany({
    where: { jgrantsId: { in: summaries.map((s) => s.id) } },
    select: { jgrantsId: true, contentHash: true, fitCheckedAt: true, fitSource: true },
  });
  const existingByJgrantsId = new Map(existing.map((e) => [e.jgrantsId, e]));

  const needsAi: ClassifyInput[] = [];

  // ── 3. upsert ＋ curated 判定
  for (const summary of summaries) {
    const record = toRecord(summary, details.get(summary.id));
    const prev = existingByJgrantsId.get(summary.id);
    const curated = findCurated(record.title);

    const base = { ...record, isActive: true, lastSyncedAt: new Date() };

    if (curated) {
      // 人が要領を読んだ内容で上書きする。AIには回さない。
      const fitFields = {
        adCostFit: curated.fit,
        fitReason: curated.reason,
        fitEvidence: curated.caution,
        fitSource: "curated",
        fitCheckedAt: new Date(`${curated.checkedOn}T00:00:00+09:00`),
        guidelineUrl: curated.sourceUrl,
      };
      await db.subsidy.upsert({
        where: { jgrantsId: summary.id },
        create: { ...base, ...fitFields },
        update: { ...base, ...fitFields },
      });
      stats.curatedApplied++;
    } else {
      await db.subsidy.upsert({
        where: { jgrantsId: summary.id },
        create: base,
        update: base,
      });

      // 本文が変わっていない & 判定済みなら AI を呼ばない（コストと時間の節約）
      const unchanged = prev?.contentHash === record.contentHash && !!prev?.fitCheckedAt;
      // curated から外れた制度が古い curated 判定を持ち続けないよう、再判定に回す
      const wasCurated = prev?.fitSource === "curated";
      if (unchanged && !wasCurated) {
        stats.aiSkipped++;
      } else {
        needsAi.push({
          jgrantsId: summary.id,
          title: record.title,
          catchPhrase: record.catchPhrase,
          usePurpose: record.usePurpose,
          industry: record.industry,
          detailText: record.detailText,
        });
      }
    }

    if (prev) stats.updated++;
    else stats.created++;
  }

  // ── 4. AI 判定（上限まで。残りは次回に回す）
  const aiTargets = needsAi.slice(0, MAX_AI_PER_RUN);
  stats.aiDeferred = needsAi.length - aiTargets.length;
  if (stats.aiDeferred > 0) {
    console.warn(`[subsidy] 判定を${stats.aiDeferred}件見送り（上限${MAX_AI_PER_RUN}件／次回実行で拾う）`);
  }

  if (aiTargets.length > 0) {
    const { results, failedBatches } = await classifySubsidies(aiTargets);
    stats.failedBatches = failedBatches;
    for (const r of results) {
      await db.subsidy.update({
        where: { jgrantsId: r.jgrantsId },
        data: {
          adCostFit: r.fit,
          fitReason: r.reason,
          fitEvidence: r.evidence,
          fitSource: "ai",
          fitCheckedAt: new Date(),
          guidelineUrl: null,
        },
      });
      stats.aiClassified++;
    }
  }

  // ── 5. 募集が終わったものを寝かせる
  const deactivated = await db.subsidy.updateMany({
    where: { isActive: true, jgrantsId: { notIn: summaries.map((s) => s.id) } },
    data: { isActive: false },
  });
  stats.deactivated = deactivated.count;

  return stats;
}
