"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getMockBranchId } from "@/lib/data/customers";
import type {
  ActivityType,
  DealStatus,
  CustomerRank,
  CustomerStatus,
} from "@/generated/prisma/client";
import type { UserRole } from "@/types/roles";

// ---------------------------------------------------------------
// 新規顧客を登録する
// ---------------------------------------------------------------
export async function createCustomer(
  _prev: { error?: string } | null,
  formData: FormData
): Promise<{ error?: string }> {
  const session = await auth();
  if (!session?.user) return { error: "ログインが必要です" };

  const role = (session.user.role ?? "MANAGER") as UserRole;
  const email = session.user.email ?? "";
  const staffName = session.user.name ?? session.user.email ?? "不明";
  const branchId = getMockBranchId(email, role);

  // ADMIN の場合はフォームから branchId を受け取る（暫定: 本部固定）
  const effectiveBranchId = branchId ?? "branch_hq";

  // ---- 必須項目 ----
  const name = (formData.get("name") as string)?.trim();
  if (!name) return { error: "会社名は必須です" };
  if (name.length > 64) return { error: "会社名は64文字以内で入力してください" };

  // ---- 任意項目 ----
  const nameKana       = (formData.get("nameKana") as string)?.trim() || null;
  const corporateNumber = (formData.get("corporateNumber") as string)?.trim() || null;
  const contactName    = (formData.get("contactName") as string)?.trim() || null;
  const phone          = (formData.get("phone") as string)?.trim() || null;
  const emailField     = (formData.get("email") as string)?.trim() || null;
  const website        = (formData.get("website") as string)?.trim() || null;
  const industry       = (formData.get("industry") as string)?.trim() || null;
  const source         = (formData.get("source") as string)?.trim() || null;
  const rank           = (formData.get("rank") as string) || "B";
  const status         = (formData.get("status") as string) || "PROSPECT";
  const postalCode     = (formData.get("postalCode") as string)?.trim() || null;
  const prefecture     = (formData.get("prefecture") as string)?.trim() || null;
  const address        = (formData.get("address") as string)?.trim() || null;
  const building       = (formData.get("building") as string)?.trim() || null;
  const notes          = (formData.get("notes") as string)?.trim() || null;

  // ---- バリデーション ----
  if (nameKana && nameKana.length > 64)
    return { error: "フリガナは64文字以内で入力してください" };
  if (corporateNumber && !/^\d{13}$/.test(corporateNumber))
    return { error: "法人番号は13桁の数字で入力してください" };
  if (contactName && contactName.length > 64)
    return { error: "担当者名は64文字以内で入力してください" };
  if (phone && phone.length > 20)
    return { error: "電話番号は20文字以内で入力してください" };
  if (address && address.length > 256)
    return { error: "住所は256文字以内で入力してください" };
  if (building && building.length > 128)
    return { error: "ビル名は128文字以内で入力してください" };
  if (notes && notes.length > 1000)
    return { error: "備考は1000文字以内で入力してください" };

  let customerId: string;
  try {
    // ---- 顧客を作成 ----
    const customer = await db.customer.create({
      data: {
        name,
        nameKana,
        corporateNumber,
        contactName,
        email: emailField,
        phone,
        website,
        industry: industry || null,
        source: source || null,
        rank: (rank || "B") as CustomerRank,
        status: (status || "PROSPECT") as CustomerStatus,
        postalCode,
        prefecture: prefecture || null,
        address,
        building,
        notes,
        branchId: effectiveBranchId,
        staffName,
      },
    });

    // ---- 初回商談を自動作成 ----
    await db.deal.create({
      data: {
        title: `${name} 初回商談`,
        status: "PROSPECTING" as DealStatus,
        amount: null,
        customerId: customer.id,
        branchId: effectiveBranchId,
      },
    });

    customerId = customer.id;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[createCustomer] DB error:", msg, e);
    // 開発環境では実際のエラー内容を表示してデバッグを容易にする
    if (process.env.NODE_ENV !== "production") {
      return { error: `保存失敗: ${msg}` };
    }
    return { error: "保存に失敗しました。再度お試しください" };
  }

  redirect(`/dashboard/customers/${customerId}`);
}

// ---------------------------------------------------------------
// 活動履歴を記録する
// ---------------------------------------------------------------
export async function createActivityLog(
  _prev: { error?: string; success?: boolean } | null,
  formData: FormData
): Promise<{ error?: string; success?: boolean }> {
  const customerId = formData.get("customerId") as string;
  const type = formData.get("type") as string;
  const content = (formData.get("content") as string)?.trim();

  if (!customerId) return { error: "顧客IDが不正です" };
  if (!content) return { error: "活動内容を入力してください" };

  const session = await auth();
  const staffName =
    session?.user?.name ?? session?.user?.email ?? "不明";

  await db.activityLog.create({
    data: {
      customerId,
      type: type as ActivityType,
      content,
      staffName,
    },
  });

  revalidatePath(`/dashboard/customers/${customerId}`);
  return { success: true };
}

// ---------------------------------------------------------------
// 商談ステータスを更新する
// ---------------------------------------------------------------
export async function updateDealStatus(
  dealId: string,
  customerId: string,
  status: string
): Promise<void> {
  await db.deal.update({
    where: { id: dealId },
    data: { status: status as DealStatus },
  });
  revalidatePath(`/dashboard/customers/${customerId}`);
}
