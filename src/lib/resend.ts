// ---------------------------------------------------------------
// Resend メール送信ユーティリティ（TVer配信申請 通知用）
// ---------------------------------------------------------------

import { Resend } from "resend";

// ビルド時クラッシュ防止のため Proxy で遅延初期化
let _resend: Resend | null = null;
const resend = new Proxy({} as Resend, {
  get(_target, prop) {
    if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY);
    return (_resend as never)[prop as keyof Resend];
  },
});

const FROM_ADDRESS = "Ad-Arch OS <noreply@adarch.co.jp>";
const ADMIN_EMAIL  = "system@adarch.co.jp";

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
    const { error } = await resend.emails.send({
      from:    FROM_ADDRESS,
      to:      [ADMIN_EMAIL],
      subject,
      html,
    });
    if (error) {
      console.error("[resend:tver-campaign-created] error:", error);
    } else {
      console.log("[resend:tver-campaign-created] ✅ 送信完了 to:", ADMIN_EMAIL);
    }
  } catch (e) {
    console.error("[resend:tver-campaign-created] 例外:", e instanceof Error ? e.message : e);
  }
}
