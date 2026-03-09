// ---------------------------------------------------------------
// リード獲得AI 定数
// ---------------------------------------------------------------

/** 業種オプション */
export const LEAD_INDUSTRY_OPTIONS = [
  { value: "recruitment", label: "採用・人材", keywords: "人材紹介 採用支援 求人" },
  { value: "real_estate", label: "不動産・建設", keywords: "不動産 建設会社 工務店" },
  { value: "restaurant", label: "飲食", keywords: "レストラン 飲食店 カフェ" },
  { value: "retail", label: "小売", keywords: "小売店 ショップ 販売店" },
  { value: "other", label: "その他", keywords: "" },
] as const;

export type LeadIndustryValue = (typeof LEAD_INDUSTRY_OPTIONS)[number]["value"];

/** 取得件数オプション */
export const LEAD_COUNT_OPTIONS = [10, 20, 30, 50] as const;

/** 優先度定義 */
export const PRIORITY_LABELS = [
  { key: "high", label: "優先", emoji: "🔴", min: 70, className: "bg-red-50 text-red-700 border-red-200" },
  { key: "normal", label: "通常", emoji: "🟡", min: 50, className: "bg-yellow-50 text-yellow-700 border-yellow-200" },
  { key: "low", label: "保留", emoji: "⚪", min: 0, className: "bg-zinc-50 text-zinc-600 border-zinc-200" },
] as const;

export function getPriorityLabel(score: number) {
  return PRIORITY_LABELS.find((p) => score >= p.min)!;
}

/** スコア項目 */
export const SCORE_ITEMS = [
  { key: "industryMatch", label: "業種一致度", max: 30 },
  { key: "activity", label: "活発度", max: 20 },
  { key: "scale", label: "規模感", max: 20 },
  { key: "competitive", label: "競合優位性", max: 15 },
  { key: "accessibility", label: "接触しやすさ", max: 15 },
] as const;

export type ScoreKey = (typeof SCORE_ITEMS)[number]["key"];

/** スコアリング結果の型 */
export interface LeadScore {
  total: number;
  breakdown: Record<ScoreKey, number>;
  comment: string;
}

/** Google Places から取得する企業情報の型 */
export interface PlaceLead {
  name: string;
  address: string;
  phone: string;
  rating: number;
  ratingCount: number;
  types: string[];
  mapsUrl: string;
  businessStatus: string;
}

/** スコアリング済みリードの型 */
export interface ScoredLead extends PlaceLead {
  score: LeadScore;
}
