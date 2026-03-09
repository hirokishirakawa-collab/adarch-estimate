// ---------------------------------------------------------------
// リード獲得AI 定数
// ---------------------------------------------------------------

/** 業種オプション */
export const LEAD_INDUSTRY_OPTIONS = [
  // ── BtoC ──
  { value: "restaurant", label: "飲食", keywords: "レストラン 飲食店 カフェ 居酒屋" },
  { value: "retail", label: "小売", keywords: "小売店 ショップ 販売店 物販" },
  { value: "real_estate", label: "不動産・建設", keywords: "不動産 建設会社 工務店 ハウスメーカー" },
  { value: "medical", label: "医療・クリニック", keywords: "病院 クリニック 歯科 医院" },
  { value: "beauty", label: "美容・エステ", keywords: "美容室 エステサロン ネイルサロン 美容院" },
  { value: "fitness", label: "フィットネス・ジム", keywords: "フィットネス スポーツジム パーソナルジム ヨガ" },
  { value: "hotel", label: "ホテル・旅館", keywords: "ホテル 旅館 宿泊施設 リゾート" },
  { value: "education", label: "教育・学習塾", keywords: "学習塾 予備校 スクール 教室" },
  { value: "car_dealer", label: "自動車ディーラー", keywords: "自動車販売 カーディーラー 中古車" },
  { value: "recruitment", label: "採用・人材", keywords: "人材紹介 採用支援 求人 派遣" },
  // ── BtoB ──
  { value: "it_web", label: "IT・Web・SaaS", keywords: "IT企業 システム開発 ソフトウェア SaaS" },
  { value: "manufacturing", label: "製造業", keywords: "製造 メーカー 工場 機械" },
  { value: "logistics", label: "物流・運送", keywords: "物流 運送 倉庫 配送" },
  { value: "consulting", label: "コンサルティング", keywords: "コンサルティング 経営コンサル 戦略" },
  { value: "professional", label: "士業（税理士・弁護士等）", keywords: "税理士 会計事務所 弁護士 社労士 行政書士" },
  { value: "advertising", label: "広告・マーケティング", keywords: "広告代理店 マーケティング PR 販促" },
  { value: "printing", label: "印刷・デザイン", keywords: "印刷会社 デザイン事務所 制作会社" },
  { value: "finance", label: "金融・保険", keywords: "保険代理店 金融 証券 ファイナンス" },
  { value: "wholesale", label: "卸売・商社", keywords: "卸売 商社 貿易 問屋" },
  { value: "other", label: "その他（自由入力）", keywords: "" },
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
  { key: "industryMatch", label: "業種一致度", max: 25 },
  { key: "activity", label: "活発度", max: 15 },
  { key: "scale", label: "規模感", max: 15 },
  { key: "competitive", label: "競合優位性", max: 15 },
  { key: "accessibility", label: "接触しやすさ", max: 10 },
  { key: "digitalPresence", label: "デジタル活用度", max: 20 },
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
  websiteUrl: string;
  businessStatus: string;
}

/** 企業タイプ（チェーン/独立判定） */
export type BusinessType = "chain" | "franchise" | "independent" | "branch" | "unknown";

/** Webサイト分析結果の型 */
export interface WebsiteAnalysis {
  hasWebsite: boolean;
  hasVideo: boolean;
  hasYouTube: boolean;
  hasSns: string[];
  siteAge: "modern" | "outdated" | "unknown";
  hasRecruitPage: boolean;
  businessType: BusinessType;
  businessTypeReason: string;
  summary: string;
}

/** スコアリング済みリードの型 */
export interface ScoredLead extends PlaceLead {
  score: LeadScore;
  digitalAnalysis?: WebsiteAnalysis;
}

// ---------------------------------------------------------------
// リード管理 ステータス定数
// ---------------------------------------------------------------

export const LEAD_STATUS_OPTIONS = [
  { value: "UNTOUCHED",      label: "未対応",   className: "bg-zinc-100 text-zinc-600 border-zinc-200",       icon: "⚪" },
  { value: "CALLED",         label: "連絡済み", className: "bg-blue-100 text-blue-700 border-blue-200",       icon: "📞" },
  { value: "APPOINTMENT",    label: "アポ獲得", className: "bg-yellow-100 text-yellow-700 border-yellow-200", icon: "📅" },
  { value: "DEAL_CONVERTED", label: "商談化",   className: "bg-emerald-100 text-emerald-700 border-emerald-200", icon: "🎉" },
  { value: "SKIPPED",        label: "スキップ", className: "bg-red-100 text-red-600 border-red-200",         icon: "⏭️" },
] as const;

export type LeadStatusValue = (typeof LEAD_STATUS_OPTIONS)[number]["value"];

export function getLeadStatusOption(value: string) {
  return LEAD_STATUS_OPTIONS.find((o) => o.value === value) ?? LEAD_STATUS_OPTIONS[0];
}
