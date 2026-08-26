import { NextRequest, NextResponse } from "next/server";
import { runClientEnrich } from "@/lib/clients/enrich";

export const runtime = "nodejs";
export const maxDuration = 300;

const CRON_SECRET = process.env.CRON_SECRET ?? "";

/**
 * GET /api/cron/client-enrich?limit=40
 * Headers: Authorization: Bearer {CRON_SECRET}
 *
 * 取引先マップ（/dashboard/clients）の補完。未確認の顧客を limit 件だけ回す。
 * 新しく登録された顧客は次回の実行で拾われる（登録時に同期で叩かない）。
 */
export async function GET(req: NextRequest) {
  const authz = req.headers.get("authorization") ?? "";
  if (!CRON_SECRET || authz !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const limit = Math.min(Number(req.nextUrl.searchParams.get("limit") ?? 40) || 40, 120);
  try {
    const stats = await runClientEnrich({ limit });
    console.log("[client-enrich]", JSON.stringify(stats));
    return NextResponse.json({ ok: true, stats });
  } catch (e) {
    console.error("[client-enrich] 失敗", e);
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
