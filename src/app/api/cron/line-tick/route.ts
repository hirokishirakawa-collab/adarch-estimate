// ==============================================================
// GET /api/cron/line-tick — ステップ配信・予約一斉配信を送る
// Auth: Bearer {CRON_SECRET}／5分ごとに叩く想定（既存 cron と同じ仕組み）
// ==============================================================

import { NextRequest, NextResponse } from "next/server";
import { runScenarioTick, runBroadcasts } from "@/lib/line/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const CRON_SECRET = process.env.CRON_SECRET ?? "";

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization") ?? "";
  if (!CRON_SECRET || auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const scenario = await runScenarioTick();
    const broadcasts = await runBroadcasts();
    return NextResponse.json({ ok: true, scenario, broadcasts });
  } catch (e) {
    console.error("[cron/line-tick]", e);
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
