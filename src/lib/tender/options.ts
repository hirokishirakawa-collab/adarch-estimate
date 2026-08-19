// ==============================================================
// 入札ファインダーの表示メタ
// ==============================================================

export const TENDER_FIT_META = {
  MATCH: {
    mark: "○",
    label: "受注できる仕事",
    badge: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
  MAYBE: {
    mark: "△",
    label: "要確認",
    badge: "bg-amber-50 text-amber-700 border-amber-200",
  },
  MISMATCH: {
    mark: "×",
    label: "制作の仕事ではない",
    badge: "bg-zinc-100 text-zinc-400 border-zinc-200",
  },
} as const;

export const WORK_TYPE_META = {
  VIDEO: { label: "動画・映像", badge: "bg-rose-50 text-rose-700" },
  AD: { label: "広告出稿", badge: "bg-indigo-50 text-indigo-700" },
  PRINT: { label: "印刷物", badge: "bg-sky-50 text-sky-700" },
  WEB: { label: "Web・SNS", badge: "bg-teal-50 text-teal-700" },
  EVENT: { label: "イベント", badge: "bg-violet-50 text-violet-700" },
  DESIGN: { label: "デザイン", badge: "bg-orange-50 text-orange-700" },
  OTHER: { label: "その他", badge: "bg-zinc-100 text-zinc-600" },
} as const;

/** 絞り込みプルダウンに出す仕事の種類（OTHER は絞り込みに出さない） */
export const WORK_TYPE_OPTIONS = [
  "VIDEO",
  "AD",
  "PRINT",
  "WEB",
  "EVENT",
  "DESIGN",
] as const;

/** 都道府県プルダウンで「全国」を選んだときの値 */
export const ALL_PREFECTURES = "ALL";
