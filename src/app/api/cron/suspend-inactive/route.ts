export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";

const CRON_SECRET = process.env.CRON_SECRET ?? "";

// ---------------------------------------------------------------
// GET /api/cron/suspend-inactive
// 毎月1日に実行: 前月の月次報告が未提出のユーザーを自動停止
// Headers: Authorization: Bearer {CRON_SECRET}
// ---------------------------------------------------------------
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization") ?? "";
  if (!CRON_SECRET || auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const now = new Date();
    // 前月の月初日をDateTimeで算出（スキーマがDateTime型のため）
    const targetMonth = new Date(Date.UTC(now.getFullYear(), now.getMonth() - 1, 1));

    // ADMIN以外の全アクティブユーザーを取得
    const users = await db.user.findMany({
      where: { role: { not: "ADMIN" }, isActive: true },
      select: { id: true, email: true },
    });

    const suspended: string[] = [];

    for (const user of users) {
      // 当該月の月次報告があるか
      const report = await db.revenueReport.findFirst({
        where: { createdById: user.id, targetMonth },
      });

      if (!report) {
        await db.user.update({
          where: { id: user.id },
          data: {
            isActive: false,
            suspendCount: { increment: 1 },
            suspendReason: "MONTHLY_REPORT",
          },
        });
        suspended.push(user.email);
        logAudit({
          action: "user_auto_suspended",
          email: "system",
          entity: "user",
          entityId: user.id,
          detail: `${user.email}: ${targetMonth.toISOString().slice(0, 7)}月次報告未提出により自動停止`,
        });
      }
    }

    return NextResponse.json({
      targetMonth: targetMonth.toISOString().slice(0, 7),
      checked: users.length,
      suspended: suspended.length,
      suspendedUsers: suspended,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : undefined;
    console.error("suspend-inactive error:", message, stack);
    return NextResponse.json({ error: message, stack }, { status: 500 });
  }
}
