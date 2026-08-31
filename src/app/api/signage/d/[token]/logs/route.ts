// POST /api/signage/d/[token]/logs — 再生ログ（束ね送信）。放映証明の元データ
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { findDeviceByToken } from "@/lib/signage/manifest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BATCH = 500;

export async function POST(req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const device = await findDeviceByToken(token);
  if (!device || !device.isActive) return NextResponse.json({ error: "unknown device" }, { status: 404 });

  const body = await req.json().catch(() => null);
  const rows: unknown[] = Array.isArray(body?.logs) ? body.logs : Array.isArray(body) ? body : [];
  if (rows.length === 0) return NextResponse.json({ ok: true, accepted: 0 });

  const assetIds = new Set(
    (await db.signageAsset.findMany({ where: { id: { in: rows.map((r) => (r as { assetId?: string }).assetId ?? "").filter(Boolean) } }, select: { id: true } })).map((a) => a.id)
  );

  const data = rows
    .slice(0, MAX_BATCH)
    .map((r) => r as { assetId?: string; playedAt?: string; durationSec?: number })
    .filter((r) => r.assetId && assetIds.has(r.assetId) && r.playedAt && !Number.isNaN(Date.parse(r.playedAt)))
    .map((r) => ({
      deviceId: device.id,
      assetId: r.assetId as string,
      playedAt: new Date(r.playedAt as string),
      durationSec: Math.max(0, Math.min(3600, Math.round(r.durationSec ?? 0))),
    }));

  if (data.length > 0) await db.signagePlayLog.createMany({ data });
  return NextResponse.json({ ok: true, accepted: data.length });
}
