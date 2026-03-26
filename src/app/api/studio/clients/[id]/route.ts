import { auth } from "@/lib/auth";
import { db as prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { id } = await params;

  // Verify the client belongs to the user's branch (ADMIN can access all)
  const existingClient = await prisma.studioClient.findUnique({ where: { id } });
  if (!existingClient) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (user.role !== "ADMIN" && existingClient.branchId !== user.branchId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();

  const updated = await prisma.studioClient.update({
    where: { id },
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
      status: body.status || undefined,
      notes: body.notes || null,
    },
  });

  await prisma.auditLog.create({
    data: {
      action: "studio_client_updated",
      email: user.email,
      name: user.name,
      entity: "studio_client",
      entityId: id,
      detail: `Studioクライアント更新: ${body.name}`,
    },
  });

  return NextResponse.json(updated);
}
