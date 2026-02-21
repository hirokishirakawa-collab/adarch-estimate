// ---------------------------------------------------------------
// CRM 共有定数（サーバー・クライアント両方で利用可）
// ---------------------------------------------------------------

export const ACTIVITY_TYPE_OPTIONS = [
  {
    value: "CALL",
    label: "電話",
    icon: "📞",
    color: "bg-blue-50 text-blue-700 border-blue-200",
    dotColor: "bg-blue-400",
  },
  {
    value: "EMAIL",
    label: "メール",
    icon: "📧",
    color: "bg-violet-50 text-violet-700 border-violet-200",
    dotColor: "bg-violet-400",
  },
  {
    value: "VISIT",
    label: "訪問",
    icon: "🏢",
    color: "bg-emerald-50 text-emerald-700 border-emerald-200",
    dotColor: "bg-emerald-400",
  },
  {
    value: "MEETING",
    label: "Web会議",
    icon: "💻",
    color: "bg-orange-50 text-orange-700 border-orange-200",
    dotColor: "bg-orange-400",
  },
  {
    value: "OTHER",
    label: "その他",
    icon: "📝",
    color: "bg-zinc-100 text-zinc-600 border-zinc-200",
    dotColor: "bg-zinc-400",
  },
] as const;

export type ActivityTypeValue =
  (typeof ACTIVITY_TYPE_OPTIONS)[number]["value"];

export const DEAL_STATUS_OPTIONS = [
  { value: "PROSPECTING", label: "見込み",  className: "bg-zinc-100 text-zinc-600 border-zinc-200" },
  { value: "QUALIFYING",  label: "検討中",  className: "bg-blue-100 text-blue-700 border-blue-200" },
  { value: "PROPOSAL",    label: "提案中",  className: "bg-yellow-100 text-yellow-700 border-yellow-200" },
  { value: "NEGOTIATION", label: "交渉中",  className: "bg-orange-100 text-orange-700 border-orange-200" },
  { value: "CLOSED_WON",  label: "受注 🎉", className: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  { value: "CLOSED_LOST", label: "失注",    className: "bg-red-100 text-red-600 border-red-200" },
] as const;

export type DealStatusValue =
  (typeof DEAL_STATUS_OPTIONS)[number]["value"];
