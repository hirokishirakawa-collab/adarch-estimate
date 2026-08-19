import { NextRequest, NextResponse } from "next/server";
import { runSubsidySync } from "@/lib/subsidy/sync";

export const runtime = "nodejs";
export const maxDuration = 300;

const CRON_SECRET = process.env.CRON_SECRET ?? "";

/**
 * GET /api/cron/subsidy-sync
 * Headers: Authorization: Bearer {CRON_SECRET}
 *
 * jGrants（デジタル庁）から募集中の補助金を取り込み、広告費適合度を判定する。
 * 補助金ファインダー（/dashboard/subsidy-finder）はこの結果だけを読む。
 */
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization") ?? "";
  if (!CRON_SECRET || auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const stats = await runSubsidySync();
    console.log("[subsidy-sync]", JSON.stringify(stats));
    return NextResponse.json({ ok: true, stats });
  } catch (e) {
    console.error("[subsidy-sync] 失敗", e);
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
