// 2026-09-01 代表決定: 濱口さん 請求申請2件（安藤工事 TVer出稿 2ヶ月目/3ヶ月目）の桁誤り訂正
//   12,000,000 → 1,200,000（詳細欄「出稿費用1,000,000＋管理費200,000」に合わせる）
import { config } from "dotenv";
config({ path: ".env.local" });
import { PrismaClient } from "../../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL as string }) });
const NOTE = "\n\n【2026-09-01 本部訂正】金額欄 12,000,000 → 1,200,000（詳細欄の内訳 1,000,000＋200,000 に合わせ桁を修正。手数料・税・派生額も再計算）";
(async () => {
  const targets = await db.invoiceRequest.findMany({ where: { OR: [{ id: "cmo86euy9000h01t5kg9a01sl" }, { id: "cmowio0el000d01mvb7b0j878" }] }, select: { id: true, subject: true, amountExclTax: true, nonDeductibleTaxAmount: true, withholdingTaxAmount: true, notes: true, paymentStatements: { select: { id: true } } } });
  for (const t of targets) {
    if (Number(t.amountExclTax) !== 12000000) { console.log("skip (already fixed?)", t.id, Number(t.amountExclTax)); continue; }
    if (t.paymentStatements.length) { console.log("skip: 支払明細あり", t.id); continue; }
    const amountExclTax = 1200000, taxAmount = 120000, amountInclTax = 1320000, commissionExclTax = 120000;
    const nonDed = t.nonDeductibleTaxAmount != null ? Math.floor(Number(t.nonDeductibleTaxAmount) / 10) : null; // 240,000 → 24,000（消費税の20%）
    const wh = t.withholdingTaxAmount != null ? Number(t.withholdingTaxAmount) : null;
    const net = nonDed != null || wh != null ? amountInclTax - (wh ?? 0) - (nonDed ?? 0) : null;
    await db.invoiceRequest.update({ where: { id: t.id }, data: { amountExclTax, taxAmount, amountInclTax, commissionExclTax, nonDeductibleTaxAmount: nonDed, netPaymentAmount: net, notes: (t.notes ?? "") + NOTE } });
    await db.auditLog.create({ data: { action: "invoice_request_amount_corrected", email: "hiroki.shirakawa@adarch.co.jp", name: "白川 裕喜（本部）", entity: "invoice_request", entityId: t.id, detail: `${t.subject}: 税抜 12,000,000→1,200,000 / 税 120,000 / 税込 1,320,000 / 手数料 120,000 / 控除不可 ${nonDed ?? "-"} / 差引 ${net ?? "-"}（代表決定 2026-09-01）` } });
    console.log("fixed", t.id, t.subject, { nonDed, net });
  }
  const after = await db.invoiceRequest.findMany({ where: { OR: [{ id: "cmo86euy9000h01t5kg9a01sl" }, { id: "cmowio0el000d01mvb7b0j878" }] }, select: { subject: true, amountExclTax: true, taxAmount: true, amountInclTax: true, commissionExclTax: true, nonDeductibleTaxAmount: true, netPaymentAmount: true } });
  console.table(after.map(a => Object.fromEntries(Object.entries(a).map(([k, v]) => [k, v != null && typeof v === "object" ? Number(v) : v]))));
  await db.$disconnect();
})();
