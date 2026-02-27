// ---------------------------------------------------------------
// TVer配信申請 定数
// ---------------------------------------------------------------

export const TVER_CAMPAIGN_STATUS_OPTIONS = [
  { value: "SUBMITTED", label: "申請済み",  className: "bg-blue-50 text-blue-700 border-blue-200" },
  { value: "APPROVED",  label: "承認",      className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  { value: "REJECTED",  label: "否決",      className: "bg-red-50 text-red-600 border-red-200" },
  { value: "DRAFT",     label: "下書き",    className: "bg-zinc-100 text-zinc-500 border-zinc-200" },
] as const;

export const BUDGET_TYPE_OPTIONS = [
  { value: "TOTAL",   label: "期間予算",             desc: "配信期間全体で予算を消化" },
  { value: "MONTHLY", label: "月次予算（毎月1日更新）", desc: "毎月1日に予算をリセットして消化" },
] as const;

export const FREQ_CAP_UNIT_OPTIONS = [
  { value: "LIFETIME", label: "全期間" },
  { value: "WEEKLY",   label: "1週間" },
  { value: "DAILY",    label: "1日" },
  { value: "HOURLY",   label: "1時間" },
] as const;

export const COMPANION_MOBILE_OPTIONS = [
  { value: "NONE",      label: "利用しない" },
  { value: "BANNER",    label: "バナー" },
  { value: "ICON_TEXT", label: "アイコン/テキスト" },
  { value: "TEXT",      label: "テキスト" },
] as const;

export const COMPANION_PC_OPTIONS = [
  { value: "NONE",   label: "利用しない" },
  { value: "BANNER", label: "バナー" },
] as const;

export function getCampaignStatusOption(value: string) {
  return (
    TVER_CAMPAIGN_STATUS_OPTIONS.find((o) => o.value === value) ??
    TVER_CAMPAIGN_STATUS_OPTIONS[0]
  );
}

export function getBudgetTypeLabel(value: string): string {
  return BUDGET_TYPE_OPTIONS.find((o) => o.value === value)?.label ?? value;
}

export function getCompanionMobileLabel(value: string): string {
  return COMPANION_MOBILE_OPTIONS.find((o) => o.value === value)?.label ?? value;
}

export function getCompanionPcLabel(value: string): string {
  return COMPANION_PC_OPTIONS.find((o) => o.value === value)?.label ?? value;
}

export function getFreqCapUnitLabel(value: string): string {
  return FREQ_CAP_UNIT_OPTIONS.find((o) => o.value === value)?.label ?? value;
}
