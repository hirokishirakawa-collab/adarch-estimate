import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

// プレイブック更新（ADMIN のみ）
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
  if (user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  const existing = await db.salesPlaybook.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await req.json();
  const updateData: Record<string, unknown> = {};

  if (body.label !== undefined) updateData.label = body.label;
  if (body.targetType !== undefined) updateData.targetType = body.targetType;
  if (body.industry !== undefined) updateData.industry = body.industry || null;
  if (body.serviceTypes !== undefined) updateData.serviceTypes = body.serviceTypes;
  if (body.pitchTemplate !== undefined) updateData.pitchTemplate = body.pitchTemplate;
  if (body.approach !== undefined) updateData.approach = body.approach || null;
  if (body.isActive !== undefined) updateData.isActive = body.isActive;

  const updated = await db.salesPlaybook.update({
    where: { id },
    data: updateData,
  });

  return NextResponse.json(updated);
}

// プレイブック無効化（ソフトデリート、ADMIN のみ）
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
  if (user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  const existing = await db.salesPlaybook.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await db.salesPlaybook.update({
    where: { id },
    data: { isActive: false },
  });

  return NextResponse.json({ success: true });
}
