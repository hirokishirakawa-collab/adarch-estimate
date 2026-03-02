// ---------------------------------------------------------------
// 動画実績DB 共有定数（サーバー・クライアント両方で利用可）
// ---------------------------------------------------------------

export const VIDEO_TYPE_OPTIONS = [
  { value: "TVCM",        label: "TVCM" },
  { value: "WEB_VIDEO",   label: "Web動画" },
  { value: "RECRUITMENT", label: "採用動画" },
  { value: "EXHIBITION",  label: "展示会動画" },
  { value: "SNS",         label: "SNS動画" },
  { value: "CORPORATE",   label: "会社紹介" },
  { value: "OTHER",       label: "その他" },
];

export const VIDEO_ACHIEVEMENT_INDUSTRY_OPTIONS = [
  "食品・飲料", "小売・EC", "不動産", "建設・工事",
  "医療・介護", "教育", "製造業", "IT・テクノロジー",
  "飲食店", "美容・サロン", "観光・ホテル", "金融・保険",
  "人材・採用", "自動車", "アパレル", "その他",
];

// 探索キーワード（地域名と組み合わせる）
export const DISCOVERY_KEYWORDS = [
  "映像制作 実績",
  "動画制作 制作事例",
  "PR動画 works",
  "採用動画 制作実績",
  "TVCM 制作実績",
];
