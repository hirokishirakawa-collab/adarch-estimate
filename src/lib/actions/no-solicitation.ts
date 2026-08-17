"use server";

import { db } from "@/lib/db";
import { getSessionInfo } from "@/lib/session";
import { normalizeDomain } from "@/lib/auto-sales-domain";
import { checkSiteForNoSolicitation } from "@/lib/no-solicitation";

/**
 * 「営業お断り」のグループ共通リスト。
 *
 * テーブルは auto_sales_blacklist をそのまま使う。自動営業のために作られたが、
 * 中身は「グループとして送ってはいけないドメイン」なので、人が送るときも同じものを見る。
 * 一度誰かが見つけたら、全拠点で二度と送られない。
 */

export type CheckOutcome = {
  url: string;
  domain: string | null;
  /** blocked=お断りあり / ok=見当たらず / unreachable=サイトを開けず / already=登録済み */
  status: "blocked" | "ok" | "unreachable" | "already";
  phrase?: string;
  where?: string;
};

const MAX_PER_CALL = 30;

async function requireUser() {
  const info = await getSessionInfo();
  if (!info) return null;
  if (info.role !== "ADMIN" && info.role !== "MANAGER") return null;
  return info;
}

/** 登録済みのお断りドメインを引く（送信操作の前に画面で使う） */
export async function getBlockedDomains(urls: string[]): Promise<Record<string, string>> {
  const info = await requireUser();
  if (!info) return {};
  const domains = [...new Set(urls.map((u) => normalizeDomain(u)).filter((d): d is string => !!d))];
  if (domains.length === 0) return {};

  const rows = await db.autoSalesBlacklist.findMany({
    where: { domain: { in: domains } },
    select: { domain: true, reason: true },
  });
  return Object.fromEntries(rows.map((r) => [r.domain, r.reason ?? "営業お断りの記載あり"]));
}

/**
 * 実際にサイトを見に行って「営業お断り」を探す。
 * 見つかったら全社共通リストに登録するので、他の拠点も以後送れなくなる。
 */
export async function checkNoSolicitation(
  items: { url: string; companyName?: string }[]
): Promise<{ error?: string; results?: CheckOutcome[] }> {
  const info = await requireUser();
  if (!info) return { error: "権限がありません" };
  if (!items?.length) return { results: [] };
  if (items.length > MAX_PER_CALL) {
    return { error: `一度に確認できるのは${MAX_PER_CALL}件までです` };
  }

  const results: CheckOutcome[] = [];

  for (const item of items) {
    const domain = normalizeDomain(item.url);
    if (!domain) {
      results.push({ url: item.url, domain: null, status: "unreachable" });
      continue;
    }

    // 既に登録済みならサイトを叩かない
    const known = await db.autoSalesBlacklist.findUnique({ where: { domain } });
    if (known) {
      results.push({
        url: item.url, domain, status: "already",
        phrase: known.reason ?? "営業お断りとして登録済み",
      });
      continue;
    }

    const check = await checkSiteForNoSolicitation(item.url);

    if (check.status === "blocked") {
      // 全社共通リストへ。以後どの拠点からも送れない
      await db.autoSalesBlacklist.upsert({
        where: { domain },
        create: {
          domain,
          companyName: item.companyName ?? null,
          reason: `営業お断りの記載を検出（${check.where}）: 「${check.phrase}」`,
        },
        update: {},
      });
      results.push({ url: item.url, domain, status: "blocked", phrase: check.phrase, where: check.where });
    } else {
      results.push({ url: item.url, domain, status: check.status });
    }
  }

  return { results };
}

/** 人が見つけた場合に手で登録する */
export async function addBlockedDomain(
  url: string,
  companyName: string | null,
  reason: string
): Promise<{ error?: string; domain?: string }> {
  const info = await requireUser();
  if (!info) return { error: "権限がありません" };

  const domain = normalizeDomain(url);
  if (!domain) return { error: "URLからドメインを判別できませんでした" };

  await db.autoSalesBlacklist.upsert({
    where: { domain },
    create: {
      domain,
      companyName,
      reason: reason.trim() || `${info.staffName} が手動で登録`,
    },
    update: { reason: reason.trim() || undefined },
  });
  return { domain };
}
