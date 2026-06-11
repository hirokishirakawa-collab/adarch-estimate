import { db } from "@/lib/db";
import type { BookingHost, BookingType } from "@/generated/prisma/client";
import { fetchBusyIntervals, type BusyInterval } from "./google";
import {
  computeSlots,
  type BusinessHours,
  type ScreeningQuestion,
  type SlotResult,
} from "./slots";

// ----------------------------------------------------------------
// 商談予約システム — 空き枠計算サービス
// ----------------------------------------------------------------

export type BookingTypeWithHosts = BookingType & {
  hosts: { host: BookingHost }[];
};

export async function getBookingTypeBySlug(
  slug: string
): Promise<BookingTypeWithHosts | null> {
  return db.bookingType.findUnique({
    where: { slug },
    include: { hosts: { include: { host: true } } },
  });
}

/** カレンダー接続済み・アクティブなホストのみ返す */
export function connectableHosts(bt: BookingTypeWithHosts): BookingHost[] {
  return bt.hosts
    .map((h) => h.host)
    .filter((h) => h.isActive && h.googleRefreshToken);
}

/**
 * 指定期間の空きスロットを計算する。
 * Google freebusy ＋ OS上の確定予約（カレンダー書き込み失敗の保険）を busy として統合。
 * freebusy 取得に失敗したホストはそのまま除外する（fail-closed）。
 */
export async function getAvailability(
  bt: BookingTypeWithHosts,
  opts?: { timeMin?: Date; timeMax?: Date }
): Promise<SlotResult[]> {
  const hosts = connectableHosts(bt);
  if (hosts.length === 0) return [];

  const now = new Date();
  const timeMin = opts?.timeMin ?? now;
  const timeMax =
    opts?.timeMax ??
    new Date(now.getTime() + (bt.maxDaysAhead + 1) * 24 * 60 * 60 * 1000);

  const [busyResults, confirmed] = await Promise.all([
    Promise.all(hosts.map((h) => fetchBusyIntervals(h, timeMin, timeMax))),
    db.booking.findMany({
      where: {
        hostId: { in: hosts.map((h) => h.id) },
        status: "CONFIRMED",
        endAt: { gt: timeMin },
        startAt: { lt: timeMax },
      },
      select: { hostId: true, startAt: true, endAt: true },
    }),
  ]);

  const busyByHost = new Map<string, BusyInterval[]>();
  hosts.forEach((h, i) => {
    const busy = busyResults[i];
    if (busy === null) return; // freebusy 失敗 → このホストには割り当てない
    const own = confirmed
      .filter((b) => b.hostId === h.id)
      .map((b) => ({ start: b.startAt.getTime(), end: b.endAt.getTime() }));
    busyByHost.set(h.id, [...busy, ...own]);
  });

  return computeSlots({
    durationMinutes: bt.durationMinutes,
    slotStepMinutes: bt.slotStepMinutes,
    bufferMinutes: bt.bufferMinutes,
    minNoticeHours: bt.minNoticeHours,
    maxDaysAhead: bt.maxDaysAhead,
    businessHours: bt.businessHours as BusinessHours,
    busyByHost,
    now,
  });
}

export function parseQuestions(bt: BookingType): ScreeningQuestion[] {
  return Array.isArray(bt.questions)
    ? (bt.questions as ScreeningQuestion[])
    : [];
}
