"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import type { UserRole } from "@/types/roles";
import { logAudit } from "@/lib/audit";

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
      include: {
        branch:  { select: { name: true } },
        branch2: { select: { name: true } },
      },
    });
  } catch (e) {
    console.error("[getAdminUserList] DB error:", e instanceof Error ? e.message : e);
    return [];
  }
}

// ---------------------------------------------------------------
// メンバー事前登録（ADMIN 専用）
// ログイン前にメールアドレス・名前・ロール・拠点を登録できる
// 既存ユーザーの場合は上書き更新
// ---------------------------------------------------------------
export async function registerMember(
  _prev: { error?: string; success?: boolean } | null,
  formData: FormData
): Promise<{ error?: string; success?: boolean }> {
  const { callerEmail } = await requireAdmin();

  const email     = (formData.get("email")     as string)?.trim().toLowerCase();
  const name      = (formData.get("name")      as string)?.trim() || null;
  const role      = (formData.get("role")      as string)?.trim();
  const branchId  = (formData.get("branchId")  as string)?.trim() || null;
  const branchId2 = (formData.get("branchId2") as string)?.trim() || null;

  if (!email) return { error: "メールアドレスは必須です" };

  const allowedDomain = process.env.ALLOWED_DOMAIN ?? "adarch.co.jp";
  const domain = email.split("@")[1]?.toLowerCase();
  if (domain !== allowedDomain) {
    return { error: `${allowedDomain} ドメインのアドレスのみ登録できます` };
  }

  if (!role || !["ADMIN", "MANAGER", "USER"].includes(role)) {
    return { error: "無効なロールです" };
  }

  try {
    await db.user.upsert({
      where:  { email },
      update: { name: name ?? undefined, role: role as "ADMIN" | "MANAGER" | "USER", branchId, branchId2 },
      create: { email, name, role: role as "ADMIN" | "MANAGER" | "USER", branchId, branchId2 },
    });
    logAudit({ action: "member_registered", email: callerEmail, entity: "user", detail: `${email} (${role})` });
  } catch (e) {
    console.error("[registerMember] DB error:", e instanceof Error ? e.message : e);
    return { error: "登録に失敗しました" };
  }

  revalidatePath("/dashboard/admin/users");
  return { success: true };
}

// ---------------------------------------------------------------
// 名前・拠点更新（ADMIN 専用）
// ---------------------------------------------------------------
export async function updateUserInfo(
  userId: string,
  _prev: { error?: string; success?: boolean } | null,
  formData: FormData
): Promise<{ error?: string; success?: boolean }> {
  const { callerEmail } = await requireAdmin();

  const name      = (formData.get("name")      as string)?.trim() || null;
  const branchId  = (formData.get("branchId")  as string)?.trim() || null;
  const branchId2 = (formData.get("branchId2") as string)?.trim() || null;

  try {
    await db.user.update({
      where: { id: userId },
      data:  { name, branchId, branchId2 },
    });
    logAudit({ action: "user_updated", email: callerEmail, entity: "user", entityId: userId, detail: name });
  } catch (e) {
    console.error("[updateUserInfo] DB error:", e instanceof Error ? e.message : e);
    return { error: "更新に失敗しました" };
  }

  revalidatePath("/dashboard/admin/users");
  return { success: true };
}

// ---------------------------------------------------------------
// ユーザー削除（ADMIN 専用）
// 自分自身は削除不可
// ---------------------------------------------------------------
export async function deleteUser(
  userId: string,
  _prev: { error?: string; success?: boolean } | null,
  _formData: FormData
): Promise<{ error?: string; success?: boolean }> {
  const { callerEmail } = await requireAdmin();

  const target = await db.user.findUnique({
    where: { id: userId },
    select: { email: true },
  });
  if (!target) return { error: "ユーザーが見つかりません" };
  if (target.email === callerEmail) return { error: "自分自身は削除できません" };

  try {
    await db.user.delete({ where: { id: userId } });
    logAudit({ action: "user_deleted", email: callerEmail, entity: "user", entityId: userId, detail: target.email });
  } catch (e) {
    console.error("[deleteUser] DB error:", e instanceof Error ? e.message : e);
    return { error: "削除に失敗しました" };
  }

  revalidatePath("/dashboard/admin/users");
  return { success: true };
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
    logAudit({ action: "user_role_updated", email: callerEmail, entity: "user", entityId: userId, detail: `${target.role} → ${newRole}` });
  } catch (e) {
    console.error("[updateUserRole] DB error:", e instanceof Error ? e.message : e);
    return { error: "更新に失敗しました" };
  }

  revalidatePath("/dashboard/admin/users");
  return { success: true };
}
