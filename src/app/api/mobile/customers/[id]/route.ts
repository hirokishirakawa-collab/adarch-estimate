import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyMobileToken } from "../../_lib/verify-mobile-token";

export const runtime = "nodejs";

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
    const customer = await db.customer.findUnique({
      where: { id },
      include: {
        branch: { select: { id: true, name: true } },
        _count: { select: { deals: true } },
      },
    });

    if (!customer) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    }

    // Non-admin users can only access customers in their own branch
    if (user.role !== "ADMIN") {
      const dbUser = await db.user.findUnique({
        where: { email: user.email },
        select: { branchId: true, branchId2: true },
      });
      const branchIds = [dbUser?.branchId, dbUser?.branchId2].filter(Boolean) as string[];
      if (!branchIds.includes(customer.branchId)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    const lastActivity = await db.activityLog.findFirst({
      where: { customerId: id },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    });

    return NextResponse.json({
      id: customer.id,
      recordNumber: customer.recordNumber,
      companyName: customer.name,
      nameKana: customer.nameKana ?? null,
      corporateNumber: customer.corporateNumber ?? null,
      contactPerson: customer.contactName ?? null,
      email: customer.email ?? null,
      phone: customer.phone ?? null,
      website: customer.website ?? null,
      industry: customer.industry ?? null,
      source: customer.source ?? null,
      rank: customer.rank,
      status: customer.status,
      postalCode: customer.postalCode ?? null,
      prefecture: customer.prefecture ?? null,
      address: customer.address ?? null,
      building: customer.building ?? null,
      notes: customer.notes ?? null,
      staffName: customer.staffName ?? null,
      branch: customer.branch,
      dealsCount: customer._count.deals,
      lastContactDate: lastActivity?.createdAt ?? null,
      createdAt: customer.createdAt,
      updatedAt: customer.updatedAt,
    });
  } catch (e) {
    console.error("[GET /api/mobile/customers/[id]]", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
