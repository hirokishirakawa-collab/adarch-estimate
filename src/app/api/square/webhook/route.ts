import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";

/**
 * Square Webhook（payment.created / payment.updated）
 *   決済が COMPLETED になったら、order_id で OS の決済リンク（ロイヤリティ 社×月／請求申請）を引き当て、
 *   ロイヤリティ → 入金チェック台帳に✅（方法=Square・金額・カード末尾）／請求申請 → 支払済み。
 *   署名: HMAC-SHA256( SIGNATURE_KEY, 通知URL + rawBody ) を base64 → x-square-hmacsha256-signature と比較。
 */
export async function POST(req: NextRequest) {
  const key = process.env.SQUARE_WEBHOOK_SIGNATURE_KEY ?? "";
  const raw = await req.text();
  const sig = req.headers.get("x-square-hmacsha256-signature") ?? "";
  if (!key) return NextResponse.json({ error: "webhook not configured" }, { status: 503 });

  // 通知URLは公開URL（AUTH_URL）+ パスで固定（コンテナ内部ホストにしない）
  const notificationUrl = `${(process.env.AUTH_URL ?? "").replace(/\/$/, "")}/api/square/webhook`;
  const expected = createHmac("sha256", key).update(notificationUrl + raw).digest("base64");
  const a = Buffer.from(expected), b = Buffer.from(sig);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    console.warn("[square/webhook] signature mismatch");
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  let body: { type?: string; event_id?: string; data?: { object?: { payment?: SquarePayment } } };
  try { body = JSON.parse(raw); } catch { return NextResponse.json({ error: "bad json" }, { status: 400 }); }
  const type = body.type ?? "";
  const p = body.data?.object?.payment;
  if (!/^payment\.(created|updated)$/.test(type) || !p) return NextResponse.json({ ok: true, ignored: type });
  if (p.status !== "COMPLETED") return NextResponse.json({ ok: true, ignored: p.status });

  const amount = Number(p.amount_money?.amount ?? 0);
  const last4 = p.card_details?.card?.last_4 ?? null;
  const brand = p.card_details?.card?.card_brand ?? null;
  const paidOnJst = new Date(p.created_at ?? Date.now()).toLocaleDateString("sv-SE", { timeZone: "Asia/Tokyo" });
  const [y, m, d] = paidOnJst.split("-").map(Number);
  const paidOn = new Date(Date.UTC(y, m - 1, d));
  const admin = await db.user.findFirst({ where: { role: "ADMIN" }, orderBy: { createdAt: "asc" }, select: { id: true, email: true } });
  const actorId = admin?.id ?? "square-webhook";

  // ① ロイヤリティ（社×月）
  if (p.order_id) {
    const link = await db.royaltyPaymentLink.findFirst({ where: { squareOrderId: p.order_id }, include: { groupCompany: { select: { name: true } } } });
    if (link) {
      const note = `Squareカード決済（${brand ?? "CARD"} ****${last4 ?? "----"}・決済ID ${p.id}）`;
      await db.royaltyPaymentCheck.upsert({
        where: { groupCompanyId_month: { groupCompanyId: link.groupCompanyId, month: link.month } },
        create: { groupCompanyId: link.groupCompanyId, month: link.month, paidOn, method: "SQUARE", amountInclTax: amount, note, checkedById: actorId },
        update: { paidOn, method: "SQUARE", amountInclTax: amount, note },
      });
      logAudit({ action: "royalty_paid_via_square_webhook", email: admin?.email ?? "", name: "square-webhook", entity: "royalty_payment_check", entityId: `${link.groupCompanyId}:${link.month}`, detail: `${link.groupCompany.name} ${link.month} ¥${amount.toLocaleString("ja-JP")} ${note}` });
      return NextResponse.json({ ok: true, matched: "royalty", month: link.month });
    }
    // ② 請求申請
    const ir = await db.invoiceRequest.findFirst({ where: { squareOrderId: p.order_id }, select: { id: true, subject: true, paymentStatus: true } });
    if (ir) {
      if (ir.paymentStatus !== "PAID") await db.invoiceRequest.update({ where: { id: ir.id }, data: { paymentStatus: "PAID", paidAt: new Date(p.created_at ?? Date.now()) } });
      logAudit({ action: "invoice_request_paid_via_square_webhook", email: admin?.email ?? "", name: "square-webhook", entity: "invoice_request", entityId: ir.id, detail: `「${ir.subject}」 ¥${amount.toLocaleString("ja-JP")} Square ${brand ?? ""} ****${last4 ?? ""} 決済ID ${p.id}` });
      return NextResponse.json({ ok: true, matched: "invoice_request", id: ir.id });
    }
  }
  // 引き当てられない決済（旧固定リンクなど）は記録だけ
  logAudit({ action: "square_payment_unmatched", email: admin?.email ?? "", name: "square-webhook", entity: "square_payment", entityId: p.id ?? "", detail: `¥${amount.toLocaleString("ja-JP")} ${brand ?? ""} ****${last4 ?? ""} note=${(p.note ?? "").slice(0, 120)} order=${p.order_id ?? "-"}` });
  return NextResponse.json({ ok: true, matched: null });
}

type SquarePayment = {
  id?: string;
  status?: string;
  order_id?: string | null;
  created_at?: string;
  note?: string | null;
  amount_money?: { amount?: number; currency?: string };
  card_details?: { card?: { last_4?: string; card_brand?: string } };
};
