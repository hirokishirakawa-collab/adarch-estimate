// Ad Arch Studio — 表示用の名前（画面・MCPで共通。DBを読まない）

export const STUDIO_KIND_LABEL = {
  SHOOTING: "撮影",
  VIDEO: "動画制作",
  TVER: "TVer広告",
  SNS: "SNS（撮影・運用）",
  MEDIA: "媒体の購入",
  OTHER: "その他",
} as const;
export type StudioKind = keyof typeof STUDIO_KIND_LABEL;

export const STUDIO_STATUS_LABEL = {
  RECEIVED: "受付（連絡待ち）",
  CONSULTING: "相談中",
  CONFIRMED: "確定",
  DECLINED: "見送り",
  SPAM: "迷惑",
} as const;
export type StudioStatus = keyof typeof STUDIO_STATUS_LABEL;

/** 受付番号「AS-2026-0001」 */
export function inquiryNumberLabel(n: number, createdAt: Date | string): string {
  const y = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tokyo", year: "numeric" }).format(new Date(createdAt));
  return `AS-${y}-${String(n).padStart(4, "0")}`;
}

/** 削除してよい状態（確定前だけ＝確定済みは発注の記録として残す） */
export const isDeletable = (status: string) => status !== "CONFIRMED";

/** 返答期限を過ぎた受付（まだ誰も連絡していない） */
export function isOverdue(q: { status: string; firstRepliedAt: Date | null; dueAt: Date }): boolean {
  return q.status === "RECEIVED" && !q.firstRepliedAt && q.dueAt.getTime() < Date.now();
}
