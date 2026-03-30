export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";

const CRON_SECRET = process.env.CRON_SECRET ?? "";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

// ---------------------------------------------------------------
// GET /api/cron/auto-sales-replies
// 5分ごとに実行: media@adarch.co.jp の受信メールを確認し、
// 自動営業の反響を検出 → Google Chat通知
// Headers: Authorization: Bearer {CRON_SECRET}
// ---------------------------------------------------------------
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization") ?? "";
  if (!CRON_SECRET || auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const res = await fetch(`${APP_URL}/api/auto-sales/check-replies`, {
      method: "POST",
      headers: {
        "x-api-key": process.env.GROUP_SUPPORT_API_KEY ?? "",
      },
    });

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
