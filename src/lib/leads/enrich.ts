// ---------------------------------------------------------------
// リードの「送る前の掃除」＝サイトを1回見て、メールを埋め、営業お断りを外す。
//
// 元は画面の server action（lib/actions/lead-email.ts）の中にあり、
// セッションが要るためリード獲得AI（discover）やAI連携（MCP）から呼べなかった。
// 拠点の代表がAIで発掘→送付まで回すようになったので、ここへ出して共通化する。
//
// ⚠️ 推測はしない。ドメインから info@ を組み立てるようなことはしない。
//    宛先不明が増えると adarch.co.jp 全体の到達率が落ちる。
//
// 「営業お断り」はグループ共通の送付禁止リスト（auto_sales_blacklist）へ。
// 一度誰かが見つけたら、全拠点で二度と送られない。
// ---------------------------------------------------------------

import { db } from "@/lib/db";
import { scanSite } from "@/lib/no-solicitation";
import { normalizeDomain } from "@/lib/auto-sales-domain";

/** 1回の実行で見に行く上限。多すぎると画面が待たされるので分割してもらう。 */
export const ENRICH_MAX_PER_RUN = 40;
/** 同時に開くサイト数。相手先にもこちらにも負荷をかけない程度に抑える。 */
const CONCURRENCY = 4;

export type EnrichResult = {
  /** 実際にサイトを見に行った件数 */
  checked: number;
  /** メールが見つかって保存できた件数 */
  found: number;
  /** 営業お断りだった件数（送付禁止リストに登録・リードは除外済み） */
  blocked: number;
  /** サイトは見たが記載が無かった件数 */
  notFound: number;
  /** サイトを開けなかった件数 */
  unreachable: number;
  /** Webサイト未登録・取得済みなどで飛ばした件数 */
  skipped: number;
  /** 上限で残った件数 */
  remaining: number;
  /** お断りだった会社（名前）。呼び出し元がそのまま人に見せる */
  blockedNames: string[];
};

/** 配列を n 件ずつ並行で処理する（Promise.all で一気に開かないための簡易プール） */
async function pool<T>(items: T[], n: number, fn: (item: T) => Promise<void>): Promise<void> {
  let i = 0;
  const workers = Array.from({ length: Math.min(n, items.length) }, async () => {
    while (i < items.length) {
      const item = items[i++];
      await fn(item);
    }
  });
  await Promise.all(workers);
}

/**
 * リードのサイトを見て、メールを埋め、営業お断りを全社リストへ落とす。
 * 権限の確認は呼び出し側で行う（画面＝MANAGER以上／AI連携＝本人の権限）。
 */
export async function enrichLeads(
  ids: string[],
  opts?: { recheck?: boolean; staffName?: string }
): Promise<EnrichResult> {
  const empty: EnrichResult = { checked: 0, found: 0, blocked: 0, notFound: 0, unreachable: 0, skipped: 0, remaining: 0, blockedNames: [] };
  if (!ids.length) return empty;

  const recheck = opts?.recheck === true;
  const staffName = opts?.staffName ?? "OS";

  const leads = await db.lead.findMany({
    where: { id: { in: ids } },
    select: { id: true, name: true, websiteUrl: true, email: true, emailCheckedAt: true },
  });

  // 見に行く必要があるものだけ残す
  const targets = leads.filter((l) => {
    if (!l.websiteUrl?.trim()) return false;      // サイトが無ければ探しようがない
    if (l.email) return false;                    // 既にあるものは上書きしない
    if (l.emailCheckedAt && !recheck) return false; // 一度探して見つからなかったものは飛ばす
    return true;
  });

  const skipped = leads.length - targets.length;
  const batch = targets.slice(0, ENRICH_MAX_PER_RUN);
  const remaining = targets.length - batch.length;

  let found = 0;
  let blocked = 0;
  let notFound = 0;
  let unreachable = 0;
  const blockedNames: string[] = [];

  await pool(batch, CONCURRENCY, async (lead) => {
    const scan = await scanSite(lead.websiteUrl!);

    if (!scan.reachable) {
      unreachable++;
      // 開けなかっただけなので確認済みにはしない。次回また試せるようにしておく。
      return;
    }

    if (scan.blocked) {
      blocked++;
      blockedNames.push(lead.name);
      const domain = normalizeDomain(lead.websiteUrl!);
      if (domain) {
        // グループ共通の送付禁止リストへ。以後どの拠点からも送れない。
        await db.autoSalesBlacklist.upsert({
          where: { domain },
          create: {
            domain,
            companyName: lead.name,
            reason: `営業お断りの記載を検出（${scan.blocked.where}）: 「${scan.blocked.phrase}」`,
          },
          update: {},
        });
      }
      // 断っている会社の宛先は保存しない。持っていると、いつか送れてしまう。
      // リードも作業一覧から外す（人が毎回サイトを見て判断し直さなくていいように）。
      await db.lead.update({
        where: { id: lead.id },
        data: { emailCheckedAt: new Date(), status: "SKIPPED" },
      });
      await db.leadLog.create({
        data: {
          leadId: lead.id,
          action: "STATUS_CHANGED",
          detail: `[AI記録] 営業お断りの記載を検出（${scan.blocked.where}）: 「${scan.blocked.phrase}」→ 対象外。全社の送付禁止リストにも登録`,
          staffName,
        },
      });
      return;
    }

    if (scan.emails.length > 0) {
      found++;
      await db.lead.update({
        where: { id: lead.id },
        data: { email: scan.emails[0], emailCheckedAt: new Date() },
      });
    } else {
      notFound++;
      await db.lead.update({
        where: { id: lead.id },
        data: { emailCheckedAt: new Date() },
      });
    }
  });

  return { checked: batch.length, found, blocked, notFound, unreachable, skipped, remaining, blockedNames };
}
