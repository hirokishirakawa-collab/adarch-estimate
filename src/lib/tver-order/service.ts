// ==============================================================
// TVer小口申込 — 申込の作成・月払いの請求・入金確定・通知（サーバー専用）
//   契約期間 3/6/12ヶ月・月払い（2026-09-09 代表決定）
//   1) createTverOrder      規約同意済みの申込を保存 → 初月の請求（月額＋初期登録費）を発行
//        カード = Square決済リンクへ送る／振込 = MF請求書を作ってメール
//   2) confirmInvoicePayment 初月の入金確認＝契約成立（メール・CEOアラート）。2ヶ月目以降＝入金の控えメール
//   3) runTverOrderBilling   毎朝cron: 次の月の請求を期日7日前に発行＋振込のMF入金取込
//   4) completeTverOrderDetails 決済後の詳細記入（法人番号・所在地・代表者）→ 考査へ
//   5) notifyTverOrderStatus 本部が状態を進めたとき広告主へメール
// ==============================================================

import { randomBytes } from "crypto";
import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { notifyCeo } from "@/lib/google-chat";
import { sendMail } from "@/lib/resend";
import { createSquarePaymentLink } from "@/lib/square";
import { mfCreateBilling, mfCreatePartner, mfFetchPdf, mfGetBilling, mfGetPartner, mfIsConnected, mfNormalizeName, mfSearchPartners } from "@/lib/mf-invoice";
import { municipalitiesOf, prefectureOptions } from "@/lib/packages/tver-area";
import type { TverOrder, TverOrderInvoice, TverOrderStatus } from "@/generated/prisma/client";
import { HQ, TERMS_TITLE, TERMS_VERSION } from "./terms";
import { AD_SECONDS, INDUSTRY_OPTIONS, MONTH_OPTIONS, estimateForArea, orderNumberLabel, planByKey, quote, withTax, yen } from "./plans";
import { TVER_ORDER_STATUS_LABEL, progressIndex } from "./plans";
export { TVER_ORDER_STATUS_LABEL, progressIndex };

export function appUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL ?? process.env.AUTH_URL ?? "").replace(/\/$/, "");
}

export type OrderSender = { id: string; company: string; person: string | null; prefecture: string | null; email: string | null; chatSpaceId: string | null };

/** ?from=<拠点ID> → 差出人（/p と同じ引き方。無効なら null＝本部） */
export async function loadOrderSender(from?: string | null): Promise<OrderSender | null> {
  if (!from) return null;
  try {
    const gc = await db.groupCompany.findFirst({
      where: { id: from, isActive: true },
      select: {
        id: true, name: true, ownerName: true, prefecture: true, chatSpaceId: true,
        linkedUsers: { where: { isActive: true }, select: { email: true }, take: 1, orderBy: { createdAt: "asc" } },
      },
    });
    if (!gc) return null;
    return { id: gc.id, company: gc.name, person: gc.ownerName, prefecture: gc.prefecture, email: gc.linkedUsers[0]?.email ?? null, chatSpaceId: gc.chatSpaceId };
  } catch {
    return null;
  }
}

async function senderOf(o: TverOrder): Promise<OrderSender | null> {
  return loadOrderSender(o.groupCompanyId);
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DAY = 86_400_000;
const jstDate = (d: Date) => d.toLocaleDateString("sv-SE", { timeZone: "Asia/Tokyo" });
const addMonths = (d: Date, n: number) => { const x = new Date(d); x.setMonth(x.getMonth() + n); return x; };

// ---------------------------------------------------------------
// 1) 申込の作成 → 初月の請求
// ---------------------------------------------------------------
export type CreateTverOrderInput = {
  from?: string | null;
  prefName: string;
  municipalityCode: string;
  planKey: string;
  months: number;
  hasVideo: boolean;
  paymentMethod: "CARD" | "BANK_TRANSFER";
  advertiserName: string;
  contactName: string;
  email: string;
  phone: string;
  signerName: string;
  agreedTerms: boolean;
  agreedNoGuarantee: boolean;
  agreedRefund: boolean;
  ip?: string | null;
  ua?: string | null;
};

/** 同じ広告主（法人番号 or メール）の入金済み申込があれば 2回目以降＝初期登録費なし */
export async function isFirstOrderFor(input: { corporateNumber?: string | null; email: string }): Promise<boolean> {
  const or: { corporateNumber?: string; email?: string }[] = [{ email: input.email.toLowerCase() }];
  if (input.corporateNumber) or.push({ corporateNumber: input.corporateNumber });
  const prior = await db.tverOrder.findFirst({ where: { paidAt: { not: null }, status: { notIn: ["REFUNDED", "CANCELLED"] }, OR: or }, select: { id: true } });
  return !prior;
}

export async function createTverOrder(input: CreateTverOrderInput): Promise<{ token?: string; paymentUrl?: string; invoiced?: boolean; error?: string }> {
  // ── 検証（画面側でも見るが、サーバーで必ずもう一度）
  if (!prefectureOptions().includes(input.prefName)) return { error: "都道府県を選んでください" };
  const muni = municipalitiesOf(input.prefName).find((m) => m.code === input.municipalityCode);
  if (!muni) return { error: "市区町村を選んでください" };
  const plan = planByKey(input.planKey);
  if (!plan) return { error: "プランを選んでください" };
  const est = estimateForArea(input.prefName, input.municipalityCode);
  if (!est) return { error: "このエリアの目安を計算できませんでした" };

  const advertiserName = input.advertiserName.trim().slice(0, 120);
  const contactName = input.contactName.trim().slice(0, 80);
  const email = input.email.trim().toLowerCase().slice(0, 200);
  const phone = input.phone.trim().slice(0, 40);
  const signerName = input.signerName.trim().slice(0, 80);
  if (!advertiserName) return { error: "会社名を入力してください" };
  if (!contactName) return { error: "ご担当者名を入力してください" };
  if (!EMAIL_RE.test(email)) return { error: "メールアドレスの形式が正しくありません" };
  if (!phone) return { error: "電話番号を入力してください" };
  if (!input.agreedTerms || !input.agreedNoGuarantee || !input.agreedRefund) return { error: "3つの確認事項すべてにチェックしてください" };
  if (!signerName) return { error: "ご署名（お名前）を入力してください" };

  const e = est.byPlan[plan.key];
  const months = MONTH_OPTIONS.some((m) => m.months === input.months) ? input.months : 3;
  const sender = await loadOrderSender(input.from);
  const first = await isFirstOrderFor({ email });
  const q = quote(e.mediaFee, first, months);
  const token = randomBytes(24).toString("base64url");
  const agreedAt = new Date();

  const order = await db.tverOrder.create({
    data: {
      token,
      groupCompanyId: sender?.id ?? null,
      prefName: input.prefName,
      municipalityCode: input.municipalityCode,
      areaLabel: est.areaLabel,
      planKey: plan.key,
      adSeconds: AD_SECONDS,
      months,
      mediaFeeExclTax: q.mediaFeeExclTax,
      setupFeeExclTax: q.setupFeeExclTax,
      totalInclTax: q.contractTotalInclTax,
      estImpressions: Math.round(e.impressions),
      estReach: Math.round(e.reach),
      hasVideo: input.hasVideo,
      paymentMethod: input.paymentMethod,
      advertiserName,
      contactName,
      email,
      phone,
      termsVersion: TERMS_VERSION,
      signerName,
      agreedAt,
      agreedIp: input.ip?.slice(0, 64) ?? null,
      agreedUa: input.ua?.slice(0, 300) ?? null,
      invoices: {
        create: {
          seq: 1,
          amountExclTax: q.firstExclTax,
          amountInclTax: q.firstInclTax,
          includesSetupFee: q.setupFeeExclTax > 0,
          method: input.paymentMethod,
          dueDate: new Date(agreedAt.getTime() + 7 * DAY),
        },
      },
    },
    include: { invoices: true },
  });
  const no = orderNumberLabel(order.number, order.createdAt);
  const inv = order.invoices[0];
  logAudit({ action: "tver_order_created", email, name: advertiserName, entity: "tver_order", entityId: order.id, ipAddress: input.ip ?? undefined, userAgent: input.ua ?? undefined, detail: `${no} ${input.prefName} ${est.areaLabel} ${plan.name} 月額${yen(q.mediaFeeExclTax)}×${months}ヶ月 初月税込${yen(q.firstInclTax)} ${input.paymentMethod === "CARD" ? "カード" : "振込"} 規約${TERMS_VERSION} 署名=${signerName}${sender ? ` 紹介=${sender.company}` : ""}` });

  const r = await issueInvoice(inv.id);
  if (input.paymentMethod === "BANK_TRANSFER") {
    notifyCeo(
      `🏦 *TVer申込（振込・月払い）* ${no}\n${advertiserName}（${input.prefName} ${est.areaLabel}・${plan.name}・${months}ヶ月）月額 ${yen(q.mediaFeeExclTax)}・初月税込 ${yen(q.firstInclTax)}\n` +
        (r.error ? `⚠️ MF請求書を作れませんでした: ${r.error}\n→ 本部画面から再発行してください\n` : `MF請求書 ${r.billingNumber ?? ""} を送付済み。入金が見えたら「入金を確認」で確定\n`) +
        `👉 ${appUrl()}/dashboard/admin/tver-orders/${order.id}`
    ).catch(() => {});
    return { token, invoiced: true };
  }
  if (!r.url) return { token, error: "決済ページを用意できませんでした。お手数ですが、しばらくしてから進捗ページの「お支払いへ進む」からやり直してください。" };
  return { token, paymentUrl: r.url };
}

// ---------------------------------------------------------------
// 1b) 請求の発行（カード＝Squareリンク／振込＝MF請求書＋メール）。初月も2ヶ月目以降も同じ
// ---------------------------------------------------------------
function invoiceTitle(o: TverOrder, inv: TverOrderInvoice): string {
  const plan = planByKey(o.planKey);
  return `TVer広告 エリア限定プラン ${plan?.name ?? o.planKey}（${o.areaLabel}）${inv.seq}/${o.months}ヶ月目`;
}

export async function issueInvoice(invoiceId: string, opts: { mailCardLink?: boolean } = {}): Promise<{ ok: boolean; url?: string; billingNumber?: string | null; error?: string }> {
  const inv = await db.tverOrderInvoice.findUnique({ where: { id: invoiceId }, include: { order: true } });
  if (!inv) return { ok: false, error: "請求が見つかりません" };
  if (inv.status === "PAID") return { ok: false, error: "入金確認済みです" };
  const o = inv.order;
  const no = orderNumberLabel(o.number, o.createdAt);
  const statusUrl = `${appUrl()}/order/tver/${o.token}`;
  const title = invoiceTitle(o, inv);
  const breakdown = `媒体費 ${yen(o.mediaFeeExclTax)}${inv.includesSetupFee ? ` ＋ 初期登録費 ${yen(o.setupFeeExclTax)}` : ""}（税抜）＝ 税込 ${yen(inv.amountInclTax)}`;

  if (inv.method === "CARD") {
    if (inv.squareLinkUrl) return { ok: true, url: inv.squareLinkUrl };
    const link = await createSquarePaymentLink({
      name: `${title} ${no}`,
      amountJpy: inv.amountInclTax,
      paymentNote: `${no} ${inv.seq}/${o.months} ${o.advertiserName} / TVer ${o.areaLabel} / 税込${yen(inv.amountInclTax)}`,
      description: `申込番号 ${no}（${inv.seq}ヶ月目／全${o.months}ヶ月）\n${o.prefName} ${o.areaLabel}・${AD_SECONDS}秒\n${breakdown}${inv.seq === 1 ? "\n※この決済の完了をもって契約が成立します。" : ""}`,
      redirectUrl: `${statusUrl}?paid=1`,
    });
    if (!link.link) {
      await db.tverOrder.update({ where: { id: o.id }, data: { adminNote: `[${jstDate(new Date())}] 決済リンク作成失敗（${inv.seq}ヶ月目）: ${link.error ?? "不明"}` } });
      logAudit({ action: "tver_order_payment_link_failed", email: o.email, name: o.advertiserName, entity: "tver_order", entityId: o.id, detail: `${no} ${inv.seq}/${o.months} ${link.error ?? ""}` });
      return { ok: false, error: link.error ?? "決済リンクを作れませんでした" };
    }
    await db.tverOrderInvoice.update({ where: { id: inv.id }, data: { squareLinkId: link.link.id, squareOrderId: link.link.orderId, squareLinkUrl: link.link.url, issuedAt: new Date() } });
    if (opts.mailCardLink || inv.seq > 1) {
      try {
        await sendMail({
          to: o.email,
          subject: `【Ad Arch】${inv.seq}ヶ月目のお支払いのご案内（${no}）`,
          html: simpleMailHtml(`${esc(o.advertiserName)}<br>${esc(o.contactName)} 様`, [
            `TVer広告 エリア限定プラン（${no}）の ${inv.seq}ヶ月目／全${o.months}ヶ月 のお支払いをご案内します。`,
            `金額: 税込 ${yen(inv.amountInclTax)}（${breakdown}）　お支払い期限: ${fmtD(inv.dueDate)}`,
            "下のボタンから Square の決済画面でお支払いください（進捗ページからもお支払いいただけます）。",
          ], link.link.url, "カードで支払う"),
          replyTo: HQ.email,
        });
      } catch (e) {
        console.error("[tver-order] card link mail failed:", e instanceof Error ? e.message : e);
      }
    }
    return { ok: true, url: link.link.url };
  }

  // ── 振込＝MF請求書
  try {
    if (!(await mfIsConnected())) throw new Error("MFクラウド請求書が未接続です");
    const found = await mfSearchPartners(o.advertiserName);
    let partner = found.find((p) => mfNormalizeName(p.name) === mfNormalizeName(o.advertiserName)) ?? null;
    if (partner && !partner.departments?.length) partner = await mfGetPartner(partner.id);
    if (!partner) partner = await mfCreatePartner({ name: o.advertiserName, personName: o.contactName, email: o.email });
    const depId = partner.departments?.[0]?.id;
    if (!depId) throw new Error("MF取引先の部署IDが取れません");
    const items = [
      { name: `${title}（${o.prefName}・${AD_SECONDS}秒）`, price: o.mediaFeeExclTax, quantity: 1 },
      ...(inv.includesSetupFee ? [{ name: "初期登録費（TVer考査・アカウント作成・初回のみ）", price: o.setupFeeExclTax, quantity: 1 }] : []),
    ];
    const note = [
      `申込番号 ${no}（${inv.seq}ヶ月目／全${o.months}ヶ月・規約 ${o.termsVersion} に同意済み）`,
      inv.seq === 1 ? "本請求書のご入金の確認をもって契約が成立し、TVerの考査を申請します。" : "毎月の媒体費のご請求です。",
      "お振込手数料はご負担ください。",
      `進捗ページ: ${statusUrl}`,
    ].join("\n");
    const b = await mfCreateBilling({ departmentId: depId, billingDate: jstDate(new Date()), dueDate: jstDate(inv.dueDate), title: `${title} ${no}`, note, memo: `OS自動作成（TVer申込・月払い） ${no} ${inv.seq}/${o.months} / ${o.advertiserName}`, items });
    let pdf: Buffer | null = null;
    if (b.pdf_url) { try { pdf = await mfFetchPdf(b.pdf_url); } catch (e) { console.error("[tver-order] mf pdf fetch failed:", e instanceof Error ? e.message : e); } }
    await db.tverOrderInvoice.update({ where: { id: inv.id }, data: { mfBillingId: b.id, mfBillingNumber: b.billing_number ?? null, mfPdfUrl: b.pdf_url ?? null, issuedAt: new Date() } });
    await sendMail({
      to: o.email,
      subject: `【Ad Arch】${inv.seq === 1 ? "請求書をお送りします" : `${inv.seq}ヶ月目の請求書をお送りします`}（${no}）`,
      html: simpleMailHtml(`${esc(o.advertiserName)}<br>${esc(o.contactName)} 様`, [
        `TVer広告 エリア限定プラン（${no}）の ${inv.seq}ヶ月目／全${o.months}ヶ月 の請求書${pdf ? "を添付しています" : "はMFクラウド請求書から別途お届けします"}。`,
        `金額: 税込 ${yen(inv.amountInclTax)}（${breakdown}）　お支払い期限: ${fmtD(inv.dueDate)}（振込手数料はご負担ください）`,
        inv.seq === 1 ? "ご入金の確認をもって契約が成立し、契約内容の控えをメールでお送りしてTVerの考査に進みます。" : "ご入金の確認後、進捗ページの支払い状況に反映します。",
      ], statusUrl),
      attachments: pdf ? [{ filename: `${no}_${inv.seq}ヶ月目_請求書.pdf`, content: pdf }] : [],
      replyTo: HQ.email,
    });
    return { ok: true, billingNumber: b.billing_number ?? null };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await db.tverOrder.update({ where: { id: o.id }, data: { adminNote: `[${jstDate(new Date())}] 請求書の自動発行に失敗（${inv.seq}ヶ月目）: ${msg}` } });
    if (inv.seq === 1) {
      try {
        await sendMail({ to: o.email, subject: `【Ad Arch】TVer広告 エリア限定プラン お申込みを受け付けました（${no}）`, html: simpleMailHtml(`${esc(o.advertiserName)}<br>${esc(o.contactName)} 様`, [`TVer広告 エリア限定プラン（${no}）のお申込みを受け付けました。初月の請求書（税込 ${yen(inv.amountInclTax)}）は本部より1営業日以内にメールでお送りします。ご入金の確認をもって契約が成立します。`], statusUrl), replyTo: HQ.email });
      } catch {}
    }
    return { ok: false, error: msg };
  }
}

/** 進捗ページ「お支払いへ進む」＝一番古い未払いのカード請求のリンク */
export async function ensurePaymentLink(orderId: string): Promise<{ url?: string; error?: string }> {
  const inv = await db.tverOrderInvoice.findFirst({ where: { orderId, status: "UNPAID", method: "CARD" }, orderBy: { seq: "asc" } });
  if (!inv) return { error: "お支払い待ちのカード請求はありません" };
  const r = await issueInvoice(inv.id);
  return r.url ? { url: r.url } : { error: r.error ?? "決済ページを用意できませんでした" };
}

// ---------------------------------------------------------------
// 2) 入金確定（Webhook／MF取込／本部の手動）。初月＝契約成立
// ---------------------------------------------------------------
export async function confirmInvoicePayment(invoiceId: string, payment: { amount: number; note: string; paidAt: Date; actorEmail: string }): Promise<{ ok: boolean; already?: boolean }> {
  const inv = await db.tverOrderInvoice.findUnique({ where: { id: invoiceId }, include: { order: true } });
  if (!inv) return { ok: false };
  if (inv.status === "PAID") return { ok: true, already: true };
  await db.tverOrderInvoice.update({ where: { id: inv.id }, data: { status: "PAID", paidAt: payment.paidAt, paidAmount: payment.amount, paymentNote: payment.note } });
  const o = inv.order;
  const no = orderNumberLabel(o.number, o.createdAt);
  const statusUrl = `${appUrl()}/order/tver/${o.token}`;
  const sender = await senderOf(o);
  const plan = planByKey(o.planKey);
  logAudit({ action: "tver_order_invoice_paid", email: payment.actorEmail, name: o.advertiserName, entity: "tver_order", entityId: o.id, detail: `${no} ${inv.seq}/${o.months}ヶ月目 ${yen(payment.amount)} ${payment.note}` });

  if (inv.seq === 1 && !o.paidAt) {
    // ── 契約成立
    const paid = await db.tverOrder.update({ where: { id: o.id }, data: { status: "PAID", paidAt: payment.paidAt, paidAmount: payment.amount, paymentNote: payment.note } });
    try {
      await sendMail({ to: paid.email, subject: `【Ad Arch】TVer広告 エリア限定プラン お申込みを承りました（${no}）`, html: confirmationMailHtml(paid, sender, statusUrl), replyTo: HQ.email });
    } catch (e) { console.error("[tver-order] mail to advertiser failed:", e instanceof Error ? e.message : e); }
    if (sender?.email) {
      try {
        await sendMail({ to: sender.email, subject: `【Ad Arch OS】TVer申込が確定しました（${no}・${paid.advertiserName}）`, html: partnerMailHtml(paid, no, statusUrl) });
      } catch (e) { console.error("[tver-order] mail to partner failed:", e instanceof Error ? e.message : e); }
    }
    notifyCeo(
      `💳 *TVer申込 契約成立（初月入金）* ${no}\n${paid.advertiserName}（${paid.prefName} ${paid.areaLabel}・${plan?.name ?? paid.planKey}・${paid.months}ヶ月）月額 ${yen(paid.mediaFeeExclTax)}\n` +
        `${sender ? `紹介: ${sender.company}\n` : ""}次: お客様の詳細記入（法人番号・住所・代表者）を待って業態考査を申請\n👉 ${appUrl()}/dashboard/admin/tver-orders/${paid.id}`
    ).catch(() => {});
    return { ok: true };
  }

  // ── 2ヶ月目以降＝控え
  try {
    await sendMail({ to: o.email, subject: `【Ad Arch】${inv.seq}ヶ月目のご入金を確認しました（${no}）`, html: simpleMailHtml(`${esc(o.advertiserName)}<br>${esc(o.contactName)} 様`, [`TVer広告 エリア限定プラン（${no}）の ${inv.seq}ヶ月目／全${o.months}ヶ月 のお支払い（税込 ${yen(payment.amount)}）を確認しました。ありがとうございます。`], statusUrl), replyTo: HQ.email });
  } catch (e) { console.error("[tver-order] receipt mail failed:", e instanceof Error ? e.message : e); }
  notifyCeo(`💴 TVer申込 ${no} ${o.advertiserName} ${inv.seq}/${o.months}ヶ月目 入金 ${yen(payment.amount)}`).catch(() => {});
  return { ok: true };
}

/** MFの入金状況を見て、入金済みの請求を確定する（本部画面ボタン・cron） */
export async function syncBankTransferFromMf(orderId: string, actorEmail: string): Promise<{ paid: number; error?: string }> {
  const list = await db.tverOrderInvoice.findMany({ where: { orderId, status: "UNPAID", method: "BANK_TRANSFER", mfBillingId: { not: null } } });
  let paid = 0;
  for (const inv of list) {
    try {
      const b = await mfGetBilling(inv.mfBillingId!);
      const st = String(b.payment_status ?? "");
      if (st === "2" || st === "4") {
        await confirmInvoicePayment(inv.id, { amount: inv.amountInclTax, note: `銀行振込（MF請求書 ${inv.mfBillingNumber ?? inv.mfBillingId} 入金済み）`, paidAt: new Date(), actorEmail });
        paid++;
      }
    } catch (e) {
      return { paid, error: e instanceof Error ? e.message : String(e) };
    }
  }
  return { paid };
}

// ---------------------------------------------------------------
// 3) 毎朝cron: 次の月の請求を期日の7日前に発行＋振込のMF入金取込
//    期日＝配信開始日の月次応当日（配信前なら初月入金日を起点）
// ---------------------------------------------------------------
export async function runTverOrderBilling(actorEmail: string): Promise<{ issued: number; synced: number; errors: string[] }> {
  const out = { issued: 0, synced: 0, errors: [] as string[] };
  const today = new Date();
  const orders = await db.tverOrder.findMany({
    where: { paidAt: { not: null }, status: { in: ["PAID", "REVIEWING", "MATERIAL_WAITING", "MATERIAL_RECEIVED", "LIVE"] } },
    include: { invoices: { orderBy: { seq: "asc" } } },
  });
  for (const o of orders) {
    try {
      // 振込の入金取込
      if (o.paymentMethod === "BANK_TRANSFER" && o.invoices.some((i) => i.status === "UNPAID" && i.mfBillingId)) {
        const r = await syncBankTransferFromMf(o.id, actorEmail);
        out.synced += r.paid;
        if (r.error) out.errors.push(`${orderNumberLabel(o.number, o.createdAt)}: MF ${r.error}`);
      }
      // 次の月の請求（配信中の契約だけ。配信前は初月のみ）
      const base = o.liveStartDate ?? null;
      if (!base) continue;
      const nextSeq = Math.max(1, ...o.invoices.map((i) => i.seq)) + 1;
      if (nextSeq > o.months) continue;
      const due = addMonths(base, nextSeq - 1);
      if (today.getTime() < due.getTime() - 7 * DAY) continue;
      const created = await db.tverOrderInvoice.create({
        data: { orderId: o.id, seq: nextSeq, amountExclTax: o.mediaFeeExclTax, amountInclTax: withTax(o.mediaFeeExclTax), includesSetupFee: false, method: o.paymentMethod, dueDate: due },
      });
      const r = await issueInvoice(created.id, { mailCardLink: true });
      if (!r.ok) out.errors.push(`${orderNumberLabel(o.number, o.createdAt)} ${nextSeq}ヶ月目: ${r.error}`);
      else out.issued++;
    } catch (e) {
      out.errors.push(`${orderNumberLabel(o.number, o.createdAt)}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  if (out.issued || out.synced || out.errors.length) {
    logAudit({ action: "tver_order_billing_cron", email: actorEmail, name: "cron", entity: "tver_order", entityId: "all", detail: `発行${out.issued}・MF入金${out.synced}${out.errors.length ? ` / エラー ${out.errors.join(" | ").slice(0, 500)}` : ""}` });
  }
  return out;
}

/** 本部画面「次の月の請求を今すぐ発行」 */
export async function issueNextInvoiceNow(orderId: string): Promise<{ ok: boolean; error?: string; seq?: number }> {
  const o = await db.tverOrder.findUnique({ where: { id: orderId }, include: { invoices: { orderBy: { seq: "asc" } } } });
  if (!o || !o.paidAt) return { ok: false, error: "初月の入金確認後に発行できます" };
  const nextSeq = Math.max(1, ...o.invoices.map((i) => i.seq)) + 1;
  if (nextSeq > o.months) return { ok: false, error: "契約期間ぶんの請求は発行済みです" };
  const base = o.liveStartDate ?? o.paidAt;
  const created = await db.tverOrderInvoice.create({
    data: { orderId: o.id, seq: nextSeq, amountExclTax: o.mediaFeeExclTax, amountInclTax: withTax(o.mediaFeeExclTax), includesSetupFee: false, method: o.paymentMethod, dueDate: addMonths(base, nextSeq - 1) },
  });
  const r = await issueInvoice(created.id, { mailCardLink: true });
  return r.ok ? { ok: true, seq: nextSeq } : { ok: false, error: r.error, seq: nextSeq };
}

export type OrderDetailsInput = {
  corporateNumber: string;
  postalCode?: string | null;
  address: string;
  representativeName: string;
  industry?: string | null;
  landingPageUrl?: string | null;
  notes?: string | null;
};

export async function completeTverOrderDetails(token: string, input: OrderDetailsInput): Promise<{ ok: boolean; error?: string }> {
  const o = await db.tverOrder.findUnique({ where: { token } });
  if (!o) return { ok: false, error: "申込が見つかりません" };
  if (!o.paidAt) return { ok: false, error: "お支払いの確認後にご記入いただけます" };
  const corporateNumber = input.corporateNumber.replace(/\D/g, "");
  if (!/^\d{13}$/.test(corporateNumber)) return { ok: false, error: "法人番号は13桁の数字です（法人のお客様のみお申込みいただけます）" };
  const address = input.address.trim().slice(0, 200);
  const representativeName = input.representativeName.trim().slice(0, 80);
  if (!address) return { ok: false, error: "本店所在地（住所）を入力してください" };
  if (!representativeName) return { ok: false, error: "代表者名を入力してください" };
  if (input.landingPageUrl && !/^https?:\/\//.test(input.landingPageUrl.trim())) return { ok: false, error: "リンク先URLは http(s):// から入力してください" };
  const industry = input.industry && (INDUSTRY_OPTIONS as readonly string[]).includes(input.industry) ? input.industry : null;
  const firstTime = !o.detailsCompletedAt;

  const updated = await db.tverOrder.update({
    where: { id: o.id },
    data: {
      corporateNumber,
      postalCode: (input.postalCode ?? "").trim().slice(0, 10) || null,
      address,
      representativeName,
      industry,
      landingPageUrl: input.landingPageUrl?.trim().slice(0, 500) || null,
      notes: input.notes?.trim().slice(0, 2000) || null,
      detailsCompletedAt: o.detailsCompletedAt ?? new Date(),
    },
  });
  const no = orderNumberLabel(updated.number, updated.createdAt);
  const sender = await senderOf(updated);
  const statusUrl = `${appUrl()}/order/tver/${updated.token}`;

  try {
    await sendMail({
      to: updated.email,
      subject: `【Ad Arch】詳細を受け付けました・考査に進みます（${no}）`,
      html: detailsMailHtml(updated, sender, statusUrl),
      replyTo: HQ.email,
    });
  } catch (e) {
    console.error("[tver-order] contract mail failed:", e instanceof Error ? e.message : e);
  }
  if (firstTime && sender?.email) {
    try {
      await sendMail({ to: sender.email, subject: `【Ad Arch OS】TVer小口申込 詳細記入が完了（${no}・${updated.advertiserName}）`, html: partnerMailHtml(updated, no, statusUrl) });
    } catch (e) {
      console.error("[tver-order] partner mail failed:", e instanceof Error ? e.message : e);
    }
  }
  logAudit({ action: "tver_order_details_completed", email: updated.email, name: updated.advertiserName, entity: "tver_order", entityId: updated.id, detail: `${no} 法人番号${corporateNumber} ${representativeName}` });
  if (firstTime) {
    notifyCeo(`📝 *TVer小口申込 詳細記入完了* ${no} ${updated.advertiserName}（法人番号 ${corporateNumber}）\n→ TVer業態考査を申請できます\n👉 ${appUrl()}/dashboard/admin/tver-orders/${updated.id}`).catch(() => {});
  }
  return { ok: true };
}

// ---------------------------------------------------------------
// 5) 状態の更新を広告主に知らせる
// ---------------------------------------------------------------
export async function notifyTverOrderStatus(orderId: string): Promise<void> {
  const o = await db.tverOrder.findUnique({ where: { id: orderId } });
  if (!o || !o.paidAt) return;
  const no = orderNumberLabel(o.number, o.createdAt);
  const statusUrl = `${appUrl()}/order/tver/${o.token}`;
  const subjectBy: Partial<Record<TverOrderStatus, string>> = {
    REVIEWING: "考査を申請しました",
    MATERIAL_WAITING: "考査が通りました・動画をお送りください",
    MATERIAL_RECEIVED: "動画を受け取りました",
    LIVE: "配信を開始しました",
    COMPLETED: "配信が終了しました・レポートのご案内",
    REFUNDED: "返金のご案内",
  };
  const subj = subjectBy[o.status];
  if (!subj) return;
  const lines: string[] = [];
  if (o.status === "MATERIAL_WAITING") lines.push("15秒の動画を進捗ページからアップロード（またはURLを共有）してください。受領から最短10営業日で配信を開始します。");
  if (o.status === "LIVE" && o.liveStartDate) lines.push(`配信期間: ${fmtD(o.liveStartDate)} 〜 ${o.liveEndDate ? fmtD(o.liveEndDate) : `${o.months}ヶ月`}`);
  if (o.status === "COMPLETED" && o.reportUrl) lines.push(`月次レポート: ${o.reportUrl}`);
  if (o.status === "REFUNDED") lines.push("お支払いいただいた料金は全額、ご利用のカードへ取消（返金）の手続きを行いました。カード会社の処理に数日かかることがあります。");
  if (o.customerNote) lines.push(o.customerNote);
  try {
    await sendMail({
      to: o.email,
      subject: `【Ad Arch】${subj}（${no}）`,
      html: simpleMailHtml(`${o.advertiserName}<br>${esc(o.contactName)} 様`, [`TVer広告 エリア限定プラン（${no}）の状況が「${TVER_ORDER_STATUS_LABEL[o.status]}」になりました。`, ...lines], statusUrl),
      replyTo: HQ.email,
    });
  } catch (e) {
    console.error("[tver-order] status mail failed:", e instanceof Error ? e.message : e);
  }
}

// ---------------------------------------------------------------
// メールHTML（幅600px・テーブル・ブランド色）
// ---------------------------------------------------------------
const esc = (s: string | null | undefined) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const fmtDT = (d: Date) => new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(d) + " JST";
const fmtD = (d: Date) => new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", year: "numeric", month: "long", day: "numeric" }).format(d);

function mailShell(inner: string): string {
  return `<!doctype html><html lang="ja"><body style="margin:0;background:#f7f6f4;font-family:'IBM Plex Sans JP','Hiragino Sans',sans-serif;color:#111;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f7f6f4;padding:24px 12px;"><tr><td align="center">
<table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width:600px;width:100%;background:#ffffff;">
<tr><td style="padding:28px 32px 8px;font-family:'IBM Plex Sans',Arial,sans-serif;font-size:11px;letter-spacing:.18em;color:#6a6a6a;"><span style="display:inline-block;width:24px;height:2px;background:#f19834;vertical-align:middle;margin-right:10px;"></span>TVER AREA PLAN</td></tr>
${inner}
<tr><td style="padding:20px 32px 28px;border-top:1px solid #e6e4e0;font-size:12px;color:#6a6a6a;line-height:1.7;">${HQ.company}（TVer広告 正規代理店）<br>${HQ.email}　／　${HQ.phone}</td></tr>
</table></td></tr></table></body></html>`;
}

function simpleMailHtml(greeting: string, paras: string[], statusUrl: string, buttonLabel = "進捗ページを開く"): string {
  return mailShell(
    `<tr><td style="padding:8px 32px 0;font-size:15px;line-height:1.8;">${greeting}</td></tr>` +
      paras.map((p) => `<tr><td style="padding:12px 32px 0;font-size:14px;line-height:1.8;">${esc(p)}</td></tr>`).join("") +
      `<tr><td style="padding:24px 32px 24px;"><a href="${statusUrl}" style="display:inline-block;background:#f19834;color:#111;font-weight:600;text-decoration:none;padding:12px 22px;border-radius:3px;font-size:14px;">${esc(buttonLabel)}</a></td></tr>`
  );
}

function orderTableHtml(o: TverOrder): string {
  const plan = planByKey(o.planKey);
  const q = quote(o.mediaFeeExclTax, o.setupFeeExclTax > 0, o.months);
  const row = (k: string, v: string, strong = false) =>
    `<tr><td style="padding:8px 0;border-bottom:1px solid #e6e4e0;font-size:13px;color:#6a6a6a;width:38%;">${esc(k)}</td><td style="padding:8px 0;border-bottom:1px solid #e6e4e0;font-size:13px;${strong ? "font-weight:600;font-size:16px;" : ""}">${esc(v)}</td></tr>`;
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0">
${row("申込番号", orderNumberLabel(o.number, o.createdAt))}
${row("配信エリア", `${o.prefName} ${o.areaLabel}`)}
${row("プラン・契約期間", `${plan?.name ?? o.planKey}（${AD_SECONDS}秒）・${o.months}ヶ月・月払い`)}
${row("再生数の目安", `月 約${o.estImpressions.toLocaleString("ja-JP")}回（推計・保証しない）`)}
${row("月額（税抜）", yen(q.mediaFeeExclTax))}
${row("初期登録費（初回のみ・税抜）", q.setupFeeExclTax ? yen(q.setupFeeExclTax) : "—")}
${row("初月のお支払い（税込）", yen(q.firstInclTax), true)}
${row("2ヶ月目以降（税込・毎月）", yen(q.monthlyInclTax))}
${row("お支払い方法", o.paymentMethod === "BANK_TRANSFER" ? "銀行振込（毎月請求書）" : "クレジットカード（毎月決済リンク）")}
</table>`;
}

function confirmationMailHtml(o: TverOrder, sender: OrderSender | null, statusUrl: string): string {
  const paid = o.paymentMethod === "BANK_TRANSFER" ? "ご入金" : "決済の完了";
  return mailShell(
    `<tr><td style="padding:8px 32px 0;font-size:20px;font-weight:600;line-height:1.5;">お申込みを承りました</td></tr>
<tr><td style="padding:14px 32px 0;font-size:14px;line-height:1.8;">${esc(o.advertiserName)}<br>${esc(o.contactName)} 様<br><br>このたびはTVer広告 エリア限定プランをお申込みいただき、ありがとうございます。${paid}を確認しましたので、契約が成立しました。</td></tr>
<tr><td style="padding:20px 32px 0;">${orderTableHtml(o)}</td></tr>
<tr><td style="padding:20px 32px 0;font-size:14px;font-weight:600;">次にしていただくこと（3分）</td></tr>
<tr><td style="padding:6px 32px 0;font-size:13px;line-height:1.9;">進捗ページで <b>法人番号・本店所在地・代表者名</b> をご記入ください。TVerの業態考査に必要な情報です。</td></tr>
<tr><td style="padding:12px 32px 0;font-size:12px;line-height:1.8;color:#6a6a6a;">本メールは契約内容の控えです。${esc(TERMS_TITLE)}（${esc(o.termsVersion)}）に ${esc(o.signerName)} 様が ${esc(fmtDT(o.agreedAt))} に同意され、${o.paymentMethod === "BANK_TRANSFER" ? "ご入金" : "決済"}の確認をもって契約が成立しました。規約全文は進捗ページからいつでも確認できます。</td></tr>
<tr><td style="padding:20px 32px 0;font-size:14px;font-weight:600;">その後の流れ</td></tr>
<tr><td style="padding:6px 32px 0;font-size:13px;line-height:1.9;color:#111;">1）本部がTVerへ業態考査を申請します（2〜5営業日）<br>2）考査が通りましたら、進捗ページから15秒の動画をお送りください${o.hasVideo ? "" : "（動画の制作は" + (sender ? esc(sender.company) : HQ.company) + "がご案内します）"}<br>3）動画の受領から最短10営業日で配信を開始します（${o.months}ヶ月・2ヶ月目以降は毎月、配信開始日の応当日にその月分をご請求します）<br>4）配信終了後、月次レポートをお送りします</td></tr>
<tr><td style="padding:24px 32px 8px;"><a href="${statusUrl}" style="display:inline-block;background:#f19834;color:#111;font-weight:600;text-decoration:none;padding:12px 22px;border-radius:3px;font-size:14px;">進捗ページで詳細を記入する</a></td></tr>
<tr><td style="padding:8px 32px 20px;font-size:12px;color:#6a6a6a;line-height:1.7;">${o.paymentMethod === "BANK_TRANSFER" ? "" : "領収書はSquareから別途メールで届きます。"}${sender ? `ご案内・ご担当: ${esc(sender.company)}${sender.person ? `（${esc(sender.person)}）` : ""}${sender.email ? ` ${esc(sender.email)}` : ""}` : ""}</td></tr>`
  );
}

function detailsMailHtml(o: TverOrder, sender: OrderSender | null, statusUrl: string): string {
  return mailShell(
    `<tr><td style="padding:8px 32px 0;font-size:20px;font-weight:600;line-height:1.5;">詳細を受け付けました</td></tr>
<tr><td style="padding:14px 32px 0;font-size:14px;line-height:1.8;">${esc(o.advertiserName)}<br>${esc(o.contactName)} 様<br><br>詳細のご記入ありがとうございます。この内容で本部がTVerへ業態考査を申請します（2〜5営業日）。考査が通りましたら、動画のご提出をメールでご案内します。</td></tr>
<tr><td style="padding:20px 32px 0;">${orderTableHtml(o)}</td></tr>
<tr><td style="padding:12px 32px 0;font-size:13px;line-height:1.8;color:#6a6a6a;">法人番号 ${esc(o.corporateNumber ?? "")}　／　${esc(o.address ?? "")}　／　代表者 ${esc(o.representativeName ?? "")}</td></tr>
<tr><td style="padding:24px 32px 8px;"><a href="${statusUrl}" style="display:inline-block;background:#f19834;color:#111;font-weight:600;text-decoration:none;padding:12px 22px;border-radius:3px;font-size:14px;">進捗ページを開く</a></td></tr>
<tr><td style="padding:8px 32px 20px;font-size:12px;color:#6a6a6a;line-height:1.7;">${sender ? `ご案内・ご担当: ${esc(sender.company)}${sender.person ? `（${esc(sender.person)}）` : ""}${sender.email ? ` ${esc(sender.email)}` : ""}` : ""}</td></tr>`
  );
}

function partnerMailHtml(o: TverOrder, no: string, statusUrl: string): string {
  return mailShell(
    `<tr><td style="padding:8px 32px 0;font-size:18px;font-weight:600;">TVer小口申込が確定しました（${esc(no)}）</td></tr>
<tr><td style="padding:12px 32px 0;font-size:14px;line-height:1.8;">貴社のご案内リンクから、${esc(o.advertiserName)}（ご担当 ${esc(o.contactName)}）のお申込みが決済完了しました。考査・入稿・レポートは本部が進めます。${o.hasVideo ? "" : "<br><b>動画は「なし」で申込されています。制作のご相談を貴社からお願いします。</b>"}</td></tr>
<tr><td style="padding:20px 32px 0;">${orderTableHtml(o)}</td></tr>
<tr><td style="padding:12px 32px 0;font-size:13px;line-height:1.8;color:#6a6a6a;">連絡先: ${esc(o.email)}　／　${esc(o.phone)}<br>進捗ページ（お客様と同じ画面）: <a href="${statusUrl}" style="color:#d97f18;">${statusUrl}</a></td></tr>
<tr><td style="padding:16px 32px 24px;font-size:12px;color:#6a6a6a;">OSの「パッケージ ＞ 地域リーチ固定パッケージ」に自社経由の申込一覧があります。</td></tr>`
  );
}
