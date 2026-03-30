import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

/**
 * POST /api/auto-sales/jobs/[id]/register-customer
 * 反響があったジョブから顧客を新規登録する
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await db.user.findUnique({
    where: { email: session.user.email },
  });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }
  if (user.role !== "ADMIN" && !user.enabledFeatures.includes("auto-sales")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  // ジョブの存在確認
  const job = await db.autoSalesJob.findUnique({
    where: { id },
    include: {
      target: {
        select: {
          companyName: true,
          url: true,
          phone: true,
          area: true,
          industry: true,
          branchId: true,
        },
      },
    },
  });

  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }
  if (!job.hasResponse) {
    return NextResponse.json(
      { error: "反響がないジョブは顧客登録できません" },
      { status: 400 }
    );
  }
  if (user.role !== "ADMIN" && job.target.branchId !== user.branchId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // 同名の顧客が既に存在するか確認
  const existing = await db.customer.findFirst({
    where: {
      name: job.target.companyName,
      branchId: job.target.branchId,
    },
  });
  if (existing) {
    // 既存の顧客がある場合はリンクして返す
    await db.autoSalesJob.update({
      where: { id },
      data: {
        responseNote: job.responseNote
          ? `${job.responseNote}\n[顧客登録済み: ${existing.id}]`
          : `[顧客登録済み: ${existing.id}]`,
      },
    });

    return NextResponse.json({
      success: true,
      customerId: existing.id,
      alreadyExisted: true,
      customerName: existing.name,
    });
  }

  // 顧客を新規登録
  const customer = await db.customer.create({
    data: {
      name: job.target.companyName,
      phone: job.target.phone ?? null,
      website: job.target.url,
      industry: job.target.industry ?? null,
      prefecture: job.target.area ?? null,
      source: "自動営業",
      status: "PROSPECT",
      rank: "C",
      branchId: job.target.branchId,
      notes: `自動営業からの反響（ジョブID: ${id}）\n返信元: ${job.responseFrom ?? ""}\n件名: ${job.responseSubject ?? ""}`,
    },
  });

  // ジョブに顧客IDを記録
  await db.autoSalesJob.update({
    where: { id },
    data: {
      responseNote: job.responseNote
        ? `${job.responseNote}\n[顧客登録済み: ${customer.id}]`
        : `[顧客登録済み: ${customer.id}]`,
    },
  });

  return NextResponse.json({
    success: true,
    customerId: customer.id,
    alreadyExisted: false,
    customerName: customer.name,
  });
}
