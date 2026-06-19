// PDFデザイン確認用：サンプルデータで各PDFを書き出す（開発用・本番に影響なし）
// 実行: npx tsx scripts/render-pdf-samples.tsx
import { renderToFile } from "@react-pdf/renderer";
import React from "react";
import os from "os";
import path from "path";
import { EstimatePDFDocument, type EstimateForPDF } from "@/components/estimates/estimate-pdf";
import { PaymentStatementPDFDocument, type PaymentStatementForPDF } from "@/components/payments/payment-statement-pdf";
import { SimulatorPDFDocument, type SimulatorPDFData } from "@/components/simulator/simulator-pdf";

const OUT = path.join(os.homedir(), "Desktop");

const estimate: EstimateForPDF = {
  id: "clx9f3a8b2k7d1q0",
  title: "TVer CM動画制作 一式（30秒・タレント手配なし）",
  status: "ISSUED",
  estimateDate: new Date("2026-05-24"),
  validUntil: new Date("2026-06-23"),
  staffName: "白川 裕喜",
  notes:
    "本見積の有効期限は発行日より30日間です。\n制作開始後の大幅な仕様変更は、別途お見積もりとなる場合がございます。",
  discountAmount: 50000,
  customer: { name: "株式会社サンプル商事" },
  branch: { name: "本部" },
  items: [
    { id: "1", name: "企画・構成", spec: "絵コンテ・香盤表含む", quantity: 1, unit: "式", unitPrice: 150000, amount: 150000 },
    { id: "2", name: "撮影", spec: "スタジオ1日・カメラ2台体制", quantity: 1, unit: "日", unitPrice: 280000, amount: 280000 },
    { id: "3", name: "編集・MA", spec: "カラーグレーディング込み", quantity: 1, unit: "式", unitPrice: 220000, amount: 220000 },
    { id: "4", name: "ナレーション収録", spec: "プロナレーター1名", quantity: 1, unit: "名", unitPrice: 60000, amount: 60000 },
    { id: "5", name: "BGM・効果音", spec: "商用ライセンス込み", quantity: 1, unit: "式", unitPrice: 40000, amount: 40000 },
  ],
};

const payment: PaymentStatementForPDF = {
  id: "clxpay8b2k7d1q0",
  title: "サンプル商事様 TVer CM制作・配信費（5月分）",
  clientName: "株式会社サンプル商事",
  description: "本明細は2026年5月実施分です。ご不明点は本部までお問い合わせください。",
  grossAmount: 1100000,
  commissionRate: 15,
  commissionAmount: 165000,
  mediaExpense: 400000,
  productionExpense: 500000,
  withholdingTaxAmount: 51050,
  nonDeductibleTaxAmount: 0,
  netPaymentAmount: 883950,
  status: "PAID",
  paidAt: new Date("2026-05-31"),
  createdAt: new Date("2026-05-25"),
  groupCompany: {
    name: "スタジオ サンプル",
    ownerName: "山田 太郎",
    entityType: "SOLE_PROPRIETOR",
    invoiceRegistered: true,
    invoiceNumber: "T1234567890123",
    bankName: "みずほ銀行",
    bankBranch: "横浜支店",
    bankAccountType: "SAVINGS",
    bankAccountNumber: "1234567",
    bankAccountHolder: "ヤマダ タロウ",
  },
};

const simulator: SimulatorPDFData = {
  simulatorName: "TVer 神奈川エリア配信",
  totalAmount: 1500000,
  taxRate: 0.1,
  date: "2026-05-24",
  conditions: [
    "配信エリア: 神奈川県全域",
    "配信期間: 2026年7月1日〜7月31日",
    "クリエイティブ: 15秒 × 1本",
  ],
  reach: {
    totalPop: 9200000,
    tverAudience: 2760000,
    reachPotential: 680000,
    fillRate: 72,
    plays: 340000,
    frequency: 2.5,
  },
  stores: [
    { name: "サンプル店 横浜本店", brand: "カフェ", pref: "神奈川県", city: "横浜市西区" },
    { name: "サンプル店 川崎店", brand: "カフェ", pref: "神奈川県", city: "川崎市" },
    { name: "サンプル店 鎌倉店", brand: "カフェ", pref: "神奈川県", city: "鎌倉市" },
  ],
};

// react-pdf の renderToFile は ReactElement<DocumentProps> を要求するが、
// 各コンポーネントは Document を返すため実行時は安全。型の都合で as never を挟む。
const doc = (el: React.ReactElement) => el as never;

async function main() {
  await renderToFile(doc(React.createElement(EstimatePDFDocument, { estimation: estimate })), path.join(OUT, "見本_見積書.pdf"));
  console.log("✓ 見本_見積書.pdf");
  await renderToFile(doc(React.createElement(PaymentStatementPDFDocument, { statement: payment })), path.join(OUT, "見本_支払明細書.pdf"));
  console.log("✓ 見本_支払明細書.pdf");
  await renderToFile(doc(React.createElement(SimulatorPDFDocument, { data: simulator })), path.join(OUT, "見本_概算見積.pdf"));
  console.log("✓ 見本_概算見積.pdf");
  console.log("→ 出力先:", OUT);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
