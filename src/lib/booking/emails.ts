import { sendMail } from "@/lib/resend";
import { formatJst } from "./slots";

// ----------------------------------------------------------------
// 商談予約システム — 確認 / キャンセルメール
// （Googleカレンダー招待は createMeetEvent の sendUpdates:"all" で別途届く）
// ----------------------------------------------------------------

function appUrl(path: string): string {
  const base =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? "http://localhost:3000";
  return `${base}${path}`;
}

function escHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const SIGNATURE = `
  <p style="margin:24px 0 0;font-size:12px;color:#71717a;line-height:1.8;">
    Ad Arch株式会社<br />
    〒107-0062 東京都港区南青山2-2-15 ウィン青山942<br />
    https://adarch.co.jp
  </p>`;

export type BookingMailPayload = {
  bookingTitle: string; // 例: 加盟に関する個別面談（60分）
  startAt: Date;
  endAt: Date;
  applicantName: string;
  applicantCompany: string | null;
  applicantEmail: string;
  applicantPhone: string | null;
  hostName: string;
  hostEmail: string;
  meetUrl: string | null;
  cancelToken: string;
  answers: { label: string; value: string }[];
};

function detailRows(p: BookingMailPayload, forHost: boolean): string {
  const rows: [string, string][] = [
    ["日時", `${formatJst(p.startAt)} 〜 ${formatJst(p.endAt).slice(-5)}（日本時間）`],
    ["内容", p.bookingTitle],
  ];
  if (forHost) {
    rows.push(["お名前", p.applicantName]);
    if (p.applicantCompany) rows.push(["会社名", p.applicantCompany]);
    rows.push(["メール", p.applicantEmail]);
    if (p.applicantPhone) rows.push(["電話", p.applicantPhone]);
    for (const a of p.answers) rows.push([a.label, a.value]);
  } else {
    rows.push(["担当", p.hostName]);
  }
  if (p.meetUrl) {
    rows.push(["参加URL", p.meetUrl]);
  }
  return rows
    .map(
      ([label, value]) => `
      <tr>
        <th style="text-align:left;padding:8px 12px;background:#f4f4f5;font-size:12px;font-weight:600;color:#71717a;white-space:nowrap;border-bottom:1px solid #e4e4e7;width:110px;">${escHtml(label)}</th>
        <td style="padding:8px 12px;font-size:14px;color:#18181b;border-bottom:1px solid #e4e4e7;word-break:break-all;">${escHtml(value)}</td>
      </tr>`
    )
    .join("");
}

/** 申込者への予約確定メール（キャンセルリンク付き） */
export async function sendBookingConfirmedToApplicant(
  p: BookingMailPayload
): Promise<void> {
  const cancelUrl = appUrl(`/book/cancel/${p.cancelToken}`);
  const html = `
  <div style="font-family:'Hiragino Sans','Yu Gothic',sans-serif;max-width:580px;margin:0 auto;padding:24px 16px;">
    <h2 style="font-size:18px;color:#18181b;margin:0 0 16px;">ご予約が確定しました</h2>
    <p style="font-size:14px;color:#18181b;line-height:1.8;margin:0 0 16px;">
      ${escHtml(p.applicantName)} 様<br /><br />
      この度は面談のご予約をいただきありがとうございます。<br />
      以下の内容で確定いたしました。Googleカレンダーの招待も別途お送りしています。
    </p>
    <table style="border-collapse:collapse;width:100%;margin:0 0 20px;">${detailRows(p, false)}</table>
    <p style="font-size:13px;color:#71717a;line-height:1.8;">
      ご都合が悪くなった場合は、こちらからキャンセルいただけます：<br />
      <a href="${cancelUrl}" style="color:#2563eb;">${cancelUrl}</a>
    </p>
    ${SIGNATURE}
  </div>`;
  await sendMail({
    to: p.applicantEmail,
    subject: `【ご予約確定】${formatJst(p.startAt)} ${p.bookingTitle}`,
    html,
  });
}

/** 担当ホストへの新規予約通知（申込内容＋スクリーニング回答つき） */
export async function sendBookingConfirmedToHost(
  p: BookingMailPayload
): Promise<void> {
  const html = `
  <div style="font-family:'Hiragino Sans','Yu Gothic',sans-serif;max-width:580px;margin:0 auto;padding:24px 16px;">
    <h2 style="font-size:18px;color:#18181b;margin:0 0 16px;">新しい面談予約が入りました（担当: ${escHtml(p.hostName)}）</h2>
    <table style="border-collapse:collapse;width:100%;margin:0 0 20px;">${detailRows(p, true)}</table>
    <p style="font-size:13px;color:#71717a;">カレンダーにはMeet付きの予定が自動登録済みです。</p>
  </div>`;
  await sendMail({
    to: p.hostEmail,
    subject: `【新規予約】${formatJst(p.startAt)} ${p.applicantName}様 — 担当: ${p.hostName}`,
    html,
  });
}

/** キャンセル通知（申込者・ホスト両方へ） */
export async function sendBookingCancelledEmails(
  p: Omit<BookingMailPayload, "answers">
): Promise<void> {
  const body = (greeting: string) => `
  <div style="font-family:'Hiragino Sans','Yu Gothic',sans-serif;max-width:580px;margin:0 auto;padding:24px 16px;">
    <h2 style="font-size:18px;color:#18181b;margin:0 0 16px;">予約がキャンセルされました</h2>
    <p style="font-size:14px;color:#18181b;line-height:1.8;margin:0 0 16px;">${greeting}</p>
    <p style="font-size:14px;color:#18181b;line-height:1.8;">
      対象: ${escHtml(formatJst(p.startAt))} ${escHtml(p.bookingTitle)}<br />
      カレンダーの予定も削除されています。
    </p>
    ${SIGNATURE}
  </div>`;
  await Promise.allSettled([
    sendMail({
      to: p.applicantEmail,
      subject: `【キャンセル完了】${formatJst(p.startAt)} ${p.bookingTitle}`,
      html: body(
        `${escHtml(p.applicantName)} 様<br /><br />以下のご予約のキャンセルを承りました。またのご予約をお待ちしております。`
      ),
    }),
    sendMail({
      to: p.hostEmail,
      subject: `【予約キャンセル】${formatJst(p.startAt)} ${p.applicantName}様`,
      html: body(
        `${escHtml(p.applicantName)}様（担当: ${escHtml(p.hostName)}）の予約がキャンセルされました。`
      ),
    }),
  ]);
}
