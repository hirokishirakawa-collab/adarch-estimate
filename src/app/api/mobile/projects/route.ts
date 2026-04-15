import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyMobileToken } from "../_lib/verify-mobile-token";
import { resolveDbUser } from "../_lib/authorize";
import type { ProjectStatus } from "@/generated/prisma/client";

export const runtime = "nodejs";

// ----------------------------------------------------------------
// GET /api/mobile/projects
// List projects with status filter, branch-scoped
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

  const validStatuses: ProjectStatus[] = [
    "ORDERED",
    "IN_PROGRESS",
    "COMPLETED",
    "ON_HOLD",
    "CANCELLED",
  ];
  const statusFilter =
    statusParam && validStatuses.includes(statusParam as ProjectStatus)
      ? (statusParam as ProjectStatus)
      : undefined;

  try {
    // Resolve branchId for non-admin users
    let branchFilter: Record<string, unknown> = {};
    if (user.role !== "ADMIN") {
      const dbUser = await resolveDbUser(user.email);
      if (!dbUser?.branchId) {
        return NextResponse.json(
          { error: "Branch not assigned" },
          { status: 403 }
        );
      }
      const branchIds = [dbUser.branchId, dbUser.branchId2].filter(
        Boolean
      ) as string[];
      branchFilter = { branchId: { in: branchIds } };
    }

    const showFinancials = user.role === "ADMIN";

    const where = {
      ...branchFilter,
      ...(statusFilter ? { status: statusFilter } : {}),
    };

    const projects = await db.project.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
      select: {
        id: true,
        title: true,
        status: true,
        deadline: true,
        budget: true,
        staffName: true,
        billingStatus: true,
        createdAt: true,
        customer: {
          select: { name: true },
        },
      },
    });

    const result = projects.map((p) => ({
      id: p.id,
      title: p.title,
      customerName: p.customer?.name ?? null,
      status: p.status,
      deadline: p.deadline ?? null,
      budget: showFinancials && p.budget ? Number(p.budget) : null,
      staffName: p.staffName ?? null,
      billingStatus: p.billingStatus,
      createdAt: p.createdAt,
    }));

    return NextResponse.json(result);
  } catch (e) {
    console.error("[GET /api/mobile/projects]", e);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
