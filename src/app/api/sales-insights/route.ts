// ==============================================================
// /api/sales-insights — 営業インサイト共有 API
// POST: ログインユーザーが分析結果をアップロード（セッション認証）
// GET:  ダッシュボード用データ取得（セッション認証）
// ==============================================================

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

// ---- POST: 分析結果アップロード ----
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const {
      period,
      totalSent,
      totalReplied,
      insights,
      topResponses,
      memo,
      authorName,
    } = body;

    if (!period) {
      return NextResponse.json(
        { error: "period は必須です（例: 2026-03）" },
        { status: 400 }
      );
    }

    // ログインユーザーからGroupCompanyを特定
    const user = await db.user.findUnique({
      where: { email: session.user.email },
      select: {
        id: true,
        name: true,
        groupCompanyId: true,
        groupCompany: { select: { id: true, name: true } },
      },
    });

    if (!user?.groupCompanyId || !user.groupCompany) {
      return NextResponse.json(
        { error: "グループ企業に紐づいていません。本部に連絡してください。" },
        { status: 400 }
      );
    }

    const displayName = authorName || user.name || session.user.name || "不明";

    const insight = await db.salesInsight.create({
      data: {
        groupCompanyId: user.groupCompany.id,
        authorName: displayName,
        period,
        totalSent: totalSent ?? 0,
        totalReplied: totalReplied ?? 0,
        insights: insights ?? [],
        topResponses: topResponses ?? [],
        memo: memo ?? null,
      },
    });

    logAudit({
      action: "sales_insight_uploaded",
      email: session.user.email,
      name: displayName,
      entity: "sales_insight",
      entityId: insight.id,
      detail: `${user.groupCompany.name} / ${period} / sent=${totalSent ?? 0} replied=${totalReplied ?? 0}`,
    });

    return NextResponse.json({
      ok: true,
      id: insight.id,
      companyName: user.groupCompany.name,
      period,
    });
  } catch (e) {
    console.error("[sales-insights] POST error:", e);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// ---- GET: ダッシュボード用データ取得 ----
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const period = searchParams.get("period");
    const limit = Math.min(parseInt(searchParams.get("limit") ?? "50"), 200);

    const where = period ? { period } : {};

    const insights = await db.salesInsight.findMany({
      where,
      include: {
        groupCompany: {
          select: { name: true, ownerName: true, emoji: true },
        },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    const totals = await db.salesInsight.aggregate({
      where,
      _sum: { totalSent: true, totalReplied: true },
      _count: true,
    });

    // ── 月次集計（createdAt 基準）と直近3ヶ月のローリング返信率 ──
    // period 文字列は表記が不揃い（W表記/月表記混在）のため、実時刻 createdAt で月バケットに正規化する。
    // 返信率は月次の小さな母数だと0〜1件で乱高下するため、％は直近3ヶ月のローリングのみで出す。
    const statRows = await db.salesInsight.findMany({
      select: { createdAt: true, totalSent: true, totalReplied: true },
    });
    const ym = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const monthMap = new Map<string, { sent: number; replied: number }>();
    for (const r of statRows) {
      const key = ym(new Date(r.createdAt));
      const cur = monthMap.get(key) ?? { sent: 0, replied: 0 };
      cur.sent += r.totalSent;
      cur.replied += r.totalReplied;
      monthMap.set(key, cur);
    }
    // 直近6ヶ月（データの無い月も0で埋める）を新しい順で
    const now = new Date();
    const monthly: { month: string; sent: number; replied: number }[] = [];
    for (let i = 0; i < 6; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = ym(d);
      const v = monthMap.get(key) ?? { sent: 0, replied: 0 };
      monthly.push({ month: key, sent: v.sent, replied: v.replied });
    }
    // 直近3ヶ月のローリング返信率（母数を十分に取るため）
    const rollingStart = new Date(now.getFullYear(), now.getMonth() - 2, 1);
    let rSent = 0;
    let rReplied = 0;
    for (const r of statRows) {
      if (new Date(r.createdAt) >= rollingStart) {
        rSent += r.totalSent;
        rReplied += r.totalReplied;
      }
    }
    const rollingReplyRate = rSent > 0 ? Math.round((rReplied / rSent) * 100) : 0;

    return NextResponse.json({
      insights,
      summary: {
        totalReports: totals._count,
        totalSent: totals._sum.totalSent ?? 0,
        totalReplied: totals._sum.totalReplied ?? 0,
        replyRate:
          totals._sum.totalSent && totals._sum.totalSent > 0
            ? Math.round(
                ((totals._sum.totalReplied ?? 0) /
                  totals._sum.totalSent) *
                  100
              )
            : 0,
        rollingReplyRate,
        rollingSent: rSent,
        rollingReplied: rReplied,
        monthly,
      },
    });
  } catch (e) {
    console.error("[sales-insights] GET error:", e);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
