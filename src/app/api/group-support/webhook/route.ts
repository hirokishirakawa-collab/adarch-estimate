// ==============================================================
// POST /api/group-support/webhook — 週次共有受信（旧 v1 形式・q1〜q5）
//   外部（Bot/フォーム連携）からの受け口。設問 v2（2026-09-10）以降も v1 のまま受け、
//   formVersion=1 / source=WEBHOOK で保存する。保存の中身は共通コア（saveWeeklyShare）。
// ==============================================================

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyWebhookApiKey } from "@/lib/webhook-auth";
import { saveWeeklyShare, validateWeeklyAnswers } from "@/lib/group-support/submit-weekly";

export async function POST(req: NextRequest) {
  // 認証
  const authError = verifyWebhookApiKey(req);
  if (authError) return authError;

  try {
    const body = await req.json();
    const { chatSpaceId, q1, q2, q3, q4, q5 } = body;
    const answers = { q1, q2, q3, q4, q5 };

    if (!chatSpaceId || validateWeeklyAnswers(answers)) {
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

    const r = await saveWeeklyShare({
      company,
      answers,
      source: "WEBHOOK",
      actorEmail: "bot@group-support",
    });

    return NextResponse.json({
      ok: true,
      weekId: r.weekId,
      status: r.status,
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
