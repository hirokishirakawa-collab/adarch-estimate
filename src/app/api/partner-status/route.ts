// ==============================================================
// GET  /api/partner-status — 自分の当月パートナーステータス取得
// POST /api/partner-status — ステータス選択（ACTIVE / INACTIVE）
// ==============================================================

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

// GET: 自分の当月ステータスを返す。レコード未作成なら NOT_SELECTED で自動作成。
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await db.user.findUnique({
      where: { email: session.user.email },
    });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    if (!user.groupCompanyId) {
      return NextResponse.json(
        { error: "No group company linked" },
        { status: 400 }
      );
    }

    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;

    // upsert: レコードが無ければ NOT_SELECTED で自動作成
    const status = await db.partnerStatus.upsert({
      where: {
        groupCompanyId_year_month: {
          groupCompanyId: user.groupCompanyId,
          year,
          month,
        },
      },
      create: {
        groupCompanyId: user.groupCompanyId,
        year,
        month,
        status: "NOT_SELECTED",
      },
      update: {},
      include: {
        groupCompany: { select: { name: true, ownerName: true } },
      },
    });

    return NextResponse.json({ status });
  } catch (e) {
    console.error("[partner-status GET] Error:", e);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST: パートナーがステータスを選択する（ACTIVE or INACTIVE のみ）
export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await db.user.findUnique({
      where: { email: session.user.email },
    });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    if (!user.groupCompanyId) {
      return NextResponse.json(
        { error: "No group company linked" },
        { status: 400 }
      );
    }

    const body = (await req.json()) as {
      status: string;
      note?: string;
    };

    if (!body.status || !["ACTIVE", "INACTIVE"].includes(body.status)) {
      return NextResponse.json(
        { error: "status must be ACTIVE or INACTIVE" },
        { status: 400 }
      );
    }

    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const toStatus = body.status as "ACTIVE" | "INACTIVE";

    // 現在のレコードを取得（なければ作成）
    const existing = await db.partnerStatus.upsert({
      where: {
        groupCompanyId_year_month: {
          groupCompanyId: user.groupCompanyId,
          year,
          month,
        },
      },
      create: {
        groupCompanyId: user.groupCompanyId,
        year,
        month,
        status: "NOT_SELECTED",
      },
      update: {},
    });

    const fromStatus = existing.status;

    // ステータス更新
    const updated = await db.partnerStatus.update({
      where: { id: existing.id },
      data: {
        status: toStatus,
        selectedAt: now,
        note: body.note ?? existing.note,
      },
    });

    // 変更ログを記録
    await db.partnerStatusLog.create({
      data: {
        groupCompanyId: user.groupCompanyId,
        fromStatus,
        toStatus,
        reason: "自己申告",
        changedBy: session.user.email,
      },
    });

    return NextResponse.json({ status: updated }, { status: 200 });
  } catch (e) {
    console.error("[partner-status POST] Error:", e);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
