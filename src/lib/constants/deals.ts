// ---------------------------------------------------------------
// 商談管理 共有定数
// ---------------------------------------------------------------

export const DEAL_STATUS_OPTIONS = [
  { value: "PROSPECTING", label: "見込み",   color: "bg-zinc-100 text-zinc-600 border-zinc-200" },
  { value: "QUALIFYING",  label: "検討中",   color: "bg-blue-100 text-blue-700 border-blue-200" },
  { value: "PROPOSAL",    label: "提案中",   color: "bg-violet-100 text-violet-700 border-violet-200" },
  { value: "NEGOTIATION", label: "交渉中",   color: "bg-amber-100 text-amber-700 border-amber-200" },
  { value: "DORMANT",     label: "休眠",     color: "bg-slate-100 text-slate-500 border-slate-200" },
  { value: "DEFERRED",    label: "先送り",   color: "bg-cyan-100 text-cyan-700 border-cyan-200" },
  { value: "CLOSED_WON",  label: "受注",     color: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  { value: "CLOSED_LOST", label: "失注",     color: "bg-red-100 text-red-600 border-red-200" },
] as const;

export type DealStatusValue = (typeof DEAL_STATUS_OPTIONS)[number]["value"];
