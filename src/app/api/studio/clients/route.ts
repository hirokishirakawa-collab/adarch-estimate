import { auth } from "@/lib/auth";
import { db as prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!user || !user.branchId) return NextResponse.json({ error: "No branch" }, { status: 400 });

  const body = await req.json();

  const client = await prisma.studioClient.create({
    data: {
      name: body.name,
      businessType: body.businessType,
      area: body.area,
      target: body.target,
      sellingPoints: body.sellingPoints || null,
      snsAccounts: body.snsAccounts || null,
      brandColors: body.brandColors || null,
      monthlyBudget: body.monthlyBudget || null,
      postsPerMonth: body.postsPerMonth || 12,
      notes: body.notes || null,
      customerId: body.customerId || null,
      branchId: user.branchId,
      createdById: user.id,
    },
  });

  // 操作ログ
  await prisma.auditLog.create({
    data: {
      action: "studio_client_created",
      email: user.email,
      name: user.name,
      entity: "studio_client",
      entityId: client.id,
      detail: `Studioクライアント登録: ${body.name}（${body.businessType} / ${body.area}）`,
    },
  });

  return NextResponse.json(client);
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const isAdmin = user.role === "ADMIN";
  if (!isAdmin && !user.branchId) return NextResponse.json({ error: "No branch" }, { status: 400 });
  const branchFilter = isAdmin ? {} : { branchId: user.branchId! };

  const clients = await prisma.studioClient.findMany({
    where: branchFilter,
    orderBy: { updatedAt: "desc" },
  });

  // 金額マスキング: ADMINまたは作成者本人以外は monthlyBudget を非表示
  const masked = clients.map((c) => ({
    ...c,
    monthlyBudget:
      isAdmin || c.createdById === user.id ? c.monthlyBudget : null,
  }));

  return NextResponse.json(masked);
}
