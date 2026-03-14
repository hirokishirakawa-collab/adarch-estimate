// ==============================================================
// /api/sales-insights — 営業インサイト共有 API
// POST: Claudeの分析結果をアップロード（APIキー認証）
// GET:  ダッシュボード用データ取得（セッション認証）
// ==============================================================

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyWebhookApiKey } from "@/lib/webhook-auth";
import { logAudit } from "@/lib/audit";

// ---- POST: 分析結果アップロード ----
export async function POST(req: NextRequest) {
  const authError = verifyWebhookApiKey(req);
  if (authError) return authError;

  try {
    const body = await req.json();
    const {
      chatSpaceId,
      authorName,
      period,
      totalSent,
      totalReplied,
      insights,
      topResponses,
      memo,
    } = body;

    if (!chatSpaceId || !authorName || !period) {
      return NextResponse.json(
        { error: "chatSpaceId, authorName, period are required" },
        { status: 400 }
      );
    }

    // chatSpaceId で企業を特定
    const company = await db.groupCompany.findUnique({
      where: { chatSpaceId },
    });

    if (!company) {
      return NextResponse.json(
        { error: "Unknown chatSpaceId" },
        { status: 404 }
      );
    }

    const insight = await db.salesInsight.create({
      data: {
        groupCompanyId: company.id,
        authorName,
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
      email: "api@sales-insights",
      name: authorName,
      entity: "sales_insight",
      entityId: insight.id,
      detail: `${company.name} / ${period} / sent=${totalSent ?? 0} replied=${totalReplied ?? 0}`,
    });

    return NextResponse.json({
      ok: true,
      id: insight.id,
      companyName: company.name,
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
  try {
    const { searchParams } = new URL(req.url);
    const period = searchParams.get("period"); // optional filter
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

    // 集計: 全体のsent/replied
    const totals = await db.salesInsight.aggregate({
      where,
      _sum: { totalSent: true, totalReplied: true },
      _count: true,
    });

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
