// ==============================================================
// POST /api/group-support/webhook/contact — コンタクト履歴受信
// ==============================================================

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyWebhookApiKey } from "@/lib/webhook-auth";

export async function POST(req: NextRequest) {
  const authError = verifyWebhookApiKey(req);
  if (authError) return authError;

  try {
    const body = await req.json();
    const { chatSpaceId, type, content, actorName, weekId } = body;

    if (!chatSpaceId || !type || !content) {
      return NextResponse.json(
        { error: "Missing required fields: chatSpaceId, type, content" },
        { status: 400 }
      );
    }

    // type バリデーション
    const validTypes = [
      "FOLLOW_UP",
      "CEO_COMMENT",
      "MANUAL_NOTE",
    ] as const;
    if (!validTypes.includes(type)) {
      return NextResponse.json(
        { error: `Invalid type. Must be one of: ${validTypes.join(", ")}` },
        { status: 400 }
      );
    }

    const company = await db.groupCompany.findUnique({
      where: { chatSpaceId },
    });

    if (!company) {
      return NextResponse.json(
        { error: "Unknown chatSpaceId" },
        { status: 404 }
      );
    }

    const record = await db.contactHistory.create({
      data: {
        groupCompanyId: company.id,
        type,
        content,
        actorName: actorName ?? null,
        weekId: weekId ?? null,
      },
    });

    return NextResponse.json({ ok: true, id: record.id });
  } catch (e) {
    console.error("[group-support/webhook/contact] Error:", e);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
