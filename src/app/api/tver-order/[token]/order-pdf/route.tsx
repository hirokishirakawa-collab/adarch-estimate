// GET /api/tver-order/<token>/order-pdf — 発注書PDF（ログイン不要・token を知っている人だけ＝広告主・案内元・本部）
//   発注書の発行後（orderIssuedAt あり）だけ。署名後は同意の記録つき
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { AD_SECONDS, orderNumberLabel, planByKey, quote } from "@/lib/tver-order/plans";
import { TERMS_TITLE, TERMS_VERSION } from "@/lib/tver-order/terms";
import { TVER_ESTIMATE_NOTE } from "@/lib/tver/plan";

export const runtime = "nodejs";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!/^[A-Za-z0-9_-]{20,}$/.test(token)) return new NextResponse("Not Found", { status: 404 });
  const o = await db.tverOrder.findUnique({ where: { token } });
  if (!o || !o.orderIssuedAt) return new NextResponse("Not Found", { status: 404 });
  const no = orderNumberLabel(o.number, o.createdAt);
  const q = quote(o.mediaFeeExclTax, o.setupFeeExclTax, o.months);
  try {
    const { renderToBuffer } = await import("@react-pdf/renderer");
    const React = (await import("react")).default;
    const { OrderDocumentPDF } = await import("@/components/tver-order/order-document-pdf");
    const d = {
      no,
      issuedAt: o.orderIssuedAt,
      advertiserName: o.advertiserName,
      contactName: o.contactName,
      email: o.email,
      phone: o.phone,
      postalCode: o.postalCode,
      address: o.address,
      representativeName: o.representativeName,
      areaLabel: `${o.prefName} ${o.areaLabel}`,
      planName: planByKey(o.planKey)?.name ?? o.planKey,
      adSeconds: o.adSeconds ?? AD_SECONDS,
      months: o.months,
      mediaFeeExclTax: q.mediaFeeExclTax,
      monthlyInclTax: q.monthlyInclTax,
      firstInclTax: q.firstInclTax,
      contractTotalInclTax: q.contractTotalInclTax,
      productName: o.productName,
      termsTitle: TERMS_TITLE,
      termsVersion: o.termsVersion ?? TERMS_VERSION,
      estimateNote: TVER_ESTIMATE_NOTE,
      signed: o.agreedAt && o.signerName ? { signerName: o.signerName, agreedAt: o.agreedAt, ip: o.agreedIp } : null,
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const buffer = await renderToBuffer(React.createElement(OrderDocumentPDF, { d }) as any);
    const filename = `発注書_${no}.pdf`;
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(filename)}`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    console.error("[tver-order] order pdf error:", e);
    return new NextResponse("PDF generation failed", { status: 500 });
  }
}
