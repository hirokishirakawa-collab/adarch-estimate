import type { BusyInterval } from "./google";

// ----------------------------------------------------------------
// 商談予約システム — 空きスロット計算（すべて JST 基準）
//
// 「複数ホストのうち1人でも空いていればそのスロットは予約可能」
// という統合空き枠を計算する。担当は予約確定時に priority 順で決める。
// ----------------------------------------------------------------

export type BusinessHours = {
  days: number[]; // 0=日 〜 6=土（JST）
  start: string; // "10:00"
  end: string; // "18:00"
};

export type ScreeningQuestion = {
  id: string;
  label: string;
  type: "text" | "textarea" | "select";
  options?: string[];
  required?: boolean;
};

export type SlotResult = {
  startAt: Date;
  endAt: Date;
  freeHostIds: string[];
};

const JST_OFFSET_MS = 9 * 60 * 60 * 1000;

/// JST での年月日を取得
function jstYmd(date: Date): { y: number; m: number; d: number } {
  const t = new Date(date.getTime() + JST_OFFSET_MS);
  return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() };
}

/// JST の日時を UTC Date に変換
function jstDate(y: number, m: number, d: number, hhmm: string): Date {
  const [hh, mm] = hhmm.split(":").map(Number);
  return new Date(Date.UTC(y, m - 1, d, hh, mm) - JST_OFFSET_MS);
}

function jstWeekday(y: number, m: number, d: number): number {
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

function overlaps(
  start: number,
  end: number,
  intervals: BusyInterval[]
): boolean {
  return intervals.some((b) => b.start < end && b.end > start);
}

export function computeSlots(opts: {
  durationMinutes: number;
  slotStepMinutes: number;
  bufferMinutes: number;
  minNoticeHours: number;
  maxDaysAhead: number;
  businessHours: BusinessHours;
  /** カレンダー接続済み・アクティブなホストの busy 区間（取得失敗ホストは含めないこと） */
  busyByHost: Map<string, BusyInterval[]>;
  now?: Date;
}): SlotResult[] {
  const now = opts.now ?? new Date();
  const durationMs = opts.durationMinutes * 60 * 1000;
  const stepMs = opts.slotStepMinutes * 60 * 1000;
  const bufferMs = opts.bufferMinutes * 60 * 1000;
  const earliest = now.getTime() + opts.minNoticeHours * 60 * 60 * 1000;

  // バッファを busy 区間の前後に展開しておく
  const expanded = new Map<string, BusyInterval[]>();
  for (const [hostId, intervals] of opts.busyByHost) {
    expanded.set(
      hostId,
      intervals.map((b) => ({ start: b.start - bufferMs, end: b.end + bufferMs }))
    );
  }

  const slots: SlotResult[] = [];
  const base = jstYmd(now);

  for (let i = 0; i <= opts.maxDaysAhead; i++) {
    // JST で i 日後の年月日（Date.UTC が月跨ぎを正規化してくれる）
    const dayUtc = new Date(Date.UTC(base.y, base.m - 1, base.d + i));
    const y = dayUtc.getUTCFullYear();
    const m = dayUtc.getUTCMonth() + 1;
    const d = dayUtc.getUTCDate();

    if (!opts.businessHours.days.includes(jstWeekday(y, m, d))) continue;

    const windowStart = jstDate(y, m, d, opts.businessHours.start).getTime();
    const windowEnd = jstDate(y, m, d, opts.businessHours.end).getTime();

    for (let t = windowStart; t + durationMs <= windowEnd; t += stepMs) {
      if (t < earliest) continue;
      const freeHostIds = [...expanded.entries()]
        .filter(([, intervals]) => !overlaps(t, t + durationMs, intervals))
        .map(([hostId]) => hostId);
      if (freeHostIds.length > 0) {
        slots.push({
          startAt: new Date(t),
          endAt: new Date(t + durationMs),
          freeHostIds,
        });
      }
    }
  }

  return slots;
}

/// JST 表示用フォーマット（例: 2026/06/15(月) 14:00）
export function formatJst(date: Date): string {
  const t = new Date(date.getTime() + JST_OFFSET_MS);
  const youbi = ["日", "月", "火", "水", "木", "金", "土"][t.getUTCDay()];
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${t.getUTCFullYear()}/${pad(t.getUTCMonth() + 1)}/${pad(t.getUTCDate())}(${youbi}) ${pad(t.getUTCHours())}:${pad(t.getUTCMinutes())}`;
}
