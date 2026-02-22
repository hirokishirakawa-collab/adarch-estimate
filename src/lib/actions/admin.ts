"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import type { UserRole } from "@/types/roles";

// ---------------------------------------------------------------
// 共通: ADMIN セッション確認
// ADMIN 以外は /dashboard にリダイレクト
// ---------------------------------------------------------------
async function requireAdmin() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const role = (session.user.role ?? "USER") as UserRole;
  if (role !== "ADMIN") redirect("/dashboard");
  return { callerEmail: session.user.email ?? "" };
}

// ---------------------------------------------------------------
// 全ユーザー一覧取得（ADMIN 専用）
// ---------------------------------------------------------------
export async function getAdminUserList() {
  await requireAdmin();
  try {
    return db.user.findMany({
      orderBy: { createdAt: "asc" },
      include: { branch: { select: { name: true } } },
    });
  } catch (e) {
    console.error("[getAdminUserList] DB error:", e instanceof Error ? e.message : e);
    return [];
  }
}

// ---------------------------------------------------------------
// ロール変更（ADMIN 専用）
// 自分自身のロールは変更不可（ロックアウト防止）
// ---------------------------------------------------------------
export async function updateUserRole(
  userId: string,
  _prev: { error?: string; success?: boolean } | null,
  formData: FormData
): Promise<{ error?: string; success?: boolean }> {
  const { callerEmail } = await requireAdmin();

  const newRole = (formData.get("role") as string)?.trim();
  if (!newRole || !["ADMIN", "MANAGER", "USER"].includes(newRole)) {
    return { error: "無効なロールです" };
  }

  // 変更対象ユーザーを取得
  const target = await db.user.findUnique({
    where: { id: userId },
    select: { email: true, role: true },
  });
  if (!target) return { error: "ユーザーが見つかりません" };

  // 自分自身のロールは変更不可
  if (target.email === callerEmail) {
    return { error: "自分自身のロールは変更できません" };
  }

  try {
    await db.user.update({
      where: { id: userId },
      data: { role: newRole as "ADMIN" | "MANAGER" | "USER" },
    });
  } catch (e) {
    console.error("[updateUserRole] DB error:", e instanceof Error ? e.message : e);
    return { error: "更新に失敗しました" };
  }

  revalidatePath("/dashboard/admin/users");
  return { success: true };
}
