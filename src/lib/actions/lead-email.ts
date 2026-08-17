"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getSessionInfo } from "@/lib/session";
import { scanSite } from "@/lib/no-solicitation";
import { normalizeDomain } from "@/lib/auto-sales-domain";

/**
 * リードのメールアドレスをサイトから取得する。
 *
 * リード獲得AI（Google Places）はメールアドレスを返さない。電話と住所しか無いので、
 * これまではアウトリーチに移してから1件ずつ手で調べていた。ここでまとめて埋める。
 *
 * ⚠️ 推測はしない。
 *   ドメインから info@ を組み立てるようなことはしない。宛先不明が増えると
 *   adarch.co.jp 全体の到達率が落ちて、まともに送った分まで迷惑メールに入る。
 *
 * 巡回のついでに「営業お断り」も判定する。同じページを取りに行くので追加の負荷はない。
 * 断りが見つかった会社はグループ共通の送付禁止リストに載せ、メールは返さない。
 */

/** 1回の実行で見に行く上限。多すぎると画面が待たされるので分割してもらう。 */
const MAX_PER_RUN = 40;
/** 同時に開くサイト数。相手先にもこちらにも負荷をかけない程度に抑える。 */
const CONCURRENCY = 4;

export type LeadEmailResult = {
  error?: string;
  /** 実際にサイトを見に行った件数 */
  checked?: number;
  /** メールが見つかって保存できた件数 */
  found?: number;
  /** 営業お断りだった件数（送付禁止リストに登録済み） */
  blocked?: number;
  /** サイトは見たが記載が無かった件数 */
  notFound?: number;
  /** サイトを開けなかった件数 */
  unreachable?: number;
  /** Webサイト未登録・取得済みなどで飛ばした件数 */
  skipped?: number;
  /** 上限で残った件数 */
  remaining?: number;
};

/**
 * 相手サイトへ外向きの通信を出し、全社共通の送付禁止リストにも書き込む操作なので、
 * 加盟代表（MANAGER）と本部（ADMIN）に限る。lib/actions/no-solicitation.ts と同じ線。
 *
 * 拠点での絞り込みはしない。リードはグループ共通の母集団で、声かけ解放で
 * よその代表が引き取る前提のため（一覧のクエリにも拠点フィルタは無い）。
 */
async function requireUser() {
  const info = await getSessionInfo();
  if (!info) return null;
  if (info.role !== "ADMIN" && info.role !== "MANAGER") return null;
  return info;
}

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

export async function findEmailsForLeads(
  ids: string[],
  opts?: { recheck?: boolean }
): Promise<LeadEmailResult> {
  const info = await requireUser();
  if (!info) return { error: "権限がありません" };
  if (!ids.length) return { checked: 0 };

  const recheck = opts?.recheck === true;

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
  const batch = targets.slice(0, MAX_PER_RUN);
  const remaining = targets.length - batch.length;

  let found = 0;
  let blocked = 0;
  let notFound = 0;
  let unreachable = 0;

  await pool(batch, CONCURRENCY, async (lead) => {
    const scan = await scanSite(lead.websiteUrl!);

    if (!scan.reachable) {
      unreachable++;
      // 開けなかっただけなので確認済みにはしない。次回また試せるようにしておく。
      return;
    }

    if (scan.blocked) {
      blocked++;
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
      await db.lead.update({
        where: { id: lead.id },
        data: { emailCheckedAt: new Date() },
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

  revalidatePath("/dashboard/leads/list");
  return { checked: batch.length, found, blocked, notFound, unreachable, skipped, remaining };
}
