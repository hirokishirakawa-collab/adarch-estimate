// ---------------------------------------------------------------
// Resend メール送信ユーティリティ
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

// ---------------------------------------------------------------
// グループサポート サポート要請アラート（→ 管理者）
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
    const { error } = await resend.emails.send({
      from: FROM_ADDRESS,
      to: ["hiroki.shirakawa@adarch.co.jp"],
      subject,
      html,
    });
    if (error) {
      console.error("[resend:group-support-alert] error:", error);
    } else {
      console.log("[resend:group-support-alert] ✅ 送信完了:", companyName);
    }
  } catch (e) {
    console.error("[resend:group-support-alert] 例外:", e instanceof Error ? e.message : e);
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
    const { error } = await resend.emails.send({
      from: FROM_ADDRESS,
      to: ["hiroki.shirakawa@adarch.co.jp"],
      subject,
      html,
    });
    if (error) {
      console.error("[resend:group-weekly-report] error:", error);
    } else {
      console.log("[resend:group-weekly-report] ✅ 送信完了");
    }
  } catch (e) {
    console.error("[resend:group-weekly-report] 例外:", e instanceof Error ? e.message : e);
  }
}
