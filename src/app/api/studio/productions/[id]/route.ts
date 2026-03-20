import { auth } from "@/lib/auth";
import { db as prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

// Admin only: 制作物の削除
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  const { id } = await params;

  const production = await prisma.production.findUnique({
    where: { id },
    include: { studioClient: true },
  });

  if (!production) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.production.delete({ where: { id } });

  // 操作ログ
  await prisma.auditLog.create({
    data: {
      action: "studio_production_deleted",
      email: user.email,
      name: user.name,
      entity: "production",
      entityId: id,
      detail: `制作物削除: ${production.title}（${production.studioClient.name}）`,
    },
  });

  return NextResponse.json({ success: true });
}

// 制作物の詳細取得
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const production = await prisma.production.findUnique({
    where: { id },
    include: { studioClient: true, createdBy: { select: { name: true, email: true } } },
  });

  if (!production) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json(production);
}
