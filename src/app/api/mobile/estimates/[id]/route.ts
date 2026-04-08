import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyMobileToken } from "../../_lib/verify-mobile-token";
import type { EstimationStatus } from "@/generated/prisma/client";

export const runtime = "nodejs";

// ----------------------------------------------------------------
// GET /api/mobile/estimates/[id]
// Single estimate detail with items
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
    // Build ownership filter for non-admin users
    const ownerFilter =
      user.role === "ADMIN" ? {} : { createdByEmail: user.email };

    const estimation = await db.estimation.findFirst({
      where: { id, ...ownerFilter },
      select: {
        id: true,
        title: true,
        status: true,
        staffName: true,
        createdByEmail: true,
        estimateDate: true,
        validUntil: true,
        notes: true,
        discountAmount: true,
        customerId: true,
        projectId: true,
        createdAt: true,
        updatedAt: true,
        customer: {
          select: { id: true, name: true },
        },
        project: {
          select: { id: true, title: true },
        },
        items: {
          orderBy: { sortOrder: "asc" },
          select: {
            id: true,
            name: true,
            spec: true,
            quantity: true,
            unit: true,
            unitPrice: true,
            amount: true,
            sortOrder: true,
          },
        },
      },
    });

    if (!estimation) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const subtotal = estimation.items.reduce(
      (sum, item) => sum + Number(item.amount),
      0
    );
    const discount = estimation.discountAmount
      ? Number(estimation.discountAmount)
      : 0;
    const discountedSubtotal = Math.max(0, subtotal - discount);
    const taxAmount = Math.round(discountedSubtotal * 0.1);
    const totalAmount = discountedSubtotal + taxAmount;

    return NextResponse.json({
      id: estimation.id,
      title: estimation.title,
      status: estimation.status,
      staffName: estimation.staffName ?? null,
      createdByEmail: estimation.createdByEmail ?? null,
      estimateDate: estimation.estimateDate,
      validUntil: estimation.validUntil ?? null,
      notes: estimation.notes ?? null,
      customerId: estimation.customer?.id ?? null,
      customerName: estimation.customer?.name ?? null,
      projectId: estimation.project?.id ?? null,
      projectTitle: estimation.project?.title ?? null,
      subtotal,
      discount,
      taxAmount,
      totalAmount,
      items: estimation.items.map((item) => ({
        id: item.id,
        name: item.name,
        spec: item.spec ?? null,
        quantity: item.quantity,
        unit: item.unit ?? null,
        unitPrice: Number(item.unitPrice),
        amount: Number(item.amount),
        sortOrder: item.sortOrder,
      })),
      createdAt: estimation.createdAt,
      updatedAt: estimation.updatedAt,
    });
  } catch (e) {
    console.error("[GET /api/mobile/estimates/[id]]", e);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// ----------------------------------------------------------------
// PATCH /api/mobile/estimates/[id]
// Update estimate (title, status, items)
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
    title?: string;
    status?: string;
    notes?: string;
    items?: { name: string; unitPrice: number; quantity: number; unit?: string }[];
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  try {
    // Verify ownership
    const ownerFilter =
      user.role === "ADMIN" ? {} : { createdByEmail: user.email };

    const existing = await db.estimation.findFirst({
      where: { id, ...ownerFilter },
      select: { id: true },
    });

    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Validate status if provided
    const validStatuses: EstimationStatus[] = [
      "DRAFT",
      "ISSUED",
      "SENT",
      "ACCEPTED",
      "REJECTED",
    ];
    if (body.status && !validStatuses.includes(body.status as EstimationStatus)) {
      return NextResponse.json(
        { error: "Invalid status value" },
        { status: 400 }
      );
    }

    // Build update data
    const updateData: Record<string, unknown> = {};
    if (body.title !== undefined) updateData.title = body.title.trim();
    if (body.status !== undefined) updateData.status = body.status as EstimationStatus;
    if (body.notes !== undefined) updateData.notes = body.notes?.trim() || null;

    // Update estimate
    await db.estimation.update({
      where: { id },
      data: updateData,
    });

    // Replace items if provided
    if (body.items && Array.isArray(body.items)) {
      // Delete existing items
      await db.estimationItem.deleteMany({ where: { estimationId: id } });

      // Create new items
      const itemsData = body.items.map((item, index) => ({
        estimationId: id,
        name: item.name,
        quantity: item.quantity,
        unit: item.unit ?? null,
        unitPrice: item.unitPrice,
        amount: item.unitPrice * item.quantity,
        sortOrder: index,
      }));

      await db.estimationItem.createMany({ data: itemsData });
    }

    return NextResponse.json({ success: true, id });
  } catch (e) {
    console.error("[PATCH /api/mobile/estimates/[id]]", e);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
