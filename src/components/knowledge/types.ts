export type KnowledgeOrigin = "OWN" | "EXTERNAL";
export type KnowledgeStatus = "PENDING" | "READY" | "FAILED";

export interface KnowledgeItem {
  id: string;
  title: string;
  origin: KnowledgeOrigin;
  kind: "FILE" | "URL" | "TEXT";
  publisher: string | null;
  publishedAt: string | null;
  fileName: string | null;
  fileUrl: string | null;
  sourceUrl: string | null;
  hqOnly: boolean;
  status: KnowledgeStatus;
  errorMessage: string | null;
  summary: string | null;
  keywords: string[];
  pageCount: number | null;
  charCount: number;
  createdByName: string;
  note: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AskCitation {
  n: number;
  sourceId: string;
  title: string;
  origin: KnowledgeOrigin;
  page: number | null;
  citedText: string;
}

export interface AskResult {
  answer: string;
  citations: AskCitation[];
  sources: { id: string; title: string; origin: KnowledgeOrigin; publisher: string | null; truncated: boolean }[];
}

export const ORIGIN_UI: Record<KnowledgeOrigin, { label: string; short: string; cls: string; hint: string }> = {
  OWN: { label: "自社資料", short: "自社", cls: "bg-emerald-50 text-emerald-700 border-emerald-200", hint: "価格・実績・手順をそのまま使える" },
  EXTERNAL: { label: "他社・媒体社の資料", short: "他社・媒体", cls: "bg-amber-50 text-amber-700 border-amber-200", hint: "仕組みは参考。価格は卸値・実績は他社分" },
};

export const STATUS_UI: Record<KnowledgeStatus, { label: string; cls: string }> = {
  PENDING: { label: "整理中", cls: "bg-sky-50 text-sky-700 border-sky-200" },
  READY: { label: "使える", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  FAILED: { label: "失敗", cls: "bg-rose-50 text-rose-700 border-rose-200" },
};

export function fmtDate(s: string) {
  return new Intl.DateTimeFormat("ja-JP", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: "Asia/Tokyo" }).format(new Date(s));
}
