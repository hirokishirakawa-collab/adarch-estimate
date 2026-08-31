// POST /api/signage/d/pair — 端末の初回起動: 端末レコードを仮作成し、トークンと6桁コードを返す
//   端末はトークンを保存して画面にコードを出す。本部/代表がCMSでコードを入力すると拠点に紐づき有効化される。
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { newDeviceToken, newPairingCode } from "@/lib/signage/manifest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const label = typeof body?.label === "string" ? body.label.slice(0, 80) : "";

  // 未ペアリングのまま放置された仮端末を掃除（24時間）
  await db.signageDevice.deleteMany({
    where: { isActive: false, pairedAt: null, createdAt: { lt: new Date(Date.now() - 24 * 3600 * 1000) } },
  });

  for (let attempt = 0; attempt < 5; attempt++) {
    const pairingCode = newPairingCode();
    try {
      const device = await db.signageDevice.create({
        data: {
          name: label || `未設定端末 ${pairingCode}`,
          deviceToken: newDeviceToken(),
          pairingCode,
          isActive: false,
          lastSeenAt: new Date(),
        },
        select: { deviceToken: true, pairingCode: true },
      });
      return NextResponse.json({ token: device.deviceToken, pairingCode: device.pairingCode });
    } catch {
      // pairingCode 衝突 → 再試行
    }
  }
  return NextResponse.json({ error: "pairing code collision" }, { status: 500 });
}
