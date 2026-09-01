// ============================================================
// MFクラウド請求書の入金状況をOSへ取り込む（共通コア）
//   - ロイヤリティ請求書（royalty_mf_billings）: 入金済み → 入金チェック台帳に✅（未記録のみ）
//   - 請求申請（invoice_requests.mfBillingId）: 入金済み → paymentStatus=PAID
//   画面のボタンと毎朝のcronの両方から呼ぶ。セッションは持たない（actorUserId を渡す）。
// ============================================================

import { db } from "@/lib/db";
import { mfGetBilling, mfIsConnected } from "@/lib/mf-invoice";

const MF_PAY_LABELS: Record<string, number> = { "未設定": 0, "未入金": 1, "入金済み": 2, "入金済": 2, "未払い": 3, "振込済み": 4, "振込済": 4 };
export function parseMfPayStatus(v: unknown): number | null {
  if (v == null || v === "") return null;
  const s = String(v).trim();
  if (/^\d+$/.test(s)) return Number(s);
  return MF_PAY_LABELS[s] ?? null;
}
export function todayKeyJst(): string {
  return new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Tokyo" });
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export type MfSyncResult = { checked: number; paid: number; newlyMarked: number; errors: string[] };

/// ロイヤリティ請求書の入金状況を取り込む。month 省略時は未入金（paymentStatus≠2）の全件。
export async function syncRoyaltyMfPayments(opts: { month?: string; actorUserId: string }): Promise<MfSyncResult> {
  const res: MfSyncResult = { checked: 0, paid: 0, newlyMarked: 0, errors: [] };
  if (!(await mfIsConnected())) { res.errors.push("MF未接続"); return res; }
  const billings = await db.royaltyMfBilling.findMany({
    where: opts.month ? { month: opts.month } : { OR: [{ paymentStatus: null }, { paymentStatus: { not: 2 } }] },
    include: { groupCompany: { select: { name: true } } },
  });
  for (const b of billings) {
    try {
      const mb = await mfGetBilling(b.mfBillingId);
      const st = parseMfPayStatus(mb.payment_status);
      await db.royaltyMfBilling.update({ where: { id: b.id }, data: { paymentStatus: st, syncedAt: new Date(), billingNumber: mb.billing_number ?? b.billingNumber, pdfUrl: mb.pdf_url ?? b.pdfUrl } });
      res.checked++;
      if (st === 2) {
        res.paid++;
        const exists = await db.royaltyPaymentCheck.findUnique({ where: { groupCompanyId_month: { groupCompanyId: b.groupCompanyId, month: b.month } } });
        if (!exists) {
          const [y, m, d] = todayKeyJst().split("-").map(Number);
          await db.royaltyPaymentCheck.create({ data: { groupCompanyId: b.groupCompanyId, month: b.month, paidOn: new Date(Date.UTC(y, m - 1, d)), method: "OTHER", amountInclTax: b.totalInclTax, note: `MFで入金済み（請求書 ${mb.billing_number ?? b.mfBillingId}）。入金日はMFで確認`, checkedById: opts.actorUserId } });
          res.newlyMarked++;
        }
      }
      await sleep(200);
    } catch (e) {
      res.errors.push(`${b.groupCompany.name} ${b.month}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  return res;
}

/// 請求申請（MF作成済・未払い）の入金状況を取り込む。
export async function syncInvoiceRequestMfPayments(): Promise<MfSyncResult> {
  const res: MfSyncResult = { checked: 0, paid: 0, newlyMarked: 0, errors: [] };
  if (!(await mfIsConnected())) { res.errors.push("MF未接続"); return res; }
  const irs = await db.invoiceRequest.findMany({ where: { mfBillingId: { not: null }, paymentStatus: "UNPAID" }, select: { id: true, subject: true, mfBillingId: true, mfBillingNumber: true } });
  for (const ir of irs) {
    try {
      const mb = await mfGetBilling(ir.mfBillingId!);
      const st = parseMfPayStatus(mb.payment_status);
      const markPaid = st === 2;
      await db.invoiceRequest.update({ where: { id: ir.id }, data: { mfPaymentStatus: st, mfSyncedAt: new Date(), mfBillingNumber: mb.billing_number ?? ir.mfBillingNumber, ...(markPaid ? { paymentStatus: "PAID", paidAt: new Date() } : {}) } });
      res.checked++;
      if (markPaid) { res.paid++; res.newlyMarked++; }
      await sleep(200);
    } catch (e) {
      res.errors.push(`${ir.subject}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  return res;
}
