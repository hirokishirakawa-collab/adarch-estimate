"use server";

// ============================================================
// 請求申請（本部→クライアントへの代理請求）を MFクラウド請求書に作成する（ADMIN専用）
//   順番: ①Square決済リンク（税込額）→ ②そのリンクを備考に入れてMF請求書を作成
//   取引先＝顧客DB(Customer)。MFに同名の取引先があれば紐づけ、無ければ作成。
//   入金: MFの payment_status=入金済み → 申請の paymentStatus=PAID に反映
// ============================================================

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getSessionInfo } from "@/lib/session";
import { logAudit } from "@/lib/audit";
import { createSquarePaymentLink, deleteSquarePaymentLink, isSquareConfigured } from "@/lib/square";
import { isMfConfigured, mfCreateBilling, mfCreatePartner, mfGetBilling, mfGetPartner, mfIsConnected, mfSearchPartners } from "@/lib/mf-invoice";

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function todayJst(): string {
  return new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Tokyo" });
}
const MF_PAY_LABELS: Record<string, number> = { "未設定": 0, "未入金": 1, "入金済み": 2, "入金済": 2, "未払い": 3, "振込済み": 4, "振込済": 4 };
function parsePayStatus(v: unknown): number | null {
  if (v == null || v === "") return null;
  const s = String(v).trim();
  if (/^\d+$/.test(s)) return Number(s);
  return MF_PAY_LABELS[s] ?? null;
}

export type BillingMfStatus = {
  squareConfigured: boolean;
  mfConfigured: boolean;
  mfConnected: boolean;
};
export async function getBillingMfStatus(): Promise<BillingMfStatus> {
  const info = await getSessionInfo();
  if (!info || info.role !== "ADMIN") return { squareConfigured: false, mfConfigured: false, mfConnected: false };
  return { squareConfigured: isSquareConfigured(), mfConfigured: isMfConfigured(), mfConnected: await mfIsConnected() };
}

async function resolveCustomerDepartment(c: { id: string; name: string; contactName: string | null; email: string | null; postalCode: string | null; prefecture: string | null; address: string | null; mfPartnerName: string | null; mfDepartmentId: string | null }, fallbackContact: { name: string | null; email: string | null }): Promise<{ departmentId: string; created: boolean; partnerName: string }> {
  if (c.mfDepartmentId) return { departmentId: c.mfDepartmentId, created: false, partnerName: c.mfPartnerName ?? c.name };
  const norm = (v: string) => v.replace(/[\s　]/g, "").replace(/株式会社|（株）|\(株\)|㈱/g, "");
  for (const nm of [c.mfPartnerName, c.name].filter((v): v is string => !!v)) {
    const found = await mfSearchPartners(nm);
    const exact = found.find((p) => norm(p.name) === norm(nm)) ?? (found.length === 1 ? found[0] : undefined);
    if (exact) {
      const full = exact.departments?.length ? exact : await mfGetPartner(exact.id);
      const dep = full.departments?.[0];
      if (dep?.id) {
        await db.customer.update({ where: { id: c.id }, data: { mfPartnerId: full.id, mfDepartmentId: dep.id, mfPartnerName: full.name } });
        return { departmentId: dep.id, created: false, partnerName: full.name };
      }
    }
  }
  const created = await mfCreatePartner({ name: c.name, personName: c.contactName ?? fallbackContact.name, email: c.email ?? fallbackContact.email });
  const dep = created.departments?.[0];
  if (!dep?.id) throw new Error(`MF取引先を作成しましたが部署IDが取れません（${c.name}）`);
  await db.customer.update({ where: { id: c.id }, data: { mfPartnerId: created.id, mfDepartmentId: dep.id, mfPartnerName: created.name } });
  return { departmentId: dep.id, created: true, partnerName: created.name };
}

/// 請求申請1件をMFに作成（必要ならSquareリンクを先に作る）。
export async function createMfBillingForInvoiceRequest(input: { id: string; billingDate?: string; withCardLink: boolean }): Promise<{ error?: string; billingNumber?: string; squareUrl?: string | null; partnerCreated?: boolean }> {
  const info = await getSessionInfo();
  if (!info || info.role !== "ADMIN") return { error: "権限がありません" };
  if (!isMfConfigured()) return { error: "MF_CLIENT_ID / MF_CLIENT_SECRET が未設定です" };
  if (!(await mfIsConnected())) return { error: "MF未接続です（ロイヤリティ状況の「MFに接続」から承認してください）" };
  if (input.billingDate && !/^\d{4}-\d{2}-\d{2}$/.test(input.billingDate)) return { error: "請求日が不正です" };

  const ir = await db.invoiceRequest.findUnique({
    where: { id: input.id },
    include: {
      customer: { select: { id: true, name: true, contactName: true, email: true, postalCode: true, prefecture: true, address: true, mfPartnerName: true, mfDepartmentId: true } },
      medias: { orderBy: { sortOrder: "asc" } },
      createdBy: { select: { name: true, groupCompany: { select: { name: true } } } },
    },
  });
  if (!ir) return { error: "請求申請が見つかりません" };
  if (ir.status !== "SUBMITTED") return { error: "提出済みの申請のみMFに作成できます" };
  if (ir.mfBillingId) return { error: `MF請求書は作成済みです（${ir.mfBillingNumber ?? ir.mfBillingId}）`, billingNumber: ir.mfBillingNumber ?? undefined };
  if (!ir.customer) return { error: "顧客（請求先）が紐づいていません。申請を編集して顧客を選んでください" };
  if (!ir.dueDate) return { error: "支払期限が未設定です。申請を編集して支払期限を入れてください" };

  const amountExclTax = Math.round(Number(ir.amountExclTax));
  const amountInclTax = Math.round(Number(ir.amountInclTax));
  const billingDate = input.billingDate || ymd(new Date(ir.billingDate));
  const dueDate = ymd(new Date(ir.dueDate));
  if (billingDate > dueDate) return { error: `請求日（${billingDate}）が支払期限（${dueDate}）より後です` };

  // ① Square決済リンク（税込額）。既存リンクが同額ならそのまま、違えば作り直し
  let squareUrl: string | null = ir.squareLinkUrl ?? null;
  if (input.withCardLink) {
    if (!isSquareConfigured()) return { error: "Squareが未設定です（カード決済リンクを外すか、SQUARE_* を設定してください）" };
    if (!ir.squareLinkId || ir.squareLinkAmount !== amountInclTax) {
      const name = `${ir.customer.name} ${ir.subject}`.slice(0, 255);
      const res = await createSquarePaymentLink({ name, amountJpy: amountInclTax, paymentNote: `${ir.customer.name} / ${ir.subject}（税込¥${amountInclTax.toLocaleString("ja-JP")}）`, description: `Ad Arch株式会社 ご請求「${ir.subject}」\n税抜 ¥${amountExclTax.toLocaleString("ja-JP")} ＋ 消費税 ＝ 税込 ¥${amountInclTax.toLocaleString("ja-JP")}` });
      if (res.error || !res.link) return { error: `Squareリンク作成に失敗: ${res.error ?? "不明"}` };
      if (ir.squareLinkId) await deleteSquarePaymentLink(ir.squareLinkId).catch(() => undefined);
      await db.invoiceRequest.update({ where: { id: ir.id }, data: { squareLinkId: res.link.id, squareLinkUrl: res.link.url, squareLinkAmount: amountInclTax } });
      squareUrl = res.link.url;
    }
  } else {
    squareUrl = null;
  }

  // ② MF請求書
  try {
    const dep = await resolveCustomerDepartment(ir.customer, { name: ir.contactName, email: ir.contactEmail });
    const items = ir.kind === "MEDIA" && ir.medias.length > 0
      ? ir.medias.map((m) => ({ name: `${m.name} 広告出稿費`, price: Math.round(Number(m.billedExclTax)), quantity: 1 }))
      : [{ name: ir.subject.slice(0, 450), ...(ir.details ? { detail: ir.details.slice(0, 2000) } : {}), price: amountExclTax, quantity: 1 }];
    if (items.reduce((s, it) => s + it.price, 0) !== amountExclTax) {
      items.splice(0, items.length, { name: ir.subject.slice(0, 450), ...(ir.details ? { detail: ir.details.slice(0, 2000) } : {}), price: amountExclTax, quantity: 1 });
    }
    // 備考に金額は書かない（明細欄が正・MFの端数処理と食い違わせない）
    const note = [
      ir.details ? `【内訳】\n${ir.details}` : null,
      "",
      squareUrl ? `■ クレジットカードでのお支払いはこちら: ${squareUrl}` : null,
      squareUrl ? `　※このリンクは本請求書（${ir.customer.name}様・「${ir.subject}」）専用です。他のご請求のお支払いには使えません` : null,
      squareUrl ? `　※今回のご請求限りのリンクです。次回以降は毎回新しいリンクをご案内します` : null,
      "■ お振込の場合は本請求書記載の口座へお願いいたします（振込手数料はご負担ください）",
    ].filter((l): l is string => l !== null).join("\n");

    const b = await mfCreateBilling({
      departmentId: dep.departmentId,
      billingDate,
      dueDate,
      title: ir.subject,
      note,
      memo: `OS請求申請 ${ir.id} / 申請者 ${ir.createdBy?.name ?? ir.creatorEmail}（${ir.createdBy?.groupCompany?.name ?? ""}）/ 作成 ${todayJst()}${ir.notes ? ` / 申請備考: ${ir.notes.slice(0, 200)}` : ""}`,
      items,
    });
    await db.invoiceRequest.update({
      where: { id: ir.id },
      data: { mfBillingId: b.id, mfBillingNumber: b.billing_number ?? null, mfPdfUrl: b.pdf_url ?? null, mfPaymentStatus: parsePayStatus(b.payment_status), mfSyncedAt: new Date() },
    });
    logAudit({ action: "invoice_request_mf_billing_created", email: info.email, name: info.staffName, entity: "invoice_request", entityId: ir.id, detail: `${ir.customer.name}「${ir.subject}」→ MF請求書 ${b.billing_number ?? b.id} ¥${amountInclTax.toLocaleString("ja-JP")}${squareUrl ? ` / Square ${squareUrl}` : ""}` });
    revalidatePath(`/dashboard/billing/${ir.id}`);
    revalidatePath("/dashboard/billing");
    return { billingNumber: b.billing_number ?? b.id, squareUrl, partnerCreated: dep.created };
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e), squareUrl };
  }
}

/// MFの入金状況を取り込み、入金済みなら申請を支払済みに。
export async function syncMfPaymentForInvoiceRequest(id: string): Promise<{ error?: string; status?: number | null; markedPaid?: boolean }> {
  const info = await getSessionInfo();
  if (!info || info.role !== "ADMIN") return { error: "権限がありません" };
  const ir = await db.invoiceRequest.findUnique({ where: { id }, select: { id: true, mfBillingId: true, paymentStatus: true, mfBillingNumber: true } });
  if (!ir?.mfBillingId) return { error: "MF請求書が未作成です" };
  try {
    const b = await mfGetBilling(ir.mfBillingId);
    const st = parsePayStatus(b.payment_status);
    const markPaid = st === 2 && ir.paymentStatus !== "PAID";
    await db.invoiceRequest.update({
      where: { id },
      data: { mfPaymentStatus: st, mfSyncedAt: new Date(), mfBillingNumber: b.billing_number ?? ir.mfBillingNumber, mfPdfUrl: b.pdf_url ?? undefined, ...(markPaid ? { paymentStatus: "PAID", paidAt: new Date() } : {}) },
    });
    if (markPaid) logAudit({ action: "invoice_request_paid_via_mf", email: info.email, name: info.staffName, entity: "invoice_request", entityId: id, detail: `MF入金済み（${b.billing_number ?? ir.mfBillingId}）→ 支払済み` });
    revalidatePath(`/dashboard/billing/${id}`);
    revalidatePath("/dashboard/billing");
    return { status: st, markedPaid: markPaid };
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}
