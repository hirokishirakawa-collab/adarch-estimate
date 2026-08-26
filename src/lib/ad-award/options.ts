// ==============================================================
// 広告賞ファインダーの表示メタ
// ==============================================================

export const WIN_TIER_META = {
  LOCAL: {
    mark: "◎",
    label: "地元・応募すれば入賞圏",
    badge: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
  MID: {
    mark: "○",
    label: "中堅・十分狙える",
    badge: "bg-sky-50 text-sky-700 border-sky-200",
  },
  HARD: {
    mark: "△",
    label: "大手代理店中心",
    badge: "bg-zinc-100 text-zinc-500 border-zinc-200",
  },
} as const;

export const SCOPE_META = {
  REGIONAL: { label: "地方", badge: "bg-orange-50 text-orange-700" },
  NATIONAL: { label: "全国", badge: "bg-indigo-50 text-indigo-700" },
  INTERNATIONAL: { label: "国際", badge: "bg-violet-50 text-violet-700" },
} as const;

export const CONFIDENCE_META = {
  HIGH: { label: "日程確認済", badge: "bg-zinc-100 text-zinc-500" },
  MEDIUM: { label: "日程は要確認", badge: "bg-amber-50 text-amber-700" },
  LOW: { label: "存在未確認", badge: "bg-red-50 text-red-700" },
} as const;

/** 範囲の絞り込み。local=地元の地方賞のみ / jp=地元＋全国（既定） / all=国際も */
export const RANGE_OPTIONS = [
  { value: "local", label: "地元の賞のみ" },
  { value: "jp", label: "地元＋全国" },
  { value: "all", label: "国際も含む" },
] as const;

export type RangeValue = (typeof RANGE_OPTIONS)[number]["value"];

/** 都道府県プルダウンで「指定しない」を選んだときの値 */
export const ALL_PREFECTURES = "ALL";
