import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

/**
 * PATCH /api/auto-sales/jobs/[id]/response
 * 反響ステータスとメモを手動で記録
 */
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
  if (user.role !== "ADMIN" && user.role !== "MANAGER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();
  const { responseStatus, responseNote } = body as {
    responseStatus?: string;
    responseNote?: string;
  };

  // ジョブの存在確認（ADMINは全拠点、それ以外は自拠点のみ）
  const job = await db.autoSalesJob.findUnique({
    where: { id },
    include: { target: { select: { branchId: true } } },
  });
  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }
  if (user.role !== "ADMIN" && job.target.branchId !== user.branchId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // responseNote にステータスをプレフィクスとして含める
  // 形式: [STATUS] メモテキスト
  const statusPrefix = responseStatus ? `[${responseStatus}]` : "";
  const noteText = responseNote?.trim() ?? "";
  const combinedNote = statusPrefix
    ? noteText
      ? `${statusPrefix} ${noteText}`
      : statusPrefix
    : noteText || null;

  const updated = await db.autoSalesJob.update({
    where: { id },
    data: {
      hasResponse: true,
      responseNote: combinedNote,
      respondedAt: job.respondedAt ?? new Date(),
    },
  });

  return NextResponse.json({
    success: true,
    job: {
      id: updated.id,
      hasResponse: updated.hasResponse,
      responseNote: updated.responseNote,
      respondedAt: updated.respondedAt,
    },
  });
}
