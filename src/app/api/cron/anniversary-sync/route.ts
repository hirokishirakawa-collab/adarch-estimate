import { NextRequest, NextResponse } from "next/server";
import { runAnniversarySync } from "@/lib/anniversary/sync";

export const runtime = "nodejs";
export const maxDuration = 300;

const CRON_SECRET = process.env.CRON_SECRET ?? "";

/**
 * GET /api/cron/anniversary-sync
 * Headers: Authorization: Bearer {CRON_SECRET}
 *
 * リードの自社サイトから設立・創業年を集め、PR TIMES から周年発信をしている会社を拾う。
 * 周年ファインダー（/dashboard/anniversary-finder）はこの結果だけを読む。
 */
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization") ?? "";
  if (!CRON_SECRET || auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const stats = await runAnniversarySync();
    console.log("[anniversary-sync]", JSON.stringify(stats));
    return NextResponse.json({ ok: true, stats });
  } catch (e) {
    console.error("[anniversary-sync] 失敗", e);
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
