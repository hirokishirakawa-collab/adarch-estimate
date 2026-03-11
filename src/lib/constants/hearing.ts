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

// --- E. 動画制作（VIDEO） ---

export const VIDEO_PURPOSE_OPTIONS = [
  { value: "cm", label: "CM・広告" },
  { value: "product", label: "商品紹介" },
  { value: "recruitment", label: "採用動画" },
  { value: "corporate", label: "会社紹介" },
  { value: "sns_short", label: "SNS用ショート" },
  { value: "youtube", label: "YouTube" },
  { value: "event", label: "イベント" },
  { value: "training", label: "研修・マニュアル" },
  { value: "lp", label: "LP埋め込み" },
] as const;

export const VIDEO_DURATION_OPTIONS = [
  { value: "15sec", label: "15秒" },
  { value: "30sec", label: "30秒" },
  { value: "60sec", label: "60秒" },
  { value: "under_3min", label: "3分以内" },
  { value: "over_5min", label: "5分以上" },
  { value: "undecided", label: "未定" },
] as const;

export const VIDEO_SHOOTING_OPTIONS = [
  { value: "new_shoot", label: "新規撮影希望" },
  { value: "existing", label: "既存素材あり" },
  { value: "both", label: "素材＋撮影両方" },
  { value: "undecided", label: "未定" },
] as const;

export const VIDEO_CAST_OPTIONS = [
  { value: "employee", label: "社員" },
  { value: "talent", label: "モデル・タレント" },
  { value: "narration", label: "ナレーションのみ" },
  { value: "animation", label: "アニメーション" },
  { value: "undecided", label: "未定" },
] as const;

export const VIDEO_PUBLISH_OPTIONS = [
  { value: "website", label: "自社サイト" },
  { value: "youtube", label: "YouTube" },
  { value: "instagram", label: "Instagram" },
  { value: "tiktok", label: "TikTok" },
  { value: "tver", label: "TVer" },
  { value: "signage", label: "サイネージ" },
  { value: "exhibition", label: "展示会" },
  { value: "other", label: "その他" },
] as const;

export const VIDEO_BUDGET_OPTIONS = [
  { value: "under_100k", label: "〜10万円" },
  { value: "under_300k", label: "〜30万円" },
  { value: "under_500k", label: "〜50万円" },
  { value: "under_1m", label: "〜100万円" },
  { value: "over_1m", label: "100万円〜" },
  { value: "undecided", label: "未定" },
] as const;

// --- F. 温度感（TEMPERATURE） ---

export const TEMPERATURE_OPTIONS = [
  { value: "hot", label: "即決見込み", color: "text-red-600 bg-red-50 border-red-200" },
  { value: "warm", label: "前向き", color: "text-orange-600 bg-orange-50 border-orange-200" },
  { value: "cool", label: "情報収集中", color: "text-blue-600 bg-blue-50 border-blue-200" },
  { value: "cold", label: "冷たい", color: "text-zinc-500 bg-zinc-50 border-zinc-200" },
] as const;

// --- 商談化マッピング ---

export const MONTHLY_BUDGET_TO_AMOUNT: Record<string, number> = {
  "0": 0,
  under_50k: 30000,
  under_100k: 75000,
  under_300k: 200000,
  under_500k: 400000,
  under_1m: 750000,
  over_1m: 1500000,
};

export const VIDEO_BUDGET_TO_AMOUNT: Record<string, number> = {
  under_100k: 75000,
  under_300k: 200000,
  under_500k: 400000,
  under_1m: 750000,
  over_1m: 1500000,
};

export const TEMPERATURE_TO_PROBABILITY: Record<string, number> = {
  hot: 80,
  warm: 50,
  cool: 30,
  cold: 20,
};

export const TIMELINE_TO_DAYS: Record<string, number | null> = {
  immediately: 14,
  within_1month: 30,
  within_3months: 90,
  within_6months: 180,
  undecided: null,
};

// --- セクション定義 ---

export const HEARING_SECTIONS = [
  { key: "who", label: "顧客理解", icon: "Building2" },
  { key: "now", label: "現状把握", icon: "BarChart3" },
  { key: "want", label: "課題・ニーズ", icon: "Target" },
  { key: "decision", label: "意思決定", icon: "UserCheck" },
  { key: "video", label: "動画制作", icon: "Video" },
  { key: "temperature", label: "温度感", icon: "Thermometer" },
] as const;
