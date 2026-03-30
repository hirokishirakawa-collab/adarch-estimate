import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sendChatMessage, notifyCeo } from "@/lib/google-chat";

/**
 * POST /api/auto-sales/check-responses
 * GAS cronから呼び出される反響記録API
 * Body: { from, subject, snippet, messageId }
 * fromのドメインから送信済みジョブを自動マッチング
 * Auth: x-api-key ヘッダー (GROUP_SUPPORT_API_KEY)
 */
export async function POST(req: NextRequest) {
  const apiKey = req.headers.get("x-api-key");
  if (apiKey !== process.env.GROUP_SUPPORT_API_KEY) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { from, subject, snippet, messageId } = body as {
      from: string;
      subject?: string;
      snippet?: string;
      messageId?: string;
    };

    if (!from) {
      return NextResponse.json({ error: "from is required" }, { status: 400 });
    }

    // 既に処理済みのメールIDはスキップ
    if (messageId) {
      const existing = await db.autoSalesJob.findFirst({
        where: { responseEmailId: messageId },
      });
      if (existing) {
        return NextResponse.json({ matched: false, reason: "already processed" });
      }
    }

    // fromからドメインを抽出（"Name <email@domain.com>" 形式に対応）
    const emailMatch = from.match(/<([^>]+)>/) || from.match(/([^\s]+@[^\s]+)/);
    const email = emailMatch ? emailMatch[1] : from;
    const domain = email.split("@")[1]?.toLowerCase();

    if (!domain) {
      return NextResponse.json({ matched: false, reason: "invalid from" });
    }

    // ドメインが一致する送信済みジョブを検索（最新のCOMPLETEDジョブ）
    const job = await db.autoSalesJob.findFirst({
      where: {
        status: "COMPLETED",
        hasResponse: false,
        target: {
          url: { contains: domain },
        },
      },
      orderBy: { completedAt: "desc" },
      include: {
        target: {
          select: {
            companyName: true,
            area: true,
            industry: true,
            branch: { select: { name: true } },
            branchId: true,
          },
        },
        template: {
          select: { branchId: true },
        },
      },
    });

    if (!job) {
      return NextResponse.json({ matched: false, reason: "no matching job" });
    }

    // 反響を記録
    await db.autoSalesJob.update({
      where: { id: job.id },
      data: {
        hasResponse: true,
        responseFrom: from,
        responseSubject: subject ?? null,
        responseSnippet: snippet ? snippet.substring(0, 500) : null,
        responseEmailId: messageId ?? null,
        respondedAt: new Date(),
      },
    });

    // Google Chat で該当パートナーに通知
    const branchId = job.target.branchId ?? job.template.branchId;
    const notificationText = [
      "🔔 *自動営業 — 反響あり！*",
      "",
      `📍 *${job.target.companyName}*（${job.target.area ?? ""}${job.target.industry ? ` / ${job.target.industry}` : ""}）`,
      `📧 返信元: ${from}`,
      `📋 件名: ${subject ?? "(なし)"}`,
      snippet ? `💬 ${snippet.substring(0, 200)}` : "",
      "",
      "ダッシュボードで詳細を確認してください。",
    ].filter(Boolean).join("\n");

    const branchUsers = await db.user.findMany({
      where: { branchId, chatSpaceId: { not: null } },
      select: { chatSpaceId: true },
    });

    for (const u of branchUsers) {
      if (u.chatSpaceId) {
        await sendChatMessage(u.chatSpaceId, notificationText);
      }
    }

    await notifyCeo(
      `🔔 自動営業 反響\n${job.target.companyName}（${job.target.area ?? ""}）\n${job.target.branch?.name ?? "不明"}の案件\n返信元: ${from}\n${snippet ? snippet.substring(0, 100) : ""}`
    );

    await db.autoSalesJob.update({
      where: { id: job.id },
      data: { chatNotifiedAt: new Date() },
    });

    return NextResponse.json({
      matched: true,
      jobId: job.id,
      companyName: job.target.companyName,
    });
  } catch (err) {
    console.error("[check-responses] エラー:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
