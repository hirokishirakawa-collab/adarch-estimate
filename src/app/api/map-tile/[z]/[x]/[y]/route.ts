import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

export const runtime = "nodejs";

/**
 * GET /api/map-tile/{z}/{x}/{y}.png
 * 地図タイル（国土地理院 淡色地図）を自社サーバ経由で返す。
 * ブラウザ側の拡張機能・社内プロキシで外部画像が止められる環境でも地図が出るようにするため。
 * 出典表記は地図側（Leaflet の attribution）で行う。
 */
export async function GET(_req: Request, props: { params: Promise<{ z: string; x: string; y: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { z, x, y } = await props.params;
  const zi = Number(z);
  const xi = Number(x);
  const yi = Number(y.replace(/\.png$/i, ""));
  if (![zi, xi, yi].every((n) => Number.isInteger(n) && n >= 0) || zi > 18) {
    return new NextResponse(null, { status: 400 });
  }

  try {
    const upstream = await fetch(`https://cyberjapandata.gsi.go.jp/xyz/pale/${zi}/${xi}/${yi}.png`, {
      headers: { "User-Agent": "AdArchGroupOS/1.0 (+https://adarch.co.jp)" },
      signal: AbortSignal.timeout(10000),
      // Next の fetch キャッシュ（同じタイルを何度も取りに行かない）
      next: { revalidate: 60 * 60 * 24 },
    });
    if (!upstream.ok) return new NextResponse(null, { status: upstream.status === 404 ? 404 : 502 });
    const buf = await upstream.arrayBuffer();
    return new NextResponse(buf, {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "private, max-age=86400",
      },
    });
  } catch {
    return new NextResponse(null, { status: 502 });
  }
}
