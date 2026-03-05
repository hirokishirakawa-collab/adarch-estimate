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
  emoji: true,
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
// 全アクティブ企業のプロフィール一覧（業務活動が新しい順）
// 顧客・商談・プロジェクトの updatedAt を横断して最新を算出
// ---------------------------------------------------------------
export async function getProfiles() {
  await requireSession();
  try {
    const companies = await db.groupCompany.findMany({
      where: { isActive: true },
      select: {
        ...PROFILE_SELECT,
        linkedUsers: {
          select: { branchId: true, branchId2: true },
        },
      },
    });

    const allBranchIds = [
      ...new Set(
        companies.flatMap((c) =>
          c.linkedUsers.flatMap((u) => [u.branchId, u.branchId2]).filter(Boolean) as string[]
        )
      ),
    ];

    // 顧客・商談・プロジェクトの最新 updatedAt を一括取得
    const [latestCustomers, latestDeals, latestProjects] = allBranchIds.length > 0
      ? await Promise.all([
          db.customer.groupBy({
            by: ["branchId"],
            where: { branchId: { in: allBranchIds } },
            _max: { updatedAt: true },
          }),
          db.deal.groupBy({
            by: ["branchId"],
            where: { branchId: { in: allBranchIds } },
            _max: { updatedAt: true },
          }),
          db.project.groupBy({
            by: ["branchId"],
            where: { branchId: { in: allBranchIds } },
            _max: { updatedAt: true },
          }),
        ])
      : [[], [], []];

    // branchId → 最新日のマップを統合
    const branchLatest = new Map<string, Date>();
    for (const list of [latestCustomers, latestDeals, latestProjects]) {
      for (const row of list) {
        const d = row._max.updatedAt;
        if (!d) continue;
        const prev = branchLatest.get(row.branchId);
        if (!prev || d.getTime() > prev.getTime()) {
          branchLatest.set(row.branchId, d);
        }
      }
    }

    const withLatest = companies.map((c) => {
      const branchIds = c.linkedUsers
        .flatMap((u) => [u.branchId, u.branchId2])
        .filter(Boolean) as string[];
      const dates = branchIds
        .map((bid) => branchLatest.get(bid))
        .filter(Boolean) as Date[];
      const latestAt = dates.length > 0
        ? new Date(Math.max(...dates.map((d) => d.getTime())))
        : null;
      const { linkedUsers: _, ...profile } = c;
      return { ...profile, latestActivityAt: latestAt };
    });

    // 活動が新しい順、活動なしは末尾（名前順）
    withLatest.sort((a, b) => {
      if (a.latestActivityAt && b.latestActivityAt) {
        return b.latestActivityAt.getTime() - a.latestActivityAt.getTime();
      }
      if (a.latestActivityAt) return -1;
      if (b.latestActivityAt) return 1;
      return a.name.localeCompare(b.name, "ja");
    });

    return withLatest;
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
// プロフィールに紐づくプロジェクト一覧
// GroupCompany → linkedUsers → branch → projects
// ---------------------------------------------------------------
export async function getProfileProjects(groupCompanyId: string) {
  await requireSession();
  try {
    // この GroupCompany に紐づくユーザーの branchId を取得
    const users = await db.user.findMany({
      where: { groupCompanyId },
      select: { branchId: true, branchId2: true },
    });
    const branchIds = [
      ...new Set(
        users.flatMap((u) => [u.branchId, u.branchId2]).filter(Boolean) as string[]
      ),
    ];
    if (branchIds.length === 0) return [];

    return db.project.findMany({
      where: { branchId: { in: branchIds } },
      select: {
        id: true,
        title: true,
        status: true,
        budget: true,
        customer: { select: { name: true } },
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    });
  } catch (e) {
    console.error("[getProfileProjects] DB error:", e instanceof Error ? e.message : e);
    return [];
  }
}

// ---------------------------------------------------------------
// プロフィールに紐づく顧客企業一覧
// GroupCompany → linkedUsers → branch → customers
// ---------------------------------------------------------------
export async function getProfileCustomers(groupCompanyId: string) {
  await requireSession();
  try {
    const users = await db.user.findMany({
      where: { groupCompanyId },
      select: { branchId: true, branchId2: true },
    });
    const branchIds = [
      ...new Set(
        users.flatMap((u) => [u.branchId, u.branchId2]).filter(Boolean) as string[]
      ),
    ];
    if (branchIds.length === 0) return [];

    return db.customer.findMany({
      where: { branchId: { in: branchIds } },
      select: {
        id: true,
        name: true,
        status: true,
        rank: true,
        industry: true,
        prefecture: true,
      },
      orderBy: { updatedAt: "desc" },
    });
  } catch (e) {
    console.error("[getProfileCustomers] DB error:", e instanceof Error ? e.message : e);
    return [];
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
