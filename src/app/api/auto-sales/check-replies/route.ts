import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { db } from "@/lib/db";
import { sendChatMessage, notifyCeo } from "@/lib/google-chat";

const MEDIA_EMAIL = "media@adarch.co.jp";
const CHECK_INTERVAL_HOURS = 24; // 過去24時間の受信メールを確認
const MAILBOX_LOOKBACK_DAYS = 30; // 反響を待つ受信箱を洗い出す期間

/**
 * 反響を拾う受信箱の一覧。
 * 拠点ごとに @adarch.co.jp のアドレスが違うので、実際に送信に使われたアドレスを
 * ジョブから逆引きして、その受信箱だけを見に行く。
 * サービスアカウントはドメイン全体の委任を持っているので、
 * @adarch.co.jp の任意のユーザーに成り代わって読める。
 */
async function mailboxesToCheck(): Promise<string[]> {
  const since = new Date(Date.now() - MAILBOX_LOOKBACK_DAYS * 24 * 3600 * 1000);
  const rows = await db.autoSalesJob.findMany({
    where: {
      status: "COMPLETED",
      hasResponse: false,
      completedAt: { gte: since },
      sentFromEmail: { not: null },
    },
    select: { sentFromEmail: true },
    distinct: ["sentFromEmail"],
  });

  const set = new Set<string>();
  for (const r of rows) {
    const addr = r.sentFromEmail?.trim().toLowerCase();
    // 委任が効くのは自社ドメインのみ。外部アドレスを渡すと認証で落ちる
    if (addr && addr.endsWith("@adarch.co.jp")) set.add(addr);
  }
  // 旧ジョブ（sentFromEmail が空）の反響も拾えるよう、既定の受信箱は常に含める
  set.add((process.env.AUTO_SALES_REPLY_EMAIL ?? MEDIA_EMAIL).toLowerCase());
  return [...set];
}

/**
 * 返信監視API — cronで定期的に呼び出す
 * 各拠点の @adarch.co.jp 受信箱を確認し、
 * 送信元ドメインで auto_sales_jobs と照合して反響を記録
 */
export async function POST(req: NextRequest) {
  // APIキー認証（cron / 内部呼び出し用）
  const apiKey = req.headers.get("x-api-key");
  if (apiKey !== process.env.GROUP_SUPPORT_API_KEY) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const keyJson = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
    if (!keyJson) {
      return NextResponse.json({ error: "GOOGLE_SERVICE_ACCOUNT_KEY not set" }, { status: 500 });
    }
    const key = JSON.parse(keyJson);

    const mailboxes = await mailboxesToCheck();
    let checked = 0;
    let matched = 0;
    const mailboxErrors: string[] = [];

    for (const mailbox of mailboxes) {
      try {
        const result = await scanMailbox(key, mailbox);
        checked += result.checked;
        matched += result.matched;
      } catch (err) {
        // 1つの受信箱で失敗しても残りは処理する
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[check-replies] 受信箱スキャン失敗 (${mailbox}):`, msg);
        mailboxErrors.push(`${mailbox}: ${msg}`);
      }
    }

    return NextResponse.json({
      mailboxes: mailboxes.length,
      checked,
      matched,
      ...(mailboxErrors.length > 0 ? { errors: mailboxErrors } : {}),
    });
  } catch (err) {
    console.error("[check-replies] エラー:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}

/** 1つの受信箱をスキャンして反響を記録する */
async function scanMailbox(
  key: Record<string, unknown>,
  mailbox: string
): Promise<{ checked: number; matched: number }> {
  {
    const auth = new google.auth.GoogleAuth({
      credentials: key,
      scopes: ["https://www.googleapis.com/auth/gmail.readonly"],
      clientOptions: { subject: mailbox }, // その拠点のアドレスに成り代わる
    });

    const gmail = google.gmail({ version: "v1", auth });

    // 過去24時間の受信メールを検索
    const after = Math.floor(Date.now() / 1000) - CHECK_INTERVAL_HOURS * 3600;
    const listRes = await gmail.users.messages.list({
      userId: "me",
      q: `after:${after} -from:${mailbox}`,
      maxResults: 50,
    });

    const messages = listRes.data.messages ?? [];
    if (messages.length === 0) {
      return { checked: 0, matched: 0 };
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
      // この受信箱から送ったジョブに限定する。同じ企業へ複数拠点が送っていても取り違えない。
      // 旧ジョブは sentFromEmail が空なので、既定の受信箱を見ているときだけ拾う。
      const isDefaultMailbox =
        mailbox === (process.env.AUTO_SALES_REPLY_EMAIL ?? MEDIA_EMAIL).toLowerCase();
      const matchingJobs = await db.autoSalesJob.findMany({
        where: {
          status: "COMPLETED",
          hasResponse: false,
          ...(isDefaultMailbox
            ? { OR: [{ sentFromEmail: mailbox }, { sentFromEmail: null }] }
            : { sentFromEmail: mailbox }),
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

      // 全社共有の送付履歴にも反映（どの会社が反応したかが全拠点から見える）
      await db.autoSalesSentDomain.updateMany({
        where: { jobId: job.id },
        data: { hasResponse: true },
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

      console.log(`[check-replies] 反響検出: ${job.target.companyName} ← ${from}（受信箱: ${mailbox}）`);
    }

    return { checked: messages.length, matched };
  }
}
