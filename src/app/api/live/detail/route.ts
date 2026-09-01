export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getLiveDetail, LIVE_DETAIL_KINDS, type LiveDetailKind } from "@/lib/live/detail";

export type { LiveDetail } from "@/lib/live/detail";

// ---------------------------------------------------------------
// GET /api/live/detail?kind=deal|move|sent|tender&id=xxx
//   ライブフィードの1行を押したときに開くパネルの中身（本体は lib/live/detail.ts）。
//   ⚠️ 金額は返さない。ライブは金額を出さない面（2026-08-24 代表決定）。
// ---------------------------------------------------------------
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  // フィード本体と同じ線引き。全社名が出る面なのでデモ・停止中には返さない
  if (session.user.email === "demo@adarch.co.jp" || session.user.isActive === false) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const kind = req.nextUrl.searchParams.get("kind") ?? "";
  const id = req.nextUrl.searchParams.get("id") ?? "";
  if (!id || !LIVE_DETAIL_KINDS.includes(kind as LiveDetailKind)) {
    return NextResponse.json({ error: "Bad Request" }, { status: 400 });
  }

  try {
    const detail = await getLiveDetail(kind, id);
    if (!detail) return NextResponse.json({ error: "Not Found" }, { status: 404 });
    return NextResponse.json(detail);
  } catch (e) {
    console.error("[live/detail]", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
