import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";

const ARCHIVE_AFTER_DAYS = 30;

// POST /api/leads/auto-archive
// CALLED のまま30日以上更新がないリードを ARCHIVED に移動する。
// GROUP_SUPPORT_API_KEY で認証（launchd / cron から叩く）。
export async function POST(req: NextRequest) {
  const apiKey = req.headers.get("x-api-key");
  if (apiKey !== process.env.GROUP_SUPPORT_API_KEY) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const threshold = new Date();
  threshold.setDate(threshold.getDate() - ARCHIVE_AFTER_DAYS);

  const result = await db.lead.updateMany({
    where: {
      status: "CALLED",
      updatedAt: { lt: threshold },
      // アポ・商談化済みは対象外（念のためフィルタ）
    },
    data: { status: "ARCHIVED" },
  });

  return NextResponse.json({ archived: result.count });
}
