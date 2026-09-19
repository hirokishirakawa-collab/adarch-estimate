// POST /api/signage/schedules — 端末にプレイリストを割り当てる（曜日・時刻・期間・優先度）
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireSignageUser, scope } from "../_guard";
import { bumpDevice } from "@/lib/signage/manifest";
import { parseScheduleBody } from "./_body";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
