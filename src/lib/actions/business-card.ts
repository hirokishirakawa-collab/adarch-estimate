"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { db } from "@/lib/db";
import { getSessionInfo } from "@/lib/session";
import { logAudit } from "@/lib/audit";
import { uploadBusinessCardImage } from "@/lib/storage";

// ---------------------------------------------------------------
// 名刺を新規登録する
// ---------------------------------------------------------------
export async function createBusinessCard(
  _prev: { error?: string } | null,
  formData: FormData
): Promise<{ error?: string }> {
  const info = await getSessionInfo();
  if (!info) return { error: "ログインが必要です" };

  const companyName = (formData.get("companyName") as string)?.trim();
  const lastName = (formData.get("lastName") as string)?.trim();

  if (!companyName) return { error: "会社名は必須です" };
  if (!lastName) return { error: "姓は必須です" };

  // 画像アップロード
  const imageFile = formData.get("cardImage") as File | null;
  let cardImageUrl: string | null = null;
  if (imageFile && imageFile.size > 0) {
    cardImageUrl = await uploadBusinessCardImage(imageFile);
  }

  const firstName = (formData.get("firstName") as string)?.trim() || null;

  let cardId: string;
  try {
    const card = await db.businessCard.create({
      data: {
        companyName,
        department: (formData.get("department") as string)?.trim() || null,
        title: (formData.get("title") as string)?.trim() || null,
        lastName,
        firstName,
        email: (formData.get("email") as string)?.trim() || null,
        companyPhone: (formData.get("companyPhone") as string)?.trim() || null,
        directPhone: (formData.get("directPhone") as string)?.trim() || null,
        mobilePhone: (formData.get("mobilePhone") as string)?.trim() || null,
        fax: (formData.get("fax") as string)?.trim() || null,
        postalCode: (formData.get("postalCode") as string)?.trim() || null,
        address: (formData.get("address") as string)?.trim() || null,
        prefecture: (formData.get("prefecture") as string)?.trim() || null,
        url: (formData.get("url") as string)?.trim() || null,
        tags: (formData.get("tags") as string)?.trim() || null,
        wantsCollab: formData.get("wantsCollab") === "on",
        isOrdered: formData.get("isOrdered") === "on",
        isCompetitor: formData.get("isCompetitor") === "on",
        isCreator: formData.get("isCreator") === "on",
        cardImageUrl,
        ownerId: info.userId,
      },
    });
    cardId = card.id;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("Unique constraint")) {
      return { error: "同じ会社名・姓名の名刺が既に存在します" };
    }
    return { error: "名刺の登録に失敗しました" };
  }

  after(async () => {
    await logAudit({
      action: "business_card_created",
      email: info.email,
      name: info.staffName,
      entity: "business_card",
      entityId: cardId,
      detail: `${companyName} ${lastName}の名刺を登録`,
    });
  });

  revalidatePath("/dashboard/business-cards");
  redirect(`/dashboard/business-cards/${cardId}`);
}

// ---------------------------------------------------------------
// 名刺を更新する
// ---------------------------------------------------------------
export async function updateBusinessCard(
  _prev: { error?: string } | null,
  formData: FormData
): Promise<{ error?: string }> {
  const info = await getSessionInfo();
  if (!info) return { error: "ログインが必要です" };

  const cardId = (formData.get("cardId") as string)?.trim();
  if (!cardId) return { error: "名刺IDが必要です" };

  const card = await db.businessCard.findUnique({
    where: { id: cardId },
    select: { ownerId: true },
  });
  if (!card) return { error: "名刺が見つかりません" };

  // 権限チェック: ADMIN または所有者
  if (info.role !== "ADMIN" && card.ownerId !== info.userId) {
    return { error: "この名刺を編集する権限がありません" };
  }

  const companyName = (formData.get("companyName") as string)?.trim();
  const lastName = (formData.get("lastName") as string)?.trim();

  if (!companyName) return { error: "会社名は必須です" };
  if (!lastName) return { error: "姓は必須です" };

  try {
    await db.businessCard.update({
      where: { id: cardId },
      data: {
        companyName,
        department: (formData.get("department") as string)?.trim() || null,
        title: (formData.get("title") as string)?.trim() || null,
        lastName,
        firstName: (formData.get("firstName") as string)?.trim() || null,
        email: (formData.get("email") as string)?.trim() || null,
        companyPhone: (formData.get("companyPhone") as string)?.trim() || null,
        directPhone: (formData.get("directPhone") as string)?.trim() || null,
        mobilePhone: (formData.get("mobilePhone") as string)?.trim() || null,
        fax: (formData.get("fax") as string)?.trim() || null,
        postalCode: (formData.get("postalCode") as string)?.trim() || null,
        address: (formData.get("address") as string)?.trim() || null,
        prefecture: (formData.get("prefecture") as string)?.trim() || null,
        url: (formData.get("url") as string)?.trim() || null,
        tags: (formData.get("tags") as string)?.trim() || null,
        wantsCollab: formData.get("wantsCollab") === "on",
        isOrdered: formData.get("isOrdered") === "on",
        isCompetitor: formData.get("isCompetitor") === "on",
        isCreator: formData.get("isCreator") === "on",
      },
    });
  } catch {
    return { error: "名刺の更新に失敗しました" };
  }

  after(async () => {
    await logAudit({
      action: "business_card_updated",
      email: info.email,
      name: info.staffName,
      entity: "business_card",
      entityId: cardId,
      detail: `${companyName} ${lastName}の名刺を更新`,
    });
  });

  revalidatePath("/dashboard/business-cards");
  revalidatePath(`/dashboard/business-cards/${cardId}`);
  redirect(`/dashboard/business-cards/${cardId}`);
}

// ---------------------------------------------------------------
// 名刺フラグをトグルする（ADMIN or 所有者）
// ---------------------------------------------------------------
export async function toggleBusinessCardFlag(
  cardId: string,
  flagName: "isCompetitor" | "isOrdered" | "wantsCollab" | "isCreator",
  value: boolean
): Promise<{ error?: string }> {
  const info = await getSessionInfo();
  if (!info) return { error: "ログインが必要です" };

  const card = await db.businessCard.findUnique({
    where: { id: cardId },
    select: { ownerId: true, companyName: true, lastName: true },
  });
  if (!card) return { error: "名刺が見つかりません" };

  if (info.role !== "ADMIN" && card.ownerId !== info.userId) {
    return { error: "この名刺を編集する権限がありません" };
  }

  const flagLabels: Record<string, string> = {
    isCompetitor: "競合",
    isOrdered: "受注済み",
    wantsCollab: "コラボ希望",
    isCreator: "クリエイター",
  };

  try {
    await db.businessCard.update({
      where: { id: cardId },
      data: { [flagName]: value },
    });
  } catch {
    return { error: "フラグの更新に失敗しました" };
  }

  after(async () => {
    await logAudit({
      action: "business_card_flag_toggled",
      email: info.email,
      name: info.staffName,
      entity: "business_card",
      entityId: cardId,
      detail: `${card.companyName} ${card.lastName}：${flagLabels[flagName]}を${value ? "ON" : "OFF"}`,
    });
  });

  revalidatePath(`/dashboard/business-cards/${cardId}`);
  revalidatePath("/dashboard/business-cards");
  return {};
}

// ---------------------------------------------------------------
// 名刺の所有者を変更する（ADMIN 限定）
// ---------------------------------------------------------------
export async function changeBusinessCardOwner(
  cardId: string,
  newOwnerId: string
): Promise<{ error?: string }> {
  const info = await getSessionInfo();
  if (!info) return { error: "ログインが必要です" };
  if (info.role !== "ADMIN") return { error: "管理者のみ変更できます" };

  const card = await db.businessCard.findUnique({
    where: { id: cardId },
    select: { companyName: true, lastName: true },
  });
  if (!card) return { error: "名刺が見つかりません" };

  const newOwner = await db.user.findUnique({
    where: { id: newOwnerId },
    select: { name: true },
  });
  if (!newOwner) return { error: "ユーザーが見つかりません" };

  try {
    await db.businessCard.update({
      where: { id: cardId },
      data: { ownerId: newOwnerId },
    });
  } catch {
    return { error: "所有者の変更に失敗しました" };
  }

  after(async () => {
    await logAudit({
      action: "business_card_owner_changed",
      email: info.email,
      name: info.staffName,
      entity: "business_card",
      entityId: cardId,
      detail: `${card.companyName} ${card.lastName}の所有者を${newOwner.name}に変更`,
    });
  });

  revalidatePath(`/dashboard/business-cards/${cardId}`);
  revalidatePath("/dashboard/business-cards");
  return {};
}

// ---------------------------------------------------------------
// 名刺を単体削除する（ADMIN 限定）
// ---------------------------------------------------------------
export async function deleteBusinessCard(
  id: string
): Promise<{ error?: string }> {
  const info = await getSessionInfo();
  if (!info) return { error: "ログインが必要です" };
  if (info.role !== "ADMIN") return { error: "管理者のみ削除できます" };

  try {
    // 関連する開示申請を先に削除
    await db.disclosureRequest.deleteMany({ where: { businessCardId: id } });
    await db.businessCard.delete({ where: { id } });
    logAudit({
      action: "business_card_deleted",
      email: info.email,
      name: info.staffName,
      entity: "business_card",
      entityId: id,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[deleteBusinessCard] DB error:", msg);
    return { error: "削除に失敗しました" };
  }

  revalidatePath("/dashboard/business-cards");
  redirect("/dashboard/business-cards");
}

// ---------------------------------------------------------------
// 名刺を一括削除する（ADMIN 限定）
// ---------------------------------------------------------------
export async function deleteBusinessCards(
  ids: string[]
): Promise<{ error?: string; deleted?: number }> {
  const info = await getSessionInfo();
  if (!info) return { error: "ログインが必要です" };
  if (info.role !== "ADMIN") return { error: "管理者のみ削除できます" };
  if (!ids.length) return { deleted: 0 };

  try {
    // 関連する開示申請を先に削除
    await db.disclosureRequest.deleteMany({
      where: { businessCardId: { in: ids } },
    });
    const result = await db.businessCard.deleteMany({
      where: { id: { in: ids } },
    });
    logAudit({
      action: "business_card_deleted",
      email: info.email,
      name: info.staffName,
      entity: "business_card",
      detail: `${result.count}件削除`,
    });

    revalidatePath("/dashboard/business-cards");
    return { deleted: result.count };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[deleteBusinessCards] DB error:", msg);
    return { error: "削除に失敗しました。再度お試しください" };
  }
}
