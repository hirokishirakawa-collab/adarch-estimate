// PDFデザイン確認用：サンプルデータで各PDFを書き出す（開発用・本番に影響なし）
// 実行: npx tsx scripts/render-pdf-samples.tsx
import { renderToFile } from "@react-pdf/renderer";
import React from "react";
import os from "os";
import path from "path";
import { EstimatePDFDocument, type EstimateForPDF } from "@/components/estimates/estimate-pdf";
import { PaymentStatementPDFDocument, type PaymentStatementForPDF } from "@/components/payments/payment-statement-pdf";
import { SimulatorPDFDocument, type SimulatorPDFData } from "@/components/simulator/simulator-pdf";
import { ProposalPdfDocument } from "@/components/proposals/proposal-pdf";

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

const proposal = {
  cover: {
    title: "TVer広告 ご提案書",
    subtitle: "コネクテッドTVで実現する、地域最適リーチ",
    date: "2026年5月24日",
    to: "株式会社サンプル商事 御中",
  },
  companyIntro: {
    heading: "私たちについて",
    description:
      "Ad Arch Groupは全国26拠点のネットワークを基盤に、動画制作から媒体運用までを一気通貫で提供するクリエイティブ・グループです。地域に根ざした担当者が、企画から効果検証まで伴走します。",
    strengths: ["全国26拠点", "制作〜運用一気通貫", "TVer正規取扱"],
  },
  proposal: {
    heading: "ご提案",
    challenge: "全国CMは予算規模が大きく、地域ターゲットの商材には過剰になりがちです。",
    solutions: [
      { title: "TVerによる地域最適配信", description: "都道府県・市区町村単位で配信エリアを設計し、無駄打ちを抑えながら必要な層に届けます。" },
      { title: "最寄り拠点による伴走支援", description: "全国26拠点の担当が訪問対応。制作から効果検証まで地元目線でサポートします。" },
    ],
  },
  cases: {
    heading: "実績",
    items: [
      { title: "飲食チェーン A社", description: "神奈川エリア配信で来店数 前年比118%を達成。" },
      { title: "小売 B社", description: "15秒素材2本の出し分けで認知率を大幅に改善。" },
    ],
  },
  nextSteps: {
    heading: "今後の進め方",
    steps: [
      "ヒアリング（目的・予算・配信エリアの確認）",
      "配信プラン・お見積もりのご提示",
      "クリエイティブ制作",
      "配信開始・効果レポート",
    ],
    contact: "ご不明点は info@adarch.co.jp までお気軽にお問い合わせください。",
  },
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
  await renderToFile(doc(React.createElement(ProposalPdfDocument, { content: proposal as never })), path.join(OUT, "見本_提案書.pdf"));
  console.log("✓ 見本_提案書.pdf");
  console.log("→ 出力先:", OUT);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
