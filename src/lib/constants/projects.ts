// ---------------------------------------------------------------
// プロジェクト管理 共有定数
// ---------------------------------------------------------------

export const PROJECT_STATUS_OPTIONS = [
  {
    value: "ORDERED",
    label: "受注済み",
    icon: "🎉",
    className: "bg-emerald-100 text-emerald-700 border-emerald-200",
  },
  {
    value: "IN_PROGRESS",
    label: "進行中",
    icon: "🔄",
    className: "bg-blue-100 text-blue-700 border-blue-200",
  },
  {
    value: "COMPLETED",
    label: "完了",
    icon: "✅",
    className: "bg-zinc-100 text-zinc-600 border-zinc-200",
  },
  {
    value: "ON_HOLD",
    label: "保留",
    icon: "⏸",
    className: "bg-amber-100 text-amber-700 border-amber-200",
  },
  {
    value: "CANCELLED",
    label: "キャンセル",
    icon: "✕",
    className: "bg-red-100 text-red-600 border-red-200",
  },
] as const;

export type ProjectStatusValue =
  (typeof PROJECT_STATUS_OPTIONS)[number]["value"];
