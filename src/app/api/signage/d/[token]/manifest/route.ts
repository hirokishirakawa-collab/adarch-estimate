// GET /api/signage/d/[token]/manifest?since=<version>
//   端末の定期問い合わせ（=ハートビート）。版が同じなら軽い応答、違えば全文。
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { buildManifest, findDeviceByToken } from "@/lib/signage/manifest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

export async function GET(req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const device = await findDeviceByToken(token);
  if (!device) return NextResponse.json({ error: "unknown device" }, { status: 404, headers: NO_STORE });

  await db.signageDevice.update({ where: { id: device.id }, data: { lastSeenAt: new Date() } });

  if (!device.isActive || !device.pairedAt) {
    return NextResponse.json(
      { status: "unpaired", pairingCode: device.pairingCode, serverTime: new Date().toISOString() },
      { status: 200, headers: NO_STORE }
    );
  }

  const since = Number(req.nextUrl.searchParams.get("since") ?? "");
  if (Number.isFinite(since) && since === device.manifestVersion) {
    return NextResponse.json(
      { status: "unchanged", version: device.manifestVersion, serverTime: new Date().toISOString(), pollSec: device.pollSec },
      { headers: NO_STORE }
    );
  }

  const baseUrl = `${req.nextUrl.protocol}//${req.nextUrl.host}`;
  const manifest = await buildManifest(device.id, baseUrl);
  if (!manifest) return NextResponse.json({ error: "not found" }, { status: 404, headers: NO_STORE });
  return NextResponse.json({ status: "ok", ...manifest }, { headers: NO_STORE });
}
