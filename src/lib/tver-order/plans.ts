// ==============================================================
// TVer小口申込（/order/tver）— プラン・料金・目安の計算
//   ・媒体費は3段（月額・税抜・市の人口で変わる）。15秒・契約期間3/6/12ヶ月・市単位
//   ・初期登録費（TVer考査・アカウント作成）= 初回のみ ¥30,000（税抜）、同じ広告主の2回目以降は 0
//     （2026-09-09 代表決定。パッケージ規定「月額10万・15万は¥30,000」と同じ額）
//   ・再生数の目安 = 媒体費 ÷ ¥6.6（15秒・卸値×3）、届く人数の目安 = 再生数 ÷ 実測F 4.78
//     計算は lib/tver/plan.ts・lib/packages/tver-area.ts と同じ（数字は「目安」と必ず添える）
// ==============================================================

import { FREQ, UNIT_PRICE } from "@/lib/tver/plan";
import type { TverOrderStatus } from "@/generated/prisma/client";
import { areaPlanFor } from "@/lib/packages/tver-area";

// 到達率固定＝「住民の N人に1人」に月に届ける（2026-09-09 代表決定: 価格は場所で変わる・3プランは常に出す・10万の上限は置かない）
//   媒体費 = 人口 ÷ N × 実測F 4.78 × ¥6.6 を千円単位に切り上げ（下限だけ置く・上限なし）
//   フル（20人に1人）＝資料の「商圏まるごと（3ヶ月で3人に1人）」を月に直した水準＝高松市で月約¥66万。「結果を出す」基準
//   スタンダード（50人に1人）＝高松市 約¥26万／ライト（200人に1人）＝高松市 約¥6.6万
export const TVER_ORDER_PLANS = [
  { key: "light", name: "ライト", perResidents: 200, floor: 20_000, recommended: false, lead: "テスト配信（反応を見る）", note: "結果を出す目的ならスタンダード以上をお選びください" },
  { key: "standard", name: "スタンダード", perResidents: 50, floor: 50_000, recommended: true, lead: "地元の市で認知を取る", note: "" },
  { key: "full", name: "フル", perResidents: 20, floor: 100_000, recommended: false, lead: "商圏まるごと＝結果を出す基準", note: "3ヶ月で市の3人に1人に届く水準" },
] as const;
export type TverOrderPlanKey = (typeof TVER_ORDER_PLANS)[number]["key"];

export const MEDIA_FEE_FLOOR = 20_000;
/** 契約期間の選択肢（月）。3ヶ月＝資料の商圏まるごとと同じ「結果を出す」前提の最短期間（2026-09-09 代表決定: 3・6・12） */
export const MONTH_OPTIONS = [
  { months: 3, label: "3ヶ月", recommended: true, note: "結果を出す最短の期間。同じ人に繰り返し届いて記憶に残る" },
  { months: 6, label: "6ヶ月", recommended: false, note: "半年かけて定着させる。季節をまたいで反応を見られる" },
  { months: 12, label: "1年", recommended: false, note: "年間で地元の顔になる。素材の差し替えは本部にご相談ください" },
] as const;
export type OrderMonths = (typeof MONTH_OPTIONS)[number]["months"];
/** 初期登録費が無料になる月額（本部規定 2026-09-03: 月額20万以上と商圏まるごとは無料） */
export const SETUP_FEE_WAIVE_FROM = 200_000;

export const SETUP_FEE_EXCL_TAX = 30_000;
export const TAX_RATE = 0.1;
export const AD_SECONDS = 15;
export const DELIVERY_DAYS = "動画の受領から最短10営業日";

export const INDUSTRY_OPTIONS = [
  "住宅・リフォーム",
  "自動車販売・整備",
  "クリニック・医療",
  "学習塾・教育",
  "葬祭",
  "小売・飲食",
  "美容・健康",
  "不動産",
  "士業・サービス",
  "製造・建設",
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

/** 月払いの見積。初期登録費は「月額」で判定（本部規定: 月額20万以上は無料）し、初月の請求に乗せる */
export function quote(monthlyFee: number, isFirstOrder: boolean, months = 3): TverOrderQuote {
  const setupFeeExclTax = isFirstOrder && monthlyFee < SETUP_FEE_WAIVE_FROM ? SETUP_FEE_EXCL_TAX : 0;
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
  /** 媒体費（税抜）＝人口比の額をプランの帯に収めたもの */
  mediaFee: number;
  /** 帯に収める前の人口比の額（参考） */
  rawFee: number;
  impressions: number;
  reach: number;
  pctResidents: number;
  /** 下限に張り付いた（人口が小さい） */
  floored: boolean;
};
export type TverOrderAreaEstimate = {
  areaLabel: string;
  population: number;
  viewers: number;
  byPlan: Record<TverOrderPlanKey, TverOrderPlanQuote>;
  unitPrice: number;
  freq: number;
};

const ceil1000 = (v: number) => Math.ceil(v / 1000) * 1000;

/** 市区町村を選んだときの各プランの価格と目安。plan.ts と同じ推計 */
export function estimateForArea(prefName: string, code: string): TverOrderAreaEstimate | null {
  const plan = areaPlanFor(prefName, code);
  if (!plan) return null;
  const unit = UNIT_PRICE[15];
  const byPlan = {} as TverOrderAreaEstimate["byPlan"];
  for (const p of TVER_ORDER_PLANS) {
    const rawFee = ceil1000((plan.population / p.perResidents) * FREQ * unit);
    const mediaFee = Math.max(p.floor, rawFee);
    const impressions = mediaFee / unit;
    const reach = Math.min(impressions / FREQ, plan.viewers);
    byPlan[p.key] = { key: p.key, mediaFee, rawFee, impressions, reach, pctResidents: Math.min(100, (reach / plan.population) * 100), floored: rawFee < p.floor };
  }
  return { areaLabel: plan.areaLabel, population: plan.population, viewers: plan.viewers, byPlan, unitPrice: unit, freq: FREQ };
}

/** 表示用の申込番号（TV-2026-0042） */
export function orderNumberLabel(n: number, createdAt: Date): string {
  return `TV-${createdAt.getFullYear()}-${String(n).padStart(4, "0")}`;
}

export const yen = (n: number) => `¥${Math.round(n).toLocaleString("ja-JP")}`;
export const approx = (n: number, unit = 100) => `約${(Math.round(n / unit) * unit).toLocaleString("ja-JP")}`;

// ---- 状態の表示（クライアントからも使うので純粋なこのファイルに置く）
export const TVER_ORDER_STATUS_LABEL: Record<TverOrderStatus, string> = {
  AWAITING_PAYMENT: "決済待ち",
  PAID: "決済完了（考査前）",
  REVIEWING: "考査中",
  MATERIAL_WAITING: "動画の受付中",
  MATERIAL_RECEIVED: "入稿準備中",
  LIVE: "配信中",
  COMPLETED: "配信終了・レポート済",
  CANCELLED: "取り下げ",
  REFUNDED: "返金済",
};

/** 進捗ページの5段（決済完了 → 考査 → 動画受付 → 配信 → レポート）。状態→何段目まで済みか */
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

