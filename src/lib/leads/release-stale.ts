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

/** 声かけ後この日数 動きがなければ解放する */
export const RELEASE_AFTER_DAYS = 60;

/**
 * 動きのない声かけ済みリードの担当を自動解放する。
 * 解放時に直前の担当者名を releasedFromName に残し、次の代表が
 * 「過去に誰が声かけ済みか」を把握できるようにする。
 * 解放した件数を返す（0件のときは何もしない＝安価）。
 *
 * 担当者ごとにまとめて updateMany するため、クエリ数は
 * （対象担当者の人数＋1）で済む。初回以降は対象が少なく軽量。
 */
export async function releaseStaleAssignedLeads(): Promise<number> {
  const threshold = new Date(
    Date.now() - RELEASE_AFTER_DAYS * 24 * 60 * 60 * 1000
  );

  const stale = await db.lead.findMany({
    where: {
      status: "CALLED",
      assigneeId: { not: null },
      updatedAt: { lt: threshold },
      source: { not: "PR_TIMES_TVCM" },
    },
    select: {
      id: true,
      assignee: { select: { id: true, name: true, email: true } },
    },
  });
  if (stale.length === 0) return 0;

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
  let total = 0;
  for (const { name, ids } of byAssignee.values()) {
    const r = await db.lead.updateMany({
      where: { id: { in: ids } },
      data: { assigneeId: null, releasedFromName: name, releasedAt },
    });
    total += r.count;
  }

  return total;
}
