"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import type { UserRole } from "@/types/roles";
import { PROFILE_FIELDS } from "@/lib/constants/group-profile";

// ---------------------------------------------------------------
// 共通 select（DRY）
// ---------------------------------------------------------------
const PROFILE_SELECT = {
  id: true,
  name: true,
  ownerName: true,
  chatSpaceId: true,
  genre: true,
  specialty: true,
  workHistory: true,
  prefecture: true,
  bio: true,
  twitterUrl: true,
  instagramUrl: true,
  facebookUrl: true,
  lineId: true,
  youtubeUrl: true,
  tiktokUrl: true,
  websiteUrl: true,
} as const;

// ---------------------------------------------------------------
// 共通: セッション取得
// ---------------------------------------------------------------
async function requireSession() {
  const session = await auth();
  if (!session?.user?.email) redirect("/login");
  const role = (session.user.role ?? "USER") as UserRole;
  return { email: session.user.email, role };
}

// ---------------------------------------------------------------
// 全アクティブ企業のプロフィール一覧
// ---------------------------------------------------------------
export async function getProfiles() {
  await requireSession();
  try {
    return db.groupCompany.findMany({
      where: { isActive: true },
      select: PROFILE_SELECT,
      orderBy: { name: "asc" },
    });
  } catch (e) {
    console.error("[getProfiles] DB error:", e instanceof Error ? e.message : e);
    return [];
  }
}

// ---------------------------------------------------------------
// 単一プロフィール取得
// ---------------------------------------------------------------
export async function getProfileById(id: string) {
  await requireSession();
  try {
    return db.groupCompany.findUnique({
      where: { id },
      select: { ...PROFILE_SELECT, isActive: true },
    });
  } catch (e) {
    console.error("[getProfileById] DB error:", e instanceof Error ? e.message : e);
    return null;
  }
}

// ---------------------------------------------------------------
// ログインユーザーの紐付け GroupCompany 取得
// ---------------------------------------------------------------
export async function getMyGroupCompany() {
  const { email } = await requireSession();
  try {
    const user = await db.user.findUnique({
      where: { email },
      select: { groupCompanyId: true },
    });
    if (!user?.groupCompanyId) return null;
    return db.groupCompany.findUnique({
      where: { id: user.groupCompanyId },
      select: PROFILE_SELECT,
    });
  } catch (e) {
    console.error("[getMyGroupCompany] DB error:", e instanceof Error ? e.message : e);
    return null;
  }
}

// ---------------------------------------------------------------
// FormData → プロフィールデータ変換
// ---------------------------------------------------------------
function extractProfileData(formData: FormData) {
  const data: Record<string, string | null> = {};
  for (const field of PROFILE_FIELDS) {
    const val = (formData.get(field) as string)?.trim() || null;
    data[field] = val;
  }
  return data;
}

// ---------------------------------------------------------------
// 自分のプロフィール更新
// ---------------------------------------------------------------
export async function updateProfile(
  _prev: { error?: string; success?: boolean } | null,
  formData: FormData,
): Promise<{ error?: string; success?: boolean }> {
  const { email } = await requireSession();

  const user = await db.user.findUnique({
    where: { email },
    select: { groupCompanyId: true },
  });
  if (!user?.groupCompanyId) {
    return { error: "グループ企業が紐付けされていません。管理者にお問い合わせください。" };
  }

  const data = extractProfileData(formData);

  try {
    await db.groupCompany.update({
      where: { id: user.groupCompanyId },
      data,
    });
  } catch (e) {
    console.error("[updateProfile] DB error:", e instanceof Error ? e.message : e);
    return { error: "更新に失敗しました" };
  }

  revalidatePath("/dashboard/group-profiles");
  return { success: true };
}

// ---------------------------------------------------------------
// ADMIN 代理編集
// ---------------------------------------------------------------
export async function adminUpdateProfile(
  companyId: string,
  _prev: { error?: string; success?: boolean } | null,
  formData: FormData,
): Promise<{ error?: string; success?: boolean }> {
  const { role } = await requireSession();
  if (role !== "ADMIN") return { error: "権限がありません" };

  const data = extractProfileData(formData);

  try {
    await db.groupCompany.update({
      where: { id: companyId },
      data,
    });
  } catch (e) {
    console.error("[adminUpdateProfile] DB error:", e instanceof Error ? e.message : e);
    return { error: "更新に失敗しました" };
  }

  revalidatePath("/dashboard/group-profiles");
  return { success: true };
}

// ---------------------------------------------------------------
// ADMIN プロフィール情報クリア
// ---------------------------------------------------------------
export async function adminDeleteProfile(
  companyId: string,
): Promise<{ error?: string; success?: boolean }> {
  const { role } = await requireSession();
  if (role !== "ADMIN") return { error: "権限がありません" };

  const clearData: Record<string, null> = {};
  for (const field of PROFILE_FIELDS) {
    clearData[field] = null;
  }

  try {
    await db.groupCompany.update({
      where: { id: companyId },
      data: clearData,
    });
  } catch (e) {
    console.error("[adminDeleteProfile] DB error:", e instanceof Error ? e.message : e);
    return { error: "削除に失敗しました" };
  }

  revalidatePath("/dashboard/group-profiles");
  return { success: true };
}
