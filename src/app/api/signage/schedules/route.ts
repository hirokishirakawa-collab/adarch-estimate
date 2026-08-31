// POST /api/signage/schedules — 端末にプレイリストを割り当てる（曜日・時刻・期間・優先度）
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireSignageUser, scope } from "../_guard";
import { bumpDevice } from "@/lib/signage/manifest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function parseScheduleBody(b: Record<string, unknown>) {
  const hhmm = (v: unknown) => (typeof v === "string" && /^\d{1,2}:\d{2}$/.test(v) ? v : null);
  const toDate = (v: unknown) => (typeof v === "string" && v && !Number.isNaN(Date.parse(v)) ? new Date(v) : null);
  return {
    name: String(b.name ?? "").trim() || "標準",
    daysOfWeek: Array.isArray(b.daysOfWeek) ? [...new Set(b.daysOfWeek.map(Number).filter((n) => Number.isInteger(n) && n >= 0 && n <= 6))] : [],
    startTime: hhmm(b.startTime),
    endTime: hhmm(b.endTime),
    startDate: toDate(b.startDate),
    endDate: toDate(b.endDate),
    priority: typeof b.priority === "number" ? Math.round(b.priority) : 0,
    isActive: b.isActive === undefined ? true : !!b.isActive,
  };
}

export async function POST(req: NextRequest) {
  const { error, info } = await requireSignageUser();
  if (error) return error;
  const b = await req.json().catch(() => ({}));
  const device = await db.signageDevice.findFirst({ where: { id: String(b.deviceId ?? ""), ...scope(info) }, select: { id: true } });
  const playlist = await db.signagePlaylist.findFirst({ where: { id: String(b.playlistId ?? ""), ...scope(info) }, select: { id: true } });
  if (!device || !playlist) return NextResponse.json({ error: "端末またはプレイリストが見つかりません" }, { status: 404 });
  const row = await db.signageSchedule.create({ data: { deviceId: device.id, playlistId: playlist.id, ...parseScheduleBody(b) } });
  await bumpDevice(device.id);
  return NextResponse.json(row);
}
