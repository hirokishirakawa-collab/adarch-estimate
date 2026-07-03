import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { notifyCeo } from "@/lib/google-chat";

export const runtime = "nodejs";

const CRON_SECRET = process.env.CRON_SECRET ?? "";

// ----------------------------------------------------------------
// POST /api/franchise-leads/booking-signal
// TimeRexの「日程調整が完了しました」メール原文をGASがPOST。
// 本文から予約者メール・日時を抽出し、該当リードを MEETING_SCHEDULED に更新
// ＋CEO通知スペースへ祝賀通知。認証: Bearer CRON_SECRET（サーバー間のみ）
//
// メール形式（実物確認済み 2026-07-03）:
//   件名: {ゲスト名}さんとの日程調整が完了しました
//   本文: 日時：2026年3月23日 (月) 17:00 - 18:00（Asia/Tokyo）
//         名前：{ゲスト名} ／ メールアドレス：{ゲストemail}
// 注意: 代表自身が他者のカレンダーを予約した際も同形式で届く
//       → 抽出メール=代表自身のときは無視する
// ----------------------------------------------------------------

const SELF_EMAILS = ["hiroki.shirakawa@adarch.co.jp"];

export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization") ?? "";
  if (!CRON_SECRET || auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const raw: string = typeof body.raw === "string" ? body.raw : "";
    if (raw.length < 20) {
      return NextResponse.json({ error: "raw（メール原文）が必要です" }, { status: 400 });
    }

    const email = raw.match(/メールアドレス[：:]\s*([^\s\r\n]+)/)?.[1]?.trim() ?? null;
    const name = raw.match(/名前[：:]\s*([^\r\n]+)/)?.[1]?.trim() ?? null;
    const datetime = raw.match(/日時[：:]\s*([^\r\n]+)/)?.[1]?.trim() ?? null;

    if (!email) {
      return NextResponse.json({ ok: false, reason: "email_not_found" });
    }
    if (SELF_EMAILS.includes(email.toLowerCase())) {
      // 代表がゲスト側の予約（他者カレンダーを予約した通知）は対象外
      return NextResponse.json({ ok: true, ignored: "self_booking" });
    }

    const lead = await db.franchiseLead.findFirst({
      where: {
        source: { not: "OUTBOUND" },
        OR: [{ email }, { address: email }],
      },
      orderBy: { createdAt: "desc" },
    });

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";

    if (lead) {
      const stamp = new Date().toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" });
      await db.franchiseLead.update({
        where: { id: lead.id },
        data: {
          status: "MEETING_SCHEDULED",
          notes: `${lead.notes ?? ""}\n\n―― 面談予約（TimeRex自動検知 ${stamp}）――\n日時: ${datetime ?? "本文参照"}`.trim(),
          // ステージが変わったのでSLA通知状態をリセット（面談後48hルールが次に効く）
          slaAlertStage: null,
        },
      });
      await notifyCeo(
        [
          "🎉 面談予約が入りました（TimeRex自動検知）",
          `リード: ${lead.companyName}（${lead.prefecture ?? "県不明"}）`,
          `日時: ${datetime ?? "不明"}`,
          `連絡先: ${email}`,
          "",
          "前日に「明日の面談」共有が届きます。台帳L4へ。",
          appUrl ? `${appUrl}/dashboard/franchise-leads` : "",
        ]
          .filter(Boolean)
          .join("\n")
      );
      return NextResponse.json({ ok: true, leadId: lead.id });
    }

    // 台帳に見つからない予約（紹介経由・手動起票漏れ等）も見逃さず通知
    await notifyCeo(
      [
        "🎉 面談予約が入りました（TimeRex自動検知・台帳外）",
        `予約者: ${name ?? "不明"} / ${email}`,
        `日時: ${datetime ?? "不明"}`,
        "",
        "⚠️ パイプライン台帳に該当リードが見つかりません。コピペ起票で登録してください。",
      ].join("\n")
    );
    return NextResponse.json({ ok: true, leadId: null });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("booking-signal error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
