import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

// 営業先一覧取得
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

  const page = Number(req.nextUrl.searchParams.get("page") ?? "1");
  const limit = 50;

  const [targets, total] = await Promise.all([
    db.autoSalesTarget.findMany({
      where: branchFilter,
      include: {
        branch: { select: { name: true } },
        jobs: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { status: true, completedAt: true },
        },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    db.autoSalesTarget.count({ where: branchFilter }),
  ]);

  return NextResponse.json({ targets, total, page, limit });
}

// 営業先削除（個別/一括）
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

  const body = await req.json();
  const { targetIds } = body as { targetIds: string[] };

  if (!targetIds?.length) {
    return NextResponse.json({ error: "targetIds is required" }, { status: 400 });
  }

  const branchFilter = user.role === "ADMIN" ? {} : { branchId: user.branchId! };

  // 関連ジョブも削除（cascadeが設定されているが念のため）
  await db.autoSalesJob.deleteMany({
    where: { targetId: { in: targetIds }, target: branchFilter },
  });

  const result = await db.autoSalesTarget.deleteMany({
    where: { id: { in: targetIds }, ...branchFilter },
  });

  return NextResponse.json({ deleted: result.count });
}

// 営業先登録
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await db.user.findUnique({
    where: { email: session.user.email },
  });
  if (!user || !user.branchId) {
    return NextResponse.json({ error: "Branch not assigned" }, { status: 400 });
  }
  if (user.role !== "ADMIN" && !user.enabledFeatures.includes("auto-sales")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { companyName, url, industry, area, phone, note } = body;

  if (!companyName || !url) {
    return NextResponse.json(
      { error: "companyName and url are required" },
      { status: 400 }
    );
  }

  // ブラックリストチェック
  const domain = new URL(url).hostname;
  const blacklisted = await db.autoSalesBlacklist.findUnique({
    where: { domain },
  });
  if (blacklisted) {
    return NextResponse.json(
      { error: `この企業 (${domain}) はブラックリストに登録されています` },
      { status: 400 }
    );
  }

  // 重複チェック
  const existing = await db.autoSalesTarget.findUnique({
    where: { branchId_url: { branchId: user.branchId, url } },
  });
  if (existing) {
    return NextResponse.json(
      { error: "この営業先は既に登録されています" },
      { status: 409 }
    );
  }

  const target = await db.autoSalesTarget.create({
    data: {
      branchId: user.branchId,
      companyName,
      url,
      industry: industry || null,
      area: area || null,
      phone: phone || null,
      note: note || null,
      createdById: user.id,
    },
  });

  return NextResponse.json(target, { status: 201 });
}
