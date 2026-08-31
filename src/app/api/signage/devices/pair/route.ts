// POST /api/signage/devices/pair — 端末画面の6桁コードで端末を拠点に紐づけて有効化
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireSignageUser, branchIdForCreate } from "../../_guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const { error, info } = await requireSignageUser();
  if (error) return error;
  const b = await req.json().catch(() => ({}));
  const code = String(b.code ?? "").replace(/\D/g, "");
  if (code.length !== 6) return NextResponse.json({ error: "6桁のコードを入力してください" }, { status: 400 });

  const device = await db.signageDevice.findUnique({ where: { pairingCode: code } });
  if (!device || device.pairedAt) return NextResponse.json({ error: "コードが見つかりません。端末の画面を確認してください" }, { status: 404 });
  if (!device.lastSeenAt || Date.now() - device.lastSeenAt.getTime() > 24 * 3600 * 1000)
    return NextResponse.json({ error: "端末が接続していません（24時間以上応答なし）" }, { status: 409 });

  const branchId = branchIdForCreate(info, typeof b.branchId === "string" ? b.branchId : null);
  const updated = await db.signageDevice.update({
    where: { id: device.id },
    data: {
      name: String(b.name ?? "").trim() || device.name,
      locationName: typeof b.locationName === "string" ? b.locationName.trim() || null : null,
      address: typeof b.address === "string" ? b.address.trim() || null : null,
      orientation: b.orientation === "PORTRAIT" ? "PORTRAIT" : "LANDSCAPE",
      customerId: typeof b.customerId === "string" && b.customerId ? b.customerId : null,
      branchId,
      pairingCode: null,
      pairedAt: new Date(),
      isActive: true,
      createdById: info.userId,
      manifestVersion: { increment: 1 },
    },
  });
  return NextResponse.json(updated);
}
