"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { db } from "@/lib/db";
import { getSessionInfo } from "@/lib/session";
import { logAudit } from "@/lib/audit";
import { sendDisclosureNotification } from "@/lib/notifications";

// ---------------------------------------------------------------
// 開示申請を送信する
// ---------------------------------------------------------------
export async function requestDisclosure(
  _prev: { error?: string } | null,
  formData: FormData
): Promise<{ error?: string }> {
  const info = await getSessionInfo();
  if (!info) return { error: "ログインが必要です" };

  const businessCardId = (formData.get("businessCardId") as string)?.trim();
  const purpose = (formData.get("purpose") as string)?.trim();

  if (!businessCardId) return { error: "名刺IDが必要です" };
  if (!purpose) return { error: "開示目的を入力してください" };
  if (purpose.length > 1000) return { error: "開示目的は1000文字以内で入力してください" };

  // 名刺の存在確認
  const card = await db.businessCard.findUnique({
    where: { id: businessCardId },
    select: { id: true, companyName: true, lastName: true, firstName: true, ownerId: true, owner: { select: { email: true } } },
  });
  if (!card) return { error: "名刺が見つかりません" };

  // 自分の名刺には申請不要
  if (card.ownerId === info.userId) {
    return { error: "自分の名刺には開示申請は不要です" };
  }

  // 既存申請チェック
  const existing = await db.disclosureRequest.findUnique({
    where: {
      businessCardId_requesterId: {
        businessCardId,
        requesterId: info.userId,
      },
    },
  });
  if (existing) return { error: "既にこの名刺への開示申請が存在します" };

  let requestId: string;
  try {
    const request = await db.disclosureRequest.create({
      data: {
        businessCardId,
        requesterId: info.userId,
        purpose,
      },
    });
    requestId = request.id;
  } catch {
    return { error: "開示申請の作成に失敗しました" };
  }

  after(async () => {
    await logAudit({
      action: "disclosure_requested",
      email: info.email,
      name: info.staffName,
      entity: "disclosure_request",
      entityId: requestId,
      detail: `${card.companyName} ${card.lastName}への開示申請`,
    });

    await sendDisclosureNotification({
      eventType: "DISCLOSURE_REQUESTED",
      requestId,
      cardOwnerName: card.lastName + (card.firstName ?? ""),
      companyName: card.companyName,
      requesterName: info.staffName,
      purpose,
      cardOwnerEmail: card.owner.email,
    });
  });

  revalidatePath(`/dashboard/business-cards/${businessCardId}`);
  redirect(`/dashboard/business-cards/${businessCardId}`);
}

// ---------------------------------------------------------------
// 開示申請を審査する（ADMIN / 所有者）
// ---------------------------------------------------------------
export async function reviewDisclosure(
  _prev: { error?: string } | null,
  formData: FormData
): Promise<{ error?: string }> {
  const info = await getSessionInfo();
  if (!info) return { error: "ログインが必要です" };

  const requestId = (formData.get("requestId") as string)?.trim();
  const action = (formData.get("action") as string)?.trim();
  const reviewNote = (formData.get("reviewNote") as string)?.trim() || null;

  if (!requestId) return { error: "申請IDが必要です" };
  if (action !== "APPROVED" && action !== "REJECTED") {
    return { error: "承認または却下を選択してください" };
  }

  const request = await db.disclosureRequest.findUnique({
    where: { id: requestId },
    include: {
      businessCard: { select: { ownerId: true, companyName: true, lastName: true, firstName: true } },
      requester: { select: { email: true, name: true } },
    },
  });

  if (!request) return { error: "申請が見つかりません" };
  if (request.status !== "PENDING") return { error: "この申請は既に審査済みです" };

  // 権限チェック: ADMIN または名刺所有者
  const isOwner = request.businessCard.ownerId === info.userId;
  if (info.role !== "ADMIN" && !isOwner) {
    return { error: "この申請を審査する権限がありません" };
  }

  try {
    await db.disclosureRequest.update({
      where: { id: requestId },
      data: {
        status: action,
        reviewedById: info.userId,
        reviewNote,
        reviewedAt: new Date(),
      },
    });
  } catch {
    return { error: "審査の保存に失敗しました" };
  }

  after(async () => {
    await logAudit({
      action: `disclosure_${action.toLowerCase()}`,
      email: info.email,
      name: info.staffName,
      entity: "disclosure_request",
      entityId: requestId,
      detail: `${request.businessCard.companyName} ${request.businessCard.lastName}の開示申請を${action === "APPROVED" ? "承認" : "却下"}`,
    });

    await sendDisclosureNotification({
      eventType: action === "APPROVED" ? "DISCLOSURE_APPROVED" : "DISCLOSURE_REJECTED",
      requestId,
      cardOwnerName: request.businessCard.lastName + (request.businessCard.firstName ?? ""),
      companyName: request.businessCard.companyName,
      requesterName: request.requester.name ?? request.requester.email,
      requesterEmail: request.requester.email,
      reviewNote,
    });
  });

  revalidatePath("/dashboard/business-cards/requests");
  revalidatePath(`/dashboard/business-cards/${request.businessCardId}`);
  redirect("/dashboard/business-cards/requests");
}
