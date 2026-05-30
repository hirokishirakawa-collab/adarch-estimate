// ============================================================
// 月次ロイヤリティの判定ロジック（単一ソース）
//
// ロイヤリティ＝最低保証型:
//   当月ロイヤリティ = max( 最低5万(税抜), 当月の案件由来 本部手数料10%の合計(税抜) )
//
//   - 10% の合計が 5万 以上 → 相殺済み（追加請求なし＝「貢献感謝」表示）
//   - 10% の合計が 5万 未満 → 差額(税抜)を請求書で請求（消費税10%を別途加算）
//
//   本部手数料(10%)の原資は PaymentStatement.commissionAmount（税抜）。
//   取扱高(税抜)50万 × 10% = 5万 がちょうど最低保証ライン。
//
// ※ 5万は「税抜」の最低保証として扱う（commissionAmount が税抜のため揃える）。
//    請求時はこの差額(税抜)に消費税10%を加算する。
// ============================================================

import { TAX_RATE } from "./payment-statement-calc";

/// 最低ロイヤリティ（税抜）
export const MIN_ROYALTY_EXCL_TAX = 50_000;

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

export type RoyaltyEvaluation = {
  commissionTotalExclTax: number; // 当月の案件由来 本部手数料(10%) 合計（税抜）
  units: number;                  // 加盟拠点数
  minRoyaltyExclTax: number;      // 最低ロイヤリティ（税抜）= 5万 × 拠点数
  shortfallExclTax: number;       // 差額（税抜）= 請求対象。0 なら相殺済み
  isCovered: boolean;             // true: 相殺済み（貢献感謝）/ false: 要請求
};

/// 当月の手数料合計(税抜)から、相殺済みか／請求差額(税抜)を判定する。
/// units = 加盟拠点数。最低保証は 5万 × 拠点数（2拠点加盟なら10万）。
export function evaluateMonthlyRoyalty(commissionTotalExclTax: number, units = 1): RoyaltyEvaluation {
  const commission = Math.max(0, Math.round(commissionTotalExclTax || 0));
  const unitCount = Math.max(1, Math.round(units || 1));
  const minRoyalty = MIN_ROYALTY_EXCL_TAX * unitCount;
  const shortfall = Math.max(0, minRoyalty - commission);
  return {
    commissionTotalExclTax: commission,
    units: unitCount,
    minRoyaltyExclTax: minRoyalty,
    shortfallExclTax: shortfall,
    isCovered: shortfall === 0,
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
