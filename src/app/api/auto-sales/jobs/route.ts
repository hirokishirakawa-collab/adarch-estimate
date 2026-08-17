import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

// ジョブ一覧（モニター用）
export async function GET(req: NextRequest) {
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

  const isAdmin = user.role === "ADMIN";
  if (!isAdmin && !user.enabledFeatures.includes("auto-sales")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const branchFilter = isAdmin ? {} : { branchId: user.branchId! };
  const status = req.nextUrl.searchParams.get("status");
  const limit = Number(req.nextUrl.searchParams.get("limit") ?? "50");

  const jobs = await db.autoSalesJob.findMany({
    where: {
      target: branchFilter,
      ...(status ? { status: status as never } : {}),
    },
    include: {
      target: {
        select: { companyName: true, url: true, area: true, industry: true, branch: { select: { name: true } } },
      },
      template: { select: { name: true, companyName: true } },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return NextResponse.json(jobs);
}

// 緊急停止（QUEUED/PROCESSINGのジョブを一括キャンセル）
export async function DELETE(req: NextRequest) {
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

  const branchFilter = user.role === "ADMIN" ? {} : { branchId: user.branchId! };

  const result = await db.autoSalesJob.updateMany({
    where: {
      status: { in: ["QUEUED", "PROCESSING"] },
      target: branchFilter,
    },
    data: {
      status: "FAILED",
      completedAt: new Date(),
      errorMessage: "緊急停止（手動キャンセル）",
    },
  });

  return NextResponse.json({ cancelled: result.count });
}

// ジョブ作成（営業先をキューに投入）
export async function POST(req: NextRequest) {
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

  const body = await req.json();
  const { targetIds, templateId } = body as {
    targetIds: string[];
    templateId: string;
  };

  if (!targetIds?.length || !templateId) {
    return NextResponse.json(
      { error: "targetIds and templateId are required" },
      { status: 400 }
    );
  }

  // テンプレートの承認チェック
  const template = await db.autoSalesTemplate.findUnique({
    where: { id: templateId },
  });
  if (!template || !template.isApproved) {
    return NextResponse.json(
      { error: "承認済みテンプレートを選択してください" },
      { status: 400 }
    );
  }

  // 既に送信済みのターゲットを除外
  const existingJobs = await db.autoSalesJob.findMany({
    where: {
      targetId: { in: targetIds },
      status: { in: ["COMPLETED", "PROCESSING", "QUEUED"] },
    },
    select: { targetId: true },
  });
  const existingTargetIds = new Set(existingJobs.map((j) => j.targetId));
  const newTargetIds = targetIds.filter((id) => !existingTargetIds.has(id));

  if (newTargetIds.length === 0) {
    return NextResponse.json(
      { error: "全ての営業先は既にキューに入っているか送信済みです" },
      { status: 409 }
    );
  }

  // バルク作成
  const jobs = await db.autoSalesJob.createMany({
    data: newTargetIds.map((targetId) => ({
      targetId,
      templateId,
      status: "QUEUED" as const,
    })),
  });

  return NextResponse.json(
    { created: jobs.count, skipped: targetIds.length - newTargetIds.length },
    { status: 201 }
  );
}
