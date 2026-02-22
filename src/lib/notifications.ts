// ---------------------------------------------------------------
// 通知ユーティリティ — Resend によるメール送信
//
// 必要な環境変数:
//   RESEND_API_KEY        : Resend の API キー
//   NOTIFICATION_EMAIL_TO : フォールバック送信先（DB にユーザーが 0 件の場合に使用）
//
// ⚠️ 送信元について:
//   現在は onboarding@resend.dev（テスト用）を使用中。
//   本番運用時は adarch.co.jp を resend.com/domains で認証し、
//   FROM_ADDRESS を "Ad-Arch OS <pm@adarch.co.jp>" に戻してください。
// ---------------------------------------------------------------

import { Resend } from "resend";

const FROM_ADDRESS = "Ad-Arch OS <onboarding@resend.dev>";

/** 絶対 URL を生成する */
function appUrl(path: string): string {
  const base =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ??
    "http://localhost:3000";
  return `${base}${path}`;
}

/** 後方互換エイリアス */
function dealUrl(dealId: string): string {
  return appUrl(`/dashboard/deals/${dealId}`);
}

// ---------------------------------------------------------------
// ペイロード型
// ---------------------------------------------------------------
export type DealNotificationPayload =
  | {
      eventType: "STATUS_CHANGED";
      dealId: string;
      customerName: string;
      dealTitle: string;
      assigneeName: string | null;
      statusLabel: string;
      staffName: string;
    }
  | {
      eventType: "LOG_ADDED";
      dealId: string;
      customerName: string;
      dealTitle: string;
      assigneeName: string | null;
      logContent: string;
      logType: string;
      staffName: string;
    };

/** 活動タイプ → 日本語ラベル */
const LOG_TYPE_LABELS: Record<string, string> = {
  CALL:    "電話",
  EMAIL:   "メール",
  VISIT:   "訪問",
  MEETING: "打合せ",
  OTHER:   "その他",
  SYSTEM:  "システム",
};

// ---------------------------------------------------------------
// メイン送信関数
// ---------------------------------------------------------------
/**
 * 商談に関するメール通知を一斉送信する。
 *
 * @param payload    - 送信内容
 * @param userEmails - DB から取得した全ユーザーのメールアドレス配列。
 *                     空の場合は NOTIFICATION_EMAIL_TO にフォールバック。
 */
export async function sendDealNotification(
  payload: DealNotificationPayload,
  userEmails: string[]
): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const envTo  = process.env.NOTIFICATION_EMAIL_TO;

  if (!apiKey) return;

  // DB アドレス + フォールバックをマージして重複排除
  const fallback = (envTo ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const to = [...new Set([...userEmails, ...fallback])].filter(Boolean);

  if (to.length === 0) return;

  const { subject, html } = buildEmail(payload);

  try {
    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from: FROM_ADDRESS,
      to,
      subject,
      html,
    });
    if (error) {
      console.error("[notifications] Resend error:", error);
    }
  } catch (e) {
    console.error("[notifications] Failed to send email:", e);
  }
}

// ---------------------------------------------------------------
// 内部: 件名・HTML 本文を組み立てる
// ---------------------------------------------------------------
function buildEmail(payload: DealNotificationPayload): {
  subject: string;
  html: string;
} {
  const { customerName, dealTitle, assigneeName, staffName, dealId } = payload;
  const url = dealUrl(dealId);

  const subject = `【アドアーチOS】商談更新通知：${customerName} 様`;

  let updateRow: string;
  if (payload.eventType === "STATUS_CHANGED") {
    updateRow = `
      <tr>
        <th style="${thStyle}">更新内容</th>
        <td style="${tdStyle}">ステータス変更 → <strong>${escHtml(payload.statusLabel)}</strong></td>
      </tr>`;
  } else {
    const typeLabel = LOG_TYPE_LABELS[payload.logType] ?? payload.logType;
    const snippet =
      payload.logContent.length > 120
        ? payload.logContent.slice(0, 120) + "…"
        : payload.logContent;
    updateRow = `
      <tr>
        <th style="${thStyle}">更新内容</th>
        <td style="${tdStyle}">[${escHtml(typeLabel)}] ${escHtml(snippet)}</td>
      </tr>`;
  }

  const html = `
<!DOCTYPE html>
<html lang="ja">
<head><meta charset="UTF-8" /></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 0;">
    <tr><td align="center">
      <table width="580" cellpadding="0" cellspacing="0"
             style="background:#ffffff;border-radius:12px;overflow:hidden;
                    border:1px solid #e4e4e7;">

        <!-- ヘッダー -->
        <tr>
          <td style="background:#1e40af;padding:20px 28px;">
            <span style="color:#ffffff;font-size:18px;font-weight:700;letter-spacing:-0.3px;">
              Ad-Arch OS
            </span>
            <span style="color:#93c5fd;font-size:13px;margin-left:8px;">
              商談更新通知
            </span>
          </td>
        </tr>

        <!-- 本文 -->
        <tr>
          <td style="padding:28px;">
            <p style="margin:0 0 20px;font-size:14px;color:#3f3f46;">
              以下の商談が更新されました。
            </p>

            <table width="100%" cellpadding="0" cellspacing="0"
                   style="border-collapse:collapse;font-size:14px;">
              <tr>
                <th style="${thStyle}">顧客名</th>
                <td style="${tdStyle}">${escHtml(customerName)} 様</td>
              </tr>
              <tr>
                <th style="${thStyle}">商談タイトル</th>
                <td style="${tdStyle}">${escHtml(dealTitle)}</td>
              </tr>
              <tr>
                <th style="${thStyle}">担当者</th>
                <td style="${tdStyle}">${escHtml(assigneeName ?? "—")}</td>
              </tr>
              <tr>
                <th style="${thStyle}">更新者</th>
                <td style="${tdStyle}">${escHtml(staffName)}</td>
              </tr>
              ${updateRow}
            </table>

            <!-- 案件リンク -->
            <div style="margin-top:24px;text-align:center;">
              <a href="${url}"
                 style="display:inline-block;padding:11px 28px;
                        background:#1e40af;color:#ffffff;text-decoration:none;
                        border-radius:8px;font-size:14px;font-weight:600;">
                該当案件を開く →
              </a>
            </div>
          </td>
        </tr>

        <!-- フッター -->
        <tr>
          <td style="background:#f4f4f5;padding:16px 28px;border-top:1px solid #e4e4e7;">
            <p style="margin:0;font-size:11px;color:#a1a1aa;text-align:center;">
              このメールは Ad-Arch Group OS から自動送信されています。<br />
              心当たりのない場合はシステム管理者にご連絡ください。
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

  return { subject, html };
}

// ---------------------------------------------------------------
// ユーティリティ
// ---------------------------------------------------------------
const thStyle =
  "text-align:left;padding:8px 12px;background:#f4f4f5;" +
  "font-size:12px;font-weight:600;color:#71717a;white-space:nowrap;" +
  "border-bottom:1px solid #e4e4e7;width:110px;";

const tdStyle =
  "padding:8px 12px;font-size:14px;color:#18181b;" +
  "border-bottom:1px solid #e4e4e7;";

function escHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ---------------------------------------------------------------
// 請求依頼通知（送信先: 管理者 + 作成者）
// ---------------------------------------------------------------
export type InvoiceNotificationPayload = {
  eventType: "INVOICE_CREATED" | "INVOICE_UPDATED" | "INVOICE_SUBMITTED";
  requestId: string;
  subject: string;       // 件名
  clientName: string;    // 請求先名
  amountExclTax: number; // 税抜金額
  amountInclTax: number; // 税込金額
  creatorName: string;
  creatorEmail: string;  // 作成者本人（追加通知先）
};

const INVOICE_ADMIN_EMAIL = "hiroki.shirakawa@adarch.co.jp";

/**
 * 請求依頼の作成・更新を以下の2宛先に通知する:
 *   1. 管理者 (hiroki.shirakawa@adarch.co.jp)
 *   2. 作成者本人 (creatorEmail)
 * 同一メールアドレスの場合は重複排除して1通のみ送信する。
 */
export async function sendInvoiceNotification(
  payload: InvoiceNotificationPayload
): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("[notifications] RESEND_API_KEY が設定されていません。請求依頼通知をスキップします。");
    return;
  }

  const to = [...new Set([INVOICE_ADMIN_EMAIL, payload.creatorEmail].filter(Boolean))];
  const eventLabel =
    payload.eventType === "INVOICE_CREATED"   ? "新規申請" :
    payload.eventType === "INVOICE_SUBMITTED" ? "提出済み更新" : "更新";

  console.log(
    `[notifications] 請求依頼通知（白川さん + 登録者）: ${to.join(", ")} 宛に送信を試行中… [${eventLabel}: ${payload.subject}]`
  );

  const { subject: mailSubject, html } = buildInvoiceEmail(payload, eventLabel);

  try {
    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from: FROM_ADDRESS,
      to,
      subject: mailSubject,
      html,
    });
    if (error) {
      console.error("[notifications] Resend error (invoice):", error);
    } else {
      console.log(`[notifications] 請求依頼通知: ${to.join(", ")} 宛への送信が完了しました。`);
    }
  } catch (e) {
    console.error("[notifications] Failed to send invoice email:", e);
  }
}

function buildInvoiceEmail(
  payload: InvoiceNotificationPayload,
  eventLabel: string
): { subject: string; html: string } {
  const { subject: title, clientName, amountExclTax, amountInclTax, creatorName, requestId } = payload;
  const url = appUrl(`/dashboard/billing/${requestId}`);
  const mailSubject = `【アドアーチOS】請求依頼${eventLabel}：${title}`;

  const rows = [
    ["件名",           title],
    ["請求先名",       clientName],
    ["税抜金額",       `¥${amountExclTax.toLocaleString("ja-JP")}`],
    ["税込金額（10%）", `¥${amountInclTax.toLocaleString("ja-JP")}`],
    ["申請者",         creatorName],
    ["種別",           eventLabel],
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

        <!-- ヘッダー -->
        <tr>
          <td style="background:#7c3aed;padding:20px 28px;">
            <span style="color:#ffffff;font-size:18px;font-weight:700;letter-spacing:-0.3px;">
              Ad-Arch OS
            </span>
            <span style="color:#ddd6fe;font-size:13px;margin-left:8px;">
              請求依頼${eventLabel}通知
            </span>
          </td>
        </tr>

        <!-- 本文 -->
        <tr>
          <td style="padding:28px;">
            <p style="margin:0 0 20px;font-size:14px;color:#3f3f46;">
              請求依頼が${eventLabel}されました。内容を確認してください。
            </p>
            <table width="100%" cellpadding="0" cellspacing="0"
                   style="border-collapse:collapse;font-size:14px;">
              ${rows}
            </table>

            <!-- 詳細リンク -->
            <div style="margin-top:24px;text-align:center;">
              <a href="${url}"
                 style="display:inline-block;padding:11px 28px;
                        background:#7c3aed;color:#ffffff;text-decoration:none;
                        border-radius:8px;font-size:14px;font-weight:600;">
                請求依頼の詳細を開く →
              </a>
            </div>
          </td>
        </tr>

        <!-- フッター -->
        <tr>
          <td style="background:#f4f4f5;padding:16px 28px;border-top:1px solid #e4e4e7;">
            <p style="margin:0;font-size:11px;color:#a1a1aa;text-align:center;">
              このメールは Ad-Arch Group OS から自動送信されています。<br />
              心当たりのない場合はシステム管理者にご連絡ください。
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

  return { subject: mailSubject, html };
}

// ---------------------------------------------------------------
// 売上報告通知（送信先: 白川さん固定）
// ---------------------------------------------------------------
export type RevenueNotificationPayload = {
  eventType: "REVENUE_CREATED" | "REVENUE_UPDATED";
  reportId: string;
  targetMonth: string;   // "YYYY年M月" 形式
  amount: number;
  projectName: string | null;
  staffName: string;
};

const REVENUE_NOTIFICATION_TO = "hiroki.shirakawa@adarch.co.jp";

/**
 * 売上報告の作成・更新を白川さん（hiroki.shirakawa@adarch.co.jp）に通知する。
 * 送信先は固定。DB ユーザー一覧や環境変数には依存しない。
 */
export async function sendRevenueNotification(
  payload: RevenueNotificationPayload
): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("[notifications] RESEND_API_KEY が設定されていません。売上報告通知をスキップします。");
    return;
  }

  const { subject, html } = buildRevenueEmail(payload);
  const eventLabel = payload.eventType === "REVENUE_CREATED" ? "新規作成" : "更新";

  console.log(`[notifications] 売上報告通知: 白川さん宛（${REVENUE_NOTIFICATION_TO}）に送信を試行中… [${eventLabel}]`);

  try {
    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from: FROM_ADDRESS,
      to: [REVENUE_NOTIFICATION_TO],
      subject,
      html,
    });
    if (error) {
      console.error("[notifications] Resend error (revenue):", error);
    } else {
      console.log(`[notifications] 売上報告通知: 白川さん宛への送信が完了しました。`);
    }
  } catch (e) {
    console.error("[notifications] Failed to send revenue email:", e);
  }
}

function buildRevenueEmail(payload: RevenueNotificationPayload): {
  subject: string;
  html: string;
} {
  const { targetMonth, amount, projectName, staffName, eventType } = payload;
  const url = appUrl(`/dashboard/sales-report`);
  const eventLabel = eventType === "REVENUE_CREATED" ? "新規登録" : "更新";
  const subject = `【アドアーチOS】売上報告${eventLabel}：${targetMonth}`;
  const formattedAmount = `¥${amount.toLocaleString("ja-JP")}`;

  const rows = [
    ["計上月",         targetMonth],
    ["金額（税抜）",   formattedAmount],
    ["関連プロジェクト", projectName ?? "—"],
    ["操作者",         staffName],
    ["種別",           eventLabel],
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

        <!-- ヘッダー -->
        <tr>
          <td style="background:#b45309;padding:20px 28px;">
            <span style="color:#ffffff;font-size:18px;font-weight:700;letter-spacing:-0.3px;">
              Ad-Arch OS
            </span>
            <span style="color:#fde68a;font-size:13px;margin-left:8px;">
              売上報告${eventLabel}通知
            </span>
          </td>
        </tr>

        <!-- 本文 -->
        <tr>
          <td style="padding:28px;">
            <p style="margin:0 0 20px;font-size:14px;color:#3f3f46;">
              売上報告が${eventLabel}されました。
            </p>
            <table width="100%" cellpadding="0" cellspacing="0"
                   style="border-collapse:collapse;font-size:14px;">
              ${rows}
            </table>

            <!-- 一覧リンク -->
            <div style="margin-top:24px;text-align:center;">
              <a href="${url}"
                 style="display:inline-block;padding:11px 28px;
                        background:#b45309;color:#ffffff;text-decoration:none;
                        border-radius:8px;font-size:14px;font-weight:600;">
                売上報告一覧を開く →
              </a>
            </div>
          </td>
        </tr>

        <!-- フッター -->
        <tr>
          <td style="background:#f4f4f5;padding:16px 28px;border-top:1px solid #e4e4e7;">
            <p style="margin:0;font-size:11px;color:#a1a1aa;text-align:center;">
              このメールは Ad-Arch Group OS から自動送信されています。<br />
              心当たりのない場合はシステム管理者にご連絡ください。
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

  return { subject, html };
}

// ---------------------------------------------------------------
// 見積発行通知（送信先: 管理者 + 担当者）
// ---------------------------------------------------------------
export type EstimateNotificationPayload = {
  estimationId:  string;
  title:         string;        // 見積タイトル
  customerName:  string;        // 顧客名（顧客なしの場合は "—"）
  totalInclTax:  number;        // 合計金額（税込）
  staffName:     string;        // 担当者名
  staffEmail:    string;        // 担当者メールアドレス（送信先に追加）
};

const ESTIMATE_ADMIN_EMAIL = "hiroki.shirakawa@adarch.co.jp";

/**
 * 見積発行時に以下の2宛先へ通知する:
 *   1. 管理者 (hiroki.shirakawa@adarch.co.jp)
 *   2. 担当者本人 (staffEmail)
 * 同一アドレスの場合は重複排除して1通のみ送信する。
 */
export async function sendEstimateNotification(
  payload: EstimateNotificationPayload
): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("[notifications] RESEND_API_KEY が設定されていません。見積通知をスキップします。");
    return;
  }

  const to = [...new Set([ESTIMATE_ADMIN_EMAIL, payload.staffEmail].filter(Boolean))];

  console.log(
    `[notifications] 見積発行通知: ${to.join(", ")} 宛に送信を試行中… [${payload.title}]`
  );

  const { subject, html } = buildEstimateEmail(payload);

  try {
    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from: FROM_ADDRESS,
      to,
      subject,
      html,
    });
    if (error) {
      console.error("[notifications] Resend error (estimate):", error);
    } else {
      console.log(`[notifications] 見積発行通知: ${to.join(", ")} 宛への送信が完了しました。`);
    }
  } catch (e) {
    console.error("[notifications] Failed to send estimate email:", e);
  }
}

function buildEstimateEmail(payload: EstimateNotificationPayload): {
  subject: string;
  html: string;
} {
  const { estimationId, title, customerName, totalInclTax, staffName } = payload;
  const url = appUrl(`/dashboard/estimates/${estimationId}`);

  const hasCustomer = customerName !== "—";
  const subject = hasCustomer
    ? `【見積発行通知】${customerName} 御中 - ${title}`
    : `【見積発行通知】${title}`;

  const rows = [
    ["見積番号",        estimationId],
    ["顧客名",          hasCustomer ? `${customerName} 御中` : "—"],
    ["合計金額（税込）", `¥${totalInclTax.toLocaleString("ja-JP")}`],
    ["発行担当者",      staffName],
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

        <!-- ヘッダー -->
        <tr>
          <td style="background:#0f766e;padding:20px 28px;">
            <span style="color:#ffffff;font-size:18px;font-weight:700;letter-spacing:-0.3px;">
              Ad-Arch OS
            </span>
            <span style="color:#99f6e4;font-size:13px;margin-left:8px;">
              見積発行通知
            </span>
          </td>
        </tr>

        <!-- 本文 -->
        <tr>
          <td style="padding:28px;">
            <p style="margin:0 0 20px;font-size:14px;color:#3f3f46;">
              新しい見積書が発行されました。内容をご確認ください。
            </p>
            <table width="100%" cellpadding="0" cellspacing="0"
                   style="border-collapse:collapse;font-size:14px;">
              ${rows}
            </table>

            <!-- 詳細リンク -->
            <div style="margin-top:24px;text-align:center;">
              <a href="${url}"
                 style="display:inline-block;padding:11px 28px;
                        background:#0f766e;color:#ffffff;text-decoration:none;
                        border-radius:8px;font-size:14px;font-weight:600;">
                見積書の詳細を開く →
              </a>
            </div>
          </td>
        </tr>

        <!-- フッター -->
        <tr>
          <td style="background:#f4f4f5;padding:16px 28px;border-top:1px solid #e4e4e7;">
            <p style="margin:0;font-size:11px;color:#a1a1aa;text-align:center;">
              このメールは Ad-Arch Group OS から自動送信されています。<br />
              心当たりのない場合はシステム管理者にご連絡ください。
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

  return { subject, html };
}

// ---------------------------------------------------------------
// 媒体依頼通知（送信先: 白川さん固定）
// ---------------------------------------------------------------
export type MediaRequestNotificationPayload = {
  requestId:      string;
  mediaTypeLabel: string; // 解決済みラベル（例: "TVer"）
  mediaName:      string;
  customerName:   string | null;
  budget:         string | null;
  staffName:      string;
};

const MEDIA_NOTIFICATION_TO = "hiroki.shirakawa@adarch.co.jp";

/**
 * 媒体依頼の新規申請を白川さん（hiroki.shirakawa@adarch.co.jp）に通知する。
 */
export async function sendMediaRequestNotification(
  payload: MediaRequestNotificationPayload
): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("[notifications] RESEND_API_KEY が設定されていません。媒体依頼通知をスキップします。");
    return;
  }

  const { subject, html } = buildMediaRequestEmail(payload);

  console.log(
    `[notifications] 媒体依頼通知: ${MEDIA_NOTIFICATION_TO} 宛に送信を試行中… [${payload.mediaTypeLabel} / ${payload.mediaName}]`
  );

  try {
    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from: FROM_ADDRESS,
      to: [MEDIA_NOTIFICATION_TO],
      subject,
      html,
    });
    if (error) {
      console.error("[notifications] Resend error (media):", error);
    } else {
      console.log(`[notifications] 媒体依頼通知: ${MEDIA_NOTIFICATION_TO} 宛への送信が完了しました。`);
    }
  } catch (e) {
    console.error("[notifications] Failed to send media email:", e);
  }
}

function buildMediaRequestEmail(payload: MediaRequestNotificationPayload): {
  subject: string;
  html: string;
} {
  const { requestId, mediaTypeLabel, mediaName, customerName, budget, staffName } = payload;
  const url = appUrl(`/dashboard/media/${requestId}`);
  const subject = `【アドアーチOS】媒体依頼：${mediaTypeLabel} / ${mediaName}`;

  const rows = [
    ["媒体種別", mediaTypeLabel],
    ["媒体名",   mediaName],
    ["顧客",     customerName ?? "—"],
    ["費用・予算", budget ?? "—"],
    ["申請者",   staffName],
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

        <!-- ヘッダー -->
        <tr>
          <td style="background:#d97706;padding:20px 28px;">
            <span style="color:#ffffff;font-size:18px;font-weight:700;letter-spacing:-0.3px;">
              Ad-Arch OS
            </span>
            <span style="color:#fde68a;font-size:13px;margin-left:8px;">
              媒体依頼 新規申請通知
            </span>
          </td>
        </tr>

        <!-- 本文 -->
        <tr>
          <td style="padding:28px;">
            <p style="margin:0 0 20px;font-size:14px;color:#3f3f46;">
              新しい媒体依頼が申請されました。内容をご確認ください。
            </p>
            <table width="100%" cellpadding="0" cellspacing="0"
                   style="border-collapse:collapse;font-size:14px;">
              ${rows}
            </table>

            <!-- 詳細リンク -->
            <div style="margin-top:24px;text-align:center;">
              <a href="${url}"
                 style="display:inline-block;padding:11px 28px;
                        background:#d97706;color:#ffffff;text-decoration:none;
                        border-radius:8px;font-size:14px;font-weight:600;">
                媒体依頼の詳細を開く →
              </a>
            </div>
          </td>
        </tr>

        <!-- フッター -->
        <tr>
          <td style="background:#f4f4f5;padding:16px 28px;border-top:1px solid #e4e4e7;">
            <p style="margin:0;font-size:11px;color:#a1a1aa;text-align:center;">
              このメールは Ad-Arch Group OS から自動送信されています。<br />
              心当たりのない場合はシステム管理者にご連絡ください。
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

  return { subject, html };
}

// ---------------------------------------------------------------
// 顧客通知
// ---------------------------------------------------------------
export type CustomerNotificationPayload = {
  eventType: "CUSTOMER_CREATED";
  customerId: string;
  customerName: string;
  contactName: string | null;
  prefecture: string | null;
  industry: string | null;
  staffName: string;
};

/**
 * 顧客管理に関するメール通知を一斉送信する。
 * ロジックは sendDealNotification と同じ（送信先解決 → Resend）。
 */
export async function sendCustomerNotification(
  payload: CustomerNotificationPayload,
  userEmails: string[]
): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const envTo  = process.env.NOTIFICATION_EMAIL_TO;

  if (!apiKey) return;

  const fallback = (envTo ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const to = [...new Set([...userEmails, ...fallback])].filter(Boolean);
  if (to.length === 0) return;

  const { subject, html } = buildCustomerEmail(payload);

  try {
    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from: FROM_ADDRESS,
      to,
      subject,
      html,
    });
    if (error) {
      console.error("[notifications] Resend error (customer):", error);
    }
  } catch (e) {
    console.error("[notifications] Failed to send customer email:", e);
  }
}

function buildCustomerEmail(payload: CustomerNotificationPayload): {
  subject: string;
  html: string;
} {
  const { customerName, contactName, prefecture, industry, staffName, customerId } = payload;
  const url = appUrl(`/dashboard/customers/${customerId}`);
  const subject = `【アドアーチOS】新規顧客登録：${customerName} 様`;

  const rows = [
    ["会社名",   customerName],
    ["担当者",   contactName ?? "—"],
    ["都道府県", prefecture  ?? "—"],
    ["業種",     industry    ?? "—"],
    ["登録者",   staffName],
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

        <!-- ヘッダー -->
        <tr>
          <td style="background:#059669;padding:20px 28px;">
            <span style="color:#ffffff;font-size:18px;font-weight:700;letter-spacing:-0.3px;">
              Ad-Arch OS
            </span>
            <span style="color:#a7f3d0;font-size:13px;margin-left:8px;">
              新規顧客登録通知
            </span>
          </td>
        </tr>

        <!-- 本文 -->
        <tr>
          <td style="padding:28px;">
            <p style="margin:0 0 20px;font-size:14px;color:#3f3f46;">
              新しい顧客が登録されました。
            </p>
            <table width="100%" cellpadding="0" cellspacing="0"
                   style="border-collapse:collapse;font-size:14px;">
              ${rows}
            </table>

            <!-- 顧客リンク -->
            <div style="margin-top:24px;text-align:center;">
              <a href="${url}"
                 style="display:inline-block;padding:11px 28px;
                        background:#059669;color:#ffffff;text-decoration:none;
                        border-radius:8px;font-size:14px;font-weight:600;">
                顧客詳細を開く →
              </a>
            </div>
          </td>
        </tr>

        <!-- フッター -->
        <tr>
          <td style="background:#f4f4f5;padding:16px 28px;border-top:1px solid #e4e4e7;">
            <p style="margin:0;font-size:11px;color:#a1a1aa;text-align:center;">
              このメールは Ad-Arch Group OS から自動送信されています。<br />
              心当たりのない場合はシステム管理者にご連絡ください。
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

  return { subject, html };
}
