import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionInfo, getBranchFilter } from "@/lib/session";
import { buildFlyerData } from "@/lib/tver/flyer-data";
import { buildFlyerHtml } from "@/lib/tver/flyer-html";
import { renderHtmlToPdf } from "@/lib/pdf/chrome";
import { TVER_FLYER_TEMPLATES, isFlyerTemplate, DEFAULT_FLYER_TEMPLATE, type FlyerTemplateKey } from "@/lib/constants/tver-flyer";

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
    // 本線: HTML → Chrome headless（資料デッキと同じデザイン言語）。Chromeが無い環境では react-pdf 版にフォールバック
    const tRaw = req.nextUrl.searchParams.get("template") ?? DEFAULT_FLYER_TEMPLATE;
    const template: FlyerTemplateKey = isFlyerTemplate(tRaw) ? tRaw : DEFAULT_FLYER_TEMPLATE;
    // 入稿用: ?bleed=1&size=A4|A5 → 各辺3mmの塗り足し付き（ネット印刷にそのまま入稿できる）
    const bleed = req.nextUrl.searchParams.get("bleed") === "1";
    const sizeRaw = req.nextUrl.searchParams.get("size");
    const size: "A4" | "A5" = sizeRaw === "A5" ? "A5" : "A4";
    let buffer: Buffer | null = null;
    try {
      buffer = await renderHtmlToPdf(buildFlyerHtml(data, template, bleed ? { bleed: true, size } : undefined));
    } catch (e) {
      console.error("[tver-flyer-pdf] chrome render failed, falling back:", e instanceof Error ? e.message : e);
    }
    if (!buffer) {
      console.warn("[tver-flyer-pdf] Chrome not available — using react-pdf fallback");
      const { renderToBuffer } = await import("@react-pdf/renderer");
      const React = (await import("react")).default;
      const { TverFlyerDocument } = await import("@/components/tver-flyer/tver-flyer-pdf");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      buffer = await renderToBuffer(React.createElement(TverFlyerDocument, { data }) as any);
    }

    const isPreview = req.nextUrl.searchParams.get("preview") === "1";
    const tLabel = TVER_FLYER_TEMPLATES.find((t) => t.key === template)?.label ?? "";
    const filename = `TVer_${data.areaLabel}_まるごとプラン_${tLabel}${bleed ? `_入稿用${size}塗り足し3mm` : ""}${isPreview ? "_下書き" : ""}.pdf`;
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
