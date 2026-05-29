// ============================================================
// 支払明細の計算ロジック（単一ソース）
// フォーム・サーバーアクション・詳細ページ・PDF が全てこれを使う。
//
// 設計: クライアントからの入金額（税込）を起点に、
//   1. 本体（税抜）と消費税に分解
//   2. 本部手数料は「税抜本体」に対して計算（消費税はパススルー）
//   3. パートナー報酬（税抜）＋ その消費税 = パートナー報酬（税込）
//   4. 源泉徴収（制作費・税抜に対して／個人事業主のみ）
//   5. 控除不可消費税（インボイス未登録／経過措置）
//   6. 差引支払額 = パートナー報酬（税込）− 源泉 − 控除不可
//
// 消費税は「手数料分」と「パートナー分」に必ず分割され、合計は入金額に一致する。
// ============================================================

export const TAX_RATE = 0.1;

/// 源泉徴収税（報酬・料金）。税抜の報酬額に対して 100万円まで10.21%、超過分20.42%。
export function computeWithholding(productionExclTax: number): number {
  if (productionExclTax <= 0) return 0;
  if (productionExclTax <= 1_000_000) return Math.floor(productionExclTax * 0.1021);
  return Math.floor(1_000_000 * 0.1021) + Math.floor((productionExclTax - 1_000_000) * 0.2042);
}

/// インボイス未登録パートナーへの支払で「控除できない消費税」の割合（経過措置）。
/// ~2026/9: 仕入税額控除80% → 不可20% / ~2029/9: 50% / 以降: 100%不可
export function nonDeductibleRate(asOf: Date): number {
  if (asOf < new Date("2026-10-01")) return 0.2;
  if (asOf < new Date("2029-10-01")) return 0.5;
  return 1.0;
}

export type BreakdownInput = {
  /// クライアントからの入金額 合計（税込）
  grossInclTax: number;
  /// 本部手数料率（%）
  commissionRate: number;
  /// 源泉対象の制作費（税抜）。個人事業主のときのみ源泉計算に使用。
  productionExclTax: number;
  /// パートナーが個人事業主か（源泉徴収の対象判定）
  isSoleProprietor: boolean;
  /// パートナーがインボイス未登録か（控除不可消費税の判定）
  isInvoiceUnregistered: boolean;
  /// 経過措置率の判定日（省略時は現在日時）
  asOf?: Date;
};

export type Breakdown = {
  grossInclTax: number; // 入金額（税込）
  grossExclTax: number; // 本体（税抜）
  grossTax: number; // 消費税
  commissionRate: number;
  commissionExclTax: number; // 本部手数料（税抜）
  commissionTax: number; // 手数料分の消費税（本部が保持）
  partnerFeeExclTax: number; // パートナー報酬（税抜）
  partnerTax: number; // パートナー分の消費税
  partnerInclTax: number; // パートナー報酬（税込）
  mediaExclTax: number; // うち媒体費（税抜・源泉対象外）= 報酬 − 制作費
  productionExclTax: number; // うち制作費（税抜・源泉対象）
  withholdingTaxAmount: number; // 源泉徴収税
  nonDeductibleTaxAmount: number; // 控除不可消費税
  netPaymentAmount: number; // 差引支払額
};

export function computeBreakdown(input: BreakdownInput): Breakdown {
  const grossInclTax = Math.max(0, Math.round(input.grossInclTax || 0));
  const commissionRate = Math.max(0, input.commissionRate || 0);

  // 税込 → 本体（税抜）＋消費税
  const grossExclTax = Math.round(grossInclTax / (1 + TAX_RATE));
  const grossTax = grossInclTax - grossExclTax;

  // 手数料は税抜本体に対して
  const commissionExclTax = Math.floor((grossExclTax * commissionRate) / 100);
  const commissionTax = Math.floor(commissionExclTax * TAX_RATE);

  // パートナー報酬（税抜）と消費税。消費税は残差で割り当て、合計が必ず入金額と一致する。
  const partnerFeeExclTax = grossExclTax - commissionExclTax;
  const partnerTax = grossTax - commissionTax;
  const partnerInclTax = partnerFeeExclTax + partnerTax;

  // 制作費（税抜・源泉対象）は報酬税抜を上限にクランプ。残りは媒体費（源泉対象外）。
  const productionExclTax = Math.min(Math.max(0, Math.round(input.productionExclTax || 0)), partnerFeeExclTax);
  const mediaExclTax = partnerFeeExclTax - productionExclTax;

  const withholdingTaxAmount = input.isSoleProprietor ? computeWithholding(productionExclTax) : 0;
  const nonDeductibleTaxAmount = input.isInvoiceUnregistered
    ? Math.floor(partnerTax * nonDeductibleRate(input.asOf ?? new Date()))
    : 0;

  const netPaymentAmount = partnerInclTax - withholdingTaxAmount - nonDeductibleTaxAmount;

  return {
    grossInclTax,
    grossExclTax,
    grossTax,
    commissionRate,
    commissionExclTax,
    commissionTax,
    partnerFeeExclTax,
    partnerTax,
    partnerInclTax,
    mediaExclTax,
    productionExclTax,
    withholdingTaxAmount,
    nonDeductibleTaxAmount,
    netPaymentAmount,
  };
}

/// 保存済みの明細レコードから表示用の内訳を復元する。
/// 金額（手数料・源泉・控除不可・差引）は保存値をそのまま使い、
/// 税抜/消費税の分解だけを決定論的に導出する（経過措置の日付ズレを避ける）。
export type StoredStatement = {
  grossAmount: number; // 税込
  commissionRate: number;
  commissionAmount: number; // 本部手数料（税抜）
  mediaExpense: number;
  productionExpense: number;
  withholdingTaxAmount: number;
  nonDeductibleTaxAmount: number;
  netPaymentAmount: number;
};

export function breakdownFromStored(s: StoredStatement): Breakdown {
  const grossInclTax = Math.round(s.grossAmount || 0);
  const grossExclTax = Math.round(grossInclTax / (1 + TAX_RATE));
  const grossTax = grossInclTax - grossExclTax;
  const commissionExclTax = Math.round(s.commissionAmount || 0);
  const commissionTax = Math.floor(commissionExclTax * TAX_RATE);
  const partnerFeeExclTax = grossExclTax - commissionExclTax;
  const partnerTax = grossTax - commissionTax;
  const partnerInclTax = partnerFeeExclTax + partnerTax;
  return {
    grossInclTax,
    grossExclTax,
    grossTax,
    commissionRate: s.commissionRate || 0,
    commissionExclTax,
    commissionTax,
    partnerFeeExclTax,
    partnerTax,
    partnerInclTax,
    mediaExclTax: Math.round(s.mediaExpense || 0),
    productionExclTax: Math.round(s.productionExpense || 0),
    withholdingTaxAmount: Math.round(s.withholdingTaxAmount || 0),
    nonDeductibleTaxAmount: Math.round(s.nonDeductibleTaxAmount || 0),
    netPaymentAmount: Math.round(s.netPaymentAmount || 0),
  };
}
