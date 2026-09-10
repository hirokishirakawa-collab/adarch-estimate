// GET /api/ad-buyers — 広告出稿者ファインダーの一覧（媒体タグの付いたリード）
//   pref / city / platform / industry / from / to / sort / dir / mine / limit
//   閲覧範囲はリード管理と同じ＝グループ全社分。金額は持たない
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { loadViewer } from "@/lib/mcp/os-read-tools";
import { listAdBuyers, parseSort } from "@/lib/ad-buyers/list";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const viewer = await loadViewer(session.user.email);
  if (!viewer) return NextResponse.json({ error: "このアカウントは利用できません" }, { status: 403 });

  const sp = req.nextUrl.searchParams;
  const limitRaw = parseInt(sp.get("limit") ?? "", 10);
  const items = await listAdBuyers(viewer, {
    prefecture: sp.get("pref") ?? "",
    city: sp.get("city") ?? "",
    platform: sp.get("platform") ?? "",
    industry: sp.get("industry") ?? "",
    from: sp.get("from") ?? "",
    to: sp.get("to") ?? "",
    mine: sp.get("mine") === "1",
    sort: parseSort(sp.get("sort")),
    dir: sp.get("dir") === "asc" ? "asc" : "desc",
    limit: Number.isFinite(limitRaw) ? limitRaw : undefined,
  });
  return NextResponse.json({ items, isAdmin: viewer.role === "ADMIN" });
}
