// ---------------------------------------------------------------
// リード獲得AI 定数
// ---------------------------------------------------------------

/** 広告媒体メニュー（媒体別リード検索用） */
export const MEDIA_MENU_OPTIONS = [
  {
    value: "tver",
    label: "TVer",
    description: "テレビ離れした20〜40代にスマホ・PCでリーチ。エリアターゲティング可能",
    targetIndustries: ["restaurant", "real_estate", "beauty", "car_dealer", "fitness", "hotel", "education", "medical", "it_web", "retail"],
    searchKeywords: "飲食店 不動産 美容室 自動車ディーラー フィットネス ホテル 学習塾 クリニック EC アプリ 転職サービス",
    scoringHint: "想定月額: 50万円〜（配信量・ターゲティング設定による）。ターゲット: テレビ離れした20〜40代のスマホ・PC視聴者。消費財・食品・アプリ・EC・エンタメ・転職サービスなど幅広い一般消費者向け商材に最適。月額50万円以上の広告予算が見込める企業が前提。",
  },
  {
    value: "skylark",
    label: "すかいらーくサイネージ",
    description: "全国2,300店舗・年2.7億人のファミリー層へダイレクト訴求",
    targetIndustries: ["real_estate", "education", "car_dealer", "hotel", "fitness", "medical", "retail"],
    searchKeywords: "不動産 住宅展示場 学習塾 自動車ディーラー レジャー施設 クリニック 保険代理店 食品 日用品 ヘルスケア",
    scoringHint: "想定月額: 約37〜40万円〜（100店舗・4週間で約150万円が目安）。ターゲット: ファミリー層・シニア・主婦など外食利用者（全国2,300店舗・年2.7億人）。食品・日用品・保険・地域密着型サービス・ヘルスケアなど家族の意思決定に関わるサービスに最適。食事中の長時間接触が強み。月額37万円以上の広告予算が見込める企業が前提。",
  },
  {
    value: "aeon_cinema",
    label: "イオンシネマ",
    description: "映画館スクリーン広告。大画面・高音質で年3,338万人にインパクト",
    targetIndustries: ["real_estate", "car_dealer", "hotel", "beauty", "fitness", "restaurant", "retail"],
    searchKeywords: "不動産 ハウスメーカー 自動車ディーラー リゾート 美容室 フィットネスジム レストラン エンタメ ショッピング",
    scoringHint: "想定月額: 約30万円〜（ランク・本数による。Sランク118万円/4週間〜）。ターゲット: 映画鑑賞前の来場者（ファミリー・カップル・シニア）年3,338万人。エンタメ・飲食・自動車・不動産・地域型ショッピング関連に最適。大画面でのブランディング効果が高い。月額30万円以上の広告予算が見込める企業が前提。",
  },
  {
    value: "taxi",
    label: "タクシー広告（TOKYO PRIME）",
    description: "都市部のビジネスパーソン・管理職・高年収層に月3,550万リーチ",
    targetIndustries: ["it_web", "consulting", "finance", "professional", "recruitment", "manufacturing"],
    searchKeywords: "IT企業 SaaS コンサルティング 金融 保険 税理士 会計事務所 人材紹介 製造業",
    scoringHint: "想定費用: 320万円〜/週（東京エリア・動画広告）※週単位販売。ターゲット: 都市部のビジネスパーソン・管理職・高年収層（月3,550万リーチ）。BtoB・金融・高級品・士業・採用・SaaS・コンサルティングに最適。密閉空間での接触で認知定着率が高い。週320万円以上の広告予算が見込める企業が前提。",
  },
  {
    value: "golfcart",
    label: "ゴルフカート広告（Golfcart Vision）",
    description: "50代以上の富裕層・経営者・決裁者に18ホール分の長時間接触",
    targetIndustries: ["finance", "real_estate", "consulting", "professional", "car_dealer", "hotel"],
    searchKeywords: "金融 保険 不動産 投資 コンサルティング 高級車ディーラー リゾートホテル 会計事務所 健康食品",
    scoringHint: "想定費用: 200万円〜/週（Regular 30秒）※週単位販売。ターゲット: ゴルフ場来場者＝50代以上の富裕層・経営者・決裁者（月42.7万人）。富裕層向け金融・保険・不動産・高級車・健康食品・リゾートに最適。4-5時間の長時間接触が最大の強み。週200万円以上の広告予算が見込める企業が前提。",
  },
  {
    value: "omochannel",
    label: "おもチャンネル（アパホテル）",
    description: "アパホテル53,000室の宿泊客へダイレクト訴求。再生単価0.47円〜",
    targetIndustries: ["it_web", "recruitment", "consulting", "finance", "fitness", "beauty"],
    searchKeywords: "IT企業 人材紹介 コンサルティング 保険 転職サービス ヘルスケア スキルアップ 観光",
    scoringHint: "想定費用: 再生単価0.47円〜（規模・期間次第で月数十万円〜）。ターゲット: アパホテル宿泊者＝国内出張ビジネスマン・旅行者（53,000室）。BtoB・採用・保険・健康・スキルアップ・地方観光PRに最適。月数十万円以上の広告予算が見込める企業が前提。",
  },
  {
    value: "sns_ad",
    label: "SNS広告",
    description: "Instagram/X/TikTok等のSNS広告運用代行。10〜40代中心にリーチ",
    targetIndustries: ["beauty", "restaurant", "retail", "fitness", "hotel", "education", "real_estate", "recruitment"],
    searchKeywords: "美容室 飲食店 小売店 フィットネスジム ホテル 学習塾 不動産 アパレル EC",
    scoringHint: "想定月額: 10万円〜（広告費のみ。運用代行込みなら+5〜20万円程度）。ターゲット: 10〜40代中心。Instagramはビジュアル重視の女性層、TikTokは若年層など媒体で異なる。美容・ファッション・飲食・EC・アプリ・採用・ブランド認知を高めたい企業全般。SNS未活用の企業に提案チャンス大。Webサイト分析でSNSリンクがない企業は特に有望。",
  },
  {
    value: "web_ad",
    label: "Web広告",
    description: "Google・Yahoo!等のリスティング・ディスプレイ広告。購買意欲の高い検索ユーザーへ",
    targetIndustries: ["real_estate", "medical", "beauty", "education", "professional", "car_dealer", "recruitment", "it_web"],
    searchKeywords: "不動産 クリニック 美容室 学習塾 税理士 自動車ディーラー 人材紹介 リフォーム",
    scoringHint: "想定月額: 10万円〜（広告費のみ。運用代行込みなら+5〜15万円程度）。ターゲット: 商品・サービスを能動的に検索している購買意欲の高い人。BtoB・士業・医療・リフォーム・学習塾など「検索されやすい」課題解決型ビジネス全般に最適。Webサイトはあるが集客に課題がある企業が有望。",
  },
  {
    value: "youtube_ad",
    label: "YouTube広告",
    description: "幅広い年齢層に興味・属性で細かくターゲティング。認知拡大・採用に有効",
    targetIndustries: ["beauty", "restaurant", "fitness", "education", "real_estate", "medical", "manufacturing", "recruitment"],
    searchKeywords: "美容室 飲食店 フィットネスジム 学習塾 不動産 クリニック 製造業 メーカー",
    scoringHint: "想定月額: 10万円〜（広告費のみ。動画素材がある前提）。ターゲット: 幅広い年齢層で興味・属性のターゲティングが細かく設定可能。商品説明が必要な商材・サービス、認知拡大フェーズの企業、採用ブランディングに最適。動画素材がない企業には動画制作とセットで提案可能。",
  },
  {
    value: "sns_management",
    label: "SNS運用",
    description: "Instagram/TikTok/X等のアカウント運用代行。長期的なファン育成",
    targetIndustries: ["beauty", "restaurant", "retail", "hotel", "fitness", "education", "recruitment"],
    searchKeywords: "美容室 飲食店 小売店 ホテル フィットネスジム スクール カフェ アパレル",
    scoringHint: "想定月額: 5〜30万円程度（投稿本数・媒体数・クリエイティブ制作の有無による）。ターゲット: フォロワー・潜在顧客へのじっくりした関係構築。飲食・美容・ブランド・採用強化中の企業など長期的にファンを育てたい業種に最適。SNSアカウントがない or 更新が止まっている企業に提案チャンス大。",
  },
  {
    value: "video_production",
    label: "動画制作",
    description: "15秒〜30秒の広告用動画30万円〜。SNS・サイネージ・展示会で横展開可能",
    targetIndustries: ["manufacturing", "real_estate", "hotel", "recruitment", "medical", "education", "it_web"],
    searchKeywords: "製造業 メーカー 不動産 ホテル 旅館 人材紹介 クリニック 学校 IT企業",
    scoringHint: "想定費用: 15秒〜30秒の広告用動画で30万円〜（内容・クオリティにより変動）。一度制作すれば複数媒体（SNS広告・YouTube広告・サイネージ・展示会）で使い回せるため費用対効果が高い。広告出稿とセットで提案しやすい。Webサイトに動画がない企業は最有望。採用ページがある企業には採用動画、製造業には工場紹介動画、ホテル・不動産にはPR動画を提案。",
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
