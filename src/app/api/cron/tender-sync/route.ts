import { NextRequest, NextResponse } from "next/server";
import { runTenderSync, DEFAULT_SINCE_DAYS } from "@/lib/tender/sync";

export const runtime = "nodejs";
export const maxDuration = 300;

const CRON_SECRET = process.env.CRON_SECRET ?? "";

/**
 * GET /api/cron/tender-sync?days=14
 * Headers: Authorization: Bearer {CRON_SECRET}
 *
 * 官公需情報ポータル（中小企業庁）から、件名が広告系の入札公告を取り込み、
 * グループが受注できる仕事かを判定する。
 * 入札ファインダー（/dashboard/tender-finder）はこの結果だけを読む。
 *
 * days は初回の遡り取り込み用。判定は1回120件までなので、
 * 大きい days を指定したときは pending が 0 になるまで繰り返し叩くこと。
 */
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization") ?? "";
  if (!CRON_SECRET || auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const raw = Number(req.nextUrl.searchParams.get("days"));
  const days = Number.isFinite(raw) && raw > 0 ? Math.min(raw, 365) : DEFAULT_SINCE_DAYS;

  try {
    const stats = await runTenderSync(days);
    console.log("[tender-sync]", JSON.stringify(stats));
    return NextResponse.json({ ok: true, days, stats });
  } catch (e) {
    console.error("[tender-sync] 失敗", e);
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
