import { NextRequest, NextResponse } from "next/server";
import { runTvcmCrawl } from "@/lib/leads/tvcm-crawler";
import { notifyCeo } from "@/lib/google-chat";

export const runtime = "nodejs";
export const maxDuration = 300;

const CRON_SECRET = process.env.CRON_SECRET ?? "";

/**
 * GET /api/cron/tvcm-crawl
 * Headers: Authorization: Bearer {CRON_SECRET}
 *
 * GitHub Actions から毎朝呼ばれ、TVer広告案件の自動クロール+通知を行う。
 * - 新規 CRAWLED が 0 件のときは通知しない（ノイズ防止）
 */
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization") ?? "";
  if (!CRON_SECRET || auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const outcome = await runTvcmCrawl(
      {
        source: "all", // YouTube + PR TIMES + @Press
        maxPerKeyword: 6,
        totalLimit: 40,
        // ローカル小規模狙い: 登録者3,000以下のチャンネルのみ
        maxSubscribers: 3_000,
        publishedWithinDays: 7,
        hideRecentlyDecidedDays: 30,
      },
      { userId: null, staffName: "SYSTEM_CRON" },
    );

    const { newlyCreated, updated, fetched, extracted, excluded, hidden } =
      outcome.stats;

    if (newlyCreated > 0) {
      const appUrl =
        process.env.NEXT_PUBLIC_APP_URL ??
        "https://adarch-estimate-production.up.railway.app";
      const historyUrl = `${appUrl}/dashboard/leads/tvcm-history?status=CRAWLED`;

      const newCandidates = outcome.results.filter(
        (r) => r.currentStatus === "CRAWLED",
      );
      const top = newCandidates.slice(0, 5).map((r) => {
        const meta = [r.prefecture, r.industryGuess].filter(Boolean).join("・");
        const warn = r.exclusionReason ? ` ${r.exclusionReason}` : "";
        return `・${r.companyName}${meta ? `（${meta}）` : ""}${warn}`;
      });
      const more = newCandidates.length > 5 ? `\n…他 ${newCandidates.length - 5} 件` : "";

      const message = [
        `📊 TVer広告 自動クロール完了`,
        `新規: ${newlyCreated}件（警告付き ${excluded}件 / 既存更新 ${updated}件 / 直近判断済み除外 ${hidden}件）`,
        ``,
        top.join("\n") + more,
        ``,
        `👉 履歴画面で選別: ${historyUrl}`,
      ].join("\n");

      await notifyCeo(message);
    }

    return NextResponse.json({
      ok: true,
      stats: { fetched, extracted, newlyCreated, updated, excluded, hidden },
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "クロール中にエラーが発生しました";
    console.error("[/api/cron/tvcm-crawl] error:", err);
    // エラーも通知（cron失敗を見逃さないため）
    try {
      await notifyCeo(`⚠️ TVer広告 自動クロール失敗: ${message}`);
    } catch {
      /* swallow */
    }
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
