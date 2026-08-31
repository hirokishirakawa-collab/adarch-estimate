// POST /api/signage/d/[token]/heartbeat — 端末の状態報告（版・ストレージ・再生中・アプリ版）
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { findDeviceByToken } from "@/lib/signage/manifest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const device = await findDeviceByToken(token);
  if (!device) return NextResponse.json({ error: "unknown device" }, { status: 404 });

  const b = await req.json().catch(() => ({}));
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? Math.round(v) : undefined);

  await db.signageDevice.update({
    where: { id: device.id },
    data: {
      lastSeenAt: new Date(),
      appVersion: typeof b.appVersion === "string" ? b.appVersion.slice(0, 40) : undefined,
      storageUsedMb: num(b.storageUsedMb),
      storageTotalMb: num(b.storageTotalMb),
      playingAssetId: typeof b.playingAssetId === "string" ? b.playingAssetId.slice(0, 64) : undefined,
      lastDownloadAt: b.downloadedAt ? new Date(b.downloadedAt) : undefined,
    },
  });

  return NextResponse.json(
    { ok: true, version: device.manifestVersion, serverTime: new Date().toISOString(), pollSec: device.pollSec },
    { headers: { "Cache-Control": "no-store" } }
  );
}
