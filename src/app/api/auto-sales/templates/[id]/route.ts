import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

// テンプレート削除（ソフトデリート: isActive=false）
export async function DELETE(
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

  const { id } = await params;

  const template = await db.autoSalesTemplate.findUnique({ where: { id } });
  if (!template) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // 自分の拠点のテンプレートか、ADMINのみ削除可能
  if (user.role !== "ADMIN" && template.branchId !== user.branchId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await db.autoSalesTemplate.update({
    where: { id },
    data: { isActive: false },
  });

  return NextResponse.json({ success: true });
}

// テンプレート更新（優先順位等）
export async function PATCH(
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

  const { id } = await params;
  const body = await req.json();

  const template = await db.autoSalesTemplate.findUnique({ where: { id } });
  if (!template) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (user.role !== "ADMIN" && template.branchId !== user.branchId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // 承認（ADMINのみ）
  const updateData: Record<string, unknown> = {};
  if (body.isApproved !== undefined && user.role === "ADMIN") {
    updateData.isApproved = body.isApproved;
    updateData.approvedAt = body.isApproved ? new Date() : null;
    updateData.approvedBy = body.isApproved ? user.id : null;
  }

  const updated = await db.autoSalesTemplate.update({
    where: { id },
    data: updateData,
  });

  return NextResponse.json(updated);
}
