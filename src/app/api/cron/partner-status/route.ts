export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sendChatMessage } from "@/lib/google-chat";

const CRON_SECRET = process.env.CRON_SECRET ?? "";
const NOTIFY_SPACE = "AAQAxSqou_g";

// ---------------------------------------------------------------
// GET /api/cron/partner-status
// 毎月1日に実行: 前月の未選択・報告ゼロを自動休止に切替 + 当月レコード作成
// Headers: Authorization: Bearer {CRON_SECRET}
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

    // 前月の年月を算出
    let prevYear = currentYear;
    let prevMonth = currentMonth - 1;
    if (prevMonth <= 0) {
      prevMonth = 12;
      prevYear -= 1;
    }

    // 全アクティブなグループ企業を取得
    const companies = await db.groupCompany.findMany({
      where: { isActive: true },
      select: { id: true, name: true, ownerName: true },
    });

    const forcedInactive: string[] = [];
    const notSelectedInactive: string[] = [];

    for (const company of companies) {
      // ── 前月のステータスを確認 ──
      const prevStatus = await db.partnerStatus.findUnique({
        where: {
          groupCompanyId_year_month: {
            groupCompanyId: company.id,
            year: prevYear,
            month: prevMonth,
          },
        },
      });

      // 前月が存在しない場合は NOT_SELECTED 扱い
      const status = prevStatus?.status ?? "NOT_SELECTED";

      // ── 未選択 → FORCED_INACTIVE に変更 ──
      if (status === "NOT_SELECTED") {
        if (prevStatus) {
          await db.partnerStatus.update({
            where: { id: prevStatus.id },
            data: { status: "FORCED_INACTIVE" },
          });
        } else {
          await db.partnerStatus.create({
            data: {
              groupCompanyId: company.id,
              year: prevYear,
              month: prevMonth,
              status: "FORCED_INACTIVE",
            },
          });
        }

        await db.partnerStatusLog.create({
          data: {
            groupCompanyId: company.id,
            fromStatus: "NOT_SELECTED",
            toStatus: "FORCED_INACTIVE",
            reason: "未選択のまま月末を迎えたため自動休止",
            changedBy: "SYSTEM",
          },
        });

        notSelectedInactive.push(`${company.name}（${company.ownerName}）`);
      }

      // ── 稼働中だが報告ゼロ → FORCED_INACTIVE に変更 ──
      if (status === "ACTIVE" && prevStatus && prevStatus.reportCount === 0) {
        await db.partnerStatus.update({
          where: { id: prevStatus.id },
          data: { status: "FORCED_INACTIVE" },
        });

        await db.partnerStatusLog.create({
          data: {
            groupCompanyId: company.id,
            fromStatus: "ACTIVE",
            toStatus: "FORCED_INACTIVE",
            reason: "稼働中選択だが報告ゼロのため自動休止",
            changedBy: "SYSTEM",
          },
        });

        forcedInactive.push(`${company.name}（${company.ownerName}）`);
      }

      // ── 当月のレコードを NOT_SELECTED で自動作成 ──
      await db.partnerStatus.upsert({
        where: {
          groupCompanyId_year_month: {
            groupCompanyId: company.id,
            year: currentYear,
            month: currentMonth,
          },
        },
        create: {
          groupCompanyId: company.id,
          year: currentYear,
          month: currentMonth,
          status: "NOT_SELECTED",
        },
        update: {},
      });
    }

    // ── Google Chat 通知 ──
    const lines: string[] = [`📊 パートナー稼働ステータス月次処理（${prevYear}年${prevMonth}月分）`];

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

    lines.push("");
    lines.push(`${currentYear}年${currentMonth}月の新規レコードを${companies.length}社分作成しました。`);

    await sendChatMessage(NOTIFY_SPACE, lines.join("\n")).catch(() => {});

    return NextResponse.json({
      ok: true,
      prevMonth: `${prevYear}-${prevMonth}`,
      forcedInactive: forcedInactive.length,
      notSelectedInactive: notSelectedInactive.length,
      newRecords: companies.length,
    });
  } catch (e) {
    console.error("[cron/partner-status] Error:", e);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
