"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import { getWeekId } from "@/lib/constants/group-support";
import { createInAppNotification } from "@/lib/notifications";
import { notifyUser } from "@/lib/push-notification";
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

  // 当月・前月の月初・月末を算出
  const now = new Date();
  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const currentMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
  const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

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
      linkedUsers: {
        select: { branchId: true },
      },
    },
  });

  // 当月＋前月の売上報告を一括取得（branchId別）
  const [currentMonthReports, prevMonthReports] = await Promise.all([
    db.revenueReport.findMany({
      where: {
        targetMonth: { gte: currentMonthStart, lte: currentMonthEnd },
      },
      select: { branchId: true },
    }),
    db.revenueReport.findMany({
      where: {
        targetMonth: { gte: prevMonthStart, lte: prevMonthEnd },
      },
      select: { branchId: true },
    }),
  ]);
  const currentReportedBranches = new Set(currentMonthReports.map((r) => r.branchId));
  const prevReportedBranches = new Set(prevMonthReports.map((r) => r.branchId));

  // 各企業に当月・前月の売上報告有無を付与
  const companiesWithReport = companies.map((c) => {
    const branchIds = c.linkedUsers
      .map((u) => u.branchId)
      .filter((id): id is string => !!id);
    const hasCurrentReport = branchIds.some((id) => currentReportedBranches.has(id));
    const hasPrevReport = branchIds.some((id) => prevReportedBranches.has(id));
    return {
      ...c,
      prevMonthReportSubmitted: hasPrevReport,
      currentMonthReportSubmitted: hasCurrentReport,
    };
  });

  return { companies: companiesWithReport, weekId, prevMonthStart, currentMonthStart };
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
// ----------------------------------------------------------------
// 週報生成
// ----------------------------------------------------------------
export async function generateWeeklyReport(
  weekId: string
): Promise<{ error?: string }> {
  try {
    await requireAdmin();

    const apiKey = process.env.GROUP_SUPPORT_API_KEY;
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

    const res = await fetch(
      `${baseUrl}/api/cron/group-support-report?weekId=${encodeURIComponent(weekId)}`,
      { headers: { "x-api-key": apiKey ?? "" } }
    );

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      return { error: body.error ?? `HTTP ${res.status}` };
    }

    revalidatePath("/dashboard/group-support");
    return {};
  } catch (e) {
    console.error("[group-support] Report generation error:", e);
    return { error: "週報の生成に失敗しました" };
  }
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

// ----------------------------------------------------------------
// 週次共有への返信（本部 → 加盟代表）
//
// Google Chat のスペースには本文を流さない。「返信が届いた」ことだけを
// 知らせて、中身は OS にログインしないと読めない状態にする。
// スペース上でやり取りが公開されている見え方を避けるための設計。
// ----------------------------------------------------------------
export type ReplyState = { error?: string; success?: boolean } | null;

export async function replyToWeeklySubmission(
  _prev: ReplyState,
  formData: FormData
): Promise<ReplyState> {
  try {
    const admin = await requireAdmin();
    const groupCompanyId = formData.get("groupCompanyId") as string;
    const weekId = ((formData.get("weekId") as string) || "").trim() || null;
    const content = ((formData.get("content") as string) || "").trim();

    if (!groupCompanyId) return { error: "企業IDが必要です" };
    if (!content) return { error: "返信内容を入力してください" };

    const company = await db.groupCompany.findUnique({
      where: { id: groupCompanyId },
      select: { id: true, name: true },
    });
    if (!company) return { error: "企業が見つかりません" };

    await db.contactHistory.create({
      data: {
        groupCompanyId: company.id,
        type: "CEO_COMMENT",
        content,
        actorName: admin.name || "本部",
        weekId,
      },
    });

    // 加盟代表へ通知。本文は入れない（OS でだけ読める状態にする）
    const partners = await db.user.findMany({
      where: { groupCompanyId: company.id, isActive: true },
      select: { id: true, email: true },
    });
    for (const p of partners) {
      await createInAppNotification({
        userId: p.id,
        type: "GROUP_REPLY",
        title: "本部から返信が届きました",
        message: weekId ? `${weekId} の共有について` : undefined,
        linkUrl: "/dashboard",
        // 見落とすと往復が途切れるので、本人の通知設定に関係なくメールを送る
        forceEmail: true,
      });
      if (p.email) {
        notifyUser(
          p.email,
          "本部から返信が届きました",
          "OS を開いて内容をご確認ください"
        ).catch((e) => console.error("[group-support:push]", e));
      }
    }

    logAudit({
      action: "group_support_replied",
      email: admin.email,
      name: admin.name,
      entity: "contact_history",
      entityId: company.id,
      detail: content.slice(0, 80),
    });

    revalidatePath(`/dashboard/group-support/${company.id}`);
    return { success: true };
  } catch (e) {
    console.error("[group-support] Reply error:", e);
    return { error: "返信の送信に失敗しました" };
  }
}

// ----------------------------------------------------------------
// 加盟代表 → 本部への返し書き
// ----------------------------------------------------------------
export async function replyAsPartner(
  _prev: ReplyState,
  formData: FormData
): Promise<ReplyState> {
  try {
    const session = await auth();
    const email = session?.user?.email ?? "";
    if (!email) return { error: "ログインが必要です" };

    const me = await db.user.findUnique({
      where: { email },
      select: {
        id: true,
        name: true,
        groupCompanyId: true,
        groupCompany: { select: { id: true, name: true } },
      },
    });
    if (!me?.groupCompanyId || !me.groupCompany) {
      return { error: "加盟企業に紐づいたアカウントではありません" };
    }

    const content = ((formData.get("content") as string) || "").trim();
    if (!content) return { error: "内容を入力してください" };

    await db.contactHistory.create({
      data: {
        groupCompanyId: me.groupCompanyId,
        type: "PARTNER_REPLY",
        content,
        actorName: me.name || me.groupCompany.name,
        weekId: getWeekId(),
      },
    });

    const admins = await db.user.findMany({
      where: { role: "ADMIN", isActive: true },
      select: { id: true },
    });
    for (const a of admins) {
      await createInAppNotification({
        userId: a.id,
        type: "GROUP_REPLY",
        title: `${me.groupCompany.name} から返信が届きました`,
        linkUrl: `/dashboard/group-support/${me.groupCompanyId}`,
        forceEmail: true,
      });
    }

    logAudit({
      action: "group_support_partner_replied",
      email,
      name: me.name ?? "",
      entity: "contact_history",
      entityId: me.groupCompanyId,
      detail: content.slice(0, 80),
    });

    revalidatePath("/dashboard");
    return { success: true };
  } catch (e) {
    console.error("[group-support] Partner reply error:", e);
    return { error: "送信に失敗しました" };
  }
}

// ----------------------------------------------------------------
// ダッシュボード用: 自社の本部やり取り（直近5件）と未読件数
// ADMIN 以外・加盟企業に紐づくユーザーだけが対象。
// ----------------------------------------------------------------
export async function getMyGroupThread() {
  const session = await auth();
  const email = session?.user?.email ?? "";
  if (!email) return null;

  const me = await db.user.findUnique({
    where: { email },
    select: { id: true, groupCompanyId: true },
  });
  if (!me?.groupCompanyId) return null;

  const [messages, unreadCount] = await Promise.all([
    db.contactHistory.findMany({
      where: {
        groupCompanyId: me.groupCompanyId,
        type: { in: ["CEO_COMMENT", "PARTNER_REPLY"] },
      },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        type: true,
        content: true,
        actorName: true,
        createdAt: true,
      },
    }),
    db.notification.count({
      where: { userId: me.id, type: "GROUP_REPLY", isRead: false },
    }),
  ]);

  if (messages.length === 0) return null;
  return { messages, unreadCount };
}

// ----------------------------------------------------------------
// 本部からの返信通知を既読にする（ダッシュボードで開いた時点で既読）
// ----------------------------------------------------------------
export async function markGroupRepliesRead(): Promise<void> {
  try {
    const session = await auth();
    const email = session?.user?.email ?? "";
    if (!email) return;
    const me = await db.user.findUnique({
      where: { email },
      select: { id: true },
    });
    if (!me) return;
    await db.notification.updateMany({
      where: { userId: me.id, type: "GROUP_REPLY", isRead: false },
      data: { isRead: true },
    });
  } catch (e) {
    console.error("[group-support] markGroupRepliesRead error:", e);
  }
}
