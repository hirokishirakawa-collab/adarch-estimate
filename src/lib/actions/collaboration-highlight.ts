"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import type { UserRole } from "@/types/roles";

// ---------------------------------------------------------------
// 共通: セッション取得
// ---------------------------------------------------------------
async function requireSession() {
  const session = await auth();
  if (!session?.user?.email) redirect("/login");
  const role = (session.user.role ?? "USER") as UserRole;
  return { email: session.user.email, role };
}

function requireAdmin(role: UserRole) {
  if (role !== "ADMIN") {
    return { error: "権限がありません" };
  }
  return null;
}

// ---------------------------------------------------------------
// include 定義（DRY）
// ---------------------------------------------------------------
const HIGHLIGHT_INCLUDE = {
  members: {
    include: {
      groupCompany: {
        select: { id: true, name: true, ownerName: true, emoji: true },
      },
    },
  },
} as const;

// ---------------------------------------------------------------
// 全アクティブハイライト取得（一覧ページ用）
// ---------------------------------------------------------------
export async function getActiveHighlights() {
  await requireSession();
  try {
    return await db.collaborationHighlight.findMany({
      where: { isActive: true },
      include: HIGHLIGHT_INCLUDE,
      orderBy: { createdAt: "desc" },
    });
  } catch (e) {
    console.error("getActiveHighlights error:", e);
    return [];
  }
}

// ---------------------------------------------------------------
// 特定企業のハイライト取得（詳細ページ用）
// ---------------------------------------------------------------
export async function getHighlightsForCompany(groupCompanyId: string) {
  await requireSession();
  try {
    return await db.collaborationHighlight.findMany({
      where: {
        isActive: true,
        members: { some: { groupCompanyId } },
      },
      include: HIGHLIGHT_INCLUDE,
      orderBy: { createdAt: "desc" },
    });
  } catch (e) {
    console.error("getHighlightsForCompany error:", e);
    return [];
  }
}

// ---------------------------------------------------------------
// ADMIN: 全ハイライト取得（管理ページ用、非アクティブ含む）
// ---------------------------------------------------------------
export async function getAllHighlights() {
  const { role } = await requireSession();
  const err = requireAdmin(role);
  if (err) return [];
  try {
    return await db.collaborationHighlight.findMany({
      include: HIGHLIGHT_INCLUDE,
      orderBy: { createdAt: "desc" },
    });
  } catch (e) {
    console.error("getAllHighlights error:", e);
    return [];
  }
}

// ---------------------------------------------------------------
// ADMIN: ハイライト1件取得
// ---------------------------------------------------------------
export async function getHighlightById(id: string) {
  const { role } = await requireSession();
  const err = requireAdmin(role);
  if (err) return null;
  try {
    return await db.collaborationHighlight.findUnique({
      where: { id },
      include: HIGHLIGHT_INCLUDE,
    });
  } catch (e) {
    console.error("getHighlightById error:", e);
    return null;
  }
}

// ---------------------------------------------------------------
// ADMIN: ハイライト作成
// ---------------------------------------------------------------
export async function adminCreateHighlight(formData: FormData) {
  const { role } = await requireSession();
  const err = requireAdmin(role);
  if (err) return err;

  const title = (formData.get("title") as string)?.trim();
  const description = (formData.get("description") as string)?.trim();
  const emoji = (formData.get("emoji") as string)?.trim() || null;
  const memberIds = formData.getAll("memberIds") as string[];

  if (!title || !description || memberIds.length < 2) {
    return { error: "タイトル、詳細、2人以上のメンバーが必要です" };
  }

  try {
    await db.collaborationHighlight.create({
      data: {
        title,
        description,
        emoji,
        members: {
          create: memberIds.map((id) => ({ groupCompanyId: id })),
        },
      },
    });
    revalidatePath("/dashboard/group-profiles");
    return { success: true };
  } catch (e) {
    console.error("adminCreateHighlight error:", e);
    return { error: "作成に失敗しました" };
  }
}

// ---------------------------------------------------------------
// ADMIN: ハイライト更新
// ---------------------------------------------------------------
export async function adminUpdateHighlight(id: string, formData: FormData) {
  const { role } = await requireSession();
  const err = requireAdmin(role);
  if (err) return err;

  const title = (formData.get("title") as string)?.trim();
  const description = (formData.get("description") as string)?.trim();
  const emoji = (formData.get("emoji") as string)?.trim() || null;
  const isActive = formData.get("isActive") === "true";
  const memberIds = formData.getAll("memberIds") as string[];

  if (!title || !description || memberIds.length < 2) {
    return { error: "タイトル、詳細、2人以上のメンバーが必要です" };
  }

  try {
    await db.$transaction([
      db.collaborationHighlightMember.deleteMany({ where: { highlightId: id } }),
      db.collaborationHighlight.update({
        where: { id },
        data: {
          title,
          description,
          emoji,
          isActive,
          members: {
            create: memberIds.map((gid) => ({ groupCompanyId: gid })),
          },
        },
      }),
    ]);
    revalidatePath("/dashboard/group-profiles");
    return { success: true };
  } catch (e) {
    console.error("adminUpdateHighlight error:", e);
    return { error: "更新に失敗しました" };
  }
}

// ---------------------------------------------------------------
// ADMIN: ハイライト削除
// ---------------------------------------------------------------
export async function adminDeleteHighlight(id: string) {
  const { role } = await requireSession();
  const err = requireAdmin(role);
  if (err) return err;

  try {
    await db.collaborationHighlight.delete({ where: { id } });
    revalidatePath("/dashboard/group-profiles");
    return { success: true };
  } catch (e) {
    console.error("adminDeleteHighlight error:", e);
    return { error: "削除に失敗しました" };
  }
}
