import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";

export const runtime = "nodejs";
export const maxDuration = 60;

// POST /api/proposals/pdf
// Body: ProposalContent JSON → PDF バイナリを返す
export async function POST(req: NextRequest) {
  // 認証必須（社内ユーザーのみ。外部からの無認証PDF生成・リソース枯渇を防止）
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const content = await req.json();

    const { renderToBuffer } = await import("@react-pdf/renderer");
    const React = (await import("react")).default;
    const { ProposalPdfDocument } = await import(
      "@/components/proposals/proposal-pdf"
    );

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const buffer = await renderToBuffer(
      React.createElement(ProposalPdfDocument, { content }) as any
    );

    const companyName = content.cover?.to?.replace(/[<>:"/\\|?*]/g, "").trim().slice(0, 30) || "提案書";
    const filename = `提案書_${companyName}_${new Date().toISOString().split("T")[0]}.pdf`;

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    console.error("[proposals/pdf] renderToBuffer error:", e);
    return NextResponse.json(
      { error: "PDF生成に失敗しました" },
      { status: 500 }
    );
  }
}
