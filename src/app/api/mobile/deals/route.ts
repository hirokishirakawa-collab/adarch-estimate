import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyMobileToken } from "../_lib/verify-mobile-token";
import type { DealStatus } from "@/generated/prisma/client";

export const runtime = "nodejs";

const validStatuses: DealStatus[] = [
  "PROSPECTING",
  "QUALIFYING",
  "PROPOSAL",
  "NEGOTIATION",
  "CLOSED_WON",
  "CLOSED_LOST",
  "DORMANT",
  "DEFERRED",
];

export async function GET(req: NextRequest) {
  const user = await verifyMobileToken(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = req.nextUrl;
  const statusParam = searchParams.get("status");
  const customerIdParam = searchParams.get("customerId");
  const limitParam = searchParams.get("limit");
  const limit = limitParam ? Math.min(Math.max(1, parseInt(limitParam, 10)), 100) : 50;

  const statusFilter =
    statusParam && validStatuses.includes(statusParam as DealStatus)
      ? (statusParam as DealStatus)
      : undefined;

  try {
    // Resolve branch filter for non-admin users
    let branchFilter: Record<string, unknown> = {};
    if (user.role !== "ADMIN") {
      const dbUser = await db.user.findUnique({
        where: { email: user.email },
        select: { branchId: true, branchId2: true },
      });
      if (!dbUser?.branchId) {
        return NextResponse.json({ error: "Branch not assigned" }, { status: 403 });
      }
      const branchIds = [dbUser.branchId, dbUser.branchId2].filter(Boolean) as string[];
      branchFilter = { branchId: { in: branchIds } };
    }

    const where = {
      ...branchFilter,
      ...(statusFilter ? { status: statusFilter } : {}),
      ...(customerIdParam ? { customerId: customerIdParam } : {}),
    };

    const deals = await db.deal.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      take: limit,
      select: {
        id: true,
        title: true,
        status: true,
        amount: true,
        probability: true,
        expectedCloseDate: true,
        createdAt: true,
        customer: {
          select: { name: true },
        },
      },
    });

    const result = deals.map((d) => ({
      id: d.id,
      title: d.title,
      customerName: d.customer?.name ?? null,
      status: d.status,
      amount: d.amount ? Number(d.amount) : null,
      probability: d.probability ?? null,
      expectedCloseDate: d.expectedCloseDate ?? null,
      createdAt: d.createdAt,
    }));

    return NextResponse.json(result);
  } catch (e) {
    console.error("[GET /api/mobile/deals]", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const user = await verifyMobileToken(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { id, status } = body as { id?: string; status?: string };

    if (!id || !status) {
      return NextResponse.json(
        { error: "id and status are required" },
        { status: 400 }
      );
    }

    if (!validStatuses.includes(status as DealStatus)) {
      return NextResponse.json(
        { error: `Invalid status. Valid values: ${validStatuses.join(", ")}` },
        { status: 400 }
      );
    }

    // Verify the deal exists and user has access
    const deal = await db.deal.findUnique({
      where: { id },
      select: { id: true, branchId: true },
    });

    if (!deal) {
      return NextResponse.json({ error: "Deal not found" }, { status: 404 });
    }

    if (user.role !== "ADMIN") {
      const dbUser = await db.user.findUnique({
        where: { email: user.email },
        select: { branchId: true, branchId2: true },
      });
      const branchIds = [dbUser?.branchId, dbUser?.branchId2].filter(Boolean) as string[];
      if (!branchIds.includes(deal.branchId)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    const updated = await db.deal.update({
      where: { id },
      data: {
        status: status as DealStatus,
        ...(status === "CLOSED_WON" || status === "CLOSED_LOST"
          ? { closedAt: new Date() }
          : {}),
      },
      select: {
        id: true,
        title: true,
        status: true,
        updatedAt: true,
      },
    });

    return NextResponse.json(updated);
  } catch (e) {
    console.error("[PATCH /api/mobile/deals]", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
