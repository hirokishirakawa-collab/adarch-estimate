// ================================================================
// ヒアリングシート定数
// ================================================================

// --- A. 顧客理解（WHO） ---

export const TARGET_CUSTOMER_OPTIONS = [
  { value: "consumer", label: "一般消費者" },
  { value: "corporate", label: "法人" },
  { value: "affluent", label: "富裕層" },
  { value: "youth", label: "若年層" },
  { value: "family", label: "ファミリー" },
  { value: "senior", label: "シニア" },
  { value: "inbound", label: "インバウンド" },
] as const;

export const TRADE_AREA_OPTIONS = [
  { value: "local", label: "店舗周辺" },
  { value: "city", label: "市区町村" },
  { value: "prefecture", label: "都道府県" },
  { value: "national", label: "全国" },
  { value: "overseas", label: "海外" },
] as const;

export const ANNUAL_REVENUE_OPTIONS = [
  { value: "under_30m", label: "〜3,000万円" },
  { value: "under_100m", label: "〜1億円" },
  { value: "under_500m", label: "〜5億円" },
  { value: "under_1b", label: "〜10億円" },
  { value: "over_1b", label: "10億円〜" },
  { value: "unknown", label: "不明" },
] as const;

export const EMPLOYEE_COUNT_OPTIONS = [
  { value: "1-5", label: "1〜5名" },
  { value: "6-20", label: "6〜20名" },
  { value: "21-50", label: "21〜50名" },
  { value: "51-100", label: "51〜100名" },
  { value: "over_100", label: "100名〜" },
  { value: "unknown", label: "不明" },
] as const;

// --- B. 現状把握（NOW） ---

export const CURRENT_CHANNEL_OPTIONS = [
  { value: "flyer", label: "チラシ" },
  { value: "signage", label: "看板" },
  { value: "web_ad", label: "Web広告" },
  { value: "sns", label: "SNS" },
  { value: "review_site", label: "口コミサイト" },
  { value: "referral", label: "紹介" },
  { value: "tv_cm", label: "TV CM" },
  { value: "video", label: "動画" },
  { value: "none", label: "なし" },
  { value: "other", label: "その他" },
] as const;

export const MONTHLY_AD_BUDGET_OPTIONS = [
  { value: "0", label: "0円" },
  { value: "under_50k", label: "〜5万円" },
  { value: "under_100k", label: "〜10万円" },
  { value: "under_300k", label: "〜30万円" },
  { value: "under_500k", label: "〜50万円" },
  { value: "under_1m", label: "〜100万円" },
  { value: "over_1m", label: "100万円〜" },
  { value: "unknown", label: "不明" },
] as const;

// --- C. 課題・ニーズ（WANT） ---

export const PRIMARY_CHALLENGE_OPTIONS = [
  { value: "new_customers", label: "新規集客" },
  { value: "awareness", label: "認知拡大" },
  { value: "repeat", label: "リピート率" },
  { value: "recruitment", label: "採用" },
  { value: "branding", label: "ブランディング" },
  { value: "sales_decline", label: "売上低迷" },
  { value: "competition", label: "競合対策" },
  { value: "other", label: "その他" },
] as const;

export const INTERESTED_SERVICE_OPTIONS = [
  { value: "tver", label: "TVer" },
  { value: "skylark", label: "すかいらーくサイネージ" },
  { value: "aeon-cinema", label: "イオンシネマ" },
  { value: "taxi", label: "タクシー広告" },
  { value: "golfcart", label: "ゴルフカート広告" },
  { value: "omochannel", label: "おもチャンネル（アパホテル）" },
  { value: "sns_ad", label: "SNS広告" },
  { value: "web_ad", label: "Web広告" },
  { value: "video_production", label: "動画制作" },
  { value: "youtube", label: "YouTube運用" },
  { value: "sns_management", label: "SNS運用" },
  { value: "none", label: "特になし" },
] as const;

export const DESIRED_TIMELINE_OPTIONS = [
  { value: "immediately", label: "すぐにでも" },
  { value: "within_1month", label: "1ヶ月以内" },
  { value: "within_3months", label: "3ヶ月以内" },
  { value: "within_6months", label: "半年以内" },
  { value: "undecided", label: "未定" },
] as const;

// --- D. 意思決定（DECISION） ---

export const DECISION_PROCESS_OPTIONS = [
  { value: "self", label: "本人即決" },
  { value: "internal", label: "社内稟議" },
  { value: "hq", label: "本部決裁" },
  { value: "unknown", label: "不明" },
] as const;

export const BUDGET_STATUS_OPTIONS = [
  { value: "secured", label: "確保済み" },
  { value: "considering", label: "検討中" },
  { value: "undecided", label: "未定" },
  { value: "none", label: "予算なし" },
] as const;

// --- E. 温度感（TEMPERATURE） ---

export const TEMPERATURE_OPTIONS = [
  { value: "hot", label: "即決見込み", color: "text-red-600 bg-red-50 border-red-200" },
  { value: "warm", label: "前向き", color: "text-orange-600 bg-orange-50 border-orange-200" },
  { value: "cool", label: "情報収集中", color: "text-blue-600 bg-blue-50 border-blue-200" },
  { value: "cold", label: "冷たい", color: "text-zinc-500 bg-zinc-50 border-zinc-200" },
] as const;

// --- セクション定義 ---

export const HEARING_SECTIONS = [
  { key: "who", label: "顧客理解", icon: "Building2" },
  { key: "now", label: "現状把握", icon: "BarChart3" },
  { key: "want", label: "課題・ニーズ", icon: "Target" },
  { key: "decision", label: "意思決定", icon: "UserCheck" },
  { key: "temperature", label: "温度感", icon: "Thermometer" },
] as const;
