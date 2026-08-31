// PUT /api/signage/playlists/[id]/items — 枠の並びを丸ごと置き換え（並べ替え・秒数・広告主・掲載期間）
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireSignageUser, scope } from "../../../_guard";
import { bumpDevicesForPlaylist } from "@/lib/signage/manifest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ItemIn = { assetId: string; durationSec?: number; advertiserCustomerId?: string | null; startDate?: string | null; endDate?: string | null };

export async function PUT(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { error, info } = await requireSignageUser();
  if (error) return error;
  const { id } = await ctx.params;
  const pl = await db.signagePlaylist.findFirst({ where: { id, ...scope(info) }, select: { id: true, branchId: true } });
  if (!pl) return new NextResponse("Not found", { status: 404 });

  const b = await req.json().catch(() => null);
  const items: ItemIn[] = Array.isArray(b?.items) ? b.items : [];
  const assetIds = [...new Set(items.map((i) => i.assetId).filter(Boolean))];
  // 素材は同じ拠点 or 本部素材(branchId=null)
  const assets = await db.signageAsset.findMany({
    where: { id: { in: assetIds }, trashedAt: null, OR: [{ branchId: null }, { branchId: pl.branchId ?? "__none__" }, ...(info.role === "ADMIN" ? [{}] : [])] },
    select: { id: true },
  });
  const okIds = new Set(assets.map((a) => a.id));
  const bad = assetIds.filter((a) => !okIds.has(a));
  if (bad.length > 0) return NextResponse.json({ error: `使えない素材があります: ${bad.length}件` }, { status: 400 });

  const toDate = (v: unknown) => (typeof v === "string" && v && !Number.isNaN(Date.parse(v)) ? new Date(v) : null);

  await db.$transaction([
    db.signagePlaylistItem.deleteMany({ where: { playlistId: id } }),
    ...items.map((it, i) =>
      db.signagePlaylistItem.create({
        data: {
          playlistId: id,
          assetId: it.assetId,
          order: i,
          durationSec: Math.max(1, Math.min(600, Math.round(it.durationSec ?? 15))),
          advertiserCustomerId: it.advertiserCustomerId || null,
          startDate: toDate(it.startDate),
          endDate: toDate(it.endDate),
        },
      })
    ),
  ]);
  await bumpDevicesForPlaylist(id);
  const rows = await db.signagePlaylistItem.findMany({ where: { playlistId: id }, orderBy: { order: "asc" }, include: { asset: true } });
  return NextResponse.json(rows);
}
