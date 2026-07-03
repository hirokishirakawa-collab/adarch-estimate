export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { notifyCeo } from "@/lib/google-chat";

const CRON_SECRET = process.env.CRON_SECRET ?? "";

// ---------------------------------------------------------------
// GET /api/cron/franchise-sla
// 加盟パイプラインのSLA監視（1日2回、GASトリガーから実行）
// Headers: Authorization: Bearer {CRON_SECRET}
//
// 対象はインバウンドリード（source != OUTBOUND）のみ。
// 発掘リード（OUTBOUND）はNEWのまま在庫されるのが正常のため対象外。
//
// SLAルール（加盟パイプライン台帳 2026Q3 に準拠）:
//   NEW                  が24時間経過   → 🔴 初回返信期限超過
//   CONTACTED            が3日更新なし  → 🟡 リマインド期限
//   CONTACTED/INTERESTED が4日更新なし  → 🔴 電話フェーズへ移行
//   MEETING_DONE         が48時間経過   → 🔴 クロージング期限超過
//
// 通知は代表のChatのみ。リード本人への自動送信は行わない（自動追いかけ禁止）。
// ---------------------------------------------------------------

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

type SlaRule = {
  stage: string; // slaAlertStage に記録するキー
  label: string; // 通知文
};

function evaluateSla(
  lead: {
    status: string;
    createdAt: Date;
    contactedAt: Date | null;
    updatedAt: Date;
  },
  now: number
): SlaRule | null {
  const age = now - lead.createdAt.getTime();
  const sinceContact = now - (lead.contactedAt ?? lead.updatedAt).getTime();
  const sinceUpdate = now - lead.updatedAt.getTime();

  switch (lead.status) {
    case "NEW":
      if (age >= 24 * HOUR) {
        return { stage: "REPLY_OVERDUE", label: "🔴 24時間以内の初回返信が未了" };
      }
      return null;
    case "CONTACTED":
      if (sinceContact >= 4 * DAY) {
        return { stage: "CALL_DUE", label: "🔴 4日経過 — 電話フェーズへ" };
      }
      if (sinceContact >= 3 * DAY) {
        return { stage: "REMIND_DUE", label: "🟡 3日経過 — リマインド送付期限" };
      }
      return null;
    case "INTERESTED":
      if (sinceUpdate >= 4 * DAY) {
        return { stage: "CALL_DUE", label: "🔴 4日更新なし — 電話フェーズへ" };
      }
      return null;
    case "MEETING_DONE":
      if (sinceUpdate >= 48 * HOUR) {
        return { stage: "CLOSING_OVERDUE", label: "🔴 面談後48時間 — クロージング期限超過" };
      }
      return null;
    default:
      return null;
  }
}

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization") ?? "";
  if (!CRON_SECRET || auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const now = Date.now();

    const leads = await db.franchiseLead.findMany({
      where: {
        source: { not: "OUTBOUND" },
        status: { in: ["NEW", "CONTACTED", "INTERESTED", "MEETING_DONE"] },
      },
      select: {
        id: true,
        companyName: true,
        prefecture: true,
        email: true,
        phone: true,
        status: true,
        createdAt: true,
        contactedAt: true,
        updatedAt: true,
        slaAlertStage: true,
        slaLastAlertAt: true,
      },
    });

    const alerts: { id: string; line: string; stage: string }[] = [];

    for (const lead of leads) {
      const rule = evaluateSla(lead, now);
      if (!rule) continue;

      // 同一ステージのアラートは24時間に1回まで
      const alreadyAlerted =
        lead.slaAlertStage === rule.stage &&
        lead.slaLastAlertAt !== null &&
        now - lead.slaLastAlertAt.getTime() < 24 * HOUR;
      if (alreadyAlerted) continue;

      alerts.push({
        id: lead.id,
        stage: rule.stage,
        line: `・${lead.companyName}（${lead.prefecture ?? "県不明"}）: ${rule.label}\n  ${lead.email ?? ""}${lead.phone ? ` / ${lead.phone}` : ""}`,
      });
    }

    if (alerts.length > 0) {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
      await notifyCeo(
        [
          `⏰ 加盟パイプラインSLAアラート（${alerts.length}件）`,
          "",
          ...alerts.map((a) => a.line),
          "",
          appUrl ? `${appUrl}/dashboard/franchise-leads` : "",
        ]
          .filter(Boolean)
          .join("\n")
      );

      const alertedAt = new Date(now);
      for (const a of alerts) {
        await db.franchiseLead.update({
          where: { id: a.id },
          data: { slaAlertStage: a.stage, slaLastAlertAt: alertedAt },
        });
      }
    }

    return NextResponse.json({
      checked: leads.length,
      alerted: alerts.length,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("franchise-sla error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
