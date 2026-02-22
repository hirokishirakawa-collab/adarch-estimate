// ---------------------------------------------------------------
// グループ連携依頼 定数
// ---------------------------------------------------------------

export const COLLABORATION_REQUEST_TYPE_OPTIONS = [
  { value: "SHOOTING_SUPPORT",  label: "撮影支援" },
  { value: "EDITING_RESOURCE",  label: "編集リソース協力" },
  { value: "EQUIPMENT_CAST",    label: "機材・キャスト手配" },
  { value: "KNOWLEDGE_SHARING", label: "知見共有・相談" },
  { value: "PROXY_VISIT",       label: "クライアント別拠点の代理視察及び営業" },
  { value: "OTHER",             label: "その他" },
] as const;

export type CollaborationRequestTypeValue =
  (typeof COLLABORATION_REQUEST_TYPE_OPTIONS)[number]["value"];

export const COLLABORATION_STATUS_OPTIONS = [
  { value: "PENDING",   label: "未対応", className: "bg-zinc-100 text-zinc-600 border-zinc-200" },
  { value: "REVIEWING", label: "検討中", className: "bg-blue-50 text-blue-700 border-blue-200" },
  { value: "ACCEPTED",  label: "受諾",   className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  { value: "DECLINED",  label: "辞退",   className: "bg-red-50 text-red-600 border-red-200" },
  { value: "COMPLETED", label: "完了",   className: "bg-violet-50 text-violet-700 border-violet-200" },
] as const;

export type CollaborationStatusValue =
  (typeof COLLABORATION_STATUS_OPTIONS)[number]["value"];

export function getRequestTypeLabel(value: string): string {
  return COLLABORATION_REQUEST_TYPE_OPTIONS.find((o) => o.value === value)?.label ?? value;
}

export function getStatusOption(value: string) {
  return (
    COLLABORATION_STATUS_OPTIONS.find((o) => o.value === value) ??
    COLLABORATION_STATUS_OPTIONS[0]
  );
}
