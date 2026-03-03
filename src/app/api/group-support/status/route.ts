// ==============================================================
// GET /api/group-support/status — 提出状況照会（GASフォロー用）
// ==============================================================

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyWebhookApiKey } from "@/lib/webhook-auth";
import { getWeekId } from "@/lib/constants/group-support";

export async function GET(req: NextRequest) {
  const authError = verifyWebhookApiKey(req);
  if (authError) return authError;

  try {
    const weekId =
      req.nextUrl.searchParams.get("weekId") ?? getWeekId();

    // アクティブな全企業を取得
    const companies = await db.groupCompany.findMany({
      where: { isActive: true },
      select: { id: true, chatSpaceId: true, name: true },
    });

    // 今週提出済みの企業IDリスト
    const submissions = await db.weeklySubmission.findMany({
      where: { weekId },
      select: { groupCompanyId: true },
    });
    const submittedIds = new Set(submissions.map((s) => s.groupCompanyId));

    const submitted = companies
      .filter((c) => submittedIds.has(c.id))
      .map((c) => ({ chatSpaceId: c.chatSpaceId, name: c.name }));

    const notSubmitted = companies
      .filter((c) => !submittedIds.has(c.id))
      .map((c) => ({ chatSpaceId: c.chatSpaceId, name: c.name }));

    return NextResponse.json({
      weekId,
      total: companies.length,
      submittedCount: submitted.length,
      notSubmittedCount: notSubmitted.length,
      submitted,
      notSubmitted,
    });
  } catch (e) {
    console.error("[group-support/status] Error:", e);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
