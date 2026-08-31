// ---------------------------------------------------------------
// 本部チラシ制作サポート 定数
// ---------------------------------------------------------------

export const TVER_FLYER_STATUS_OPTIONS = [
  { value: "PENDING",   label: "依頼受付",   className: "bg-zinc-100 text-zinc-600 border-zinc-200" },
  { value: "REVIEWING", label: "本部作成中", className: "bg-blue-50 text-blue-700 border-blue-200" },
  { value: "DELIVERED", label: "納品済み",   className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  { value: "CANCELLED", label: "取り下げ",   className: "bg-red-50 text-red-600 border-red-200" },
] as const;

export type TverFlyerStatusValue = (typeof TVER_FLYER_STATUS_OPTIONS)[number]["value"];

export function getFlyerStatusOption(value: string) {
  return TVER_FLYER_STATUS_OPTIONS.find((o) => o.value === value) ?? TVER_FLYER_STATUS_OPTIONS[0];
}

export const AD_SECONDS_OPTIONS = [
  { value: 15, label: "15秒（標準）" },
  { value: 30, label: "30秒" },
  { value: 60, label: "60秒" },
] as const;

export const INDUSTRY_SUGGESTIONS = [
  "リフォーム・建設", "不動産", "自動車販売・整備", "医療・クリニック", "介護・福祉",
  "学習塾・教育", "飲食店", "美容・エステ", "小売・専門店", "士業・保険", "採用（求人）", "その他",
] as const;

export const TVER_FLYER_TEMPLATES = [
  { key: "orange",  label: "オレンジ（おすすめ）", desc: "白地×オレンジ・柔らかい一般向け" },
  { key: "classic", label: "クラシック", desc: "紺×金・落ち着いた提案書トーン" },
  { key: "poster",  label: "ポスター",   desc: "濃紺全面・数字が主役" },
] as const;

export type FlyerTemplateKey = (typeof TVER_FLYER_TEMPLATES)[number]["key"];

export function isFlyerTemplate(v: string): v is FlyerTemplateKey {
  return TVER_FLYER_TEMPLATES.some((t) => t.key === v);
}

export const DEFAULT_FLYER_TEMPLATE: FlyerTemplateKey = "orange";
