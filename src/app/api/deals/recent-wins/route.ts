// ==============================================================
// 直近の受注（受注のお祝い表示＝WinCelebration 用）
//   受注した拠点の人には大きく、他の代表にはOSを開いたときに小さく出す（2026-09-11 代表決定）。
//   見せる範囲はグループライブの受注表示と同じ＝拠点名・顧客名・業種。金額は返さない。
//   商談名は自拠点の受注だけ返す。デモアカウントと停止中ユーザーには返さない（/api/live/feed と同じ）。
//   受注日（closedAt）で拾う＝OS画面・スマホ・AI連携のどこで受注にしても同じように出る。
// ==============================================================

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getSessionInfo, getBranchFilter } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const WINDOW_DAYS = 3;

export async function GET() {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.email === "demo@adarch.co.jp" || session.user.isActive === false) return NextResponse.json({ wins: [] });

  const info = await getSessionInfo();
  if (!info) return NextResponse.json({ wins: [] });

  const since = new Date(Date.now() - WINDOW_DAYS * 86400000);
  const wins = await db.deal.findMany({
    where: { status: "CLOSED_WON", closedAt: { gte: since } },
    select: { id: true, title: true, closedAt: true, customer: { select: { name: true, industry: true } }, branch: { select: { name: true } } },
    orderBy: { closedAt: "desc" },
    take: 20,
  });
  if (wins.length === 0) return NextResponse.json({ wins: [] });

  // 自拠点の判定。本部(ADMIN)は拠点フィルタが全件になるため、本部の拠点（未割当なら本部拠点）で判定する
  const ownWhere = info.role === "ADMIN"
    ? { branchId: { in: [info.branchId ?? "branch_hq", info.branchId2].filter((id): id is string => !!id) } }
    : getBranchFilter(info);
  const own = await db.deal.findMany({ where: { id: { in: wins.map((w) => w.id) }, ...ownWhere }, select: { id: true } });
  const ownIds = new Set(own.map((d) => d.id));

  return NextResponse.json({
    wins: wins.map((w) => ({
      id: w.id,
      isMine: ownIds.has(w.id),
      title: ownIds.has(w.id) ? w.title : null,
      customer: w.customer.name,
      industry: w.customer.industry,
      branch: w.branch.name,
      closedAt: w.closedAt!.toISOString(),
    })),
  });
}
