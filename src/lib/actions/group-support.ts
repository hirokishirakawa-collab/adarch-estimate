"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import { getWeekId } from "@/lib/constants/group-support";
import type { GroupCompanyPhase } from "@/generated/prisma/client";
import type { UserRole } from "@/types/roles";

// ----------------------------------------------------------------
// 認証ヘルパー（ADMIN 限定）
// ----------------------------------------------------------------
async function requireAdmin() {
  const session = await auth();
  const role = (session?.user?.role ?? "USER") as UserRole;
  if (role !== "ADMIN") throw new Error("Forbidden");
  return {
    email: session?.user?.email ?? "",
    name: session?.user?.name ?? "",
  };
}

// ----------------------------------------------------------------
// 一覧取得
// ----------------------------------------------------------------
export async function getGroupCompanies() {
  await requireAdmin();
  const weekId = getWeekId();

  const companies = await db.groupCompany.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    include: {
      weeklySubmissions: {
        where: { weekId },
        take: 1,
      },
      contactHistories: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });

  return { companies, weekId };
}

// ----------------------------------------------------------------
// 企業詳細取得
// ----------------------------------------------------------------
export async function getGroupCompanyDetail(id: string) {
  await requireAdmin();
  const weekId = getWeekId();

  const company = await db.groupCompany.findUnique({
    where: { id },
    include: {
      weeklySubmissions: {
        orderBy: { weekId: "desc" },
        take: 12,
      },
      contactHistories: {
        orderBy: { createdAt: "desc" },
        take: 50,
      },
    },
  });

  return { company, weekId };
}

// ----------------------------------------------------------------
// メモ・フェーズ更新
// ----------------------------------------------------------------
export async function updateGroupCompany(
  _prev: { error?: string } | null,
  formData: FormData
): Promise<{ error?: string }> {
  try {
    const admin = await requireAdmin();
    const id = formData.get("id") as string;
    const memo = formData.get("memo") as string | null;
    const phase = formData.get("phase") as GroupCompanyPhase | null;

    if (!id) return { error: "IDが必要です" };

    const old = await db.groupCompany.findUnique({ where: { id } });
    if (!old) return { error: "企業が見つかりません" };

    const data: Record<string, unknown> = {};
    if (memo !== null && memo !== old.memo) data.memo = memo;
    if (phase && phase !== old.phase) data.phase = phase;

    if (Object.keys(data).length === 0) return {};

    await db.groupCompany.update({ where: { id }, data });

    // メモ更新をコンタクト履歴に記録
    if (data.memo !== undefined) {
      await db.contactHistory.create({
        data: {
          groupCompanyId: id,
          type: "MANUAL_NOTE",
          content: data.memo as string,
          actorName: admin.name,
        },
      });
    }

    logAudit({
      action: "group_company_updated",
      email: admin.email,
      name: admin.name,
      entity: "group_company",
      entityId: id,
      detail: Object.keys(data).join(", "),
    });

    revalidatePath("/dashboard/group-support");
    revalidatePath(`/dashboard/group-support/${id}`);
    return {};
  } catch (e) {
    console.error("[group-support] Update error:", e);
    return { error: "更新に失敗しました" };
  }
}
