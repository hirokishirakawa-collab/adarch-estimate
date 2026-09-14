"use server";

// ==============================================================
// TVer小口申込 — 本部の操作（ADMINだけ。ページ側の判定と二重）
//   相談の段（面談済み→業態考査→発注書）／状態を進める／お客様への連絡文／入金の手動確定／MF入金取込／請求書の再発行／返金・取り下げ
// ==============================================================

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getSessionInfo } from "@/lib/session";
import { logAudit } from "@/lib/audit";
import type { TverOrderStatus } from "@/generated/prisma/client";
import { confirmInvoicePayment, issueInvoice, issueNextInvoiceNow, issueOrderDocument, markConsulted, notifyTverOrderStatus, recordPreReview, saveReviewInfo, syncBankTransferFromMf } from "@/lib/tver-order/service";
import { orderNumberLabel } from "@/lib/tver-order/plans";

const PATH = "/dashboard/admin/tver-orders";
type R = { error?: string; ok?: boolean; message?: string };

async function admin() {
  const info = await getSessionInfo();
  if (!info || info.role !== "ADMIN") return null;
  return info;
}

const ALLOWED: TverOrderStatus[] = ["PAID", "REVIEWING", "MATERIAL_WAITING", "MATERIAL_RECEIVED", "LIVE", "COMPLETED", "CANCELLED", "REFUNDED"];

/** 状態を進める（＋お客様向け連絡文・配信期間・レポートURL・内部メモ）。進めたらお客様へメール */
export async function updateTverOrder(id: string, fd: FormData): Promise<R> {
  const info = await admin();
  if (!info) return { error: "権限がありません" };
  const o = await db.tverOrder.findUnique({ where: { id } });
  if (!o) return { error: "申込が見つかりません" };
  const s = (k: string) => String(fd.get(k) ?? "").trim();
  const status = s("status") as TverOrderStatus;
  if (!ALLOWED.includes(status)) return { error: "無効な状態です" };
  if (!o.paidAt && !["CANCELLED"].includes(status)) return { error: "入金未確認の申込は取り下げしかできません（入金は「入金を確認」から）" };
  const liveStart = s("liveStartDate") ? new Date(s("liveStartDate")) : null;
  const liveEnd = s("liveEndDate") ? new Date(s("liveEndDate")) : null;
  const notify = s("notify") === "1";
  const changed = o.status !== status;
  await db.tverOrder.update({
    where: { id },
    data: {
      status,
      customerNote: s("customerNote").slice(0, 2000) || null,
      adminNote: s("adminNote").slice(0, 4000) || null,
      liveStartDate: liveStart && !isNaN(liveStart.getTime()) ? liveStart : o.liveStartDate,
      liveEndDate: liveEnd && !isNaN(liveEnd.getTime()) ? liveEnd : o.liveEndDate,
      reportUrl: s("reportUrl").slice(0, 500) || null,
      refundedAt: status === "REFUNDED" ? o.refundedAt ?? new Date() : o.refundedAt,
    },
  });
  logAudit({ action: "tver_order_status_updated", email: info.email, name: info.staffName, entity: "tver_order", entityId: id, detail: `${orderNumberLabel(o.number, o.createdAt)} ${o.status} → ${status}${notify ? "（お客様へメール）" : ""}` });
  if (notify && (changed || s("customerNote"))) await notifyTverOrderStatus(id);
  revalidatePath(PATH);
  revalidatePath(`${PATH}/${id}`);
  return { ok: true, message: changed ? `「${status}」に更新しました${notify ? "・お客様へメールしました" : ""}` : "保存しました" };
}

/** 請求1件の入金を手動で確定（振込の通帳確認／Webhook取りこぼし）。初月なら契約成立 */
export async function confirmPaymentManually(invoiceId: string, note: string): Promise<R> {
  const info = await admin();
  if (!info) return { error: "権限がありません" };
  const inv = await db.tverOrderInvoice.findUnique({ where: { id: invoiceId }, select: { status: true, amountInclTax: true, method: true, orderId: true, seq: true } });
  if (!inv) return { error: "請求が見つかりません" };
  if (inv.status === "PAID") return { error: "入金確認済みです" };
  await confirmInvoicePayment(invoiceId, { amount: inv.amountInclTax, note: note.trim().slice(0, 200) || (inv.method === "BANK_TRANSFER" ? "銀行振込（本部が手動確認）" : "手動確認"), paidAt: new Date(), actorEmail: info.email });
  revalidatePath(PATH);
  revalidatePath(`${PATH}/${inv.orderId}`);
  return { ok: true, message: `${inv.seq}ヶ月目の入金を確定しました${inv.seq === 1 ? "（契約成立・お客様へ確認メール）" : ""}` };
}

/** MFの入金状況を取り込む（振込・未払いの請求すべて） */
export async function syncMfPayment(id: string): Promise<R> {
  const info = await admin();
  if (!info) return { error: "権限がありません" };
  const r = await syncBankTransferFromMf(id, info.email);
  revalidatePath(PATH);
  revalidatePath(`${PATH}/${id}`);
  if (r.error) return { error: r.error };
  return { ok: true, message: r.paid ? `MFで入金済み ${r.paid}件を確定しました` : "MFではまだ未入金です" };
}

/** 請求1件を（再）発行してメール（振込＝MF請求書／カード＝リンク） */
export async function reissueInvoice(invoiceId: string): Promise<R> {
  const info = await admin();
  if (!info) return { error: "権限がありません" };
  const inv = await db.tverOrderInvoice.findUnique({ where: { id: invoiceId }, select: { orderId: true, seq: true, method: true } });
  if (!inv) return { error: "請求が見つかりません" };
  // カードは作り直し＝古いリンクを外してから
  if (inv.method === "CARD") await db.tverOrderInvoice.update({ where: { id: invoiceId }, data: { squareLinkId: null, squareOrderId: null, squareLinkUrl: null } });
  const r = await issueInvoice(invoiceId, { mailCardLink: true });
  logAudit({ action: "tver_order_invoice_issued", email: info.email, name: info.staffName, entity: "tver_order", entityId: inv.orderId, detail: r.ok ? `${inv.seq}ヶ月目 ${r.billingNumber ?? r.url ?? ""}` : `失敗: ${r.error}` });
  revalidatePath(`${PATH}/${inv.orderId}`);
  return r.ok ? { ok: true, message: `${inv.seq}ヶ月目の請求を発行しメールしました` } : { error: r.error };
}

/** 次の月の請求を今すぐ発行（cronを待たない） */
export async function issueNextInvoice(orderId: string): Promise<R> {
  const info = await admin();
  if (!info) return { error: "権限がありません" };
  const r = await issueNextInvoiceNow(orderId);
  logAudit({ action: "tver_order_invoice_issued", email: info.email, name: info.staffName, entity: "tver_order", entityId: orderId, detail: r.ok ? `${r.seq}ヶ月目を手動発行` : `失敗: ${r.error}` });
  revalidatePath(`${PATH}/${orderId}`);
  return r.ok ? { ok: true, message: `${r.seq}ヶ月目の請求を発行しメールしました` } : { error: r.error };
}

/** 一括取り下げ（未入金の申込だけ。入金済みは契約・財務記録なので消さない） */
export async function cancelUnpaidOrders(ids: string[]): Promise<R> {
  const info = await admin();
  if (!info) return { error: "権限がありません" };
  const list = ids.filter((v) => typeof v === "string" && v.length > 0).slice(0, 200);
  if (list.length === 0) return { error: "対象がありません" };
  const r = await db.tverOrder.updateMany({ where: { id: { in: list }, paidAt: null, status: { in: ["CONSULTING", "PRE_REVIEWING", "ORDER_ISSUED", "AWAITING_PAYMENT"] } }, data: { status: "CANCELLED" } });
  logAudit({ action: "tver_order_bulk_cancelled", email: info.email, name: info.staffName, entity: "tver_order", detail: `${r.count}件を取り下げ（未入金のみ）` });
  revalidatePath(PATH);
  return { ok: true, message: `${r.count}件を取り下げました（入金済みは対象外）` };
}

// ---------------------------------------------------------------
// 相談の段（2026-09-14〜）: 面談済み → 業態考査 → 発注書。発注書を出せるのは本部だけ（代表決定）
// ---------------------------------------------------------------
function done(id: string) {
  revalidatePath(PATH);
  revalidatePath(`${PATH}/${id}`);
}

/** 面談・電話で確認した（記録を残して業態考査の段へ。考査の情報が未記入ならお客様へ記入のお願いメール） */
export async function markTverConsulted(id: string, note: string): Promise<R> {
  const info = await admin();
  if (!info) return { error: "権限がありません" };
  const r = await markConsulted(id, note, { email: info.email, name: info.staffName });
  done(id);
  return r.ok ? { ok: true, message: "面談済みにしました（業態考査の段へ）" } : { error: r.error };
}

/** 業態考査の5項目を本部が保存（面談で聞いた内容） */
export async function saveTverReviewInfo(id: string, fd: FormData): Promise<R> {
  const info = await admin();
  if (!info) return { error: "権限がありません" };
  const s = (k: string) => String(fd.get(k) ?? "").trim();
  const r = await saveReviewInfo({ id }, { websiteUrl: s("websiteUrl"), corporateNumber: s("corporateNumber"), hasNoCorporateNumber: fd.get("hasNoCorporateNumber") === "on", productName: s("productName"), productUrl: s("productUrl") }, { email: info.email, name: info.staffName });
  done(id);
  return r.ok ? { ok: true, message: "業態考査の情報を保存しました" } : { error: r.error };
}

/** 業態考査を申請した／OK／見送り */
export async function recordTverPreReview(id: string, step: "SUBMITTED" | "APPROVED" | "REJECTED", note: string): Promise<R> {
  const info = await admin();
  if (!info) return { error: "権限がありません" };
  if (!["SUBMITTED", "APPROVED", "REJECTED"].includes(step)) return { error: "無効な操作です" };
  const r = await recordPreReview(id, step, note, { email: info.email, name: info.staffName });
  done(id);
  if (!r.ok) return { error: r.error };
  return { ok: true, message: step === "SUBMITTED" ? "業態考査を申請済みにしました" : step === "APPROVED" ? "考査OK。発注書を発行できます" : "見送りにしました（お客様へメール）" };
}

/** 発注書を発行（プラン・期間・動画の有無は面談の結果で確定。金額はOSの料金で再計算）→ お客様へメール */
export async function issueTverOrderDocument(id: string, fd: FormData): Promise<R> {
  const info = await admin();
  if (!info) return { error: "権限がありません" };
  const r = await issueOrderDocument(id, { planKey: String(fd.get("planKey") ?? ""), months: Number(fd.get("months") ?? 0), hasVideo: fd.get("hasVideo") === "on" }, { email: info.email, name: info.staffName });
  done(id);
  return r.ok ? { ok: true, message: "発注書を発行し、お客様へメールしました" } : { error: r.error };
}
