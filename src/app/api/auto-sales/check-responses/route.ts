import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sendChatMessage, notifyCeo } from "@/lib/google-chat";

/**
 * POST /api/auto-sales/check-responses
 * GAS cronから呼び出される反響記録API
 * Body: { jobId, from, subject, snippet }
 * Auth: x-api-key ヘッダー (GROUP_SUPPORT_API_KEY)
 */
export async function POST(req: NextRequest) {
  const apiKey = req.headers.get("x-api-key");
  if (apiKey !== process.env.GROUP_SUPPORT_API_KEY) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { jobId, from, subject, snippet } = body as {
      jobId: string;
      from: string;
      subject?: string;
      snippet?: string;
    };

    if (!jobId || !from) {
      return NextResponse.json(
        { error: "jobId and from are required" },
        { status: 400 }
      );
    }

    // ジョブを取得
    const job = await db.autoSalesJob.findUnique({
      where: { id: jobId },
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
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    // 反響を記録
    const updated = await db.autoSalesJob.update({
      where: { id: jobId },
      data: {
        hasResponse: true,
        responseFrom: from,
        responseSubject: subject ?? null,
        responseSnippet: snippet ? snippet.substring(0, 500) : null,
        respondedAt: new Date(),
      },
    });

    // Google Chat で該当パートナーに通知
    const branchId = job.target.branchId ?? job.template.branchId;
    const notificationText = [
      "\uD83D\uDD14 *自動営業 — 反響あり！*",
      "",
      `\uD83D\uDCCD *${job.target.companyName}*（${job.target.area ?? ""}${job.target.industry ? ` / ${job.target.industry}` : ""}）`,
      `\uD83D\uDCE7 返信元: ${from}`,
      `\uD83D\uDCCB 件名: ${subject ?? "(なし)"}`,
      snippet ? `\uD83D\uDCAC ${snippet.substring(0, 200)}` : "",
      "",
      "ダッシュボードで詳細を確認してください。",
    ]
      .filter(Boolean)
      .join("\n");

    // パートナーのChatスペースに通知
    const branchUsers = await db.user.findMany({
      where: { branchId, chatSpaceId: { not: null } },
      select: { chatSpaceId: true },
    });

    for (const u of branchUsers) {
      if (u.chatSpaceId) {
        await sendChatMessage(u.chatSpaceId, notificationText);
      }
    }

    // CEO通知
    await notifyCeo(
      `\uD83D\uDD14 自動営業 反響\n${job.target.companyName}（${job.target.area ?? ""}）\n${job.target.branch?.name ?? "不明"}の案件\n返信元: ${from}\n${snippet ? snippet.substring(0, 100) : ""}`
    );

    // Chat通知済みを記録
    await db.autoSalesJob.update({
      where: { id: jobId },
      data: { chatNotifiedAt: new Date() },
    });

    return NextResponse.json({
      success: true,
      jobId: updated.id,
      companyName: job.target.companyName,
      hasResponse: true,
    });
  } catch (err) {
    console.error("[check-responses] エラー:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
