import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyMobileToken } from "../_lib/verify-mobile-token";
import type { InvoiceRequestStatus } from "@/generated/prisma/client";

export const runtime = "nodejs";

// ----------------------------------------------------------------
// GET /api/mobile/billing
// List invoice requests (billings) for user or all for admin
// ----------------------------------------------------------------
export async function GET(req: NextRequest) {
  const user = await verifyMobileToken(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = req.nextUrl;
  const statusParam = searchParams.get("status");
  const limitParam = searchParams.get("limit");
  const limit = limitParam
    ? Math.min(Math.max(1, parseInt(limitParam, 10)), 100)
    : 50;

  const validStatuses: InvoiceRequestStatus[] = ["DRAFT", "SUBMITTED"];
  const statusFilter =
    statusParam && validStatuses.includes(statusParam as InvoiceRequestStatus)
      ? (statusParam as InvoiceRequestStatus)
      : undefined;

  try {
    // Resolve user id for ownership filter
    const dbUser = await db.user.findUnique({
      where: { email: user.email },
      select: { id: true },
    });

    const where =
      user.role === "ADMIN"
        ? statusFilter
          ? { status: statusFilter }
          : {}
        : statusFilter
          ? { createdById: dbUser?.id ?? "", status: statusFilter }
          : { createdById: dbUser?.id ?? "" };

    const invoices = await db.invoiceRequest.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
      select: {
        id: true,
        subject: true,
        status: true,
        amountExclTax: true,
        taxAmount: true,
        amountInclTax: true,
        billingDate: true,
        dueDate: true,
        notes: true,
        createdAt: true,
        customer: {
          select: { name: true },
        },
      },
    });

    const result = invoices.map((inv) => ({
      id: inv.id,
      subject: inv.subject,
      customerName: inv.customer?.name ?? null,
      amountExclTax: Number(inv.amountExclTax),
      taxAmount: Number(inv.taxAmount),
      totalAmount: Number(inv.amountInclTax),
      status: inv.status,
      billingDate: inv.billingDate,
      dueDate: inv.dueDate ?? null,
      createdAt: inv.createdAt,
    }));

    return NextResponse.json(result);
  } catch (e) {
    console.error("[GET /api/mobile/billing]", e);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// ----------------------------------------------------------------
// POST /api/mobile/billing
// Create new invoice request (billing)
// ----------------------------------------------------------------
export async function POST(req: NextRequest) {
  const user = await verifyMobileToken(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: {
    customerId?: string;
    subject?: string;
    items?: { description: string; amount: number; quantity: number }[];
    dueDate?: string;
    notes?: string;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.subject?.trim()) {
    return NextResponse.json(
      { error: "subject is required" },
      { status: 400 }
    );
  }

  if (!body.items || !Array.isArray(body.items) || body.items.length === 0) {
    return NextResponse.json(
      { error: "At least one item is required" },
      { status: 400 }
    );
  }

  // Validate items
  for (const item of body.items) {
    if (!item.description?.trim()) {
      return NextResponse.json(
        { error: "Each item must have a description" },
        { status: 400 }
      );
    }
    if (typeof item.amount !== "number" || item.amount < 0) {
      return NextResponse.json(
        { error: "Each item must have a valid amount" },
        { status: 400 }
      );
    }
    if (typeof item.quantity !== "number" || item.quantity < 1) {
      return NextResponse.json(
        { error: "Each item must have a quantity >= 1" },
        { status: 400 }
      );
    }
  }

  try {
    const dbUser = await db.user.findUnique({
      where: { email: user.email },
      select: { id: true, branchId: true },
    });

    if (!dbUser?.branchId) {
      return NextResponse.json(
        { error: "Branch not assigned" },
        { status: 403 }
      );
    }

    // Verify customer if provided
    let customerEmail = "";
    if (body.customerId) {
      const customer = await db.customer.findFirst({
        where: { id: body.customerId },
        select: { id: true, email: true },
      });
      if (!customer) {
        return NextResponse.json(
          { error: "Customer not found" },
          { status: 404 }
        );
      }
      customerEmail = customer.email ?? "";
    }

    // Calculate amounts
    const amountExclTax = body.items.reduce(
      (sum, item) => sum + item.amount * item.quantity,
      0
    );
    const taxAmount = Math.round(amountExclTax * 0.1);
    const amountInclTax = amountExclTax + taxAmount;

    // Build details text from items
    const details = body.items
      .map(
        (item) =>
          `${item.description} x${item.quantity} = ${(item.amount * item.quantity).toLocaleString()}`
      )
      .join("\n");

    const invoice = await db.invoiceRequest.create({
      data: {
        subject: body.subject.trim(),
        contactEmail: customerEmail || user.email,
        billingDate: new Date(),
        dueDate: body.dueDate ? new Date(body.dueDate) : null,
        details,
        amountExclTax,
        taxAmount,
        amountInclTax,
        notes: body.notes?.trim() || null,
        status: "DRAFT",
        customerId: body.customerId || null,
        createdById: dbUser.id,
        creatorEmail: user.email,
        branchId: dbUser.branchId,
      },
      select: {
        id: true,
        subject: true,
        status: true,
        amountExclTax: true,
        taxAmount: true,
        amountInclTax: true,
        billingDate: true,
        dueDate: true,
        createdAt: true,
        customer: {
          select: { name: true },
        },
      },
    });

    return NextResponse.json(
      {
        id: invoice.id,
        subject: invoice.subject,
        customerName: invoice.customer?.name ?? null,
        amountExclTax: Number(invoice.amountExclTax),
        taxAmount: Number(invoice.taxAmount),
        totalAmount: Number(invoice.amountInclTax),
        status: invoice.status,
        billingDate: invoice.billingDate,
        dueDate: invoice.dueDate ?? null,
        createdAt: invoice.createdAt,
      },
      { status: 201 }
    );
  } catch (e) {
    console.error("[POST /api/mobile/billing]", e);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
