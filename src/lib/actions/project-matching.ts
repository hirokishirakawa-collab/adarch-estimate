"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import { getWeekId } from "@/lib/constants/group-support";
import { REQUIRED_WEEKS, CATEGORY_OPTIONS, FREQUENCY_OPTIONS, canApplyToProject, formatBudget, getLatestReportMonth, getRequiredWeeks, isRevenueCheckActive } from "@/lib/constants/project-matching";
import { broadcastChatMessage } from "@/lib/google-chat";
import type { ProjectRequestCategory, ProjectFrequency } from "@/generated/prisma/client";

// ----------------------------------------------------------------
// 認証ヘルパー
// ----------------------------------------------------------------
async function requireAuth() {
  const session = await auth();
  if (!session?.user?.email) throw new Error("Unauthorized");
  const dbUser = await db.user.findUnique({
    where: { email: session.user.email },
    select: { id: true },
  });
  return {
    email: session.user.email,
    name: session.user.name ?? "",
    id: dbUser?.id ?? "",
    role: (session.user.role ?? "USER") as "ADMIN" | "USER",
  };
}

// ----------------------------------------------------------------
// ユーザーの所属企業を取得
// ----------------------------------------------------------------
async function getUserCompanyAndBranch(userId: string, role?: string) {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { groupCompanyId: true, branchId: true },
  });
  if (!user?.groupCompanyId) {
    if (role === "ADMIN") {
      // ADMINは本部（アドアーチ）を自動割り当て
      const hq = await db.groupCompany.findFirst({
        where: { name: { contains: "本部" } },
        select: { id: true },
      });
      return { groupCompanyId: hq?.id ?? null, branchId: null };
    }
    throw new Error("グループ企業に所属していません");
  }
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
// 応募資格のある企業にGoogle Chat通知を送信
// ----------------------------------------------------------------
async function notifyEligibleCompanies(params: {
  title: string;
  category: ProjectRequestCategory;
  frequency: ProjectFrequency;
  budget: number | null;
  prefecture: string | null;
  postedByCompanyId: string;
}) {
  const now = new Date();
  const requiredWeeks = getRequiredWeeks(now);
  const revenueActive = isRevenueCheckActive(now);
  const targetMonth = getLatestReportMonth();

  // 直近N週のweekIdを生成
  const weekIds: string[] = [];
  for (let i = 0; i < REQUIRED_WEEKS; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() - i * 7);
    weekIds.push(getWeekId(d));
  }

  // 全アクティブ企業（投稿者を除く）を取得
  const companies = await db.groupCompany.findMany({
    where: { isActive: true, id: { not: params.postedByCompanyId } },
    select: {
      id: true,
      chatSpaceId: true,
      linkedUsers: { select: { branchId: true }, take: 1 },
      weeklySubmissions: {
        where: { weekId: { in: weekIds } },
        select: { weekId: true },
      },
    },
  });

  // 応募資格のある企業のspaceIdを抽出
  const eligibleSpaceIds: string[] = [];
  for (const c of companies) {
    const submissionCount = c.weeklySubmissions.length;
    const branchId = c.linkedUsers[0]?.branchId ?? null;
    let hasRevenue = true;
    if (revenueActive && branchId) {
      hasRevenue =
        (await db.revenueReport.count({
          where: { branchId, targetMonth },
        })) > 0;
    } else if (revenueActive && !branchId) {
      hasRevenue = false;
    }
    if (canApplyToProject(submissionCount, hasRevenue, now)) {
      eligibleSpaceIds.push(c.chatSpaceId);
    }
  }

  if (eligibleSpaceIds.length === 0) return;

  // 通知メッセージを組み立て
  const catLabel = CATEGORY_OPTIONS.find((c) => c.value === params.category)?.label ?? params.category;
  const freqLabel = FREQUENCY_OPTIONS.find((f) => f.value === params.frequency)?.label ?? params.frequency;
  const budgetText = formatBudget(params.budget);
  const prefText = params.prefecture ? `\n📍 エリア: ${params.prefecture}` : "";

  const message = [
    "📢 新しい案件が投稿されました",
    "",
    `📋 ${params.title}`,
    `🏷️ ${catLabel}（${freqLabel}）`,
    `💰 予算: ${budgetText}${prefText}`,
    "",
    "▶ 詳細を確認して応募できます",
    `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/dashboard/project-matching`,
  ].join("\n");

  await broadcastChatMessage(eligibleSpaceIds, message);
}

// ----------------------------------------------------------------
// 自社の応募資格情報を取得
// ----------------------------------------------------------------
export async function getMyEligibility(): Promise<{
  submissionCount: number;
  requiredWeeks: number;
  hasLatestRevenueReport: boolean;
  revenueCheckActive: boolean;
  latestReportMonth: string;
  canApply: boolean;
}> {
  const now = new Date();
  const user = await requireAuth();
  const { groupCompanyId, branchId } = await getUserCompanyAndBranch(user.id, user.role);

  // ADMINは制限なし
  if (!groupCompanyId) {
    const targetMonth = getLatestReportMonth();
    return {
      submissionCount: REQUIRED_WEEKS,
      requiredWeeks: getRequiredWeeks(now),
      hasLatestRevenueReport: true,
      revenueCheckActive: isRevenueCheckActive(now),
      latestReportMonth: `${targetMonth.getUTCFullYear()}年${targetMonth.getUTCMonth() + 1}月`,
      canApply: true,
    };
  }

  const [submissionCount, hasLatestRevenueReport] = await Promise.all([
    getRecentSubmissionCount(groupCompanyId),
    checkLatestRevenueReport(branchId),
  ]);
  const targetMonth = getLatestReportMonth();
  const latestReportMonth = `${targetMonth.getUTCFullYear()}年${targetMonth.getUTCMonth() + 1}月`;
  return {
    submissionCount,
    requiredWeeks: getRequiredWeeks(now),
    hasLatestRevenueReport,
    revenueCheckActive: isRevenueCheckActive(now),
    latestReportMonth,
    canApply: canApplyToProject(submissionCount, hasLatestRevenueReport, now),
  };
}

// ----------------------------------------------------------------
// ADMIN用: 全拠点の応募資格一覧
// ----------------------------------------------------------------
export async function getEligibilityList() {
  const session = await auth();
  const role = (session?.user?.role ?? "USER") as import("@/types/roles").UserRole;
  if (role !== "ADMIN") throw new Error("Forbidden");

  const now = new Date();
  const requiredWeeks = getRequiredWeeks(now);
  const revenueActive = isRevenueCheckActive(now);
  const weekIds: string[] = [];
  for (let i = 0; i < REQUIRED_WEEKS; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() - i * 7);
    weekIds.push(getWeekId(d));
  }
  const targetMonth = getLatestReportMonth();

  // 全アクティブ企業を取得
  const companies = await db.groupCompany.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      ownerName: true,
      linkedUsers: {
        select: { branchId: true },
        take: 1,
      },
      weeklySubmissions: {
        where: { weekId: { in: weekIds } },
        select: { weekId: true },
      },
    },
  });

  // 各企業の資格を判定
  const results = await Promise.all(
    companies.map(async (c) => {
      const submissionCount = c.weeklySubmissions.length;
      const branchId = c.linkedUsers[0]?.branchId ?? null;
      const hasRevenue = branchId
        ? (await db.revenueReport.count({
            where: { branchId, targetMonth },
          })) > 0
        : false;
      const eligible = canApplyToProject(submissionCount, hasRevenue, now);

      return {
        id: c.id,
        name: c.name,
        ownerName: c.ownerName,
        submissionCount,
        hasRevenueReport: hasRevenue,
        eligible,
      };
    })
  );

  return {
    results,
    weekIds,
    requiredWeeks,
    revenueCheckActive: revenueActive,
    reportMonth: `${targetMonth.getUTCFullYear()}年${targetMonth.getUTCMonth() + 1}月`,
  };
}

// ----------------------------------------------------------------
// 案件一覧取得（OPEN案件）
// ----------------------------------------------------------------
export async function getProjectRequests() {
  await requireAuth();

  const requests = await db.projectRequest.findMany({
    where: { status: "OPEN", isHidden: false },
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
  const { groupCompanyId: companyId } = await getUserCompanyAndBranch(user.id, user.role);

  // ADMINで企業未所属の場合は全案件を表示
  const companyFilter = companyId ? { postedByCompanyId: companyId } : {};
  const appFilter = companyId ? { applicantCompanyId: companyId } : {};

  const [posted, applied] = await Promise.all([
    db.projectRequest.findMany({
      where: companyFilter,
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
      where: appFilter,
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
  const { groupCompanyId: companyId } = await getUserCompanyAndBranch(user.id, user.role);

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
    const { groupCompanyId: companyId } = await getUserCompanyAndBranch(user.id, user.role);
    if (!companyId) return { error: "案件を投稿するにはグループ企業への所属が必要です" };

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

    // 応募資格のある企業にGoogle Chat通知（非同期、失敗してもエラーにしない）
    notifyEligibleCompanies({
      title,
      category,
      frequency,
      budget: budget && !isNaN(budget) ? budget : null,
      prefecture,
      postedByCompanyId: companyId,
    }).catch((err) =>
      console.error("[project-matching] Chat notification error:", err)
    );

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
    const { groupCompanyId: companyId, branchId } = await getUserCompanyAndBranch(user.id, user.role);
    if (!companyId) return { error: "応募するにはグループ企業への所属が必要です" };

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
    const now = new Date();
    const requiredWeeks = getRequiredWeeks(now);
    const [submissionCount, hasLatestRevenueReport] = await Promise.all([
      getRecentSubmissionCount(companyId),
      checkLatestRevenueReport(branchId),
    ]);
    if (!canApplyToProject(submissionCount, hasLatestRevenueReport, now)) {
      if (isRevenueCheckActive(now) && !hasLatestRevenueReport) {
        return { error: "応募するには最新月の売上報告を提出する必要があります" };
      }
      return {
        error: `応募するには直近${requiredWeeks}週の週次シェアをすべて提出する必要があります（現在 ${submissionCount}/${requiredWeeks}週）`,
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
    const { groupCompanyId: companyId } = await getUserCompanyAndBranch(user.id, user.role);

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
    if (request.postedByCompanyId !== companyId && user.role !== "ADMIN") {
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
    const { groupCompanyId: companyId } = await getUserCompanyAndBranch(user.id, user.role);

    const request = await db.projectRequest.findUnique({
      where: { id: projectRequestId },
      select: { postedByCompanyId: true },
    });

    if (!request) return { error: "案件が見つかりません" };
    if (request.postedByCompanyId !== companyId && user.role !== "ADMIN") {
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

// ----------------------------------------------------------------
// 案件編集（投稿者 or ADMIN）
// ----------------------------------------------------------------
export async function updateProjectRequest(
  _prev: { error?: string } | null,
  formData: FormData
): Promise<{ error?: string }> {
  try {
    const user = await requireAuth();
    const { groupCompanyId: companyId } = await getUserCompanyAndBranch(user.id, user.role);

    const projectRequestId = formData.get("projectRequestId") as string;
    if (!projectRequestId) return { error: "案件IDが必要です" };

    const request = await db.projectRequest.findUnique({
      where: { id: projectRequestId },
      select: { postedByCompanyId: true, status: true },
    });
    if (!request) return { error: "案件が見つかりません" };
    if (request.postedByCompanyId !== companyId && user.role !== "ADMIN") {
      return { error: "この案件を編集する権限がありません" };
    }

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

    await db.projectRequest.update({
      where: { id: projectRequestId },
      data: {
        title,
        description,
        category,
        prefecture,
        budget: budget && !isNaN(budget) ? budget : null,
        frequency,
        deadline,
      },
    });

    logAudit({
      action: "project_request_updated",
      email: user.email,
      name: user.name,
      entity: "project_request",
      entityId: projectRequestId,
      detail: title,
    });

    revalidatePath("/dashboard/project-matching");
    revalidatePath(`/dashboard/project-matching/${projectRequestId}`);
    return {};
  } catch (e) {
    console.error("[project-matching] Update error:", e);
    const msg = e instanceof Error ? e.message : "更新に失敗しました";
    return { error: msg };
  }
}

// ----------------------------------------------------------------
// ADMIN: 非公開トグル
// ----------------------------------------------------------------
export async function toggleProjectHidden(
  projectRequestId: string
): Promise<{ error?: string }> {
  try {
    const user = await requireAuth();
    if (user.role !== "ADMIN") return { error: "管理者権限が必要です" };

    const request = await db.projectRequest.findUnique({
      where: { id: projectRequestId },
      select: { isHidden: true, title: true },
    });
    if (!request) return { error: "案件が見つかりません" };

    await db.projectRequest.update({
      where: { id: projectRequestId },
      data: { isHidden: !request.isHidden },
    });

    logAudit({
      action: request.isHidden ? "project_unhidden" : "project_hidden",
      email: user.email,
      name: user.name,
      entity: "project_request",
      entityId: projectRequestId,
      detail: request.title,
    });

    revalidatePath("/dashboard/project-matching");
    revalidatePath(`/dashboard/project-matching/${projectRequestId}`);
    return {};
  } catch (e) {
    console.error("[project-matching] Toggle hidden error:", e);
    return { error: "操作に失敗しました" };
  }
}

// ----------------------------------------------------------------
// ADMIN: 案件削除
// ----------------------------------------------------------------
export async function deleteProjectRequest(
  projectRequestId: string
): Promise<{ error?: string }> {
  try {
    const user = await requireAuth();
    if (user.role !== "ADMIN") return { error: "管理者権限が必要です" };

    const request = await db.projectRequest.findUnique({
      where: { id: projectRequestId },
      select: { title: true },
    });
    if (!request) return { error: "案件が見つかりません" };

    await db.projectRequest.delete({
      where: { id: projectRequestId },
    });

    logAudit({
      action: "project_deleted",
      email: user.email,
      name: user.name,
      entity: "project_request",
      entityId: projectRequestId,
      detail: request.title,
    });

    revalidatePath("/dashboard/project-matching");
    return {};
  } catch (e) {
    console.error("[project-matching] Delete error:", e);
    return { error: "削除に失敗しました" };
  }
}

// ----------------------------------------------------------------
// ADMIN: 全案件取得（非公開・終了含む）
// ----------------------------------------------------------------
export async function getAllProjectRequestsAdmin() {
  const user = await requireAuth();
  if (user.role !== "ADMIN") throw new Error("Forbidden");

  return db.projectRequest.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      postedByCompany: { select: { name: true, ownerName: true } },
      applications: {
        select: { id: true, applicantCompanyId: true },
      },
    },
  });
}

// ----------------------------------------------------------------
// ADMIN: 対象企業を指定して案件投稿（応募を自動作成）
// ----------------------------------------------------------------
export async function createProjectRequestAdmin(
  _prev: { error?: string } | null,
  formData: FormData
): Promise<{ error?: string }> {
  try {
    const user = await requireAuth();
    if (user.role !== "ADMIN") return { error: "管理者権限が必要です" };

    const { groupCompanyId: companyId } = await getUserCompanyAndBranch(user.id, user.role);
    if (!companyId) return { error: "投稿元の企業が見つかりません" };

    const title = (formData.get("title") as string)?.trim();
    const description = (formData.get("description") as string)?.trim();
    const category = formData.get("category") as ProjectRequestCategory;
    const prefecture = (formData.get("prefecture") as string) || null;
    const budgetStr = formData.get("budget") as string;
    const budget = budgetStr ? parseInt(budgetStr, 10) : null;
    const frequency = (formData.get("frequency") as ProjectFrequency) || "ONE_TIME";
    const deadlineStr = formData.get("deadline") as string;
    const deadline = deadlineStr ? new Date(deadlineStr) : null;
    const targetCompanyIds = formData.getAll("targetCompanyIds") as string[];

    if (!title) return { error: "案件名を入力してください" };
    if (!description) return { error: "詳細を入力してください" };
    if (!category) return { error: "カテゴリを選択してください" };

    const created = await db.projectRequest.create({
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

    // 選択された企業の応募を自動作成
    if (targetCompanyIds.length > 0) {
      const companies = await db.groupCompany.findMany({
        where: { id: { in: targetCompanyIds }, isActive: true },
        select: {
          id: true,
          chatSpaceId: true,
          linkedUsers: { select: { id: true }, take: 1 },
        },
      });

      for (const c of companies) {
        if (!c.linkedUsers[0]) continue;
        await db.projectApplication.create({
          data: {
            projectRequestId: created.id,
            applicantCompanyId: c.id,
            applicantUserId: c.linkedUsers[0].id,
            message: "（管理者による割り当て）",
            contributionScore: 0,
          },
        });
      }

      // 選択企業にChat通知
      const catLabel = CATEGORY_OPTIONS.find((c) => c.value === category)?.label ?? category;
      const budgetText = formatBudget(budget && !isNaN(budget) ? budget : null);
      const message = [
        "📢 新しい案件が投稿されました",
        "",
        `📋 ${title}`,
        `🏷️ ${catLabel}`,
        `💰 予算: ${budgetText}`,
        "",
        "▶ 詳細を確認して応募できます",
        `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/dashboard/project-matching/${created.id}`,
      ].join("\n");

      const spaceIds = companies.map((c) => c.chatSpaceId).filter(Boolean);
      if (spaceIds.length > 0) {
        broadcastChatMessage(spaceIds, message).catch((err) =>
          console.error("[project-matching] Admin Chat notification error:", err)
        );
      }
    } else {
      // 企業未選択の場合は通常通り全資格企業に通知
      notifyEligibleCompanies({
        title,
        category,
        frequency,
        budget: budget && !isNaN(budget) ? budget : null,
        prefecture,
        postedByCompanyId: companyId,
      }).catch((err) =>
        console.error("[project-matching] Chat notification error:", err)
      );
    }

    logAudit({
      action: "project_request_created_admin",
      email: user.email,
      name: user.name,
      entity: "project_request",
      entityId: created.id,
      detail: `${title} (targets: ${targetCompanyIds.length})`,
    });

    revalidatePath("/dashboard/project-matching");
    return {};
  } catch (e) {
    console.error("[project-matching] Admin create error:", e);
    const msg = e instanceof Error ? e.message : "投稿に失敗しました";
    return { error: msg };
  }
}

// ----------------------------------------------------------------
// ADMIN: アクティブ企業一覧取得（投稿フォーム用）
// ----------------------------------------------------------------
export async function getActiveCompanies() {
  const user = await requireAuth();
  if (user.role !== "ADMIN") throw new Error("Forbidden");

  return db.groupCompany.findMany({
    where: { isActive: true },
    select: { id: true, name: true, ownerName: true },
    orderBy: { name: "asc" },
  });
}
