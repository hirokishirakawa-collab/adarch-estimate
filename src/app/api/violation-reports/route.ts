// ==============================================================
// GET  /api/violation-reports — コンプライアンス相談一覧（ADMIN: 全件 / パートナー: 自分の相談のみ）
// POST /api/violation-reports — コンプライアンス相談の新規作成
// ==============================================================

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { sendChatMessage } from "@/lib/google-chat";

export const runtime = "nodejs";

// GET: 一覧取得
export async function GET() {
  try {
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

    if (user.role === "ADMIN") {
      // ADMIN: 全件取得
      const reports = await db.violationReport.findMany({
        include: {
          reporterCompany: {
            select: { id: true, name: true, ownerName: true },
          },
        },
        orderBy: { createdAt: "desc" },
      });
      return NextResponse.json({ reports });
    }

    // パートナー: 自分の通報のみ
    if (!user.groupCompanyId) {
      return NextResponse.json({ reports: [] });
    }

    const reports = await db.violationReport.findMany({
      where: { reporterCompanyId: user.groupCompanyId },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ reports });
  } catch (e) {
    console.error("[violation-reports GET] Error:", e);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST: コンプライアンス相談を新規作成
export async function POST(req: Request) {
  try {
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

    const body = (await req.json()) as {
      targetDescription: string;
      content: string;
      evidenceUrls?: string[];
      isAnonymous?: boolean;
    };

    if (!body.targetDescription || !body.content) {
      return NextResponse.json(
        { error: "targetDescription and content are required" },
        { status: 400 }
      );
    }

    const isAnonymous = body.isAnonymous ?? true;

    const report = await db.violationReport.create({
      data: {
        reporterCompanyId: isAnonymous ? null : user.groupCompanyId,
        isAnonymous,
        targetDescription: body.targetDescription,
        content: body.content,
        evidenceUrls: body.evidenceUrls ?? [],
        status: "PENDING",
      },
    });

    // Google Chat 通知
    const reporterLabel = isAnonymous ? "匿名" : (user.name ?? user.email ?? "不明");
    const chatText = `📋 コンプライアンス相談が届きました\n相談者: ${reporterLabel}\n対象: ${body.targetDescription.slice(0, 100)}\n内容: ${body.content.slice(0, 200)}${body.content.length > 200 ? "…" : ""}\n\nOS管理画面で確認してください。`;
    sendChatMessage("AAQAxSqou_g", chatText).catch(() => {});

    return NextResponse.json({ report }, { status: 201 });
  } catch (e) {
    console.error("[violation-reports POST] Error:", e);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
