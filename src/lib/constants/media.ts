// ---------------------------------------------------------------
// 媒体依頼 定数
// ---------------------------------------------------------------

export const MEDIA_TYPE_OPTIONS = [
  { value: "TVER",            label: "TVer" },
  { value: "CINE_AD",         label: "シネアド（イオンシネマ）" },
  { value: "DIGITAL_SIGNAGE", label: "デジタルサイネージ" },
  { value: "TAXI",            label: "タクシー広告" },
  { value: "APA_HOTEL",       label: "アパホテル" },
  { value: "UNIVERSITY",      label: "大学広告" },
  { value: "SKYLARK",         label: "すかいらーく広告" },
  { value: "GOLF_CART",       label: "ゴルフカート" },
  { value: "ACQUISITION",     label: "取得依頼" },
  { value: "OTHER",           label: "その他" },
] as const;

export type MediaTypeValue = (typeof MEDIA_TYPE_OPTIONS)[number]["value"];

export const MEDIA_REQUEST_STATUS_OPTIONS = [
  { value: "PENDING",   label: "依頼中",     className: "bg-zinc-100 text-zinc-600 border-zinc-200" },
  { value: "REVIEWING", label: "確認中",     className: "bg-blue-50 text-blue-700 border-blue-200" },
  { value: "COMPLETED", label: "完了",       className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  { value: "CANCELLED", label: "キャンセル", className: "bg-red-50 text-red-600 border-red-200" },
] as const;

export type MediaRequestStatusValue =
  (typeof MEDIA_REQUEST_STATUS_OPTIONS)[number]["value"];

export function getMediaTypeLabel(value: string): string {
  return MEDIA_TYPE_OPTIONS.find((o) => o.value === value)?.label ?? value;
}

export function getStatusOption(value: string) {
  return (
    MEDIA_REQUEST_STATUS_OPTIONS.find((o) => o.value === value) ??
    MEDIA_REQUEST_STATUS_OPTIONS[0]
  );
}
