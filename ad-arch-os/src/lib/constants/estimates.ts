export const ESTIMATION_STATUS_OPTIONS = [
  {
    value: "DRAFT",
    label: "下書き",
    icon: "📝",
    className: "bg-zinc-100 text-zinc-600 border-zinc-200",
  },
  {
    value: "ISSUED",
    label: "発行済み",
    icon: "📄",
    className: "bg-teal-100 text-teal-700 border-teal-200",
  },
  {
    value: "SENT",
    label: "送付済み",
    icon: "📤",
    className: "bg-blue-100 text-blue-700 border-blue-200",
  },
  {
    value: "ACCEPTED",
    label: "承認済み",
    icon: "✅",
    className: "bg-emerald-100 text-emerald-700 border-emerald-200",
  },
  {
    value: "REJECTED",
    label: "却下",
    icon: "❌",
    className: "bg-red-100 text-red-600 border-red-200",
  },
] as const;
