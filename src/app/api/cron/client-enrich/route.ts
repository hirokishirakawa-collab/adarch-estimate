import { NextRequest, NextResponse } from "next/server";
import { runClientEnrich } from "@/lib/clients/enrich";
import { importDriveWorks } from "@/lib/clients/drive-import";

export const runtime = "nodejs";
export const maxDuration = 300;

const CRON_SECRET = process.env.CRON_SECRET ?? "";

/**
 * GET /api/cron/client-enrich?limit=40
 * Headers: Authorization: Bearer {CRON_SECRET}
 *
 * 取引先マップ（/dashboard/clients）の日次処理。
 *   1) Drive の実績フォルダ（portfolio_items）に増えた案件フォルダを取り込む
 *   2) 未確認の顧客を limit 件だけ補完する（口コミ・写真・社内構成）
 * 登録直後の補完は enqueue.ts が行い、取りこぼしをここで拾う。
 */
export async function GET(req: NextRequest) {
  const authz = req.headers.get("authorization") ?? "";
  if (!CRON_SECRET || authz !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const limit = Math.min(Number(req.nextUrl.searchParams.get("limit") ?? 40) || 40, 120);
  try {
    const drive = await importDriveWorks();
    console.log("[client-enrich] drive", JSON.stringify({ ...drive, createdNames: drive.createdNames.slice(0, 20) }));
    const stats = await runClientEnrich({ limit });
    console.log("[client-enrich]", JSON.stringify(stats));
    return NextResponse.json({ ok: true, drive: { ...drive, createdNames: drive.createdNames.slice(0, 50) }, stats });
  } catch (e) {
    console.error("[client-enrich] 失敗", e);
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
