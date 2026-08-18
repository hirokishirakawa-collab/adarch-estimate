import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import type { UserRole } from "@/types/roles";

export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const session = await auth();
  if (!session?.user) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const role = (session.user.role ?? "USER") as UserRole;
  const email = session.user.email ?? "";

  const statement = await db.paymentStatement.findUnique({
    where: { id },
    include: {
      groupCompany: {
        select: {
          name: true,
          ownerName: true,
          entityType: true,
          invoiceRegistered: true,
          invoiceNumber: true,
          bankName: true,
          bankBranch: true,
          bankAccountType: true,
          bankAccountNumber: true,
          bankAccountHolder: true,
        },
      },
      items: { orderBy: { sortOrder: "asc" } },
    },
  });

  if (!statement) {
    return new NextResponse("Not Found", { status: 404 });
  }

  // パートナーは自社のCONFIRMED/PAIDのみ
  if (role !== "ADMIN") {
    const user = await db.user.findUnique({
      where: { email },
      select: { groupCompanyId: true },
    });
    if (user?.groupCompanyId !== statement.groupCompanyId || statement.status === "DRAFT") {
      return new NextResponse("Forbidden", { status: 403 });
    }
  }

  try {
    const { renderToBuffer } = await import("@react-pdf/renderer");
    const React = (await import("react")).default;
    const { PaymentStatementPDFDocument } = await import(
      "@/components/payments/payment-statement-pdf"
    );

    const pdfData = {
      ...statement,
      grossAmount: Number(statement.grossAmount),
      commissionRate: Number(statement.commissionRate),
      commissionAmount: Number(statement.commissionAmount),
      mediaExpense: Number(statement.mediaExpense),
      productionExpense: Number(statement.productionExpense),
      withholdingTaxAmount: Number(statement.withholdingTaxAmount),
      nonDeductibleTaxAmount: Number(statement.nonDeductibleTaxAmount),
      netPaymentAmount: Number(statement.netPaymentAmount),
      items: statement.items.map((it) => ({
        clientName: it.clientName,
        prefecture: it.prefecture,
        grossAmount: Number(it.grossAmount),
        note: it.note,
      })),
    };

    const buffer = await renderToBuffer(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      React.createElement(PaymentStatementPDFDocument, { statement: pdfData }) as any
    );

    const safeTitle = statement.title
      .replace(/[<>:"/\\|?*]/g, "")
      .trim()
      .slice(0, 50);
    const filename = `payment_${safeTitle || id.slice(-8)}.pdf`;

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    console.error("[payment-pdf] renderToBuffer error:", e);
    return new NextResponse("PDF generation failed", { status: 500 });
  }
}
