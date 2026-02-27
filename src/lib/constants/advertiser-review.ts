// ---------------------------------------------------------------
// TVer広告主 業態考査申請 定数
// ---------------------------------------------------------------

export const ADVERTISER_REVIEW_STATUS_OPTIONS = [
  {
    value: "PENDING",
    label: "審査中",
    className: "bg-zinc-100 text-zinc-600 border-zinc-200",
  },
  {
    value: "APPROVED",
    label: "承認",
    className: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
  {
    value: "REJECTED",
    label: "否決",
    className: "bg-red-50 text-red-600 border-red-200",
  },
] as const;

export type AdvertiserReviewStatusValue =
  (typeof ADVERTISER_REVIEW_STATUS_OPTIONS)[number]["value"];

export function getReviewStatusOption(value: string) {
  return (
    ADVERTISER_REVIEW_STATUS_OPTIONS.find((o) => o.value === value) ??
    ADVERTISER_REVIEW_STATUS_OPTIONS[0]
  );
}

/** 法人番号バリデーション */
export function validateCorporateNumber(
  value: string | undefined,
  hasNoCorporateNumber: boolean
): string | true {
  if (hasNoCorporateNumber) return true;
  if (!value || value.trim() === "") return "法人番号を入力してください";
  if (!/^\d{13}$/.test(value.trim()))
    return "法人番号は13桁の数字で入力してください";
  return true;
}
