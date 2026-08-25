// ==============================================================
// LINEアカウントの閲覧・操作権限
//   ADMIN（本部）: 本部アカウント（branchId=null）はフル操作。
//                  拠点アカウントは「接続状況と件数」だけ（会話・友だち名は見ない）。
//   MANAGER/USER : 自拠点のアカウントのみフル操作。
// ==============================================================

import { db } from "@/lib/db";
import { getSessionInfo, getBranchFilter } from "@/lib/session";
import type { Prisma } from "@/generated/prisma/client";

export type SessionInfo = NonNullable<Awaited<ReturnType<typeof getSessionInfo>>>;

/** 自分がフル操作できるアカウントの where 句 */
export function manageableWhere(info: SessionInfo): Prisma.LineAccountWhereInput {
  if (info.role === "ADMIN") return { branchId: null };
  return getBranchFilter(info) as Prisma.LineAccountWhereInput;
}

export async function requireSession(): Promise<SessionInfo> {
  const info = await getSessionInfo();
  if (!info) throw new Error("ログインが必要です");
  return info;
}

/** フル操作できるアカウントを1件取得（権限がなければ null） */
export async function getManageableAccount(info: SessionInfo, accountId: string) {
  return db.lineAccount.findFirst({ where: { id: accountId, ...manageableWhere(info) } });
}

/** 新規アカウントを作るときの branchId（ADMIN=本部=null／それ以外=主担当拠点） */
export function branchIdForNewAccount(info: SessionInfo): string | null | undefined {
  if (info.role === "ADMIN") return null;
  return info.branchId ?? undefined; // undefined = 拠点未割当で作れない
}
