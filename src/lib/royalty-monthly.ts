// ============================================================
// 月次ロイヤリティの判定ロジック（単一ソース）
//
// ロイヤリティ＝最低保証型:
//   当月ロイヤリティ = max( 最低5万(税抜), 当月の案件由来 本部手数料10%の合計(税抜) )
//
//   - 10% の合計が 5万 以上 → 相殺済み（追加請求なし＝「貢献感謝」表示）
//   - 10% の合計が 5万 未満 → 差額(税抜)を請求書で請求（消費税10%を別途加算）
//
//   本部手数料(10%)の原資は InvoiceRequest.commissionExclTax（税抜）。
//   本部がクライアントへ代理請求した金額(税抜)に対して発生し、請求日(billingDate)の月に帰属する。
//   支払明細(PaymentStatement.commissionAmount)は同じ手数料を「実際に控除した額」として持つ。
//   両者は同一案件なら一致する想定で、ズレは突き合わせ対象。
//   取扱高(税抜)50万 × 10% = 5万 がちょうど最低保証ライン。
//
// ※ 5万は「税抜」の最低保証として扱う（commissionAmount が税抜のため揃える）。
//    請求時はこの差額(税抜)に消費税10%を加算する。
// ============================================================

import { TAX_RATE } from "./payment-statement-calc";

/// 最低ロイヤリティ（税抜）
export const MIN_ROYALTY_EXCL_TAX = 50_000;

/// 本部手数料率（%）。ロイヤリティ相殺の原資＝請求額(税抜) × この率。
export const HQ_COMMISSION_RATE = 10;

/// 手数料の計算基礎(税抜)＝請求額(税抜) − 立替実費(税抜)。
/// 交通費・宿泊費・外注実費など、実費相当額をそのまま請求先に請求した分は
/// 契約 別紙2-4 により対象売上に算入しないため、10%の基礎から外す。
/// 上乗せして請求した分は実費に含めない（通常の売上として基礎に残る）。
export function commissionBaseOf(amountExclTax: number, reimbursementExclTax: number = 0): number {
  const amount = Math.max(0, Math.round(amountExclTax || 0));
  const reimbursement = Math.max(0, Math.round(reimbursementExclTax || 0));
  return Math.max(0, amount - reimbursement);
}

/// 計算基礎(税抜)から本部手数料(税抜)を求める。立替実費がある場合は
/// commissionBaseOf() を通した額を渡すこと。
/// 支払明細の computeBreakdown と同じ切り捨てで、同一案件なら両者が一致する。
export function commissionOf(amountExclTax: number, ratePercent: number = HQ_COMMISSION_RATE): number {
  const base = Math.max(0, Math.round(amountExclTax || 0));
  const rate = Math.max(0, ratePercent || 0);
  return Math.floor((base * rate) / 100);
}

/// この取扱高(税抜)で 10% = 5万 に達する（相殺ライン）
export const ROYALTY_COVER_REVENUE_EXCL_TAX = 500_000;

/// 月キー（"2026-05"）を Date / 文字列から作る。
export function monthKeyOf(d: Date | string): string {
  const dt = new Date(d);
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

/// 支払明細レコード（commissionAmount＝本部手数料・税抜 と 基準日）を
/// 月キーごとに合計する。基準日は入金日(paidAt)優先、なければ作成日。
export function aggregateCommissionByMonth(
  records: { commissionAmount: number; date: Date | string }[],
): Map<string, number> {
  const map = new Map<string, number>();
  for (const r of records) {
    const k = monthKeyOf(r.date);
    map.set(k, (map.get(k) ?? 0) + Math.max(0, Math.round(r.commissionAmount || 0)));
  }
  return map;
}

/// 県（拠点）ごとのロイヤリティ内訳。
export type BranchRoyalty = {
  label: string;             // 県名（例: 山口）
  commissionExclTax: number; // その県の当月手数料（10%・税抜）
  minExclTax: number;        // その県の最低保証（5万・税抜）
  shortfallExclTax: number;  // その県の不足（税抜）
  isCovered: boolean;        // その県が相殺済みか
};

export type RoyaltyEvaluation = {
  commissionTotalExclTax: number;    // 当月の手数料(10%)合計（税抜・全県＋未振分）
  units: number;                     // 拠点数
  perBranchMinExclTax: number;       // 県あたり（or単一）の最低保証（税抜）。免除なら0
  minRoyaltyExclTax: number;         // 最低ロイヤリティ合計（税抜）= 県あたり最低保証 × 拠点数
  shortfallExclTax: number;          // 請求対象（県別不足の合計。相殺なし）
  isCovered: boolean;                // 全県クリアか
  isExempt: boolean;                 // ロイヤリティ免除
  branches: BranchRoyalty[];         // 複数拠点のときの県別内訳。単一拠点は空
  untaggedCommissionExclTax: number; // 複数拠点で県未指定の手数料（floorに寄与しない・要再割当）
};

/// 県別に独立してロイヤリティを判定する（相殺なし）。
/// - minExclTax: 県あたり（or単一拠点）の最低保証。省略時は既定5万。代表ごとに個別設定可。
/// - exempt: 免除なら最低保証0として扱い、請求は発生しない。
/// - branchLabels が空 or 1件: 合計に対して最低保証を1回。2件以上: 県ごとに max(最低保証, その県の手数料) を独立評価。
export function evaluatePartnerRoyalty(opts: {
  branchLabels: string[];
  commissionByLabel: Record<string, number>;
  totalCommissionExclTax: number;
  minExclTax?: number;
  exempt?: boolean;
}): RoyaltyEvaluation {
  const labels = (opts.branchLabels ?? []).map((l) => (l ?? "").trim()).filter(Boolean);
  const total = Math.max(0, Math.round(opts.totalCommissionExclTax || 0));
  const exempt = !!opts.exempt;
  const perMin = exempt ? 0 : Math.max(0, Math.round(opts.minExclTax ?? MIN_ROYALTY_EXCL_TAX));

  // 単一拠点（従来挙動）
  if (labels.length <= 1) {
    const shortfall = Math.max(0, perMin - total);
    return {
      commissionTotalExclTax: total,
      units: 1,
      perBranchMinExclTax: perMin,
      minRoyaltyExclTax: perMin,
      shortfallExclTax: shortfall,
      isCovered: shortfall === 0,
      isExempt: exempt,
      branches: [],
      untaggedCommissionExclTax: 0,
    };
  }

  // 複数拠点：県ごとに独立判定
  let taggedSum = 0;
  const branches: BranchRoyalty[] = labels.map((label) => {
    const c = Math.max(0, Math.round(opts.commissionByLabel[label] || 0));
    taggedSum += c;
    const shortfall = Math.max(0, perMin - c);
    return { label, commissionExclTax: c, minExclTax: perMin, shortfallExclTax: shortfall, isCovered: shortfall === 0 };
  });
  const shortfallTotal = branches.reduce((s, b) => s + b.shortfallExclTax, 0);
  return {
    commissionTotalExclTax: total,
    units: labels.length,
    perBranchMinExclTax: perMin,
    minRoyaltyExclTax: perMin * labels.length,
    shortfallExclTax: shortfallTotal,
    isCovered: shortfallTotal === 0,
    isExempt: exempt,
    branches,
    untaggedCommissionExclTax: Math.max(0, total - taggedSum),
  };
}

/// 税抜小計から 消費税(10%) と 税込合計 を求める（請求書共通）。
export function invoiceTotals(subtotalExclTax: number): {
  subtotalExclTax: number;
  taxAmount: number;
  totalInclTax: number;
} {
  const sub = Math.max(0, Math.round(subtotalExclTax || 0));
  const tax = Math.floor(sub * TAX_RATE);
  return { subtotalExclTax: sub, taxAmount: tax, totalInclTax: sub + tax };
}
