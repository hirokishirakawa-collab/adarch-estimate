export const RESULT_OPTIONS = [
  { value: "DEAL",       label: "商談化",             className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  { value: "REPLIED_NG", label: "返信あり（不成立）", className: "bg-amber-50 text-amber-700 border-amber-200" },
  { value: "NO_REPLY",   label: "未返信",             className: "bg-zinc-100 text-zinc-500 border-zinc-200" },
  { value: "REJECTED",   label: "拒否",               className: "bg-red-50 text-red-600 border-red-200" },
] as const;

export const METHOD_OPTIONS = [
  { value: "EMAIL", label: "メール" },
  { value: "FORM",  label: "問い合わせフォーム" },
  { value: "DM",    label: "DM（SNS等）" },
  { value: "PHONE", label: "電話" },
  { value: "VISIT", label: "訪問" },
  { value: "OTHER", label: "その他" },
] as const;

export const INDUSTRY_OPTIONS = [
  "飲食", "美容・サロン", "医療・クリニック", "不動産", "自動車",
  "小売・物販", "教育・スクール", "士業", "建設・リフォーム",
  "製造", "IT・Web", "観光・ホテル", "自治体・公共", "スポーツ",
  "冠婚葬祭", "金融・保険", "その他",
] as const;

export function getResultOption(value: string) {
  return RESULT_OPTIONS.find((o) => o.value === value) ?? RESULT_OPTIONS[2];
}

export function getMethodLabel(value: string) {
  return METHOD_OPTIONS.find((o) => o.value === value)?.label ?? value;
}
