// ---------------------------------------------------------------
// 商談管理 共有定数
// ---------------------------------------------------------------

export const DEAL_STATUS_OPTIONS = [
  { value: "PROSPECTING", label: "初期声掛け",   color: "bg-zinc-100 text-zinc-600 border-zinc-200" },
  { value: "QUALIFYING",  label: "初回商談",     color: "bg-blue-100 text-blue-700 border-blue-200" },
  { value: "PROPOSAL",    label: "提案中",       color: "bg-violet-100 text-violet-700 border-violet-200" },
  { value: "CLOSED_WON",  label: "受注",         color: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  { value: "NEGOTIATION", label: "休眠/先送り",  color: "bg-amber-100 text-amber-700 border-amber-200" },
  { value: "CLOSED_LOST", label: "失注",         color: "bg-red-100 text-red-600 border-red-200" },
] as const;

export type DealStatusValue = (typeof DEAL_STATUS_OPTIONS)[number]["value"];
