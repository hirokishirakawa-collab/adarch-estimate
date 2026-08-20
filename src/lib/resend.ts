// ---------------------------------------------------------------
// メール送信ユーティリティ（Gmail SMTP / Resend フォールバック）
// ---------------------------------------------------------------

import { Resend } from "resend";
import nodemailer from "nodemailer";
import { notifyCeo } from "./google-chat";

// ビルド時クラッシュ防止のため Proxy で遅延初期化
let _resend: Resend | null = null;
const resend = new Proxy({} as Resend, {
  get(_target, prop) {
    if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY);
    return (_resend as never)[prop as keyof Resend];
  },
});

// Gmail SMTP トランスポート（遅延初期化）
let _gmailTransport: nodemailer.Transporter | null = null;
function getGmailTransport(): nodemailer.Transporter | null {
  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) return null;
  if (!_gmailTransport) {
    _gmailTransport = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD,
      },
    });
  }
  return _gmailTransport;
}

const FROM_ADDRESS = "Ad-Arch OS <info@adarch.co.jp>";
const ADMIN_EMAIL  = "system@adarch.co.jp";

/** Gmail SMTP優先、失敗時Resendフォールバック。添付・BCC対応。 */
export async function sendMail(params: {
  to: string | string[];
  subject: string;
  html: string;
  bcc?: string | string[];
  attachments?: { filename: string; content: Buffer }[];
  /** 差出人の上書き（未指定なら Ad-Arch OS）。加盟希望者への返信など、代表名義で出したい時に使う。 */
  from?: string;
  /** 返信先の指定 */
  replyTo?: string;
}): Promise<void> {
  const { to, subject, html, bcc, attachments, from, replyTo } = params;
  const fromAddress = from || FROM_ADDRESS;
  const recipients = Array.isArray(to) ? to : [to];
  const bccList = bcc ? (Array.isArray(bcc) ? bcc : [bcc]) : [];

  // Gmail SMTP を優先
  const gmail = getGmailTransport();
  if (gmail) {
    try {
      await gmail.sendMail({
        from: fromAddress,
        to: recipients.join(","),
        ...(bccList.length ? { bcc: bccList.join(",") } : {}),
        ...(replyTo ? { replyTo } : {}),
        subject,
        html,
        ...(attachments?.length ? { attachments: attachments.map((a) => ({ filename: a.filename, content: a.content })) } : {}),
      });
      console.log(`[gmail] ✅ ${recipients.join(",")} へ送信完了`);
      return;
    } catch (e) {
      console.error("[gmail] 送信失敗、Resendにフォールバック:", e instanceof Error ? e.message : e);
    }
  }

  // Resend フォールバック
  const { error } = await resend.emails.send({
    from: fromAddress,
    to: recipients,
    ...(bccList.length ? { bcc: bccList } : {}),
    ...(replyTo ? { replyTo } : {}),
    subject,
    html,
    ...(attachments?.length ? { attachments: attachments.map((a) => ({ filename: a.filename, content: a.content })) } : {}),
  });
  if (error) {
    console.error("[resend] error:", error);
    throw new Error(error.message);
  }
  console.log(`[resend] ✅ ${recipients.join(",")} へ送信完了`);
}

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

const thStyle =
  "text-align:left;padding:8px 12px;background:#f4f4f5;" +
  "font-size:12px;font-weight:600;color:#71717a;white-space:nowrap;" +
  "border-bottom:1px solid #e4e4e7;width:130px;";

const tdStyle =
  "padding:8px 12px;font-size:14px;color:#18181b;" +
  "border-bottom:1px solid #e4e4e7;";

// ---------------------------------------------------------------
// コーポレートサイト お問い合わせ通知（→ 管理者）
// ---------------------------------------------------------------
export type ContactInquiryPayload = {
  company: string;
  name: string;
  email: string;
  phone: string;
  inquiryType: string;
  message: string;
  /** 営業・相互リンク依頼の疑い。捨てずに件名で仕分けられるようにする */
  suspectedSales?: boolean;
};

const INQUIRY_LABELS: Record<string, string> = {
  production: "映像制作のご依頼",
  media: "広告媒体のご相談",
  partnership: "グループ加盟について",
  other: "その他",
};

export async function sendContactInquiryEmail(
  payload: ContactInquiryPayload
): Promise<void> {
  const { company, name, email, phone, inquiryType, message, suspectedSales } = payload;
  const typeLabel = INQUIRY_LABELS[inquiryType] ?? inquiryType;
  const subject = suspectedSales
    ? `【営業の疑い】${typeLabel} — ${company || name}`
    : `【お問い合わせ】${typeLabel} — ${company || name}`;

  const rows = [
    ["会社名", company || "（未入力）"],
    ["お名前", name],
    ["メール", email],
    ["電話番号", phone || "（未入力）"],
    ["お問い合わせ種別", typeLabel],
  ]
    .map(
      ([label, value]) => `
      <tr>
        <th style="${thStyle}">${escHtml(label)}</th>
        <td style="${tdStyle}">${escHtml(value)}</td>
      </tr>`
    )
    .join("");

  const html = `
<!DOCTYPE html>
<html lang="ja">
<head><meta charset="UTF-8" /></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 0;">
    <tr><td align="center">
      <table width="580" cellpadding="0" cellspacing="0"
             style="background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e4e4e7;">
        <tr>
          <td style="background:linear-gradient(135deg,#1a1a2e,#0f3460);padding:20px 28px;">
            <span style="color:#ffffff;font-size:18px;font-weight:700;">Ad Arch</span>
            <span style="color:#c4a35a;font-size:13px;margin-left:8px;">adarch.co.jp お問い合わせ</span>
          </td>
        </tr>
        <tr>
          <td style="padding:28px;">
            <p style="margin:0 0 20px;font-size:14px;color:#3f3f46;">
              コーポレートサイトからお問い合わせがありました。
            </p>
            <table width="100%" cellpadding="0" cellspacing="0"
                   style="border-collapse:collapse;font-size:14px;">
              ${rows}
            </table>
            <div style="margin-top:20px;padding:16px;background:#f4f4f5;border-radius:8px;">
              <p style="margin:0 0 8px;font-size:12px;color:#71717a;font-weight:600;">メッセージ</p>
              <p style="margin:0;font-size:14px;color:#18181b;line-height:1.7;white-space:pre-wrap;">${escHtml(message)}</p>
            </div>
            <div style="margin-top:24px;text-align:center;">
              <a href="mailto:${escHtml(email)}?subject=Re: ${encodeURIComponent(subject)}"
                 style="display:inline-block;padding:11px 28px;background:#1a1a2e;color:#ffffff;
                        text-decoration:none;border-radius:8px;font-size:14px;font-weight:600;">
                返信する →
              </a>
            </div>
          </td>
        </tr>
        <tr>
          <td style="background:#f4f4f5;padding:16px 28px;border-top:1px solid #e4e4e7;">
            <p style="margin:0;font-size:11px;color:#a1a1aa;text-align:center;">
              このメールは adarch.co.jp のお問い合わせフォームから自動送信されています。
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  try {
    await sendMail({ to: ["hiroki.shirakawa@adarch.co.jp"], subject, html });
  } catch (e) {
    console.error("[resend:contact-inquiry] error:", e instanceof Error ? e.message : e);
    throw e;
  }

  // Google Chat にも通知
  notifyCeo([
    `📩 コーポレートサイト お問い合わせ`,
    `種別: ${typeLabel}`,
    `会社: ${company || "（未入力）"}`,
    `氏名: ${name}`,
    `メール: ${email}`,
    `電話: ${phone || "—"}`,
    ``,
    message.length > 200 ? message.slice(0, 200) + "…" : message,
  ].join("\n")).catch(() => {});
}

// ---------------------------------------------------------------
// TVer配信申請 新規申請通知（→ 管理者）
// ---------------------------------------------------------------
export type TverCampaignCreatedPayload = {
  campaignId:     string;
  campaignName:   string;
  advertiserName: string;
  budget:         string;   // "¥1,000,000" 形式で渡す
  startDate:      string;
  endDate:        string;
  staffName:      string;
};

export async function sendTverCampaignCreatedEmail(
  payload: TverCampaignCreatedPayload
): Promise<void> {
  const { campaignId, campaignName, advertiserName, budget, startDate, endDate, staffName } =
    payload;
  const url     = appUrl(`/dashboard/tver-campaign/${campaignId}`);
  const subject = `【TVer配信申請】新規の案件申請が届きました：${campaignName}`;

  const rows = [
    ["キャンペーン名", campaignName],
    ["広告主名",       advertiserName],
    ["広告予算（税抜）", budget],
    ["配信期間",       `${startDate} 〜 ${endDate}`],
    ["申請者",         staffName],
  ]
    .map(
      ([label, value]) => `
      <tr>
        <th style="${thStyle}">${escHtml(label)}</th>
        <td style="${tdStyle}">${escHtml(value)}</td>
      </tr>`
    )
    .join("");

  const html = `
<!DOCTYPE html>
<html lang="ja">
<head><meta charset="UTF-8" /></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 0;">
    <tr><td align="center">
      <table width="580" cellpadding="0" cellspacing="0"
             style="background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e4e4e7;">
        <tr>
          <td style="background:#1d4ed8;padding:20px 28px;">
            <span style="color:#ffffff;font-size:18px;font-weight:700;letter-spacing:-0.3px;">Ad-Arch OS</span>
            <span style="color:#bfdbfe;font-size:13px;margin-left:8px;">TVer配信申請 新規通知</span>
          </td>
        </tr>
        <tr>
          <td style="padding:28px;">
            <p style="margin:0 0 20px;font-size:14px;color:#3f3f46;">
              新しいTVer配信申請が届きました。内容をご確認ください。
            </p>
            <table width="100%" cellpadding="0" cellspacing="0"
                   style="border-collapse:collapse;font-size:14px;">
              ${rows}
            </table>
            <div style="margin-top:24px;text-align:center;">
              <a href="${url}"
                 style="display:inline-block;padding:11px 28px;background:#1d4ed8;color:#ffffff;
                        text-decoration:none;border-radius:8px;font-size:14px;font-weight:600;">
                申請内容を確認する →
              </a>
            </div>
          </td>
        </tr>
        <tr>
          <td style="background:#f4f4f5;padding:16px 28px;border-top:1px solid #e4e4e7;">
            <p style="margin:0;font-size:11px;color:#a1a1aa;text-align:center;">
              このメールは Ad-Arch Group OS から自動送信されています。
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  try {
    await sendMail({ to: [ADMIN_EMAIL], subject, html });
  } catch (e) {
    console.error("[resend:tver-campaign-created] error:", e instanceof Error ? e.message : e);
  }

  notifyCeo([
    `📺 TVer配信申請`,
    `キャンペーン: ${campaignName}`,
    `広告主: ${advertiserName}`,
    `予算: ${budget}`,
    `期間: ${startDate} 〜 ${endDate}`,
    `申請者: ${staffName}`,
    `🔗 ${url}`,
  ].join("\n")).catch(() => {});
}

// ---------------------------------------------------------------
// グループサポート サポート要請 Google Chat 通知
// Q5 が「あると助かる」または「できれば早めに欲しい」の場合に即時送信
// ---------------------------------------------------------------
export async function sendGroupSupportAlertChat(
  payload: GroupSupportAlertPayload
): Promise<void> {
  const { companyName, ownerName, companyId, q1, q5, q4, weekId } = payload;
  const isUrgent = q5 === "できれば早めに欲しい";
  const emoji = isUrgent ? "🆘" : "🙏";
  const url = appUrl(`/dashboard/group-support/${companyId}`);

  const text =
    `${emoji} *サポート要請* — ${companyName}（${ownerName}）\n\n` +
    `📅 ${weekId}\n` +
    `Q1. 今週の調子: ${q1}\n` +
    `Q5. サポート: *${q5}*\n` +
    `Q4. 相談内容: ${q4 || "（記載なし）"}\n\n` +
    `👉 ${url}`;

  await notifyCeo(text);
}

// ---------------------------------------------------------------
// グループサポート サポート要請アラート メール（→ 管理者）
// Q5 が「あると助かる」または「できれば早めに欲しい」の場合に即時送信
// ---------------------------------------------------------------
export type GroupSupportAlertPayload = {
  companyName: string;
  ownerName: string;
  companyId: string;
  q1: string;
  q5: string;
  q4: string;
  weekId: string;
};

export async function sendGroupSupportAlertEmail(
  payload: GroupSupportAlertPayload
): Promise<void> {
  const { companyName, ownerName, companyId, q1, q5, q4, weekId } = payload;
  const url = appUrl(`/dashboard/group-support/${companyId}`);

  const isUrgent = q5 === "できれば早めに欲しい";
  const urgencyLabel = isUrgent ? "🆘 至急" : "🙏 サポート希望";
  const subject = `【グループサポート${isUrgent ? "・至急」" : "】"}${companyName}（${ownerName}）からサポート要請`;

  const rows = [
    ["企業", companyName],
    ["代表者", ownerName],
    ["週", weekId],
    ["Q1. 今週の調子", q1],
    ["Q5. サポート要請", `${urgencyLabel}  ${q5}`],
    ["Q4. 共有・相談", q4 || "（記載なし）"],
  ]
    .map(
      ([label, value]) => `
      <tr>
        <th style="${thStyle}">${escHtml(label)}</th>
        <td style="${tdStyle}">${escHtml(value)}</td>
      </tr>`
    )
    .join("");

  const html = `
<!DOCTYPE html>
<html lang="ja">
<head><meta charset="UTF-8" /></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 0;">
    <tr><td align="center">
      <table width="580" cellpadding="0" cellspacing="0"
             style="background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e4e4e7;">
        <tr>
          <td style="background:${isUrgent ? "#dc2626" : "#f59e0b"};padding:20px 28px;">
            <span style="color:#ffffff;font-size:18px;font-weight:700;">${urgencyLabel}</span>
            <span style="color:rgba(255,255,255,0.85);font-size:13px;margin-left:8px;">グループサポート通知</span>
          </td>
        </tr>
        <tr>
          <td style="padding:28px;">
            <p style="margin:0 0 20px;font-size:14px;color:#3f3f46;">
              ${escHtml(companyName)}の${escHtml(ownerName)}さんから、本部サポートの要請がありました。
            </p>
            <table width="100%" cellpadding="0" cellspacing="0"
                   style="border-collapse:collapse;font-size:14px;">
              ${rows}
            </table>
            <div style="margin-top:24px;text-align:center;">
              <a href="${url}"
                 style="display:inline-block;padding:11px 28px;background:#1d4ed8;color:#ffffff;
                        text-decoration:none;border-radius:8px;font-size:14px;font-weight:600;">
                詳細を確認する →
              </a>
            </div>
          </td>
        </tr>
        <tr>
          <td style="background:#f4f4f5;padding:16px 28px;border-top:1px solid #e4e4e7;">
            <p style="margin:0;font-size:11px;color:#a1a1aa;text-align:center;">
              このメールは Ad-Arch Group OS から自動送信されています。
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  try {
    await sendMail({ to: ["hiroki.shirakawa@adarch.co.jp"], subject, html });
  } catch (e) {
    console.error("[resend:group-support-alert] error:", e instanceof Error ? e.message : e);
  }
}

// ---------------------------------------------------------------
// グループサポート 週報AI要約（→ 社長）
// ---------------------------------------------------------------
export type GroupWeeklyReportStats = {
  total: number;
  submitted: number;
  notSubmitted: number;
  statusCounts: Record<string, number>;
};

export async function sendGroupWeeklyReportEmail(
  weekId: string,
  aiSummary: string,
  stats: GroupWeeklyReportStats
): Promise<void> {
  const dashboardUrl = appUrl("/dashboard/group-support");
  const { total, submitted, notSubmitted, statusCounts } = stats;
  const rate = total > 0 ? Math.round((submitted / total) * 100) : 0;
  const subject = `【グループ週報】${weekId} AI要約レポート`;

  const summaryHtml = escHtml(aiSummary).replace(/\n/g, "<br>");

  const html = `
<!DOCTYPE html>
<html lang="ja">
<head><meta charset="UTF-8" /></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 0;">
    <tr><td align="center">
      <table width="580" cellpadding="0" cellspacing="0"
             style="background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e4e4e7;">
        <tr>
          <td style="background:#1d4ed8;padding:20px 28px;">
            <span style="color:#ffffff;font-size:18px;font-weight:700;letter-spacing:-0.3px;">Ad-Arch OS</span>
            <span style="color:#bfdbfe;font-size:13px;margin-left:8px;">グループ週報 ${escHtml(weekId)}</span>
          </td>
        </tr>
        <tr>
          <td style="padding:28px;">
            <table width="100%" cellpadding="0" cellspacing="0"
                   style="border-collapse:collapse;margin-bottom:20px;">
              <tr>
                <td style="padding:12px 16px;background:#f0f9ff;border-radius:8px;font-size:14px;color:#1e40af;">
                  共有率: <strong>${submitted}/${total}社（${rate}%）</strong>&nbsp;&nbsp;
                  🟢${statusCounts["GREEN"] ?? 0}&nbsp;
                  🟡${statusCounts["YELLOW"] ?? 0}&nbsp;
                  🔴${statusCounts["RED"] ?? 0}&nbsp;
                  ⚪${statusCounts["NONE"] ?? 0}
                </td>
              </tr>
            </table>
            <div style="font-size:14px;color:#3f3f46;line-height:1.7;">
              ${summaryHtml}
            </div>
            <div style="margin-top:24px;text-align:center;">
              <a href="${dashboardUrl}"
                 style="display:inline-block;padding:11px 28px;background:#1d4ed8;color:#ffffff;
                        text-decoration:none;border-radius:8px;font-size:14px;font-weight:600;">
                ダッシュボードを開く →
              </a>
            </div>
          </td>
        </tr>
        <tr>
          <td style="background:#f4f4f5;padding:16px 28px;border-top:1px solid #e4e4e7;">
            <p style="margin:0;font-size:11px;color:#a1a1aa;text-align:center;">
              このメールは Ad-Arch Group OS から自動送信されています。
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  try {
    await sendMail({ to: ["hiroki.shirakawa@adarch.co.jp"], subject, html });
  } catch (e) {
    console.error("[resend:group-weekly-report] error:", e instanceof Error ? e.message : e);
  }

  const summarySnippet = aiSummary.length > 300 ? aiSummary.slice(0, 300) + "…" : aiSummary;
  notifyCeo([
    `📋 グループ週報 ${weekId}`,
    `共有率: ${submitted}/${total}社（${rate}%）`,
    `🟢${statusCounts["GREEN"] ?? 0} 🟡${statusCounts["YELLOW"] ?? 0} 🔴${statusCounts["RED"] ?? 0}`,
    ``,
    summarySnippet,
    `🔗 ${appUrl("/dashboard/group-support")}`,
  ].join("\n")).catch(() => {});
}

// ---------------------------------------------------------------
// グループ請求書 メール送付（→ パートナー・PDF添付）
// ---------------------------------------------------------------
export type GroupInvoiceEmailPayload = {
  to: string[];
  bcc?: string[];
  partnerName: string;
  ownerName: string;
  invoiceNo: string;
  title: string;
  totalInclTax: number;
  dueDate: string | null; // 表示用文字列 or null
  pdfBuffer: Buffer;
  pdfFilename: string;
};

export async function sendGroupInvoiceEmail(payload: GroupInvoiceEmailPayload): Promise<void> {
  const { to, bcc, partnerName, ownerName, invoiceNo, title, totalInclTax, dueDate, pdfBuffer, pdfFilename } = payload;
  const subject = `【Ad Arch】請求書のご送付（${title}）`;

  const rows = [
    ["請求書番号", invoiceNo],
    ["件名", title],
    ["ご請求金額（税込）", `¥${totalInclTax.toLocaleString("ja-JP")}`],
    ["お支払期限", dueDate || "別途ご案内"],
  ]
    .map(([label, value]) => `
      <tr>
        <th style="${thStyle}">${escHtml(label)}</th>
        <td style="${tdStyle}">${escHtml(value)}</td>
      </tr>`)
    .join("");

  const html = `<!DOCTYPE html>
<html lang="ja">
<head><meta charset="UTF-8" /></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 0;">
    <tr><td align="center">
      <table width="580" cellpadding="0" cellspacing="0"
             style="background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e4e4e7;">
        <tr>
          <td style="background:#1e3a5f;padding:20px 28px;">
            <span style="color:#ffffff;font-size:18px;font-weight:700;letter-spacing:-0.3px;">Ad Arch</span>
            <span style="color:#c4a35a;font-size:13px;margin-left:8px;">請求書のご送付</span>
          </td>
        </tr>
        <tr>
          <td style="padding:28px;">
            <p style="margin:0 0 8px;font-size:14px;color:#18181b;font-weight:600;">${escHtml(partnerName)}<br>${escHtml(ownerName)} 様</p>
            <p style="margin:0 0 20px;font-size:14px;color:#3f3f46;line-height:1.7;">
              いつもお世話になっております。Ad Arch株式会社です。<br>
              下記のとおり請求書をお送りいたします。詳細は添付のPDFをご確認ください。
            </p>
            <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;font-size:14px;">
              ${rows}
            </table>
            <div style="margin-top:20px;padding:12px 16px;background:#f3f5f9;border-radius:8px;">
              <p style="margin:0;font-size:13px;color:#1e3a5f;">📎 請求書PDF（${escHtml(pdfFilename)}）を添付しています。</p>
            </div>
            <hr style="border:none;border-top:1px solid #e4e4e7;margin:24px 0 16px;" />
            <p style="margin:0;font-size:12px;color:#71717a;line-height:1.7;">
              Ad Arch株式会社<br>
              〒107-0062 東京都港区南青山2-15-5 FARO1F<br>
              info@adarch.co.jp
            </p>
          </td>
        </tr>
        <tr>
          <td style="background:#f4f4f5;padding:16px 28px;border-top:1px solid #e4e4e7;">
            <p style="margin:0;font-size:11px;color:#a1a1aa;text-align:center;">
              このメールは Ad-Arch Group OS から送信されています。
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  await sendMail({
    to,
    bcc,
    subject,
    html,
    attachments: [{ filename: pdfFilename, content: pdfBuffer }],
  });
}

// ---------------------------------------------------------------
// 案件マッチング — 募集終了通知（→ 選ばれなかった応募者）
// ---------------------------------------------------------------
export type ProjectClosedPayload = {
  to: string;
  applicantName: string;
  projectTitle: string;
};

export async function sendProjectClosedEmail(payload: ProjectClosedPayload) {
  const { to, applicantName, projectTitle } = payload;
  const subject = `【案件マッチング】「${projectTitle}」の募集が終了しました`;

  const html = `<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#fafafa;font-family:sans-serif;">
<div style="max-width:560px;margin:40px auto;background:#fff;border-radius:12px;border:1px solid #e4e4e7;overflow:hidden;">
  <div style="padding:24px 28px;border-bottom:1px solid #e4e4e7;">
    <h1 style="margin:0;font-size:16px;color:#18181b;">案件の募集が終了しました</h1>
  </div>
  <div style="padding:24px 28px;">
    <p style="font-size:14px;color:#3f3f46;line-height:1.7;margin:0 0 16px;">
      ${escHtml(applicantName)} さん
    </p>
    <p style="font-size:14px;color:#3f3f46;line-height:1.7;margin:0 0 16px;">
      ご応募いただいた案件「<strong>${escHtml(projectTitle)}</strong>」は、他の企業とマッチングが成立したため募集を終了しました。
    </p>
    <p style="font-size:14px;color:#3f3f46;line-height:1.7;margin:0 0 24px;">
      またの機会にぜひご応募ください。
    </p>
    <a href="${appUrl("/dashboard/project-matching")}"
       style="display:inline-block;padding:10px 20px;background:#2563eb;color:#fff;text-decoration:none;border-radius:6px;font-size:13px;font-weight:600;">
      案件一覧を見る
    </a>
  </div>
</div>
</body>
</html>`;

  try {
    await sendMail({ to: [to], subject, html });
  } catch (e) {
    console.error("[resend:project-closed] error:", e instanceof Error ? e.message : e);
  }
}

// ---------------------------------------------------------------
// クリエイター メール認証コード送信
// ---------------------------------------------------------------
export async function sendCreatorVerificationEmail(payload: {
  to: string;
  name: string;
  code: string;
}): Promise<void> {
  const { to, name, code } = payload;
  const subject = `【Ad Arch】メール認証コード: ${code}`;

  const html = `<!DOCTYPE html>
<html lang="ja">
<head><meta charset="UTF-8" /></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 0;">
    <tr><td align="center">
      <table width="580" cellpadding="0" cellspacing="0"
             style="background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e4e4e7;">
        <tr>
          <td style="background:#0a0a14;padding:20px 28px;">
            <span style="color:#ffffff;font-size:18px;font-weight:700;">Ad Arch</span>
            <span style="color:#a5b4fc;font-size:13px;margin-left:8px;">Creator Network</span>
          </td>
        </tr>
        <tr>
          <td style="padding:28px;text-align:center;">
            <p style="margin:0 0 16px;font-size:14px;color:#3f3f46;">
              ${escHtml(name)} さん
            </p>
            <p style="margin:0 0 24px;font-size:14px;color:#3f3f46;line-height:1.7;">
              クリエイター登録のメール認証コードです。<br>
              以下のコードを画面に入力してください。
            </p>
            <div style="background:#f4f4f5;border-radius:12px;padding:20px;margin:0 auto 24px;max-width:200px;">
              <span style="font-size:32px;font-weight:700;letter-spacing:8px;color:#18181b;">${code}</span>
            </div>
            <p style="margin:0;font-size:12px;color:#a1a1aa;">
              このコードは10分間有効です。<br>
              心当たりがない場合はこのメールを無視してください。
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  try {
    await sendMail({ to: [to], subject, html });
  } catch (e) {
    console.error("[resend:creator-verify] error:", e instanceof Error ? e.message : e);
  }
}

// ---------------------------------------------------------------
// クリエイター登録完了メール（クリエイター宛）
// ---------------------------------------------------------------
export async function sendCreatorWelcomeEmail(payload: {
  to: string;
  name: string;
  skills: string[];
  prefecture: string;
}): Promise<void> {
  const { to, name, skills, prefecture } = payload;
  const subject = "【Ad Arch】クリエイター登録が完了しました";

  const skillTags = skills
    .map((s) => `<span style="display:inline-block;padding:3px 10px;background:#eef2ff;color:#4338ca;border-radius:20px;font-size:12px;margin:2px;">${escHtml(s)}</span>`)
    .join(" ");

  const html = `<!DOCTYPE html>
<html lang="ja">
<head><meta charset="UTF-8" /></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 0;">
    <tr><td align="center">
      <table width="580" cellpadding="0" cellspacing="0"
             style="background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e4e4e7;">
        <tr>
          <td style="background:#0a0a14;padding:20px 28px;">
            <span style="color:#ffffff;font-size:18px;font-weight:700;letter-spacing:-0.3px;">Ad Arch</span>
            <span style="color:#a5b4fc;font-size:13px;margin-left:8px;">Creator Network</span>
          </td>
        </tr>
        <tr>
          <td style="padding:28px;">
            <p style="margin:0 0 16px;font-size:14px;color:#3f3f46;">
              ${escHtml(name)} さん
            </p>
            <p style="margin:0 0 20px;font-size:14px;color:#3f3f46;line-height:1.7;">
              クリエイターネットワークへのご登録ありがとうございます。<br>
              ご登録内容を確認の上、プロジェクトのご相談をお送りいたします。
            </p>

            <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-bottom:20px;">
              <tr>
                <th style="${thStyle}">活動拠点</th>
                <td style="${tdStyle}">${escHtml(prefecture)}</td>
              </tr>
              <tr>
                <th style="${thStyle}">登録スキル</th>
                <td style="padding:8px 12px;font-size:14px;border-bottom:1px solid #e4e4e7;">${skillTags}</td>
              </tr>
            </table>

            <p style="margin:0 0 12px;font-size:13px;color:#71717a;line-height:1.6;">
              ご不明点がございましたら、本メールへの返信にてお問い合わせください。
            </p>

            <hr style="border:none;border-top:1px solid #e4e4e7;margin:20px 0;" />
            <p style="margin:0;font-size:11px;color:#a1a1aa;">
              Ad Arch株式会社 Creator Network<br>
              ※ 本メールはクリエイター登録時に自動送信されています。
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  try {
    await sendMail({ to: [to], subject, html });
  } catch (e) {
    console.error("[resend:creator-welcome] error:", e instanceof Error ? e.message : e);
  }
}

// ---------------------------------------------------------------
// クリエイター新規登録通知（ADMIN宛）
// ---------------------------------------------------------------
export async function sendCreatorRegistrationNotifyEmail(payload: {
  name: string;
  email: string;
  prefecture: string;
  entityType: string;
  skills: string[];
  dayRate: number | null;
  website: string | null;
  creatorId: string;
}): Promise<void> {
  const { name, email, prefecture, entityType, skills, dayRate, website, creatorId } = payload;
  const adminTo = process.env.NOTIFICATION_EMAIL_TO || ADMIN_EMAIL;
  const subject = `【クリエイター登録】${name}さんが新規登録しました`;
  const detailUrl = appUrl(`/dashboard/creators/${creatorId}`);

  const skillTags = skills
    .map((s) => `<span style="display:inline-block;padding:3px 10px;background:#eef2ff;color:#4338ca;border-radius:20px;font-size:12px;margin:2px;">${escHtml(s)}</span>`)
    .join(" ");

  const rows = [
    ["氏名", name],
    ["メール", email],
    ["区分", entityType === "corporation" ? "法人" : "個人"],
    ["活動拠点", prefecture],
    ["日額単価", dayRate ? `¥${dayRate.toLocaleString()}` : "未入力"],
    ["Webサイト", website || "未入力"],
  ]
    .map(
      ([label, value]) => `
      <tr>
        <th style="${thStyle}">${escHtml(label)}</th>
        <td style="${tdStyle}">${escHtml(value)}</td>
      </tr>`
    )
    .join("");

  const html = `<!DOCTYPE html>
<html lang="ja">
<head><meta charset="UTF-8" /></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 0;">
    <tr><td align="center">
      <table width="580" cellpadding="0" cellspacing="0"
             style="background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e4e4e7;">
        <tr>
          <td style="background:#1d4ed8;padding:20px 28px;">
            <span style="color:#ffffff;font-size:18px;font-weight:700;">Ad-Arch OS</span>
            <span style="color:#bfdbfe;font-size:13px;margin-left:8px;">クリエイター新規登録</span>
          </td>
        </tr>
        <tr>
          <td style="padding:28px;">
            <p style="margin:0 0 20px;font-size:14px;color:#3f3f46;">
              新しいクリエイターが登録しました。内容を確認してください。
            </p>
            <table width="100%" cellpadding="0" cellspacing="0"
                   style="border-collapse:collapse;font-size:14px;">
              ${rows}
              <tr>
                <th style="${thStyle}">スキル</th>
                <td style="padding:8px 12px;font-size:14px;border-bottom:1px solid #e4e4e7;">${skillTags}</td>
              </tr>
            </table>
            <div style="margin-top:24px;text-align:center;">
              <a href="${detailUrl}"
                 style="display:inline-block;padding:10px 24px;background:#2563eb;color:#fff;text-decoration:none;border-radius:6px;font-size:13px;font-weight:600;">
                詳細を確認する
              </a>
            </div>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  try {
    await sendMail({ to: [adminTo], subject, html });
  } catch (e) {
    console.error("[resend:creator-notify] error:", e instanceof Error ? e.message : e);
  }
}

// ---------------------------------------------------------------
// 加盟の資料請求・お問い合わせへの自動返信（代表名義）
// LP（adarch.co.jp/intro/, partner.html）からの inquiry_type=partnership に対して即時返信する。
// 広告経由の請求は深夜・休日にも入るため、人手を待たずに資料を届けるのが目的。
// ---------------------------------------------------------------
const DOC_PDF_URL = "https://adarch.co.jp/intro/AdArch-overview.pdf";
const BOOKING_URL = "https://timerex.net/s/AdArch/b42bc7ae";

export async function sendPartnershipAutoReply(params: {
  name: string;
  email: string;
}): Promise<void> {
  const { name, email } = params;
  const subject = "資料をお送りします｜アドアーチグループ";

  const linkBtn = (href: string, label: string, primary: boolean) => `
    <a href="${href}" target="_blank"
       style="display:inline-block;padding:14px 30px;border-radius:6px;text-decoration:none;
              font-size:15px;font-weight:700;letter-spacing:.02em;
              ${primary
                ? "background:#C9A227;color:#10203a;"
                : "background:#ffffff;color:#1F3A5F;border:1px solid #1F3A5F;"}">
      ${label}
    </a>`;

  const html = `<!DOCTYPE html>
<html lang="ja">
<head><meta charset="UTF-8" /></head>
<body style="margin:0;padding:0;background:#f6f5f1;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f6f5f1;padding:28px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0"
             style="background:#ffffff;border-radius:10px;overflow:hidden;border:1px solid #e8e4da;">
        <tr>
          <td style="border-top:3px solid #C9A227;padding:32px 34px 28px;
                     font-family:'Hiragino Sans','Noto Sans JP',sans-serif;
                     font-size:15px;line-height:2;color:#2b3646;">

            <p style="margin:0 0 20px;">${escHtml(name)} 様</p>

            <p style="margin:0 0 20px;">
              はじめまして。<br />
              Ad Arch株式会社の白川です。
            </p>

            <p style="margin:0 0 20px;">
              この度は資料をご請求いただき、ありがとうございます！
            </p>

            <p style="margin:0 0 10px;">
              下記より、事前説明資料（PDF・全15ページ）をご覧いただけます。
            </p>

            <p style="margin:0 0 24px;text-align:center;">
              ${linkBtn(DOC_PDF_URL, "▶ 資料を見る（PDF）", true)}
            </p>

            <p style="margin:0 0 24px;">
              会社概要・これまでの実績・事業の仕組みをまとめております。<br />
              お目通しいただいて、気になる点がございましたら、このメールにそのままご返信ください。
            </p>

            <div style="border-top:1px dashed #e8e4da;padding-top:22px;margin-bottom:10px;">
              <p style="margin:0 0 6px;font-size:14px;font-weight:700;color:#1F3A5F;">
                【個別面談をご希望の場合】
              </p>
              <p style="margin:0 0 16px;font-size:14px;">
                オンライン・約30分で、私から直接ご説明いたします。<br />
                ご都合のよい日時をお選びください。
              </p>
              <p style="margin:0 0 18px;text-align:center;">
                ${linkBtn(BOOKING_URL, "▶ 日程を選ぶ", false)}
              </p>
            </div>

            <p style="margin:0 0 22px;font-size:14px;">
              無理な勧誘はいたしませんので、まずは話を聞いてみたい、それだけでも構いません。
            </p>

            <p style="margin:0 0 22px;">
              引き続きどうぞよろしくお願いいたします。
            </p>

            <p style="margin:0;">白川</p>

            <div style="margin-top:26px;padding-top:18px;border-top:1px solid #e8e4da;
                        font-size:12px;line-height:1.9;color:#6b7888;">
              Ad Arch株式会社<br />
              代表取締役/Producer 白川 裕喜 (Hiroki Shirakawa)<br />
              〒107-0062 東京都港区南青山2-15-5 FARO1F<br />
              HP: <a href="https://www.adarch.co.jp" style="color:#9c7d12;">https://www.adarch.co.jp</a>
            </div>
          </td>
        </tr>
      </table>
      <p style="margin:14px 0 0;font-size:11px;color:#a1a1aa;font-family:'Hiragino Sans',sans-serif;">
        このメールは資料請求をいただいた方へ自動でお送りしています。
      </p>
    </td></tr>
  </table>
</body>
</html>`;

  await sendMail({
    to: [email],
    subject,
    html,
    from: "白川 裕喜（Ad Arch株式会社） <info@adarch.co.jp>",
    replyTo: "hiroki.shirakawa@adarch.co.jp",
  });
}
