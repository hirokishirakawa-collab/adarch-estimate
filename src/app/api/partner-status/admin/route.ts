// ==============================================================
// GET  /api/partner-status/admin — 全パートナーの月次ステータス一覧（ADMIN専用）
// POST /api/partner-status/admin — ステータス強制変更（ADMIN専用）
// ==============================================================

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

// GET: 指定月の全パートナーステータスを返す。連続非稼働月数を算出して付与。
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await db.user.findUnique({
      where: { email: session.user.email },
    });
    if (!user || user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const yearParam = req.nextUrl.searchParams.get("year");
    const monthParam = req.nextUrl.searchParams.get("month");

    const now = new Date();
    const year = yearParam ? parseInt(yearParam, 10) : now.getFullYear();
    const month = monthParam ? parseInt(monthParam, 10) : now.getMonth() + 1;

    if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
      return NextResponse.json(
        { error: "Invalid year or month" },
        { status: 400 }
      );
    }

    // 指定月のステータスレコードを取得
    const statuses = await db.partnerStatus.findMany({
      where: { year, month },
      include: {
        groupCompany: { select: { id: true, name: true, ownerName: true } },
      },
      orderBy: { groupCompany: { name: "asc" } },
    });

    // 連続非稼働月数を算出（指定月から遡って ACTIVE でない月を数える）
    const results = await Promise.all(
      statuses.map(async (s) => {
        let consecutiveInactive = 0;

        // 最大12ヶ月遡ってチェック
        for (let i = 1; i <= 12; i++) {
          let checkMonth = month - i;
          let checkYear = year;
          if (checkMonth <= 0) {
            checkMonth += 12;
            checkYear -= 1;
          }

          const prev = await db.partnerStatus.findUnique({
            where: {
              groupCompanyId_year_month: {
                groupCompanyId: s.groupCompanyId,
                year: checkYear,
                month: checkMonth,
              },
            },
          });

          // ACTIVE なら連続途切れ、レコード無しも途切れとみなす
          if (!prev || prev.status === "ACTIVE") {
            break;
          }
          consecutiveInactive++;
        }

        return {
          ...s,
          consecutiveInactiveMonths: consecutiveInactive,
        };
      })
    );

    return NextResponse.json({ year, month, statuses: results });
  } catch (e) {
    console.error("[partner-status/admin GET] Error:", e);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST: ADMINがパートナーのステータスを強制変更する
export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await db.user.findUnique({
      where: { email: session.user.email },
    });
    if (!user || user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = (await req.json()) as {
      groupCompanyId: string;
      status: string;
      reason: string;
    };

    if (!body.groupCompanyId || !body.status || !body.reason) {
      return NextResponse.json(
        { error: "groupCompanyId, status, and reason are required" },
        { status: 400 }
      );
    }

    const validStatuses = [
      "ACTIVE",
      "INACTIVE",
      "FORCED_INACTIVE",
      "NOT_SELECTED",
    ];
    if (!validStatuses.includes(body.status)) {
      return NextResponse.json(
        { error: `status must be one of: ${validStatuses.join(", ")}` },
        { status: 400 }
      );
    }

    // 対象企業の存在チェック
    const company = await db.groupCompany.findUnique({
      where: { id: body.groupCompanyId },
    });
    if (!company) {
      return NextResponse.json(
        { error: "Group company not found" },
        { status: 404 }
      );
    }

    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;

    // 現在月のレコードを取得（なければ作成）
    const existing = await db.partnerStatus.upsert({
      where: {
        groupCompanyId_year_month: {
          groupCompanyId: body.groupCompanyId,
          year,
          month,
        },
      },
      create: {
        groupCompanyId: body.groupCompanyId,
        year,
        month,
        status: "NOT_SELECTED",
      },
      update: {},
    });

    const fromStatus = existing.status;
    const toStatus = body.status as
      | "ACTIVE"
      | "INACTIVE"
      | "FORCED_INACTIVE"
      | "NOT_SELECTED";

    // ステータス更新
    const updated = await db.partnerStatus.update({
      where: { id: existing.id },
      data: {
        status: toStatus,
        selectedAt: now,
      },
    });

    // 変更ログを記録
    await db.partnerStatusLog.create({
      data: {
        groupCompanyId: body.groupCompanyId,
        fromStatus,
        toStatus,
        reason: body.reason,
        changedBy: "ADMIN",
      },
    });

    return NextResponse.json({ status: updated });
  } catch (e) {
    console.error("[partner-status/admin POST] Error:", e);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
