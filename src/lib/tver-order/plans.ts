// ==============================================================
// TVer小口申込（/order/tver）＝ ①市町村プランのWeb申込 — プラン表示・見積・状態ラベル
//   料金の計算（人口の式・下限2段・最低期間・②の境目・目安）は lib/tver/plan.ts の料金ルールが正本（2026-09-13 代表決定）
//   ・3プラン（住民の200/50/20人に1人）は残す。プラン別の下限はやめ、人口2段の下限を全プランに共通で当てる
//   ・下限で同じ額になったプランは1枚にまとめる（おすすめのスタンダードを残す）
//   ・月額30万以上になるプランは申込を出さず「大規模展開で相談」へ
//   ・初回登録費・管理費なし（旧版 v2026-09-09 の申込は保存済みの初期登録費をそのまま使う）
// ==============================================================

import { CITY_PLAN_RATES, FREQ, SMALL_TOWN_PLAN, UNIT_PRICE, cityPlansFor, estimateDelivery } from "@/lib/tver/plan";
import type { TverOrderStatus } from "@/generated/prisma/client";
import { areaPlanFor } from "@/lib/packages/tver-area";

const RATE = Object.fromEntries(CITY_PLAN_RATES.map((r) => [r.key, r.perResidents])) as Record<(typeof CITY_PLAN_RATES)[number]["key"], number>;

export const TVER_ORDER_PLANS = [
  { key: "light", name: "ライト", perResidents: RATE.light, recommended: false, lead: "テスト配信（反応を見る）", note: "結果を出す目的ならスタンダード以上をお選びください" },
  { key: "standard", name: "スタンダード", perResidents: RATE.standard, recommended: true, lead: "地元の市で認知を取る", note: "" },
  { key: "full", name: "フル", perResidents: RATE.full, recommended: false, lead: "商圏まるごと＝結果を出す基準", note: "" },
  // 人口5万人未満のエリアはこの1プランだけ（月額¥30,000固定・6ヶ月以上）
  { key: SMALL_TOWN_PLAN.key, name: SMALL_TOWN_PLAN.name, perResidents: null, recommended: true, lead: "人口5万人未満のエリアの定額プラン", note: "" },
] as const;
export type TverOrderPlanKey = (typeof TVER_ORDER_PLANS)[number]["key"];

/** 契約期間の選択肢（月）。人口5万人未満のエリアは6ヶ月以上（cityPlanTerms.minMonths） */
export const MONTH_OPTIONS = [
  { months: 3, label: "3ヶ月", note: "結果を出す最短の期間。同じ人に繰り返し届いて記憶に残る" },
  { months: 6, label: "6ヶ月", note: "半年かけて定着させる。季節をまたいで反応を見られる" },
  { months: 12, label: "1年", note: "年間で地元の顔になる" },
] as const;
export type OrderMonths = (typeof MONTH_OPTIONS)[number]["months"];

/** そのエリアで選べる期間（最短期間以上） */
export function monthOptionsFor(minMonths: number) {
  return MONTH_OPTIONS.filter((m) => m.months >= minMonths);
}

export const TAX_RATE = 0.1;
export const AD_SECONDS = 15;
export const DELIVERY_DAYS = "動画の受領から最短10営業日";

export const INDUSTRY_OPTIONS = [
  "住宅・リフォーム",
  "自動車販売・整備",
  "クリニック・医療",
  "学習塾・教育",
  "冠婚葬祭",
  "小売・飲食",
  "美容・健康",
  "不動産",
  "士業・サービス",
  "製造・建設",
  "興行（公演・イベント）",
  "レジャー・スポーツ",
  "採用（業種問わず）",
  "その他",
] as const;

export function planByKey(key: string) {
  return TVER_ORDER_PLANS.find((p) => p.key === key) ?? null;
}

/** 税抜→税込（円未満切り捨て） */
export function withTax(exclTax: number): number {
  return Math.floor(exclTax * (1 + TAX_RATE));
}

export type TverOrderQuote = {
  /** 媒体費（税抜・月額） */
  mediaFeeExclTax: number;
  months: number;
  setupFeeExclTax: number;
  /** 初月の請求（税抜）＝月額＋初期登録費 */
  firstExclTax: number;
  firstTax: number;
  firstInclTax: number;
  /** 2ヶ月目以降の毎月の請求（税込） */
  monthlyInclTax: number;
  /** 契約総額（税込・月額×期間＋初期登録費） */
  contractTotalInclTax: number;
  /** 互換: 初月の税・税込（旧名） */
  tax: number;
  totalInclTax: number;
  subtotalExclTax: number;
};

/** 月払いの見積。初期登録費は再計算しない＝新しい申込は 0、旧版の申込は保存済みの値を渡す */
export function quote(monthlyFee: number, setupFeeExclTax: number, months = 3): TverOrderQuote {
  const firstExclTax = monthlyFee + setupFeeExclTax;
  const firstInclTax = withTax(firstExclTax);
  const monthlyInclTax = withTax(monthlyFee);
  const contractTotalInclTax = withTax(monthlyFee * months + setupFeeExclTax);
  return {
    mediaFeeExclTax: monthlyFee,
    months,
    setupFeeExclTax,
    firstExclTax,
    firstTax: firstInclTax - firstExclTax,
    firstInclTax,
    monthlyInclTax,
    contractTotalInclTax,
    tax: firstInclTax - firstExclTax,
    totalInclTax: firstInclTax,
    subtotalExclTax: firstExclTax,
  };
}

export type TverOrderPlanQuote = {
  key: TverOrderPlanKey;
  name: string;
  /** 住民の N人に1人（まちのプランは null） */
  perResidents: number | null;
  lead: string;
  note: string;
  /** このプランにまとめたプラン名（同額） */
  mergedWith: string[];
  /** 媒体費（税抜・月額）＝人口の式 → 人口2段の下限 */
  mediaFee: number;
  /** 下限を当てる前の人口の式の額（参考） */
  rawFee: number;
  impressions: number;
  reach: number;
  pctResidents: number;
  /** 下限に張り付いた（人口が小さい） */
  floored: boolean;
  /** 月額30万以上＝②大規模展開（Web申込を出さない） */
  custom: boolean;
  /** 同じ額の別プランにまとめた（このカードは出さない）。まとめ先のキー */
  mergedInto: TverOrderPlanKey | null;
};
export type TverOrderAreaEstimate = {
  areaLabel: string;
  population: number;
  viewers: number;
  /** このエリアで出すプランだけ（キーで引く用）。人口5万人未満は town だけ */
  byPlan: Partial<Record<TverOrderPlanKey, TverOrderPlanQuote>>;
  /** 画面に並べる順（まとめたプランは除く・②は custom で残す・安い順） */
  plans: TverOrderPlanQuote[];
  unitPrice: number;
  freq: number;
  /** このエリアの最低料金（月額・税抜）と最短期間 */
  floor: number;
  minMonths: 3 | 6;
  /** 人口5万人未満 */
  small: boolean;
  /** 申込できる（30万未満の）プランがあるか */
  orderable: boolean;
  /** 既定で選ぶプラン（スタンダード→ライト→フルの順で申込できるもの） */
  defaultPlan: TverOrderPlanKey | null;
};

/** 市区町村を選んだときの各プランの価格と目安（lib/tver/plan.ts の cityPlansFor＝LP・MCPと同じ額） */
export function estimateForArea(prefName: string, code: string): TverOrderAreaEstimate | null {
  const plan = areaPlanFor(prefName, code);
  if (!plan) return null;
  const cp = cityPlansFor(plan.population);
  const byPlan: TverOrderAreaEstimate["byPlan"] = {};
  const plans: TverOrderPlanQuote[] = [];
  for (const r of Object.values(cp.rows)) {
    if (!r) continue;
    const def = TVER_ORDER_PLANS.find((p) => p.key === r.key)!;
    const d = estimateDelivery(r.fee, { viewers: plan.viewers, population: plan.population });
    const q: TverOrderPlanQuote = { key: r.key, name: r.name, perResidents: r.perResidents, lead: def.lead, note: def.note, mergedWith: r.mergedWith, mediaFee: r.fee, rawFee: r.raw, impressions: d.impressions, reach: d.reach, pctResidents: d.pctResidents ?? 0, floored: r.floored, custom: r.custom, mergedInto: r.mergedInto };
    byPlan[r.key] = q;
    if (!r.mergedInto) plans.push(q);
  }
  plans.sort((a, b) => a.mediaFee - b.mediaFee);
  return {
    areaLabel: plan.areaLabel,
    population: plan.population,
    viewers: plan.viewers,
    byPlan,
    plans,
    unitPrice: UNIT_PRICE[15],
    freq: FREQ,
    floor: cp.floor,
    minMonths: cp.minMonths,
    small: cp.small,
    orderable: cp.defaultPlan !== null,
    defaultPlan: cp.defaultPlan,
  };
}

/** 表示用の申込番号（TV-2026-0042） */
export function orderNumberLabel(n: number, createdAt: Date): string {
  return `TV-${createdAt.getFullYear()}-${String(n).padStart(4, "0")}`;
}

export const yen = (n: number) => `¥${Math.round(n).toLocaleString("ja-JP")}`;
export const approx = (n: number, unit = 100) => `約${(Math.round(n / unit) * unit).toLocaleString("ja-JP")}`;

// ---- 状態の表示（クライアントからも使うので純粋なこのファイルに置く）
export const TVER_ORDER_STATUS_LABEL: Record<TverOrderStatus, string> = {
  CONSULTING: "相談受付（面談・電話待ち）",
  PRE_REVIEWING: "業態考査中（お支払い前）",
  ORDER_ISSUED: "発注書送付（署名待ち）",
  AWAITING_PAYMENT: "お支払い待ち",
  PAID: "決済完了（考査前）",
  REVIEWING: "考査中",
  MATERIAL_WAITING: "動画の受付中",
  MATERIAL_RECEIVED: "入稿準備中",
  LIVE: "配信中",
  COMPLETED: "配信終了・レポート済",
  CANCELLED: "取り下げ・見送り",
  REFUNDED: "返金済",
};

/** 相談から始まった申込か（2026-09-14〜）。旧来の「申込＝即決済」の申込は false */
export function isConsultFlow(o: { consultMethod: string | null }): boolean {
  return !!o.consultMethod;
}

/** 進捗ページの段（旧来: 決済完了 → 考査 → 動画受付 → 配信 → レポート）。状態→何段目まで済みか */
export function progressIndex(status: TverOrderStatus): number {
  switch (status) {
    case "AWAITING_PAYMENT": return -1;
    case "PAID": return 0;
    case "REVIEWING": return 1;
    case "MATERIAL_WAITING": return 2;
    case "MATERIAL_RECEIVED": return 2;
    case "LIVE": return 3;
    case "COMPLETED": return 4;
    default: return -1;
  }
}

/** 相談から始まった申込の段（面談・電話 → 業態考査 → 発注書 → お支払い → 動画・配信 → 結果報告） */
export const CONSULT_FLOW_STEPS = ["面談・電話", "業態考査", "発注書", "お支払い", "動画・配信", "結果報告"] as const;
export function consultProgressIndex(status: TverOrderStatus): number {
  switch (status) {
    case "CONSULTING": return -1;
    case "PRE_REVIEWING": return 0;
    case "ORDER_ISSUED": return 1;
    case "AWAITING_PAYMENT": return 2;
    case "PAID": case "REVIEWING": case "MATERIAL_WAITING": case "MATERIAL_RECEIVED": return 3;
    case "LIVE": return 4;
    case "COMPLETED": return 5;
    default: return -1;
  }
}
