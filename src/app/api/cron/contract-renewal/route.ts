export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { notifyCeo } from "@/lib/google-chat";

const CRON_SECRET = process.env.CRON_SECRET ?? "";

// ---------------------------------------------------------------
// GET /api/cron/contract-renewal
// 加盟契約の更新期限監視（高澤#021の教訓の仕組み化）
// Headers: Authorization: Bearer {CRON_SECRET}
//
// 背景: 契約は自動更新・「更新しない」通知の期限は満了3カ月前。
// 高澤#021 はこの期限を徒過して 2028/6 まで自動更新が確定した。
// 二度と起こさないため、満了日から逆算して段階アラートを出す:
//   150日前 🟡 更新判断の開始（継続/条件変更/更新しないを決める）
//   120日前 🔴 通知期限（満了90日前）まで残り1カ月
//    97日前 🚨 通知期限まで残り1週間 — 最終警告
// contractRenewed=true（次期更新確認済み）は対象外。
// 同一ステージは一度だけ通知（renewalAlertStage で管理）。
// ---------------------------------------------------------------

const DAY = 24 * 60 * 60 * 1000;

function evaluateStage(daysLeft: number): { stage: string; label: string } | null {
  if (daysLeft <= 97) {
    return { stage: "FINAL_WARNING", label: "🚨 更新しない場合の通知期限（満了3カ月前）まで残り1週間以内 — 最終警告" };
  }
  if (daysLeft <= 120) {
    return { stage: "NOTICE_SOON", label: "🔴 通知期限（満了3カ月前）まで残り1カ月 — 更新可否を確定させる" };
  }
  if (daysLeft <= 150) {
    return { stage: "REVIEW_START", label: "🟡 満了150日前 — 更新判断（継続/条件変更/更新しない）の開始時期" };
  }
  return null;
}

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization") ?? "";
  if (!CRON_SECRET || auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const now = Date.now();
    const companies = await db.groupCompany.findMany({
      where: {
        isActive: true,
        contractRenewed: false,
        contractEndDate: { not: null },
      },
      select: {
        id: true,
        name: true,
        ownerName: true,
        contractEndDate: true,
        renewalAlertStage: true,
      },
    });

    const alerts: { id: string; stage: string; line: string }[] = [];

    for (const c of companies) {
      const daysLeft = Math.floor((c.contractEndDate!.getTime() - now) / DAY);
      const rule = evaluateStage(daysLeft);
      if (!rule) continue;
      if (c.renewalAlertStage === rule.stage) continue;

      const endDate = c.contractEndDate!.toLocaleDateString("ja-JP", { timeZone: "Asia/Tokyo" });
      alerts.push({
        id: c.id,
        stage: rule.stage,
        line: `・${c.name}（${c.ownerName}）: 満了 ${endDate}（残り${daysLeft}日）\n  ${rule.label}`,
      });
    }

    if (alerts.length > 0) {
      await notifyCeo(
        [
          `📜 加盟契約 更新期限アラート（${alerts.length}件）`,
          "",
          ...alerts.map((a) => a.line),
          "",
          "更新方針が確定したら OS の契約管理で「次期更新確認済み」にするとアラートは止まります。",
        ].join("\n")
      );
      for (const a of alerts) {
        await db.groupCompany.update({
          where: { id: a.id },
          data: { renewalAlertStage: a.stage },
        });
      }
    }

    return NextResponse.json({ checked: companies.length, alerted: alerts.length });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("contract-renewal error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
