// ---------------------------------------------------------------
// リード獲得AI 定数
// ---------------------------------------------------------------

/** 広告媒体メニュー（媒体別リード検索用） */
export const MEDIA_MENU_OPTIONS = [
  {
    value: "tver",
    label: "TVer",
    description: "テレビCMと同等のリーチを低コストで。エリアターゲティング可能",
    targetIndustries: ["restaurant", "real_estate", "beauty", "car_dealer", "fitness", "hotel", "education", "medical"],
    searchKeywords: "飲食店 不動産 美容室 自動車ディーラー フィットネス ホテル 学習塾 クリニック",
    scoringHint: "地域密着型でエリアターゲティングが有効な業種。BtoC向けサービスで認知拡大したい企業に最適。TV CMの代替として提案可能。",
  },
  {
    value: "skylark",
    label: "すかいらーくサイネージ",
    description: "ファミレス店内デジタルサイネージ。ファミリー層へダイレクト訴求",
    targetIndustries: ["real_estate", "education", "car_dealer", "hotel", "fitness", "medical"],
    searchKeywords: "不動産 住宅展示場 学習塾 自動車ディーラー レジャー施設 クリニック 保険代理店",
    scoringHint: "ファミリー層がメインターゲット。不動産・教育・車・レジャー・保険など家族の意思決定に関わるサービスに最適。食事中の長時間接触が強み。",
  },
  {
    value: "aeon_cinema",
    label: "イオンシネマ",
    description: "映画館のスクリーン広告。大画面・高音質で圧倒的なインパクト",
    targetIndustries: ["real_estate", "car_dealer", "hotel", "beauty", "fitness", "restaurant"],
    searchKeywords: "不動産 ハウスメーカー 自動車ディーラー リゾート 美容室 フィットネスジム レストラン",
    scoringHint: "イオンモール来場者（ファミリー・カップル・若年層）がターゲット。商圏内の不動産・車・美容・レジャーに響く。大画面でのブランディング効果が高い。",
  },
  {
    value: "taxi",
    label: "タクシー広告",
    description: "タクシー車内モニター広告。経営者・富裕層にピンポイントリーチ",
    targetIndustries: ["it_web", "consulting", "finance", "professional", "recruitment", "manufacturing"],
    searchKeywords: "IT企業 SaaS コンサルティング 金融 保険 税理士 会計事務所 人材紹介 製造業",
    scoringHint: "BtoB決裁者・経営者・富裕層がターゲット。IT/SaaS・コンサル・金融・士業など高単価サービスに最適。密閉空間での接触で認知定着率が高い。",
  },
  {
    value: "golfcart",
    label: "ゴルフカート広告",
    description: "ゴルフカートのモニター広告。経営者層に18ホール分の長時間接触",
    targetIndustries: ["finance", "real_estate", "consulting", "professional", "car_dealer", "hotel"],
    searchKeywords: "金融 保険 不動産 投資 コンサルティング 高級車ディーラー リゾートホテル 会計事務所",
    scoringHint: "ゴルフ場利用者（経営者・富裕層・管理職）がターゲット。高単価商材・富裕層向けサービスに最適。4-5時間の長時間接触が最大の強み。",
  },
  {
    value: "omochannel",
    label: "おもチャンネル（アパホテル）",
    description: "アパホテル客室テレビ広告。ビジネス出張客へダイレクト訴求",
    targetIndustries: ["it_web", "recruitment", "consulting", "restaurant", "fitness", "beauty"],
    searchKeywords: "IT企業 人材紹介 コンサルティング 飲食チェーン フィットネス エステ 転職サービス",
    scoringHint: "ビジネスホテル宿泊客（出張ビジネスマン）がターゲット。BtoB企業の認知拡大、採用、出張先の飲食・サービス利用促進に有効。",
  },
  {
    value: "sns_ad",
    label: "SNS広告",
    description: "Instagram/Facebook/TikTok等のSNS広告運用代行",
    targetIndustries: ["beauty", "restaurant", "retail", "fitness", "hotel", "education", "real_estate"],
    searchKeywords: "美容室 飲食店 小売店 フィットネスジム ホテル 学習塾 不動産",
    scoringHint: "SNS未活用またはSNS運用が弱い企業に提案チャンス大。BtoC業種全般。Webサイト分析でSNSリンクがない企業は特に有望。",
  },
  {
    value: "web_ad",
    label: "Web広告",
    description: "Google広告・Yahoo広告等のリスティング・ディスプレイ広告運用",
    targetIndustries: ["real_estate", "medical", "beauty", "education", "professional", "car_dealer", "recruitment"],
    searchKeywords: "不動産 クリニック 美容室 学習塾 税理士 自動車ディーラー 人材紹介",
    scoringHint: "検索ニーズが強い業種に最適。地域+業種の検索で上位表示が必要な企業。Webサイトはあるが集客に課題がある企業が有望。",
  },
  {
    value: "video_production",
    label: "動画制作",
    description: "CM・商品紹介・採用動画・SNS用ショート動画の企画制作",
    targetIndustries: ["manufacturing", "real_estate", "hotel", "recruitment", "medical", "education", "it_web"],
    searchKeywords: "製造業 メーカー 不動産 ホテル 旅館 人材紹介 クリニック 学校 IT企業",
    scoringHint: "Webサイトに動画がない企業は最有望ターゲット。採用ページがある企業には採用動画、製造業には工場紹介動画、ホテル・不動産にはPR動画を提案。",
  },
  {
    value: "youtube",
    label: "YouTube運用",
    description: "YouTubeチャンネルの企画・撮影・編集・運用代行",
    targetIndustries: ["beauty", "restaurant", "fitness", "education", "real_estate", "medical", "manufacturing"],
    searchKeywords: "美容室 飲食店 フィットネスジム 学習塾 不動産 クリニック 製造業",
    scoringHint: "YouTubeを活用していない企業が最有望。ノウハウ発信できる業種（美容・教育・医療）や、商品・施設のビジュアル訴求が強い業種に最適。",
  },
  {
    value: "sns_management",
    label: "SNS運用",
    description: "Instagram/TikTok/X等のSNSアカウント運用代行",
    targetIndustries: ["beauty", "restaurant", "retail", "hotel", "fitness", "education"],
    searchKeywords: "美容室 飲食店 小売店 ホテル フィットネスジム スクール カフェ",
    scoringHint: "SNSアカウントがない or 更新が止まっている企業に提案チャンス大。ビジュアルコンテンツと相性が良いBtoC業種全般。",
  },
] as const;

export type MediaMenuValue = (typeof MEDIA_MENU_OPTIONS)[number]["value"];

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
