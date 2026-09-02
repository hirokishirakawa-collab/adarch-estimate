import { db } from "@/lib/db";

// ----------------------------------------------------------------
// 声かけ解放ルール
//
// 加盟店が一般企業に動画制作・広告媒体を売り込むための営業リード（通常リード）。
// 「連絡済み（声かけ済み）」のまま商談（アポ/商談化）に至らず、一定日数 動きが
// ないものは、担当を自動で外して別の代表が声かけできる状態（未アサイン）に戻す。
//
// - 対象: status = CALLED（連絡済み）/ 担当あり / TVerプール以外
// - 解放: assigneeId = null（リード自体は残す。削除ではない）
// - UNTOUCHED（未声かけ）や APPOINTMENT/DEAL_CONVERTED（前進済み）は対象外
// ----------------------------------------------------------------

/** 声かけ済み（連絡済み）後この日数 動きがなければ解放する */
export const RELEASE_AFTER_DAYS = 60;
/** 担当を取ったまま一度も声かけしない（未対応）場合に解放する日数。
 *  取って放置は声かけ済みより悪質なので短く設定。 */
export const RELEASE_UNTOUCHED_AFTER_DAYS = 14;

// ----------------------------------------------------------------
// 取得の蓋
//
// 「取るだけ取って声をかけない」を止めるための上限。
// 未送付のまま担当付きで抱えている未対応リードがこの件数以上ある人は、
// 新しい検索結果を保存できない（送るか解放して在庫を空けてから取る）。
// 対象の入口: 店舗検索 / BtoB / シネマ / 採用検索 / CSV取込。
// TVerプールの先着claimは「案件を取りに行く行為」なので対象外。
// ----------------------------------------------------------------

/** 未送付の担当付きリードがこの件数以上なら新規保存を止める */
export const SAVE_CAP_UNSENT = 100;

/** 取得の蓋にかかったときのメッセージ（各入口で共通） */
export function saveCapMessage(unsent: number): string {
  return `未送付のリードが${unsent}件あります（上限${SAVE_CAP_UNSENT}件）。営業フォームで送るか、担当を外して在庫を空けてから取得してください。`;
}

/**
 * 取得の蓋の判定。
 * 自分が担当で、未対応（UNTOUCHED）のまま一度も送っていないリードを数える。
 * 上限に達していれば { blocked: true, message } を返す。
 */
export async function checkSaveCap(
  userId: string,
): Promise<{ blocked: boolean; unsent: number; message?: string }> {
  const unsent = await db.lead.count({
    where: {
      assigneeId: userId,
      status: "UNTOUCHED",
      sentAt: null,
      source: { not: "PR_TIMES_TVCM" },
    },
  });
  if (unsent >= SAVE_CAP_UNSENT) {
    return { blocked: true, unsent, message: saveCapMessage(unsent) };
  }
  return { blocked: false, unsent };
}

// 解放ルール: 状態ごとに「動きなし」とみなす日数を変える。
// 解放後も status 自体は変えない（連絡済み/未対応の別が一覧で分かる）。
const RELEASE_RULES: Array<{ status: "CALLED" | "UNTOUCHED"; days: number }> = [
  { status: "CALLED", days: RELEASE_AFTER_DAYS },
  { status: "UNTOUCHED", days: RELEASE_UNTOUCHED_AFTER_DAYS },
];

/**
 * 動きのない担当付きリードを自動解放する。
 * - 連絡済み（声かけ済み）: {@link RELEASE_AFTER_DAYS} 日 動きなし
 * - 未対応（声かけ未着手）: {@link RELEASE_UNTOUCHED_AFTER_DAYS} 日 動きなし
 * 解放時に直前の担当者名を releasedFromName に残し、次の代表が
 * 「過去に誰が担当していたか」を把握できるようにする。
 * 解放した合計件数を返す（0件のときは何もしない＝安価）。
 *
 * 担当者ごとにまとめて updateMany するため軽量。初回以降は対象が少ない。
 */
export async function releaseStaleAssignedLeads(): Promise<number> {
  let total = 0;

  for (const rule of RELEASE_RULES) {
    const threshold = new Date(Date.now() - rule.days * 24 * 60 * 60 * 1000);

    const stale = await db.lead.findMany({
      where: {
        status: rule.status,
        assigneeId: { not: null },
        updatedAt: { lt: threshold },
        source: { not: "PR_TIMES_TVCM" },
      },
      select: {
        id: true,
        assignee: { select: { id: true, name: true, email: true } },
      },
    });
    if (stale.length === 0) continue;

    // 担当者ごとにリードIDをまとめる（解放後も担当者名をタグとして残すため）
    const byAssignee = new Map<string, { name: string; ids: string[] }>();
    for (const l of stale) {
      if (!l.assignee) continue;
      const g = byAssignee.get(l.assignee.id) ?? {
        name: l.assignee.name ?? l.assignee.email ?? "不明",
        ids: [],
      };
      g.ids.push(l.id);
      byAssignee.set(l.assignee.id, g);
    }

    const releasedAt = new Date();
    for (const { name, ids } of byAssignee.values()) {
      const r = await db.lead.updateMany({
        where: { id: { in: ids } },
        data: { assigneeId: null, releasedFromName: name, releasedAt },
      });
      total += r.count;
    }
  }

  return total;
}
