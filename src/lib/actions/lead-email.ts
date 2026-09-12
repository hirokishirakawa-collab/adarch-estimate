"use server";

import { revalidatePath } from "next/cache";
import { getSessionInfo } from "@/lib/session";
import { enrichLeads } from "@/lib/leads/enrich";

/**
 * リードのメールアドレスをサイトから取得する（画面のボタン）。
 *
 * 中身は lib/leads/enrich.ts に出してある。リード獲得AI・AI連携（MCP）からも
 * 同じ処理を呼ぶため（2026-09-13）。ここは権限の確認と画面の更新だけ。
 *
 * 巡回のついでに「営業お断り」も判定する。同じページを取りに行くので追加の負荷はない。
 * 断りが見つかった会社はグループ共通の送付禁止リストに載せ、メールは返さない。
 */

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

export async function findEmailsForLeads(
  ids: string[],
  opts?: { recheck?: boolean }
): Promise<LeadEmailResult> {
  const info = await requireUser();
  if (!info) return { error: "権限がありません" };
  if (!ids.length) return { checked: 0 };

  const r = await enrichLeads(ids, { recheck: opts?.recheck, staffName: info.staffName });

  revalidatePath("/dashboard/leads/list");
  return { checked: r.checked, found: r.found, blocked: r.blocked, notFound: r.notFound, unreachable: r.unreachable, skipped: r.skipped, remaining: r.remaining };
}
