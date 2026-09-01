// ============================================================
// 月次ロイヤリティの判定ロジック（単一ソース）
//
// ロイヤリティ＝最低保証＋売上連動（契約: 最低5万＋売上10%）:
//   当月ロイヤリティ = max( 最低5万(税抜), 月次報告の売上(税抜・自拠点請求＋本部請求)×10% )
//   相殺           = 当月の案件由来 本部手数料10%の合計(税抜)＝本部が代理請求で既に控除した分
//   請求額(税抜)   = ロイヤリティ − 相殺（0未満は0）
//
//   - 相殺 ≥ ロイヤリティ → 相殺済み（追加請求なし＝「貢献感謝」表示）
//   - 相殺 < ロイヤリティ → 差額(税抜)を請求書で請求（消費税10%を別途加算）
//
//   ※ 月次報告が未提出・不完全で 売上×10% < 相殺 のときは、ロイヤリティを相殺額まで
//     引き上げて評価する（＝従来の max(5万, 手数料) と同じ結果。取り漏れも取り過ぎもしない）。
//   ※ 2026-09-01 代表決定: それまでは本部請求分の10%だけを見ており、自拠点請求の売上が
//     判定に乗っていなかった（月次報告と未連動）。
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

/// この額未満の不足は請求しない（相殺済み扱い）。丸めの違いで出る数百円の請求書を作らないため。
/// 2026-09-01 代表決定。
export const ROYALTY_SHORTFALL_IGNORE_BELOW = 1_000;

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
  revenueExclTax: number;    // その県の月次報告 売上（税抜）
  royaltyExclTax: number;    // その県のロイヤリティ = max(最低保証, 売上×10%, 手数料)（税抜）
  commissionExclTax: number; // その県の当月手数料（10%・税抜）＝相殺
  minExclTax: number;        // その県の最低保証（5万・税抜）
  shortfallExclTax: number;  // その県の不足（税抜）= ロイヤリティ − 手数料
  isCovered: boolean;        // その県が相殺済みか
};

export type RoyaltyEvaluation = {
  revenueExclTax: number;            // 月次報告の売上合計（税抜・全県）
  royaltyExclTax: number;            // ロイヤリティ合計（税抜）= Σ max(最低保証, 売上×10%, 手数料)
  commissionTotalExclTax: number;    // 当月の手数料(10%)合計（税抜・全県＋未振分）＝相殺
  units: number;                     // 拠点数
  perBranchMinExclTax: number;       // 県あたり（or単一）の最低保証（税抜）。免除なら0
  minRoyaltyExclTax: number;         // 最低ロイヤリティ合計（税抜）= 県あたり最低保証 × 拠点数
  shortfallExclTax: number;          // 請求対象（県別不足の合計。相殺なし）
  isCovered: boolean;                // 全県クリアか
  isExempt: boolean;                 // ロイヤリティ免除
  branches: BranchRoyalty[];         // 複数拠点のときの県別内訳。単一拠点は空
  untaggedCommissionExclTax: number; // 複数拠点で県未指定の手数料（floorに寄与しない・要再割当）
};

/// 1拠点分の判定: ロイヤリティ = max(最低保証, 売上×10%, 手数料)、不足 = ロイヤリティ − 手数料。
function evaluateUnit(perMin: number, revenue: number, commission: number) {
  const fromRevenue = commissionOf(revenue);
  const royalty = Math.max(perMin, fromRevenue, commission);
  const shortfall = Math.max(0, royalty - commission);
  return { royaltyExclTax: royalty, shortfallExclTax: shortfall < ROYALTY_SHORTFALL_IGNORE_BELOW ? 0 : shortfall };
}

/// 県別に独立してロイヤリティを判定する（相殺なし）。
/// - minExclTax: 県あたり（or単一拠点）の最低保証。省略時は既定5万。代表ごとに個別設定可。
/// - exempt: 免除なら最低保証0として扱い、請求は発生しない（売上連動も発生しない）。
/// - revenue*: 月次報告の売上（税抜）。省略時は0＝従来どおり max(最低保証, 手数料) の評価になる。
/// - branchLabels が空 or 1件: 合計に対して1回。2件以上: 県ごとに独立評価。
export function evaluatePartnerRoyalty(opts: {
  branchLabels: string[];
  commissionByLabel: Record<string, number>;
  totalCommissionExclTax: number;
  revenueByLabel?: Record<string, number>;
  totalRevenueExclTax?: number;
  minExclTax?: number;
  exempt?: boolean;
}): RoyaltyEvaluation {
  const labels = (opts.branchLabels ?? []).map((l) => (l ?? "").trim()).filter(Boolean);
  const total = Math.max(0, Math.round(opts.totalCommissionExclTax || 0));
  const revenueTotal = Math.max(0, Math.round(opts.totalRevenueExclTax || 0));
  const revenueByLabel = opts.revenueByLabel ?? {};
  const exempt = !!opts.exempt;
  const perMin = exempt ? 0 : Math.max(0, Math.round(opts.minExclTax ?? MIN_ROYALTY_EXCL_TAX));

  // 単一拠点
  if (labels.length <= 1) {
    const u = exempt ? { royaltyExclTax: 0, shortfallExclTax: 0 } : evaluateUnit(perMin, revenueTotal, total);
    return {
      revenueExclTax: revenueTotal,
      royaltyExclTax: u.royaltyExclTax,
      commissionTotalExclTax: total,
      units: 1,
      perBranchMinExclTax: perMin,
      minRoyaltyExclTax: perMin,
      shortfallExclTax: u.shortfallExclTax,
      isCovered: u.shortfallExclTax === 0,
      isExempt: exempt,
      branches: [],
      untaggedCommissionExclTax: 0,
    };
  }

  // 複数拠点：県ごとに独立判定
  let taggedSum = 0;
  const branches: BranchRoyalty[] = labels.map((label) => {
    const c = Math.max(0, Math.round(opts.commissionByLabel[label] || 0));
    const rev = Math.max(0, Math.round(revenueByLabel[label] || 0));
    taggedSum += c;
    const u = exempt ? { royaltyExclTax: 0, shortfallExclTax: 0 } : evaluateUnit(perMin, rev, c);
    return { label, revenueExclTax: rev, royaltyExclTax: u.royaltyExclTax, commissionExclTax: c, minExclTax: perMin, shortfallExclTax: u.shortfallExclTax, isCovered: u.shortfallExclTax === 0 };
  });
  const shortfallTotal = branches.reduce((s, b) => s + b.shortfallExclTax, 0);
  return {
    revenueExclTax: revenueTotal,
    royaltyExclTax: branches.reduce((s, b) => s + b.royaltyExclTax, 0),
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

// ============================================================
// 入金期限（本部の入金チェック用）
//   対象月 M のロイヤリティは月末締め → 請求 → 翌々月10日が支払期限。
//   例: 2026-06 分 → 期限 2026-08-10（実務: 請求6/25・期限8/10）
//   多くの代表は「月末に翌月10日期限分」を払う＝期限当日に未入金でも異常ではない。
// ============================================================

/// 対象月から支払期限までの月数（翌々月＝2）
export const ROYALTY_DUE_MONTH_OFFSET = 2;
/// 支払期限の日
export const ROYALTY_DUE_DAY = 10;

/// 対象月キー（"2026-06"）→ 支払期限（ローカル日付・その日の 00:00）
export function royaltyDueDateOf(month: string): Date {
  const [y, m] = month.split("-").map(Number);
  return new Date(y, m - 1 + ROYALTY_DUE_MONTH_OFFSET, ROYALTY_DUE_DAY);
}

/// 自動集計（請求申請）と手入力調整を合成して、判定に使う手数料を決める。
/// - 手入力があればその県だけ上書き（無い県は自動集計）
/// - 単一拠点は key="" の手入力が合計を上書き
/// getMonthlyRoyaltyOverview と入金チェックの両方で同じ合成を使う（単一ソース）。
export function resolveEffectiveCommission(opts: {
  branchLabels: string[];
  autoByLabel: Record<string, number>;
  autoTotal: number;
  overrides: Record<string, number>;
}): { commissionByLabel: Record<string, number>; total: number } {
  const labels = (opts.branchLabels ?? []).filter(Boolean);
  const ov = opts.overrides ?? {};
  const hasOverride = Object.keys(ov).length > 0;
  if (labels.length > 1) {
    const eff: Record<string, number> = {};
    for (const l of labels) eff[l] = ov[l] ?? opts.autoByLabel[l] ?? 0;
    const total = hasOverride ? Object.values(eff).reduce((s, v) => s + v, 0) : opts.autoTotal;
    return { commissionByLabel: eff, total };
  }
  return { commissionByLabel: opts.autoByLabel, total: ov[""] != null ? ov[""] : opts.autoTotal };
}
