import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyMobileToken } from "../_lib/verify-mobile-token";
import type { CustomerRank, CustomerStatus } from "@/generated/prisma/client";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const user = await verifyMobileToken(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = req.nextUrl;
  const q = searchParams.get("q")?.trim() || "";
  const rankParam = searchParams.get("rank");
  const statusParam = searchParams.get("status");
  const limitParam = searchParams.get("limit");
  const limit = limitParam ? Math.min(Math.max(1, parseInt(limitParam, 10)), 100) : 50;

  const validRanks: CustomerRank[] = ["A", "B", "C", "D"];
  const rankFilter =
    rankParam && validRanks.includes(rankParam as CustomerRank)
      ? (rankParam as CustomerRank)
      : undefined;

  const validStatuses: CustomerStatus[] = ["PROSPECT", "ACTIVE", "INACTIVE", "BLOCKED"];
  const statusFilter =
    statusParam && validStatuses.includes(statusParam as CustomerStatus)
      ? (statusParam as CustomerStatus)
      : undefined;

  try {
    // Resolve branchId for non-admin users
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
      ...(rankFilter ? { rank: rankFilter } : {}),
      ...(statusFilter ? { status: statusFilter } : {}),
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" as const } },
              { contactName: { contains: q, mode: "insensitive" as const } },
              { industry: { contains: q, mode: "insensitive" as const } },
            ],
          }
        : {}),
    };

    const customers = await db.customer.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      take: limit,
      select: {
        id: true,
        name: true,
        contactName: true,
        rank: true,
        status: true,
        prefecture: true,
        phone: true,
        updatedAt: true,
        activityLogs: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { createdAt: true },
        },
      },
    });

    const result = customers.map((c) => ({
      id: c.id,
      companyName: c.name,
      contactPerson: c.contactName ?? null,
      rank: c.rank,
      status: c.status,
      prefecture: c.prefecture ?? null,
      phone: c.phone ?? null,
      lastContactDate: c.activityLogs[0]?.createdAt ?? null,
    }));

    return NextResponse.json(result);
  } catch (e) {
    console.error("[GET /api/mobile/customers]", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
