"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import { getWeekId } from "@/lib/constants/group-support";
import { REQUIRED_WEEKS, canApplyToProject, getLatestReportMonth } from "@/lib/constants/project-matching";
import type { ProjectRequestCategory, ProjectFrequency } from "@/generated/prisma/client";

// ----------------------------------------------------------------
// 認証ヘルパー
// ----------------------------------------------------------------
async function requireAuth() {
  const session = await auth();
  if (!session?.user?.email) throw new Error("Unauthorized");
  return {
    email: session.user.email,
    name: session.user.name ?? "",
    id: session.user.id ?? "",
  };
}

// ----------------------------------------------------------------
// ユーザーの所属企業を取得
// ----------------------------------------------------------------
async function getUserCompanyAndBranch(userId: string) {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { groupCompanyId: true, branchId: true },
  });
  if (!user?.groupCompanyId) throw new Error("グループ企業に所属していません");
  return { groupCompanyId: user.groupCompanyId, branchId: user.branchId };
}

// ----------------------------------------------------------------
// 直近3週の提出数を取得
// ----------------------------------------------------------------
async function getRecentSubmissionCount(groupCompanyId: string): Promise<number> {
  const now = new Date();
  const weekIds: string[] = [];
  for (let i = 0; i < REQUIRED_WEEKS; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() - i * 7);
    weekIds.push(getWeekId(d));
  }

  return db.weeklySubmission.count({
    where: {
      groupCompanyId,
      weekId: { in: weekIds },
    },
  });
}

// ----------------------------------------------------------------
// 最新月の売上報告が提出済みか確認
// ----------------------------------------------------------------
async function checkLatestRevenueReport(branchId: string | null): Promise<boolean> {
  if (!branchId) return true; // ADMINは制限なし
  const targetMonth = getLatestReportMonth();
  const count = await db.revenueReport.count({
    where: {
      branchId,
      targetMonth: targetMonth,
    },
  });
  return count > 0;
}

// ----------------------------------------------------------------
// 自社の応募資格情報を取得
// ----------------------------------------------------------------
export async function getMyEligibility(): Promise<{
  submissionCount: number;
  requiredWeeks: number;
  hasLatestRevenueReport: boolean;
  latestReportMonth: string;
  canApply: boolean;
}> {
  const user = await requireAuth();
  const { groupCompanyId, branchId } = await getUserCompanyAndBranch(user.id);
  const [submissionCount, hasLatestRevenueReport] = await Promise.all([
    getRecentSubmissionCount(groupCompanyId),
    checkLatestRevenueReport(branchId),
  ]);
  const targetMonth = getLatestReportMonth();
  const latestReportMonth = `${targetMonth.getUTCFullYear()}年${targetMonth.getUTCMonth() + 1}月`;
  return {
    submissionCount,
    requiredWeeks: REQUIRED_WEEKS,
    hasLatestRevenueReport,
    latestReportMonth,
    canApply: canApplyToProject(submissionCount, hasLatestRevenueReport),
  };
}

// ----------------------------------------------------------------
// 案件一覧取得（OPEN案件）
// ----------------------------------------------------------------
export async function getProjectRequests() {
  await requireAuth();

  const requests = await db.projectRequest.findMany({
    where: { status: "OPEN" },
    orderBy: { createdAt: "desc" },
    include: {
      postedByCompany: { select: { name: true, ownerName: true } },
      applications: {
        select: { id: true, applicantCompanyId: true },
      },
    },
  });

  return requests;
}

// ----------------------------------------------------------------
// 全案件取得（管理者・自社投稿含む）
// ----------------------------------------------------------------
export async function getMyProjectRequests() {
  const user = await requireAuth();
  const companyId = (await getUserCompanyAndBranch(user.id)).groupCompanyId;

  const [posted, applied] = await Promise.all([
    db.projectRequest.findMany({
      where: { postedByCompanyId: companyId },
      orderBy: { createdAt: "desc" },
      include: {
        postedByCompany: { select: { name: true } },
        applications: {
          include: {
            applicantCompany: { select: { name: true, ownerName: true } },
          },
          orderBy: { contributionScore: "desc" },
        },
      },
    }),
    db.projectApplication.findMany({
      where: { applicantCompanyId: companyId },
      orderBy: { createdAt: "desc" },
      include: {
        projectRequest: {
          include: {
            postedByCompany: { select: { name: true } },
          },
        },
      },
    }),
  ]);

  return { posted, applied };
}

// ----------------------------------------------------------------
// 案件詳細取得
// ----------------------------------------------------------------
export async function getProjectRequestDetail(id: string) {
  const user = await requireAuth();
  const companyId = (await getUserCompanyAndBranch(user.id)).groupCompanyId;

  const request = await db.projectRequest.findUnique({
    where: { id },
    include: {
      postedByCompany: { select: { id: true, name: true, ownerName: true, prefecture: true } },
      postedByUser: { select: { name: true } },
      matchedCompany: { select: { name: true, ownerName: true } },
      applications: {
        include: {
          applicantCompany: {
            select: { id: true, name: true, ownerName: true, specialty: true, prefecture: true },
          },
          applicantUser: { select: { name: true } },
        },
        orderBy: { contributionScore: "desc" },
      },
    },
  });

  return { request, currentCompanyId: companyId };
}

// ----------------------------------------------------------------
// 案件投稿
// ----------------------------------------------------------------
export async function createProjectRequest(
  _prev: { error?: string } | null,
  formData: FormData
): Promise<{ error?: string }> {
  try {
    const user = await requireAuth();
    const companyId = (await getUserCompanyAndBranch(user.id)).groupCompanyId;

    const title = (formData.get("title") as string)?.trim();
    const description = (formData.get("description") as string)?.trim();
    const category = formData.get("category") as ProjectRequestCategory;
    const prefecture = (formData.get("prefecture") as string) || null;
    const budgetStr = formData.get("budget") as string;
    const budget = budgetStr ? parseInt(budgetStr, 10) : null;
    const frequency = (formData.get("frequency") as ProjectFrequency) || "ONE_TIME";
    const deadlineStr = formData.get("deadline") as string;
    const deadline = deadlineStr ? new Date(deadlineStr) : null;

    if (!title) return { error: "案件名を入力してください" };
    if (!description) return { error: "詳細を入力してください" };
    if (!category) return { error: "カテゴリを選択してください" };

    await db.projectRequest.create({
      data: {
        title,
        description,
        category,
        prefecture,
        budget: budget && !isNaN(budget) ? budget : null,
        frequency,
        deadline,
        postedByCompanyId: companyId,
        postedByUserId: user.id,
      },
    });

    logAudit({
      action: "project_request_created",
      email: user.email,
      name: user.name,
      entity: "project_request",
      detail: title,
    });

    revalidatePath("/dashboard/project-matching");
    return {};
  } catch (e) {
    console.error("[project-matching] Create error:", e);
    const msg = e instanceof Error ? e.message : "投稿に失敗しました";
    return { error: msg };
  }
}

// ----------------------------------------------------------------
// 案件に応募
// ----------------------------------------------------------------
export async function applyToProject(
  _prev: { error?: string } | null,
  formData: FormData
): Promise<{ error?: string }> {
  try {
    const user = await requireAuth();
    const { groupCompanyId: companyId, branchId } = await getUserCompanyAndBranch(user.id);

    const projectRequestId = formData.get("projectRequestId") as string;
    const message = (formData.get("message") as string)?.trim();

    if (!projectRequestId) return { error: "案件IDが必要です" };
    if (!message) return { error: "メッセージを入力してください" };

    // 自社の案件には応募不可
    const request = await db.projectRequest.findUnique({
      where: { id: projectRequestId },
      select: { postedByCompanyId: true, status: true },
    });
    if (!request) return { error: "案件が見つかりません" };
    if (request.status !== "OPEN") return { error: "この案件は募集を終了しています" };
    if (request.postedByCompanyId === companyId) {
      return { error: "自社の案件には応募できません" };
    }

    // 応募資格チェック
    const [submissionCount, hasLatestRevenueReport] = await Promise.all([
      getRecentSubmissionCount(companyId),
      checkLatestRevenueReport(branchId),
    ]);
    if (!canApplyToProject(submissionCount, hasLatestRevenueReport)) {
      if (!hasLatestRevenueReport) {
        return { error: "応募するには最新月の売上報告を提出する必要があります" };
      }
      return {
        error: `応募するには直近${REQUIRED_WEEKS}週の週次シェアをすべて提出する必要があります（現在 ${submissionCount}/${REQUIRED_WEEKS}週）`,
      };
    }

    await db.projectApplication.create({
      data: {
        projectRequestId,
        applicantCompanyId: companyId,
        applicantUserId: user.id,
        message,
        contributionScore: submissionCount,
      },
    });

    logAudit({
      action: "project_application_created",
      email: user.email,
      name: user.name,
      entity: "project_application",
      entityId: projectRequestId,
    });

    revalidatePath(`/dashboard/project-matching/${projectRequestId}`);
    return {};
  } catch (e) {
    console.error("[project-matching] Apply error:", e);
    if (e instanceof Error && e.message.includes("Unique constraint")) {
      return { error: "既に応募済みです" };
    }
    const msg = e instanceof Error ? e.message : "応募に失敗しました";
    return { error: msg };
  }
}

// ----------------------------------------------------------------
// マッチング確定（案件投稿者のみ）
// ----------------------------------------------------------------
export async function matchProject(
  projectRequestId: string,
  applicantCompanyId: string
): Promise<{ error?: string }> {
  try {
    const user = await requireAuth();
    const companyId = (await getUserCompanyAndBranch(user.id)).groupCompanyId;

    const request = await db.projectRequest.findUnique({
      where: { id: projectRequestId },
      select: {
        title: true,
        postedByCompanyId: true,
        status: true,
        applications: {
          select: {
            applicantCompanyId: true,
            applicantUser: { select: { email: true, name: true } },
            applicantCompany: { select: { name: true } },
          },
        },
      },
    });

    if (!request) return { error: "案件が見つかりません" };
    if (request.postedByCompanyId !== companyId) {
      return { error: "この案件のマッチング権限がありません" };
    }
    if (request.status !== "OPEN") return { error: "この案件は既に募集を終了しています" };

    await db.projectRequest.update({
      where: { id: projectRequestId },
      data: {
        status: "MATCHED",
        matchedCompanyId: applicantCompanyId,
      },
    });

    logAudit({
      action: "project_matched",
      email: user.email,
      name: user.name,
      entity: "project_request",
      entityId: projectRequestId,
      detail: `matched with ${applicantCompanyId}`,
    });

    // 選ばれなかった応募者にメール通知（非同期で送信、失敗してもエラーにしない）
    const { sendProjectClosedEmail } = await import("@/lib/resend");
    const notSelected = request.applications.filter(
      (a) => a.applicantCompanyId !== applicantCompanyId
    );
    for (const app of notSelected) {
      sendProjectClosedEmail({
        to: app.applicantUser.email,
        applicantName: app.applicantUser.name ?? app.applicantCompany.name,
        projectTitle: request.title,
      }).catch((err) =>
        console.error("[project-matching] Notification email error:", err)
      );
    }

    revalidatePath("/dashboard/project-matching");
    revalidatePath(`/dashboard/project-matching/${projectRequestId}`);
    return {};
  } catch (e) {
    console.error("[project-matching] Match error:", e);
    return { error: "マッチングに失敗しました" };
  }
}

// ----------------------------------------------------------------
// 案件クローズ（投稿者のみ）
// ----------------------------------------------------------------
export async function closeProjectRequest(
  projectRequestId: string
): Promise<{ error?: string }> {
  try {
    const user = await requireAuth();
    const companyId = (await getUserCompanyAndBranch(user.id)).groupCompanyId;

    const request = await db.projectRequest.findUnique({
      where: { id: projectRequestId },
      select: { postedByCompanyId: true },
    });

    if (!request) return { error: "案件が見つかりません" };
    if (request.postedByCompanyId !== companyId) {
      return { error: "この案件を終了する権限がありません" };
    }

    await db.projectRequest.update({
      where: { id: projectRequestId },
      data: { status: "CLOSED" },
    });

    revalidatePath("/dashboard/project-matching");
    revalidatePath(`/dashboard/project-matching/${projectRequestId}`);
    return {};
  } catch (e) {
    console.error("[project-matching] Close error:", e);
    return { error: "終了処理に失敗しました" };
  }
}
