export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sendChatMessage } from "@/lib/google-chat";

const CRON_SECRET = process.env.CRON_SECRET ?? "";
const NOTIFY_SPACE = "AAQAxSqou_g";

// ---------------------------------------------------------------
// GET /api/cron/partner-status
// 毎月15日に実行: 当月の未選択・報告ゼロを自動休止に切替
// 毎月1日にも実行: 当月レコードの自動作成
// Headers: Authorization: Bearer {CRON_SECRET}
// Query: ?action=check (15日) or ?action=init (1日) — デフォルトは check
// ---------------------------------------------------------------
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization") ?? "";
  if (!CRON_SECRET || auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;

    const url = new URL(req.url);
    const action = url.searchParams.get("action") ?? "check";

    // ── action=init: 毎月1日に当月レコードを全社分作成 ──
    if (action === "init") {
      const companies = await db.groupCompany.findMany({
        where: { isActive: true },
        select: { id: true },
      });

      let created = 0;
      for (const company of companies) {
        const existing = await db.partnerStatus.findUnique({
          where: {
            groupCompanyId_year_month: {
              groupCompanyId: company.id,
              year: currentYear,
              month: currentMonth,
            },
          },
        });
        if (!existing) {
          await db.partnerStatus.create({
            data: {
              groupCompanyId: company.id,
              year: currentYear,
              month: currentMonth,
              status: "NOT_SELECTED",
            },
          });
          created++;
        }
      }

      await sendChatMessage(
        NOTIFY_SPACE,
        `📊 パートナー稼働ステータス：${currentYear}年${currentMonth}月のレコードを${created}社分作成しました。\n全パートナーにステータス選択を促してください。`
      ).catch(() => {});

      return NextResponse.json({ ok: true, action: "init", created });
    }

    // ── action=check: 毎月15日にのみ未選択・報告ゼロを自動休止 ──
    // 15日以外に実行された場合はスキップ（複数回実行による誤休止を防止）
    if (now.getDate() !== 15) {
      return NextResponse.json({
        ok: true,
        action: "check",
        skipped: true,
        reason: `${now.getDate()}日: 15日以外のためスキップ`,
      });
    }

    const companies = await db.groupCompany.findMany({
      where: { isActive: true },
      select: { id: true, name: true, ownerName: true },
    });

    const forcedInactive: string[] = [];
    const notSelectedInactive: string[] = [];

    for (const company of companies) {
      const currentStatus = await db.partnerStatus.findUnique({
        where: {
          groupCompanyId_year_month: {
            groupCompanyId: company.id,
            year: currentYear,
            month: currentMonth,
          },
        },
      });

      // レコードなし or NOT_SELECTED → FORCED_INACTIVE
      if (!currentStatus || currentStatus.status === "NOT_SELECTED") {
        if (currentStatus) {
          await db.partnerStatus.update({
            where: { id: currentStatus.id },
            data: { status: "FORCED_INACTIVE" },
          });
        } else {
          await db.partnerStatus.create({
            data: {
              groupCompanyId: company.id,
              year: currentYear,
              month: currentMonth,
              status: "FORCED_INACTIVE",
            },
          });
        }

        await db.partnerStatusLog.create({
          data: {
            groupCompanyId: company.id,
            fromStatus: "NOT_SELECTED",
            toStatus: "FORCED_INACTIVE",
            reason: "月半ば（15日）までに未選択のため自動休止",
            changedBy: "SYSTEM",
          },
        });

        notSelectedInactive.push(`${company.name}（${company.ownerName}）`);
      }

      // ACTIVE だが reportCount=0 → FORCED_INACTIVE
      if (currentStatus?.status === "ACTIVE" && currentStatus.reportCount === 0) {
        await db.partnerStatus.update({
          where: { id: currentStatus.id },
          data: { status: "FORCED_INACTIVE" },
        });

        await db.partnerStatusLog.create({
          data: {
            groupCompanyId: company.id,
            fromStatus: "ACTIVE",
            toStatus: "FORCED_INACTIVE",
            reason: "稼働中選択だが15日時点で報告ゼロのため自動休止",
            changedBy: "SYSTEM",
          },
        });

        forcedInactive.push(`${company.name}（${company.ownerName}）`);
      }
    }

    // ── Google Chat 通知 ──
    const lines: string[] = [`📊 パートナー稼働ステータス 15日チェック（${currentYear}年${currentMonth}月）`];

    if (forcedInactive.length > 0) {
      lines.push("");
      lines.push(`⚠️ 稼働中→報告ゼロで自動休止（${forcedInactive.length}社）:`);
      forcedInactive.forEach((name) => lines.push(`  ・${name}`));
    }

    if (notSelectedInactive.length > 0) {
      lines.push("");
      lines.push(`⚠️ 未選択→自動休止（${notSelectedInactive.length}社）:`);
      notSelectedInactive.forEach((name) => lines.push(`  ・${name}`));
    }

    if (forcedInactive.length === 0 && notSelectedInactive.length === 0) {
      lines.push("");
      lines.push("✅ 全パートナー正常（自動休止対象なし）");
    }

    await sendChatMessage(NOTIFY_SPACE, lines.join("\n")).catch(() => {});

    return NextResponse.json({
      ok: true,
      action: "check",
      month: `${currentYear}-${currentMonth}`,
      forcedInactive: forcedInactive.length,
      notSelectedInactive: notSelectedInactive.length,
    });
  } catch (e) {
    console.error("[cron/partner-status] Error:", e);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
