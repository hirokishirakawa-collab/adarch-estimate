import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export const runtime = "nodejs";

// PUT /api/proposals/:id — Update proposal content
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await db.user.findUnique({ where: { email: session.user.email } });
  if (!user) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  // Non-ADMIN users can only edit their own proposals
  if (user.role !== "ADMIN") {
    const proposal = await db.proposal.findUnique({ where: { id } });
    if (!proposal || proposal.userId !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  try {
    const body = await req.json();
    const { companyName, content } = body;

    if (!companyName || !content) {
      return NextResponse.json({ error: "companyName and content are required" }, { status: 400 });
    }

    const updated = await db.proposal.update({
      where: { id },
      data: { companyName, content },
    });

    return NextResponse.json({ ok: true, proposal: updated });
  } catch (e) {
    console.error("[PUT /api/proposals/:id]", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// DELETE /api/proposals/:id — ADMIN can delete any, others can delete own
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await db.user.findUnique({ where: { email: session.user.email } });
  if (!user) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  // Non-ADMIN users can only delete their own proposals
  if (user.role !== "ADMIN") {
    const proposal = await db.proposal.findUnique({ where: { id } });
    if (!proposal || proposal.userId !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  try {
    await db.proposal.delete({ where: { id } }).catch(() => null);

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[DELETE /api/proposals/:id]", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
