import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sendChatMessage } from "@/lib/google-chat";

const NO_REPLY_DAYS = 3;

/**
 * POST /api/auto-sales/finalize-no-reply
 * cronで1日1回実行。送信から3日経過 + 返信なしのジョブを「未返信確定」にし、
 * SalesApproach に自動投稿する。
 * Auth: x-api-key ヘッダー (GROUP_SUPPORT_API_KEY)
 */
export async function POST(req: NextRequest) {
  const apiKey = req.headers.get("x-api-key");
  if (apiKey !== process.env.GROUP_SUPPORT_API_KEY) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - NO_REPLY_DAYS);

    // 送信完了から3日以上経過 + 返信なし + 未確定のジョブを取得
    const jobs = await db.autoSalesJob.findMany({
      where: {
        status: "COMPLETED",
        hasResponse: false,
        noReplyConfirmedAt: null,
        completedAt: { lte: cutoff },
      },
      include: {
        target: {
          select: {
            companyName: true,
            industry: true,
            area: true,
            branchId: true,
          },
        },
        template: {
          select: {
            body: true,
            branchId: true,
          },
        },
      },
    });

    if (jobs.length === 0) {
      return NextResponse.json({ confirmed: 0, approachesCreated: 0 });
    }

    let confirmed = 0;
    let approachesCreated = 0;

    for (const job of jobs) {
      // 未返信確定に更新
      await db.autoSalesJob.update({
        where: { id: job.id },
        data: { noReplyConfirmedAt: new Date() },
      });
      confirmed++;

      // SalesApproach に自動投稿
      const branchId = job.target.branchId ?? job.template.branchId;

      // 拠点の最初のユーザー（groupCompanyId取得も兼ねる）
      const author = await db.user.findFirst({
        where: { branchId, groupCompanyId: { not: null } },
        select: { id: true, groupCompanyId: true },
        orderBy: { createdAt: "asc" },
      });
      if (!author?.groupCompanyId) continue;
      const groupCompanyId = author.groupCompanyId;

      await db.salesApproach.create({
        data: {
          groupCompanyId,
          authorId: author.id,
          industry: job.target.industry ?? "その他",
          targetDesc: `${job.target.companyName}（${job.target.area ?? ""}）— 自動営業`,
          method: "FORM",
          messageBody: job.template.body.substring(0, 5000),
          result: "NO_REPLY",
          learnings: `自動営業フォーム送信 → ${NO_REPLY_DAYS}日間返信なし（自動記録）`,
        },
      });

      // approachPostedAt を記録
      await db.autoSalesJob.update({
        where: { id: job.id },
        data: { approachPostedAt: new Date() },
      });

      approachesCreated++;
    }

    console.log(`[finalize-no-reply] ${confirmed}件を未返信確定, ${approachesCreated}件をアプローチ事例に投稿`);

    return NextResponse.json({ confirmed, approachesCreated });
  } catch (err) {
    console.error("[finalize-no-reply] エラー:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
