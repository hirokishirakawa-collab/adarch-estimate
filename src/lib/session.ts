import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import type { UserRole } from "@/types/roles";

/**
 * 共通セッション情報取得ユーティリティ
 * Google OAuth ログイン時に users テーブルへ upsert して userId を必ず確保する
 * role / branchId / branchId2 は DB の値を使用（管理者が設定した値を尊重）
 */
export async function getSessionInfo() {
  const session = await auth();
  if (!session?.user) return null;

  const email   = session.user.email ?? "";
  const jwtRole = (session.user.role ?? "MANAGER") as UserRole;

  const dbRole: "ADMIN" | "MANAGER" | "USER" =
    jwtRole === "ADMIN" ? "ADMIN" : jwtRole === "MANAGER" ? "MANAGER" : "USER";

  // 事前登録済みユーザー: update: {} で管理者設定を保持
  // 初回ログインユーザー: create で新規作成（branchId/branchId2 は未割当）
  const user = await db.user.upsert({
    where:  { email },
    update: {},
    create: {
      email,
      name:     session.user.name ?? email,
      role:     dbRole,
      branchId:  null,
      branchId2: null,
    },
    select: { id: true, name: true, role: true, branchId: true, branchId2: true },
  });

  const role      = user.role as UserRole;
  const branchId  = user.branchId  ?? null;
  const branchId2 = user.branchId2 ?? null;

  return { role, email, branchId, branchId2, userId: user.id, staffName: user.name ?? email };
}

// ---------------------------------------------------------------
// 拠点フィルタヘルパー
// ADMIN: フィルタなし
// 非ADMIN: branchId / branchId2 の IN 句
// ---------------------------------------------------------------
type SessionInfo = NonNullable<Awaited<ReturnType<typeof getSessionInfo>>>;

export function getBranchFilter(info: Pick<SessionInfo, "role" | "branchId" | "branchId2">) {
  if (info.role === "ADMIN") return {};
  const ids = [info.branchId, info.branchId2].filter((id): id is string => !!id);
  if (ids.length === 0) return { branchId: "__unassigned__" }; // 何もヒットしない
  if (ids.length === 1) return { branchId: ids[0] };
  return { branchId: { in: ids } };
}
