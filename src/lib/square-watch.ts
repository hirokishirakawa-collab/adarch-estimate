// ============================================================
// Square入金の見張り役（毎朝のcronから）
//   Squareの決済一覧（＝入金通知メールの元データ）を直接照合し、
//   ウェブフックが取りこぼした分をその場で台帳に反映（自己修復）。
//   引き当てられない入金（旧固定リンク等）だけ本部に通知する（1決済につき1回）。
// ============================================================

import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { notifyAdmins } from "@/lib/notifications";
import { isSquareConfigured, listSquarePayments } from "@/lib/square";

function jstDateOnly(iso: string | undefined): Date {
  const jst = new Date(iso ?? Date.now()).toLocaleDateString("sv-SE", { timeZone: "Asia/Tokyo" });
  const [y, m, d] = jst.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export type SquareWatchResult = { scanned: number; healedRoyalty: number; healedRequests: number; alreadyOk: number; unmatchedNew: number; errors: string[] };

export async function watchSquarePayments(actorUserId: string, adminEmail: string): Promise<SquareWatchResult> {
  const res: SquareWatchResult = { scanned: 0, healedRoyalty: 0, healedRequests: 0, alreadyOk: 0, unmatchedNew: 0, errors: [] };
  if (!isSquareConfigured()) { res.errors.push("Square未設定"); return res; }
  const begin = new Date(Date.now() - 72 * 3600_000).toISOString();
  const list = await listSquarePayments({ beginTime: begin });
  if (list.error) { res.errors.push(list.error); return res; }

  for (const p of list.payments ?? []) {
    if (p.status !== "COMPLETED" || !p.id) continue;
    res.scanned++;
    const amount = Number(p.amount_money?.amount ?? 0);
    const last4 = p.card_details?.card?.last_4 ?? "----";
    const brand = p.card_details?.card?.card_brand ?? "CARD";
    try {
      if (p.order_id) {
        const link = await db.royaltyPaymentLink.findFirst({ where: { squareOrderId: p.order_id }, include: { groupCompany: { select: { name: true } } } });
        if (link) {
          const exists = await db.royaltyPaymentCheck.findUnique({ where: { groupCompanyId_month: { groupCompanyId: link.groupCompanyId, month: link.month } } });
          if (exists) { res.alreadyOk++; continue; }
          const note = `Squareカード決済（${brand} ****${last4}・決済ID ${p.id}・見張りcronで補完）`;
          await db.royaltyPaymentCheck.create({ data: { groupCompanyId: link.groupCompanyId, month: link.month, paidOn: jstDateOnly(p.created_at), method: "SQUARE", amountInclTax: amount, note, checkedById: actorUserId } });
          res.healedRoyalty++;
          logAudit({ action: "royalty_paid_via_square_watch", email: adminEmail, name: "square-watch", entity: "royalty_payment_check", entityId: `${link.groupCompanyId}:${link.month}`, detail: `${link.groupCompany.name} ${link.month} ¥${amount.toLocaleString("ja-JP")}（ウェブフック取りこぼしを補完）` });
          continue;
        }
        const ir = await db.invoiceRequest.findFirst({ where: { squareOrderId: p.order_id }, select: { id: true, subject: true, paymentStatus: true } });
        if (ir) {
          if (ir.paymentStatus === "PAID") { res.alreadyOk++; continue; }
          await db.invoiceRequest.update({ where: { id: ir.id }, data: { paymentStatus: "PAID", paidAt: new Date(p.created_at ?? Date.now()) } });
          res.healedRequests++;
          logAudit({ action: "invoice_request_paid_via_square_watch", email: adminEmail, name: "square-watch", entity: "invoice_request", entityId: ir.id, detail: `「${ir.subject}」 ¥${amount.toLocaleString("ja-JP")}（ウェブフック取りこぼしを補完）` });
          continue;
        }
      }
      // 引き当て不能（通知は1決済につき1回）
      const seen = await db.auditLog.findFirst({ where: { entityId: p.id, action: { in: ["square_payment_unmatched", "square_watch_unmatched"] } }, select: { id: true } });
      if (seen) continue;
      res.unmatchedNew++;
      logAudit({ action: "square_watch_unmatched", email: adminEmail, name: "square-watch", entity: "square_payment", entityId: p.id, detail: `¥${amount.toLocaleString("ja-JP")} ${brand} ****${last4} note=${(p.note ?? "").slice(0, 120)} order=${p.order_id ?? "-"}` });
      await notifyAdmins({ type: "royalty", title: `Square入金 ¥${amount.toLocaleString("ja-JP")} が台帳に引き当てられません`, message: `${brand} ****${last4}／メモ: ${(p.note ?? "なし").slice(0, 80)}。旧リンクや手動決済の可能性。入金チェックで手動✅してください`, linkUrl: "/dashboard/admin/royalty/check" });
    } catch (e) {
      res.errors.push(`${p.id}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  return res;
}
