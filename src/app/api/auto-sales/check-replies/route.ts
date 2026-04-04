import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { db } from "@/lib/db";
import { sendChatMessage, notifyCeo } from "@/lib/google-chat";

const MEDIA_EMAIL = "media@adarch.co.jp";
const CHECK_INTERVAL_HOURS = 24; // 過去24時間の受信メールを確認

/**
 * 返信監視API — cronで5分ごとに呼び出す
 * media@adarch.co.jp への受信メールを確認し、
 * 送信元ドメインで auto_sales_jobs と照合して反響を記録
 */
export async function POST(req: NextRequest) {
  // APIキー認証（cron / 内部呼び出し用）
  const apiKey = req.headers.get("x-api-key");
  if (apiKey !== process.env.GROUP_SUPPORT_API_KEY) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // サービスアカウント + ドメイン全体の委任で media@adarch.co.jp のGmailを読む
    const keyJson = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
    if (!keyJson) {
      return NextResponse.json({ error: "GOOGLE_SERVICE_ACCOUNT_KEY not set" }, { status: 500 });
    }
    const key = JSON.parse(keyJson);
    const auth = new google.auth.GoogleAuth({
      credentials: key,
      scopes: ["https://www.googleapis.com/auth/gmail.readonly"],
      clientOptions: { subject: MEDIA_EMAIL }, // media@adarch.co.jp に成り代わる
    });

    const gmail = google.gmail({ version: "v1", auth });

    // 過去24時間の受信メールを検索
    const after = Math.floor(Date.now() / 1000) - CHECK_INTERVAL_HOURS * 3600;
    const listRes = await gmail.users.messages.list({
      userId: "me",
      q: `after:${after} -from:${MEDIA_EMAIL}`,
      maxResults: 50,
    });

    const messages = listRes.data.messages ?? [];
    if (messages.length === 0) {
      return NextResponse.json({ checked: 0, matched: 0 });
    }

    let matched = 0;

    for (const msg of messages) {
      if (!msg.id) continue;

      // 既に処理済みか確認
      const existing = await db.autoSalesJob.findFirst({
        where: { responseEmailId: msg.id },
      });
      if (existing) continue;

      // メール詳細を取得
      const detail = await gmail.users.messages.get({
        userId: "me",
        id: msg.id,
        format: "metadata",
        metadataHeaders: ["From", "Subject"],
      });

      const headers = detail.data.payload?.headers ?? [];
      const from = headers.find((h) => h.name === "From")?.value ?? "";
      const subject = headers.find((h) => h.name === "Subject")?.value ?? "";
      const snippet = detail.data.snippet ?? "";

      // 送信元ドメインを抽出
      const domainMatch = from.match(/@([a-zA-Z0-9.-]+)/);
      if (!domainMatch) continue;
      const senderDomain = domainMatch[1].toLowerCase();

      // auto_sales_jobs と照合（送信先URLのドメインで一致するものを探す）
      const matchingJobs = await db.autoSalesJob.findMany({
        where: {
          status: "COMPLETED",
          hasResponse: false,
          target: {
            url: { contains: senderDomain },
          },
        },
        include: {
          target: {
            select: {
              companyName: true,
              area: true,
              industry: true,
              branch: { select: { name: true } },
              branchId: true,
            },
          },
          template: {
            select: { branchId: true, body: true },
          },
        },
        orderBy: { completedAt: "desc" },
        take: 1,
      });

      if (matchingJobs.length === 0) continue;

      const job = matchingJobs[0];
      matched++;

      // 反響を記録
      await db.autoSalesJob.update({
        where: { id: job.id },
        data: {
          hasResponse: true,
          responseEmailId: msg.id,
          responseFrom: from,
          responseSubject: subject,
          responseSnippet: snippet.substring(0, 500),
          respondedAt: new Date(),
        },
      });

      // Google Chat で該当パートナーに通知
      const branchId = job.target.branchId ?? job.template.branchId;
      const notificationText = [
        "🔔 *自動営業 — 反響あり！*",
        "",
        `📍 *${job.target.companyName}*（${job.target.area ?? ""}${job.target.industry ? ` / ${job.target.industry}` : ""}）`,
        `📧 送信元: ${from}`,
        `📋 件名: ${subject}`,
        `💬 ${snippet.substring(0, 200)}`,
        "",
        "ダッシュボードで詳細を確認してください。",
      ].join("\n");

      // パートナーのChatスペースに通知
      const branchUsers = await db.user.findMany({
        where: { branchId, chatSpaceId: { not: null } },
        select: { chatSpaceId: true },
      });

      for (const u of branchUsers) {
        if (u.chatSpaceId) {
          await sendChatMessage(u.chatSpaceId, notificationText);
        }
      }

      // CEO通知（白川代表にも全件通知）
      await notifyCeo(
        `🔔 自動営業 反響\n${job.target.companyName}（${job.target.area ?? ""}）\n${job.target.branch?.name ?? "不明"}の案件\n送信元: ${from}\n${snippet.substring(0, 100)}`
      );

      // Chat通知済みを記録
      await db.autoSalesJob.update({
        where: { id: job.id },
        data: { chatNotifiedAt: new Date() },
      });

      // SalesApproach に「返信あり」として自動投稿
      const author = await db.user.findFirst({
        where: { branchId, groupCompanyId: { not: null } },
        select: { id: true, groupCompanyId: true },
        orderBy: { createdAt: "asc" },
      });
      if (author?.groupCompanyId) {
        await db.salesApproach.create({
          data: {
            groupCompanyId: author.groupCompanyId,
            authorId: author.id,
            industry: job.target.industry ?? "その他",
            targetDesc: `${job.target.companyName}（${job.target.area ?? ""}）— 自動営業`,
            method: "FORM",
            messageBody: job.template.body.substring(0, 5000),
            result: "REPLIED_NG",
            learnings: `自動営業フォーム送信 → 返信あり（自動記録）\n件名: ${subject}\n抜粋: ${snippet.substring(0, 200)}`,
          },
        });
        await db.autoSalesJob.update({
          where: { id: job.id },
          data: { approachPostedAt: new Date() },
        });
      }

      console.log(`[check-replies] 反響検出: ${job.target.companyName} ← ${from}`);
    }

    return NextResponse.json({
      checked: messages.length,
      matched,
    });
  } catch (err) {
    console.error("[check-replies] エラー:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
