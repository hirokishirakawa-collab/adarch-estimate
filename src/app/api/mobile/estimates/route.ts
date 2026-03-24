import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyMobileToken } from "../_lib/verify-mobile-token";
import type { EstimationStatus } from "@/generated/prisma/client";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const user = await verifyMobileToken(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = req.nextUrl;
  const statusParam = searchParams.get("status");
  const limitParam = searchParams.get("limit");
  const limit = limitParam ? Math.min(Math.max(1, parseInt(limitParam, 10)), 100) : 50;

  const validStatuses: EstimationStatus[] = ["DRAFT", "ISSUED", "ACCEPTED", "REJECTED", "EXPIRED"];
  const statusFilter =
    statusParam && validStatuses.includes(statusParam as EstimationStatus)
      ? (statusParam as EstimationStatus)
      : undefined;

  try {
    const where =
      user.role === "ADMIN"
        ? statusFilter ? { status: statusFilter } : {}
        : statusFilter
        ? { createdByEmail: user.email, status: statusFilter }
        : { createdByEmail: user.email };

    const estimations = await db.estimation.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
      select: {
        id: true,
        title: true,
        status: true,
        staffName: true,
        createdByEmail: true,
        estimateDate: true,
        validUntil: true,
        discountAmount: true,
        createdAt: true,
        customer: {
          select: { name: true },
        },
        items: {
          select: {
            amount: true,
          },
        },
      },
    });

    const result = estimations.map((e) => {
      const subtotal = e.items.reduce(
        (sum, item) => sum + Number(item.amount),
        0
      );
      const discount = e.discountAmount ? Number(e.discountAmount) : 0;
      const discountedSubtotal = Math.max(0, subtotal - discount);
      const totalAmount = discountedSubtotal + Math.round(discountedSubtotal * 0.1);

      return {
        id: e.id,
        title: e.title,
        customerName: e.customer?.name ?? null,
        staffName: e.staffName ?? null,
        totalAmount,
        status: e.status,
        estimateDate: e.estimateDate,
        validUntil: e.validUntil ?? null,
        createdAt: e.createdAt,
      };
    });

    return NextResponse.json(result);
  } catch (e) {
    console.error("[GET /api/mobile/estimates]", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
