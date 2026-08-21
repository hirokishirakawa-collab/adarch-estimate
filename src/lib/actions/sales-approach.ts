"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import { getSessionInfo } from "@/lib/session";
import { logAudit } from "@/lib/audit";
import { sendChatMessage } from "@/lib/google-chat";
import { getResultOption, getMethodLabel } from "@/lib/constants/sales-approach";

// ---------------------------------------------------------------
// 投稿
// ---------------------------------------------------------------
export async function createSalesApproach(
  _prev: { error?: string } | null,
  formData: FormData
): Promise<{ error?: string }> {
  const info = await getSessionInfo();
  if (!info) return { error: "ログインが必要です" };

  const user = await db.user.findUnique({
    where: { id: info.userId },
    select: { groupCompanyId: true },
  });
  if (!user?.groupCompanyId) return { error: "グループ企業に所属していません" };

  const industry    = (formData.get("industry")    as string)?.trim();
  const targetDesc  = (formData.get("targetDesc")  as string)?.trim() || null;
  const customerId  = (formData.get("customerId")  as string)?.trim() || null;
  const method      = (formData.get("method")      as string)?.trim();
  const messageBody = (formData.get("messageBody") as string)?.trim();
  const result      = (formData.get("result")      as string)?.trim();
  const learnings   = (formData.get("learnings")   as string)?.trim() || null;

  if (!industry)    return { error: "業種を選択してください" };
  if (!method)      return { error: "送信方法を選択してください" };
  if (!messageBody) return { error: "送信文面を入力してください" };
  if (!result)      return { error: "結果を選択してください" };

  try {
    const approach = await db.salesApproach.create({
      data: {
        groupCompanyId: user.groupCompanyId,
        authorId: info.userId,
        industry,
        targetDesc,
        customerId,
        method: method as Prisma.SalesApproachCreateInput["method"],
        messageBody,
        result: result as Prisma.SalesApproachCreateInput["result"],
        learnings,
      },
      include: { groupCompany: { select: { name: true } } },
    });
    logAudit({ action: "sales_approach_created", email: info.email, name: info.staffName, entity: "sales_approach", detail: `${industry} / ${method} / ${result}` });

    // Google Chat 案件進捗スペースに通知
    const resLabel = getResultOption(result).label;
    const methodLabel = getMethodLabel(method);
    const preview = messageBody.length > 100 ? messageBody.slice(0, 100) + "…" : messageBody;
    const chatText = [
      `📋 *アプローチ事例が投稿されました*`,
      ``,
      `👤 ${approach.groupCompany.name}（${info.staffName}）`,
      `🏷 業種: ${industry} ／ 方法: ${methodLabel}`,
      `📊 結果: ${resLabel}`,
      targetDesc ? `🎯 ターゲット: ${targetDesc}` : null,
      ``,
      `💬 文面:`,
      preview,
      learnings ? `\n📝 学び: ${learnings.length > 80 ? learnings.slice(0, 80) + "…" : learnings}` : null,
    ].filter(Boolean).join("\n");

    sendChatMessage("AAQAp6XvXqE", chatText).catch(() => {});
  } catch (e) {
    console.error("[createSalesApproach] error:", e instanceof Error ? e.message : e);
    return { error: "保存に失敗しました" };
  }

  revalidatePath("/dashboard/sales-approaches");
  redirect("/dashboard/sales-approaches");
}

// ---------------------------------------------------------------
// 一覧取得
// ---------------------------------------------------------------
export async function getSalesApproaches(filters?: {
  result?: string;
  industry?: string;
}) {
  const info = await getSessionInfo();
  if (!info) return [];

  const where: Prisma.SalesApproachWhereInput = {};
  if (filters?.result)   where.result   = filters.result as Prisma.SalesApproachWhereInput["result"];
  if (filters?.industry) where.industry = filters.industry;

  return db.salesApproach.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      groupCompany: { select: { name: true, ownerName: true } },
      author: { select: { name: true } },
      customer: { select: { id: true, name: true } },
    },
  });
}

// ---------------------------------------------------------------
// 自拠点の顧客一覧（紐づけ用）
// ---------------------------------------------------------------
export async function getMyCustomersForApproach() {
  const info = await getSessionInfo();
  if (!info) return [];

  const where = info.role === "ADMIN" ? {} : info.branchId ? { branchId: info.branchId } : { branchId: "__none__" };

  return db.customer.findMany({
    where,
    orderBy: { name: "asc" },
    select: { id: true, name: true, industry: true },
    take: 500,
  });
}

// ---------------------------------------------------------------
// 削除（管理者のみ）
// ---------------------------------------------------------------
export async function deleteSalesApproach(id: string): Promise<void> {
  const info = await getSessionInfo();
  if (!info || info.role !== "ADMIN") return;

  try {
    await db.salesApproach.delete({ where: { id } });
    logAudit({ action: "sales_approach_deleted", email: info.email, name: info.staffName, entity: "sales_approach", entityId: id });
  } catch (e) {
    console.error("[deleteSalesApproach] error:", e instanceof Error ? e.message : e);
  }

  revalidatePath("/dashboard/sales-approaches");
}

// ---------------------------------------------------------------
// 集計
// ---------------------------------------------------------------
export async function getSalesApproachStats() {
  const info = await getSessionInfo();
  if (!info) return { total: 0, deal: 0, repliedOk: 0, repliedNg: 0, noReply: 0, rejected: 0 };

  const [total, deal, repliedOk, repliedNg, noReply, rejected] = await Promise.all([
    db.salesApproach.count(),
    db.salesApproach.count({ where: { result: "DEAL" } }),
    db.salesApproach.count({ where: { result: "REPLIED_OK" } }),
    db.salesApproach.count({ where: { result: "REPLIED_NG" } }),
    db.salesApproach.count({ where: { result: "NO_REPLY" } }),
    db.salesApproach.count({ where: { result: "REJECTED" } }),
  ]);

  return { total, deal, repliedOk, repliedNg, noReply, rejected };
}
