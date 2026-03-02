import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import type { UserRole } from "@/types/roles";

/**
 * 共通セッション情報取得ユーティリティ
 * Google OAuth ログイン時に users テーブルへ upsert して userId を必ず確保する
 * role / branchId は DB の値を使用（管理者が設定した値を尊重）
 */
export async function getSessionInfo() {
  const session = await auth();
  if (!session?.user) return null;

  const email   = session.user.email ?? "";
  const jwtRole = (session.user.role ?? "MANAGER") as UserRole;

  const dbRole: "ADMIN" | "MANAGER" | "USER" =
    jwtRole === "ADMIN" ? "ADMIN" : jwtRole === "MANAGER" ? "MANAGER" : "USER";

  // 事前登録済みユーザー: update: {} で管理者設定を保持
  // 初回ログインユーザー: create で新規作成（branchId は未割当）
  const user = await db.user.upsert({
    where:  { email },
    update: {},
    create: {
      email,
      name:     session.user.name ?? email,
      role:     dbRole,
      branchId: null,
    },
    select: { id: true, name: true, role: true, branchId: true },
  });

  const role     = user.role as UserRole;
  const branchId = user.branchId ?? null;

  return { role, email, branchId, userId: user.id, staffName: user.name ?? email };
}
