import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getSessionInfo, ownBranchWhere } from "@/lib/session";

export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // 認証チェック
  const session = await auth();
  if (!session?.user) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  // 拠点はDBの所属で判定（本部＝全部・代表＝自拠点だけ・所属なし＝出さない）
  const info = await getSessionInfo();
  const whereClause = { id, ...(info ? ownBranchWhere(info) : { branchId: "__unassigned__" }) };

  const estimation = await db.estimation.findFirst({
    where: whereClause,
    include: {
      customer: { select: { name: true } },
      branch:   { select: { name: true } },
      items:    { orderBy: { sortOrder: "asc" } },
    },
  });

  if (!estimation) {
    return new NextResponse("Not Found", { status: 404 });
  }

  try {
    // ESM パッケージのため動的インポート
    const { renderToBuffer } = await import("@react-pdf/renderer");
    const React = (await import("react")).default;
    const { EstimatePDFDocument } = await import(
      "@/components/estimates/estimate-pdf"
    );

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const buffer = await renderToBuffer(
      React.createElement(EstimatePDFDocument, { estimation }) as any
    );

    const safeTitle = estimation.title
      .replace(/[<>:"/\\|?*]/g, "")
      .trim()
      .slice(0, 50);
    const filename = `estimate_${safeTitle || id.slice(-8)}.pdf`;

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    console.error("[pdf] renderToBuffer error:", e);
    return new NextResponse("PDF generation failed", { status: 500 });
  }
}
