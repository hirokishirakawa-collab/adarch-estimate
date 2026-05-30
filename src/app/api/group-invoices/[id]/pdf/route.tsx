import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import type { UserRole } from "@/types/roles";

export const runtime = "nodejs";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const session = await auth();
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });

  const role = (session.user.role ?? "USER") as UserRole;
  const email = session.user.email ?? "";

  const invoice = await db.groupInvoice.findUnique({
    where: { id },
    include: {
      groupCompany: { select: { name: true, ownerName: true } },
      items: { orderBy: { sortOrder: "asc" } },
    },
  });
  if (!invoice) return new NextResponse("Not Found", { status: 404 });

  // パートナーは自社の発行済・入金済のみ
  if (role !== "ADMIN") {
    const user = await db.user.findUnique({ where: { email }, select: { groupCompanyId: true } });
    if (user?.groupCompanyId !== invoice.groupCompanyId || invoice.status === "DRAFT") {
      return new NextResponse("Forbidden", { status: 403 });
    }
  }

  try {
    const { renderToBuffer } = await import("@react-pdf/renderer");
    const React = (await import("react")).default;
    const { GroupInvoicePDFDocument } = await import("@/components/group-invoices/group-invoice-pdf");

    const pdfData = {
      invoiceNo: invoice.invoiceNo,
      type: invoice.type,
      title: invoice.title,
      targetMonth: invoice.targetMonth,
      description: invoice.description,
      subtotalExclTax: Number(invoice.subtotalExclTax),
      taxAmount: Number(invoice.taxAmount),
      totalInclTax: Number(invoice.totalInclTax),
      issueDate: invoice.issueDate,
      dueDate: invoice.dueDate,
      status: invoice.status,
      groupCompany: invoice.groupCompany,
      items: invoice.items.map((it) => ({
        name: it.name,
        detail: it.detail,
        quantity: Number(it.quantity),
        unitPrice: Number(it.unitPrice),
        amount: Number(it.amount),
      })),
    };

    const buffer = await renderToBuffer(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      React.createElement(GroupInvoicePDFDocument, { invoice: pdfData }) as any,
    );

    const filename = `invoice_${invoice.invoiceNo}.pdf`;
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    console.error("[group-invoice-pdf] renderToBuffer error:", e);
    return new NextResponse("PDF generation failed", { status: 500 });
  }
}
