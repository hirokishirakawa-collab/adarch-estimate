import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyMobileToken } from "../../_lib/verify-mobile-token";

export const runtime = "nodejs";

// ----------------------------------------------------------------
// POST /api/mobile/estimates/create
// Create new estimate with items
// ----------------------------------------------------------------
export async function POST(req: NextRequest) {
  const user = await verifyMobileToken(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: {
    title?: string;
    customerId?: string;
    items?: { name: string; unitPrice: number; quantity: number; unit?: string }[];
    notes?: string;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.title?.trim()) {
    return NextResponse.json(
      { error: "title is required" },
      { status: 400 }
    );
  }

  if (!body.items || !Array.isArray(body.items) || body.items.length === 0) {
    return NextResponse.json(
      { error: "At least one item is required" },
      { status: 400 }
    );
  }

  // Validate each item
  for (const item of body.items) {
    if (!item.name?.trim()) {
      return NextResponse.json(
        { error: "Each item must have a name" },
        { status: 400 }
      );
    }
    if (typeof item.unitPrice !== "number" || item.unitPrice < 0) {
      return NextResponse.json(
        { error: "Each item must have a valid unitPrice" },
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
    // Resolve branchId from user
    const dbUser = await db.user.findUnique({
      where: { email: user.email },
      select: { id: true, name: true, branchId: true },
    });

    if (!dbUser?.branchId) {
      return NextResponse.json(
        { error: "Branch not assigned" },
        { status: 403 }
      );
    }

    // Verify customer belongs to accessible branch if customerId provided
    if (body.customerId) {
      const customer = await db.customer.findFirst({
        where: { id: body.customerId },
        select: { id: true },
      });
      if (!customer) {
        return NextResponse.json(
          { error: "Customer not found" },
          { status: 404 }
        );
      }
    }

    // Calculate total
    const itemsData = body.items.map((item, index) => ({
      name: item.name.trim(),
      quantity: item.quantity,
      unit: item.unit ?? null,
      unitPrice: item.unitPrice,
      amount: item.unitPrice * item.quantity,
      sortOrder: index,
    }));

    const subtotal = itemsData.reduce((sum, item) => sum + item.amount, 0);
    const taxAmount = Math.round(subtotal * 0.1);
    const totalAmount = subtotal + taxAmount;

    const estimation = await db.estimation.create({
      data: {
        title: body.title.trim(),
        status: "DRAFT",
        customerId: body.customerId || null,
        notes: body.notes?.trim() || null,
        staffName: dbUser.name ?? user.name ?? null,
        createdByEmail: user.email,
        branchId: dbUser.branchId,
        items: {
          create: itemsData,
        },
      },
      select: {
        id: true,
        title: true,
        status: true,
        createdAt: true,
        customer: {
          select: { name: true },
        },
      },
    });

    return NextResponse.json(
      {
        id: estimation.id,
        title: estimation.title,
        customerName: estimation.customer?.name ?? null,
        totalAmount,
        subtotal,
        taxAmount,
        status: estimation.status,
        itemCount: itemsData.length,
        createdAt: estimation.createdAt,
      },
      { status: 201 }
    );
  } catch (e) {
    console.error("[POST /api/mobile/estimates/create]", e);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
