import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyMobileToken } from "../../_lib/verify-mobile-token";
import { resolveDbUser } from "../../_lib/authorize";
import type { ProjectStatus, BillingStatus } from "@/generated/prisma/client";

export const runtime = "nodejs";

// ----------------------------------------------------------------
// GET /api/mobile/projects/[id]
// Project detail
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

    const project = await db.project.findFirst({
      where: { id, ...branchFilter },
      select: {
        id: true,
        title: true,
        status: true,
        deadline: true,
        budget: true,
        description: true,
        staffName: true,
        billingStatus: true,
        createdAt: true,
        updatedAt: true,
        customer: {
          select: { id: true, name: true },
        },
        estimations: {
          orderBy: { createdAt: "desc" },
          take: 5,
          select: {
            id: true,
            title: true,
            status: true,
            createdAt: true,
          },
        },
        expenses: {
          select: {
            id: true,
            category: true,
            amount: true,
            title: true,
            createdAt: true,
          },
          orderBy: { createdAt: "desc" },
          take: 10,
        },
        logs: {
          orderBy: { createdAt: "desc" },
          take: 10,
          select: {
            id: true,
            type: true,
            content: true,
            createdAt: true,
          },
        },
      },
    });

    if (!project) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const totalExpenses = showFinancials
      ? project.expenses.reduce((sum, exp) => sum + Number(exp.amount), 0)
      : null;

    return NextResponse.json({
      id: project.id,
      title: project.title,
      status: project.status,
      deadline: project.deadline ?? null,
      budget: showFinancials && project.budget ? Number(project.budget) : null,
      description: project.description ?? null,
      staffName: project.staffName ?? null,
      billingStatus: project.billingStatus,
      customerId: project.customer?.id ?? null,
      customerName: project.customer?.name ?? null,
      totalExpenses,
      estimations: project.estimations.map((e) => ({
        id: e.id,
        title: e.title,
        status: e.status,
        createdAt: e.createdAt,
      })),
      expenses: project.expenses.map((exp) => ({
        id: exp.id,
        category: exp.category,
        amount: showFinancials ? Number(exp.amount) : null,
        description: exp.title,
        createdAt: exp.createdAt,
      })),
      recentLogs: project.logs.map((log) => ({
        id: log.id,
        type: log.type,
        content: log.content,
        createdAt: log.createdAt,
      })),
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
    });
  } catch (e) {
    console.error("[GET /api/mobile/projects/[id]]", e);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// ----------------------------------------------------------------
// PATCH /api/mobile/projects/[id]
// Update project status, billing status, description
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
    billingStatus?: string;
    description?: string;
    deadline?: string;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

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

    const existing = await db.project.findFirst({
      where: { id, ...branchFilter },
      select: { id: true, status: true },
    });

    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Validate status if provided
    const validStatuses: ProjectStatus[] = [
      "ORDERED",
      "IN_PROGRESS",
      "COMPLETED",
      "ON_HOLD",
      "CANCELLED",
    ];
    if (body.status && !validStatuses.includes(body.status as ProjectStatus)) {
      return NextResponse.json(
        { error: "Invalid status value" },
        { status: 400 }
      );
    }

    const validBillingStatuses: BillingStatus[] = [
      "UNBILLED",
      "BILLED",
      "PAID",
    ];
    if (
      body.billingStatus &&
      !validBillingStatuses.includes(body.billingStatus as BillingStatus)
    ) {
      return NextResponse.json(
        { error: "Invalid billingStatus value" },
        { status: 400 }
      );
    }

    const updateData: Record<string, unknown> = {};
    if (body.status !== undefined)
      updateData.status = body.status as ProjectStatus;
    if (body.billingStatus !== undefined)
      updateData.billingStatus = body.billingStatus as BillingStatus;
    if (body.description !== undefined)
      updateData.description = body.description?.trim() || null;
    if (body.deadline !== undefined)
      updateData.deadline = body.deadline ? new Date(body.deadline) : null;

    await db.project.update({
      where: { id },
      data: updateData,
    });

    // Log status change
    if (body.status && body.status !== existing.status) {
      await db.projectLog.create({
        data: {
          projectId: id,
          type: "SYSTEM",
          content: `Status changed: ${existing.status} -> ${body.status} (via mobile)`,
          staffName: user.name ?? user.email,
        },
      });
    }

    return NextResponse.json({ success: true, id });
  } catch (e) {
    console.error("[PATCH /api/mobile/projects/[id]]", e);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
