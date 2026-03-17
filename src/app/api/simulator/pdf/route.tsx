import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const body = await req.json();
  const { simulatorName, totalAmount, conditions, notes, reach, stores } = body;

  if (!simulatorName || typeof totalAmount !== "number") {
    return new NextResponse("Bad Request", { status: 400 });
  }

  try {
    const { renderToBuffer } = await import("@react-pdf/renderer");
    const React = (await import("react")).default;
    const { SimulatorPDFDocument } = await import(
      "@/components/simulator/simulator-pdf"
    );

    const data = {
      simulatorName,
      totalAmount,
      conditions: conditions ?? [],
      notes: notes ?? undefined,
      date: new Date().toISOString(),
      reach: reach ?? undefined,
      stores: stores ?? undefined,
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const buffer = await renderToBuffer(
      React.createElement(SimulatorPDFDocument, { data }) as any
    );

    const safeTitle = simulatorName
      .replace(/[<>:"/\\|?*]/g, "")
      .trim()
      .slice(0, 50);
    const filename = `estimate_${safeTitle}.pdf`;

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    console.error("[simulator-pdf] error:", e);
    return new NextResponse("PDF generation failed", { status: 500 });
  }
}
