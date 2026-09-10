export const runtime = "nodejs";
export const maxDuration = 60;

import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { db } from "@/lib/db";
import { STATUS_CONFIG, getWeekId, hasHqRequest, hqRequestLabel, followUpLabel } from "@/lib/constants/group-support";
import { sendGroupWeeklyReportEmail } from "@/lib/notifications";

const CRON_SECRET = process.env.CRON_SECRET ?? "";
const GROUP_SUPPORT_API_KEY = process.env.GROUP_SUPPORT_API_KEY ?? "";

// ---------------------------------------------------------------
// GET /api/cron/group-support-report
// Auth: Bearer {CRON_SECRET} or x-api-key {GROUP_SUPPORT_API_KEY}
// Query: ?weekId=2026-W10 (default: current week)
// ---------------------------------------------------------------
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization") ?? "";
  const apiKey = req.headers.get("x-api-key") ?? "";

  if (
    !(CRON_SECRET && auth === `Bearer ${CRON_SECRET}`) &&
    !(GROUP_SUPPORT_API_KEY && apiKey === GROUP_SUPPORT_API_KEY)
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const weekId = req.nextUrl.searchParams.get("weekId") ?? getWeekId();

  // 全アクティブ企業 + 今週の提出データ
  const companies = await db.groupCompany.findMany({
    where: { isActive: true },
    include: {
      weeklySubmissions: { where: { weekId } },
    },
    orderBy: { name: "asc" },
  });

  const submitted = companies.filter((c) => c.weeklySubmissions.length > 0);
  const notSubmitted = companies.filter((c) => c.weeklySubmissions.length === 0);
  const total = companies.length;
  const submissionRate =
    total > 0 ? Math.round((submitted.length / total) * 100) : 0;

  // ステータス集計
  const statusCounts: Record<string, number> = {
    GREEN: 0,
    YELLOW: 0,
    RED: 0,
    NONE: notSubmitted.length,
  };
  for (const c of submitted) {
    const status = c.weeklySubmissions[0].status;
    statusCounts[status] = (statusCounts[status] ?? 0) + 1;
  }

  // 注目企業（🟡🔴 or サポート要請あり）
  const notable = submitted.filter((c) => {
    const sub = c.weeklySubmissions[0];
    const v2 = (sub.formVersion ?? 1) >= 2;
    return (
      sub.status === "YELLOW" ||
      sub.status === "RED" ||
      (v2 ? hasHqRequest(sub.hqRequest) : sub.q5 !== "今は大丈夫")
    );
  });

  // Claude Haiku で週報生成（v2=行動量型 / v1=旧設問 を併記）
  const promptData = submitted
    .map((c) => {
      const sub = c.weeklySubmissions[0];
      const head = `【${c.name}（${c.ownerName}）】ステータス: ${STATUS_CONFIG[sub.status].emoji}${STATUS_CONFIG[sub.status].label}${sub.source === "AI" ? "（AI連携から提出）" : ""}`;
      if ((sub.formVersion ?? 1) >= 2) {
        return `${head}
声かけ: ${sub.outreachCount ?? 0}件${sub.repliedCount != null ? ` / 返事・会えた: ${sub.repliedCount}件` : ""} / いちばん近い1件: ${sub.candidate ?? "なし"} / 先週の次の一手: ${followUpLabel(sub.followUp)}${sub.followUpNote ? `（${sub.followUpNote}）` : ""} / 本部への依頼: ${hasHqRequest(sub.hqRequest) ? `${hqRequestLabel(sub.hqRequest)}${sub.hqNote ? `—${sub.hqNote}` : ""}` : "なし"}`;
      }
      return `${head}
Q1(調子): ${sub.q1} / Q2(先週やったこと): ${sub.q2} / Q3(来週やること): ${sub.q3} / Q4(共有・相談): ${sub.q4} / Q5(サポート): ${sub.q5}`;
    })
    .join("\n\n");

  const aiPrompt = `あなたはグループ企業26社を統括する本部の社長秘書AIです。
以下は今週（${weekId}）の各社からの週次共有データです。

【全体概況】
- アクティブ企業: ${total}社
- 共有率: ${submitted.length}/${total}社（${submissionRate}%）
- ステータス分布: 🟢${statusCounts["GREEN"]} 🟡${statusCounts["YELLOW"]} 🔴${statusCounts["RED"]} ⚪${statusCounts["NONE"]}

【各社データ】
${promptData || "（今週の共有はまだありません）"}

【未共有企業】
${notSubmitted.map((c) => `- ${c.name}（${c.ownerName}）`).join("\n") || "なし"}

上記データをもとに、社長向けの週報ドラフトを作成してください。

【出力形式】
1. 全体サマリー（3〜5行）: 共有率、全体の傾向、ポジティブな動き
2. 注目すべき会社（🟡・🔴・本部への依頼ありの会社のみ）: 各社について、声かけの量と受注候補の状況、本部が動くべきこと（依頼の中身）を2〜3行で要約。🔴は「声かけ0件」＝営業として動いていない事実として書く
3. 未共有企業リスト（あれば）

トーンは社長への内部ブリーフィング。簡潔かつ的確に。マークダウンは使わず、プレーンテキストで出力してください。`;

  let aiSummary: string;
  try {
    const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
    if (!anthropicApiKey) throw new Error("ANTHROPIC_API_KEY not set");

    const client = new Anthropic({ apiKey: anthropicApiKey });
    const message = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 2048,
      messages: [{ role: "user", content: aiPrompt }],
    });

    const content = message.content[0];
    aiSummary =
      content.type === "text" ? content.text : "（AI要約の生成に失敗しました）";
  } catch (e) {
    console.error("[group-support-report] AI error:", e);
    aiSummary = "（AI要約の生成に失敗しました）";
  }

  // メール送信
  await sendGroupWeeklyReportEmail(weekId, aiSummary, {
    total,
    submitted: submitted.length,
    notSubmitted: notSubmitted.length,
    statusCounts,
  });

  return NextResponse.json({
    weekId,
    total,
    submitted: submitted.length,
    notSubmitted: notSubmitted.length,
    statusCounts,
    notableCount: notable.length,
  });
}
