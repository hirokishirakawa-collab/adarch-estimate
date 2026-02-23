"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { sendCustomerNotification } from "@/lib/notifications";
import { getMockBranchId } from "@/lib/data/customers";
import type {
  ActivityType,
  DealStatus,
  CustomerRank,
  CustomerStatus,
} from "@/generated/prisma/client";
import type { UserRole } from "@/types/roles";

// 全ユーザーのメールアドレスを収集する
async function getCustomerRecipients(): Promise<string[]> {
  const users = await db.user
    .findMany({ select: { email: true } })
    .catch(() => [] as { email: string | null }[]);
  return users.map((u) => u.email).filter((e): e is string => !!e);
}

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
    if (process.env.NODE_ENV !== "production") {
      return { error: `保存失敗: ${msg}` };
    }
    return { error: "保存に失敗しました。再度お試しください" };
  }

  // 通知（after: レスポンス送信後に確実に実行される）
  const capturedId    = customerId;
  const capturedName  = name;
  const capturedContact = contactName;
  const capturedPref  = prefecture;
  const capturedIndustry = industry;
  const capturedStaff = staffName;
  after(async () => {
    const users = await db.user
      .findMany({ select: { email: true } })
      .catch(() => [] as { email: string | null }[]);
    const userEmails = users
      .map((u) => u.email)
      .filter((e): e is string => !!e);

    await sendCustomerNotification(
      {
        eventType: "CUSTOMER_CREATED",
        customerId: capturedId,
        customerName: capturedName,
        contactName: capturedContact,
        prefecture: capturedPref,
        industry: capturedIndustry,
        staffName: capturedStaff,
      },
      userEmails
    );
  });

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

// ---------------------------------------------------------------
// 顧客情報を更新する（差分を ActivityLog に自動記録）
// ---------------------------------------------------------------

// 項目ラベルマップ
const FIELD_LABELS: Record<string, string> = {
  name:            "会社名",
  nameKana:        "フリガナ",
  corporateNumber: "法人番号",
  contactName:     "先方担当者",
  email:           "メールアドレス",
  phone:           "電話番号",
  website:         "企業URL",
  industry:        "業種",
  source:          "流入経路",
  rank:            "顧客ランク",
  status:          "取引ステータス",
  postalCode:      "郵便番号",
  prefecture:      "都道府県",
  address:         "住所",
  building:        "ビル名",
  notes:           "備考",
};

// 表示ラベル変換（enum 値を読みやすくする）
const RANK_LABELS: Record<string, string> = { A: "A（重要）", B: "B（通常）", C: "C（見込み）", D: "D（取引回避）" };
const STATUS_LABELS: Record<string, string> = { PROSPECT: "見込み", ACTIVE: "取引中", INACTIVE: "休眠", BLOCKED: "取引回避" };

function humanize(field: string, value: string | null): string {
  if (!value) return "（未設定）";
  if (field === "rank")   return RANK_LABELS[value]   ?? value;
  if (field === "status") return STATUS_LABELS[value] ?? value;
  return value;
}

export async function updateCustomer(
  customerId: string,
  _prev: { error?: string } | null,
  formData: FormData
): Promise<{ error?: string }> {
  const session = await auth();
  if (!session?.user) return { error: "ログインが必要です" };
  const staffName = session.user.name ?? session.user.email ?? "不明";

  // 現在の顧客情報を取得
  const current = await db.customer.findUnique({ where: { id: customerId } });
  if (!current) return { error: "顧客が見つかりません" };

  // フォーム値をパース
  const name            = (formData.get("name") as string)?.trim();
  const nameKana        = (formData.get("nameKana") as string)?.trim() || null;
  const corporateNumber = (formData.get("corporateNumber") as string)?.trim() || null;
  const contactName     = (formData.get("contactName") as string)?.trim() || null;
  const phone           = (formData.get("phone") as string)?.trim() || null;
  const emailField      = (formData.get("email") as string)?.trim() || null;
  const website         = (formData.get("website") as string)?.trim() || null;
  const industry        = (formData.get("industry") as string)?.trim() || null;
  const source          = (formData.get("source") as string)?.trim() || null;
  const rank            = (formData.get("rank") as string) || current.rank;
  const status          = (formData.get("status") as string) || current.status;
  const postalCode      = (formData.get("postalCode") as string)?.trim() || null;
  const prefecture      = (formData.get("prefecture") as string)?.trim() || null;
  const address         = (formData.get("address") as string)?.trim() || null;
  const building        = (formData.get("building") as string)?.trim() || null;
  const notes           = (formData.get("notes") as string)?.trim() || null;

  // バリデーション
  if (!name) return { error: "会社名は必須です" };
  if (name.length > 64) return { error: "会社名は64文字以内で入力してください" };
  if (nameKana && nameKana.length > 64) return { error: "フリガナは64文字以内で入力してください" };
  if (corporateNumber && !/^\d{13}$/.test(corporateNumber)) return { error: "法人番号は13桁の数字で入力してください" };
  if (contactName && contactName.length > 64) return { error: "担当者名は64文字以内で入力してください" };
  if (phone && phone.length > 20) return { error: "電話番号は20文字以内で入力してください" };
  if (address && address.length > 256) return { error: "住所は256文字以内で入力してください" };
  if (building && building.length > 128) return { error: "ビル名は128文字以内で入力してください" };
  if (notes && notes.length > 1000) return { error: "備考は1000文字以内で入力してください" };

  // 差分チェック: 変更があった項目のみ抽出
  type FieldKey = keyof typeof FIELD_LABELS;
  const newValues: Record<FieldKey, string | null> = {
    name, nameKana, corporateNumber, contactName,
    email: emailField, phone, website, industry, source,
    rank, status, postalCode, prefecture, address, building, notes,
  };
  const oldValues: Record<FieldKey, string | null> = {
    name:            current.name,
    nameKana:        current.nameKana,
    corporateNumber: current.corporateNumber,
    contactName:     current.contactName,
    email:           current.email,
    phone:           current.phone,
    website:         current.website,
    industry:        current.industry,
    source:          current.source,
    rank:            current.rank,
    status:          current.status,
    postalCode:      current.postalCode,
    prefecture:      current.prefecture,
    address:         current.address,
    building:        current.building,
    notes:           current.notes,
  };

  const changedFields = (Object.keys(FIELD_LABELS) as FieldKey[]).filter(
    (key) => (oldValues[key] ?? null) !== (newValues[key] ?? null)
  );

  try {
    // 顧客情報を更新
    await db.customer.update({
      where: { id: customerId },
      data: {
        name,
        nameKana,
        corporateNumber,
        contactName,
        email: emailField,
        phone,
        website,
        industry,
        source,
        rank:       rank       as CustomerRank,
        status:     status     as CustomerStatus,
        postalCode,
        prefecture,
        address,
        building,
        notes,
      },
    });

    // 変更ログを ActivityLog に自動記録
    if (changedFields.length > 0) {
      await db.activityLog.createMany({
        data: changedFields.map((key) => ({
          customerId,
          type: "SYSTEM" as ActivityType,
          content: `${FIELD_LABELS[key]} を「${humanize(key, oldValues[key])}」から「${humanize(key, newValues[key])}」に変更しました`,
          staffName,
        })),
      });
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[updateCustomer] DB error:", msg, e);
    if (process.env.NODE_ENV !== "production") {
      return { error: `保存失敗: ${msg}` };
    }
    return { error: "保存に失敗しました。再度お試しください" };
  }

  // 通知（変更があった場合のみ）
  if (changedFields.length > 0) {
    const capturedId       = customerId;
    const capturedName     = name;
    const capturedContact  = contactName;
    const capturedPref     = prefecture;
    const capturedIndustry = industry;
    const capturedStaff    = staffName;
    const capturedCount    = changedFields.length;
    after(async () => {
      const recipients = await getCustomerRecipients();
      await sendCustomerNotification(
        {
          eventType:    "CUSTOMER_UPDATED",
          customerId:   capturedId,
          customerName: capturedName,
          contactName:  capturedContact,
          prefecture:   capturedPref,
          industry:     capturedIndustry,
          staffName:    capturedStaff,
          changedCount: capturedCount,
        },
        recipients
      );
    });
  }

  redirect(`/dashboard/customers/${customerId}`);
}

// ---------------------------------------------------------------
// 顧客を一括削除する（ADMIN 専用）
// ---------------------------------------------------------------
export async function deleteCustomers(
  ids: string[]
): Promise<{ error?: string; deleted?: number }> {
  const session = await auth();
  const role = (session?.user?.role ?? "") as UserRole;
  if (role !== "ADMIN") {
    return { error: "この操作は管理者のみ実行できます" };
  }
  if (!ids.length) return { deleted: 0 };

  // 商談を先に削除（外部キー制約）
  await db.deal.deleteMany({ where: { customerId: { in: ids } } });
  // ActivityLog は customerId の cascade delete が schema で設定されている想定、
  // なければ明示的に削除
  await db.activityLog.deleteMany({ where: { customerId: { in: ids } } });
  // 顧客を削除
  const result = await db.customer.deleteMany({ where: { id: { in: ids } } });

  revalidatePath("/dashboard/customers");
  return { deleted: result.count };
}
