import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionInfo, getBranchFilter } from "@/lib/session";
import { buildFlyerData } from "@/lib/tver/flyer-data";

export const runtime = "nodejs";

// GET /api/tver-flyer/[id]/pdf
//   本部: いつでも（?preview=1 で作成中の下書きを確認）
//   代表: 納品済み（DELIVERED）のみ
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const info = await getSessionInfo();
  if (!info || info.role === "USER") return new NextResponse("Unauthorized", { status: 401 });

  const { id } = await ctx.params;
  const r = await db.tverFlyerRequest.findFirst({ where: { id, ...getBranchFilter(info) } });
  if (!r) return new NextResponse("Not Found", { status: 404 });
  if (info.role !== "ADMIN" && r.status !== "DELIVERED") {
    return new NextResponse("まだ納品されていません", { status: 403 });
  }

  const data = buildFlyerData(r);
  if (!data) return new NextResponse("商圏データが見つかりません", { status: 422 });

  try {
    const { renderToBuffer } = await import("@react-pdf/renderer");
    const React = (await import("react")).default;
    const { TverFlyerDocument } = await import("@/components/tver-flyer/tver-flyer-pdf");

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const buffer = await renderToBuffer(React.createElement(TverFlyerDocument, { data }) as any);

    const isPreview = req.nextUrl.searchParams.get("preview") === "1";
    const filename = `TVer_${data.areaLabel}_まるごとプラン${isPreview ? "_下書き" : ""}.pdf`;
    const disposition = req.nextUrl.searchParams.get("dl") === "1" ? "attachment" : "inline";

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `${disposition}; filename*=UTF-8''${encodeURIComponent(filename)}`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    console.error("[tver-flyer-pdf] error:", e);
    return new NextResponse("PDF generation failed", { status: 500 });
  }
}
