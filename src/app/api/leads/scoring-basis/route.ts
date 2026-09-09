// ==============================================================
// GET /api/leads/scoring-basis — リード獲得AI「今日の判定基準」（画面のカード用）
//   1日1回組み立てた基準と、直近7日の要約（何本の補正が効いていたか）を返す。金額は含まない
// ==============================================================
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getTodayScoringBasis, getRecentBases } from "@/lib/leads/scoring-basis";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const [basis, recent] = await Promise.all([getTodayScoringBasis(), getRecentBases(7)]);
    return NextResponse.json({
      day: basis.day,
      computedAt: basis.computedAt,
      windowDays: basis.windowDays,
      wins: { total: basis.wins.total, byFamily: basis.wins.byFamily, closingFactors: basis.wins.closingFactors },
      outreach: { total: basis.outreach.total },
      rules: basis.rules,
      fixed: basis.fixed,
      recent: recent.map((r) => ({ day: r.day, ruleCount: r.ruleCount })),
    });
  } catch (e) {
    console.error("[scoring-basis]", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "判定基準を取得できませんでした" }, { status: 500 });
  }
}
