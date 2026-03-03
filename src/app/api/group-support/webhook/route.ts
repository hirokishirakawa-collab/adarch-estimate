// ==============================================================
// POST /api/group-support/webhook — 週次共有受信
// ==============================================================

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyWebhookApiKey } from "@/lib/webhook-auth";
import { calculateStatus, getWeekId } from "@/lib/constants/group-support";
import { logAudit } from "@/lib/audit";

export async function POST(req: NextRequest) {
  // 認証
  const authError = verifyWebhookApiKey(req);
  if (authError) return authError;

  try {
    const body = await req.json();
    const { chatSpaceId, q1, q2, q3, q4, q5 } = body;

    if (!chatSpaceId || !q1 || !q2 || !q3 || !q4 || !q5) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // 企業を chatSpaceId で特定
    const company = await db.groupCompany.findUnique({
      where: { chatSpaceId },
    });

    if (!company) {
      return NextResponse.json(
        { error: "Unknown chatSpaceId" },
        { status: 404 }
      );
    }

    const weekId = getWeekId();
    const status = calculateStatus(q1, q5);

    // 週次共有を upsert
    const submission = await db.weeklySubmission.upsert({
      where: {
        groupCompanyId_weekId: {
          groupCompanyId: company.id,
          weekId,
        },
      },
      update: { q1, q2, q3, q4, q5, status },
      create: {
        groupCompanyId: company.id,
        weekId,
        q1,
        q2,
        q3,
        q4,
        q5,
        status,
      },
    });

    // コンタクト履歴に記録
    await db.contactHistory.create({
      data: {
        groupCompanyId: company.id,
        type: "WEEKLY_SUBMISSION",
        content: `週次共有 (${weekId}): ${q1}`,
        actorName: company.ownerName,
        weekId,
      },
    });

    // 監査ログ
    logAudit({
      action: "group_weekly_submitted",
      email: "bot@group-support",
      name: company.name,
      entity: "weekly_submission",
      entityId: submission.id,
      detail: `${weekId} status=${status}`,
    });

    return NextResponse.json({
      ok: true,
      weekId,
      status,
      companyName: company.name,
    });
  } catch (e) {
    console.error("[group-support/webhook] Error:", e);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
