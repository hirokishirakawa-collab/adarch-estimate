import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyMobileToken } from "../../_lib/verify-mobile-token";
import type { InvoiceRequestStatus } from "@/generated/prisma/client";

export const runtime = "nodejs";

// ----------------------------------------------------------------
// GET /api/mobile/billing/[id]
// Billing (invoice request) detail
// ----------------------------------------------------------------
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await verifyMobileToken(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    // Resolve user id for ownership filter
    const dbUser = await db.user.findUnique({
      where: { email: user.email },
      select: { id: true },
    });

    const ownerFilter =
      user.role === "ADMIN" ? {} : { createdById: dbUser?.id ?? "" };

    const invoice = await db.invoiceRequest.findFirst({
      where: { id, ...ownerFilter },
      select: {
        id: true,
        subject: true,
        status: true,
        contactName: true,
        contactEmail: true,
        billingDate: true,
        dueDate: true,
        details: true,
        amountExclTax: true,
        taxAmount: true,
        amountInclTax: true,
        inspectionStatus: true,
        fileUrl: true,
        notes: true,
        createdAt: true,
        updatedAt: true,
        customer: {
          select: { id: true, name: true },
        },
        project: {
          select: { id: true, title: true },
        },
      },
    });

    if (!invoice) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({
      id: invoice.id,
      subject: invoice.subject,
      status: invoice.status,
      contactName: invoice.contactName ?? null,
      contactEmail: invoice.contactEmail,
      billingDate: invoice.billingDate,
      dueDate: invoice.dueDate ?? null,
      details: invoice.details ?? null,
      amountExclTax: Number(invoice.amountExclTax),
      taxAmount: Number(invoice.taxAmount),
      totalAmount: Number(invoice.amountInclTax),
      inspectionStatus: invoice.inspectionStatus ?? null,
      fileUrl: invoice.fileUrl ?? null,
      notes: invoice.notes ?? null,
      customerId: invoice.customer?.id ?? null,
      customerName: invoice.customer?.name ?? null,
      projectId: invoice.project?.id ?? null,
      projectTitle: invoice.project?.title ?? null,
      createdAt: invoice.createdAt,
      updatedAt: invoice.updatedAt,
    });
  } catch (e) {
    console.error("[GET /api/mobile/billing/[id]]", e);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// ----------------------------------------------------------------
// PATCH /api/mobile/billing/[id]
// Update billing status or details
// ----------------------------------------------------------------
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await verifyMobileToken(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  let body: {
    status?: string;
    subject?: string;
    dueDate?: string;
    notes?: string;
    contactName?: string;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  try {
    // Resolve user id for ownership filter
    const dbUser = await db.user.findUnique({
      where: { email: user.email },
      select: { id: true },
    });

    const ownerFilter =
      user.role === "ADMIN" ? {} : { createdById: dbUser?.id ?? "" };

    const existing = await db.invoiceRequest.findFirst({
      where: { id, ...ownerFilter },
      select: { id: true },
    });

    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Validate status if provided
    const validStatuses: InvoiceRequestStatus[] = ["DRAFT", "SUBMITTED"];
    if (
      body.status &&
      !validStatuses.includes(body.status as InvoiceRequestStatus)
    ) {
      return NextResponse.json(
        { error: "Invalid status value" },
        { status: 400 }
      );
    }

    const updateData: Record<string, unknown> = {};
    if (body.status !== undefined)
      updateData.status = body.status as InvoiceRequestStatus;
    if (body.subject !== undefined) updateData.subject = body.subject.trim();
    if (body.dueDate !== undefined)
      updateData.dueDate = body.dueDate ? new Date(body.dueDate) : null;
    if (body.notes !== undefined)
      updateData.notes = body.notes?.trim() || null;
    if (body.contactName !== undefined)
      updateData.contactName = body.contactName?.trim() || null;

    await db.invoiceRequest.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ success: true, id });
  } catch (e) {
    console.error("[PATCH /api/mobile/billing/[id]]", e);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
