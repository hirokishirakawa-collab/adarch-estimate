// ---------------------------------------------------------------
// 通知ユーティリティ — Gmail API（Google OAuth2）によるメール送信
//
// 【環境変数（Railway Variables に設定）】
//   GOOGLE_CLIENT_ID     : OAuth2 クライアント ID
//   GOOGLE_CLIENT_SECRET : OAuth2 クライアント シークレット
//   GOOGLE_REFRESH_TOKEN : OAuth2 リフレッシュトークン
//   GMAIL_USER           : 送信元メールアドレス（例: hiroki.shirakawa@adarch.co.jp）
//   EMAIL_ALL            : 全メンバー向けアドレス（カンマ区切り）
//   EMAIL_CEO            : 白川専用（全通知を受信）
//   EMAIL_SELECTED       : 選抜メンバー向け（グループ連携依頼）
//
// 【振り分けルール】
//   顧客管理・商談管理（作成・更新）   → EMAIL_ALL + EMAIL_CEO
//   請求依頼・見積・売上報告・媒体依頼 → EMAIL_CEO のみ
//   グループ連携依頼                   → EMAIL_CEO + EMAIL_SELECTED
// ---------------------------------------------------------------

import { google } from "googleapis";

const FROM_ADDRESS = `Ad-Arch Group <${process.env.GMAIL_USER ?? "hiroki.shirakawa@adarch.co.jp"}>`;

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
// 宛先解決ロジック（一元管理）
// ---------------------------------------------------------------
type NotificationTier = "all_and_ceo" | "ceo_only" | "ceo_and_selected";

/**
 * 通知ティアに応じて送信先メールアドレスを解決する。
 * 未設定の環境変数は無視し、設定済みの宛先のみ返す（重複排除）。
 */
function resolveRecipients(tier: NotificationTier): string[] {
  // 改行・スペース・全角スペースを含む区切り文字をすべて正規化して分割
  const parse = (val: string | undefined) =>
    (val ?? "")
      .replace(/[\r\n\u3000]/g, ",")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

  const all      = parse(process.env.EMAIL_ALL);
  const ceo      = parse(process.env.EMAIL_CEO);
  const selected = parse(process.env.EMAIL_SELECTED);

  // デバッグ: 環境変数の解決結果をログ出力
  console.log(
    `[notifications] resolveRecipients(${tier})` +
    ` EMAIL_ALL=[${all.join(",")}]` +
    ` EMAIL_CEO=[${ceo.join(",")}]` +
    ` EMAIL_SELECTED=[${selected.join(",")}]`
  );

  let addrs: string[];
  switch (tier) {
    case "all_and_ceo":      addrs = [...all, ...ceo];      break;
    case "ceo_only":         addrs = ceo;                   break;
    case "ceo_and_selected": addrs = [...ceo, ...selected]; break;
  }

  return [...new Set(addrs)];
}

// ---------------------------------------------------------------
// 共通メール送信ヘルパー（Gmail API・1件ずつ個別送信）
// ---------------------------------------------------------------
async function sendEmail(
  tag: string,
  to: string[],
  subject: string,
  html: string
): Promise<void> {
  const clientId     = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;
  const senderEmail  = process.env.GMAIL_USER ?? "hiroki.shirakawa@adarch.co.jp";

  // ① 認証情報の確認
  if (!clientId || !clientSecret || !refreshToken) {
    console.error(
      `[notifications:${tag}] ❌ GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET / GOOGLE_REFRESH_TOKEN が未設定 → スキップ`
    );
    return;
  }
  if (to.length === 0) {
    console.warn(`[notifications:${tag}] ⚠️ 宛先が0件 → スキップ`);
    return;
  }

  console.log(
    `[notifications:${tag}] 📤 送信開始 from="${senderEmail}" 宛先${to.length}件 subject="${subject}"`
  );

  // ② Gmail API クライアントを初期化
  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret);
  oauth2Client.setCredentials({ refresh_token: refreshToken });
  const gmail = google.gmail({ version: "v1", auth: oauth2Client });

  // ③ 宛先ごとに個別送信
  for (const addr of to) {
    try {
      console.log(`[notifications:${tag}]   → 送信試行 to="${addr}"`);

      // RFC 2822 形式でメッセージを組み立て → base64url エンコード
      const raw = [
        `From: Ad-Arch Group <${senderEmail}>`,
        `To: ${addr}`,
        `Subject: =?UTF-8?B?${Buffer.from(subject).toString("base64")}?=`,
        `MIME-Version: 1.0`,
        `Content-Type: text/html; charset=UTF-8`,
        ``,
        html,
      ].join("\r\n");

      const encoded = Buffer.from(raw)
        .toString("base64")
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");

      const result = await gmail.users.messages.send({
        userId: "me",
        requestBody: { raw: encoded },
      });

      console.log(`[notifications:${tag}]   ✅ 送信成功 to=${addr} id=${result.data.id}`);
    } catch (e) {
      console.error(
        `[notifications:${tag}]   ❌ 送信失敗 (to=${addr}):`,
        e instanceof Error ? e.message : String(e)
      );
    }

    await new Promise((r) => setTimeout(r, 1000));
  }

  console.log("Notification process completed.");
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
    }
  | {
      eventType: "DEAL_CREATED";
      dealId: string;
      customerName: string;
      dealTitle: string;
      statusLabel: string;
      amount: number | null;
      staffName: string;
    }
  | {
      eventType: "DEAL_UPDATED";
      dealId: string;
      customerName: string;
      dealTitle: string;
      statusLabel: string;
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
 * 宛先: EMAIL_ALL + EMAIL_CEO
 */
export async function sendDealNotification(
  payload: DealNotificationPayload
): Promise<void> {
  const to = resolveRecipients("all_and_ceo");
  const { subject, html } = buildEmail(payload);
  await sendEmail("deal", to, subject, html);
}

// ---------------------------------------------------------------
// 内部: 件名・HTML 本文を組み立てる
// ---------------------------------------------------------------
function buildEmail(payload: DealNotificationPayload): {
  subject: string;
  html: string;
} {
  const { customerName, dealTitle, staffName, dealId } = payload;
  const assigneeName =
    "assigneeName" in payload ? payload.assigneeName : null;
  const url = dealUrl(dealId);

  const eventLabels: Record<string, string> = {
    STATUS_CHANGED: "商談更新通知",
    LOG_ADDED:      "活動記録通知",
    DEAL_CREATED:   "新規商談登録通知",
    DEAL_UPDATED:   "商談情報更新通知",
  };
  const subject = `【アドアーチOS】${eventLabels[payload.eventType] ?? "商談通知"}：${customerName} 様`;

  let updateRow: string;
  if (payload.eventType === "STATUS_CHANGED") {
    updateRow = `
      <tr>
        <th style="${thStyle}">更新内容</th>
        <td style="${tdStyle}">ステータス変更 → <strong>${escHtml(payload.statusLabel)}</strong></td>
      </tr>`;
  } else if (payload.eventType === "LOG_ADDED") {
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
  } else if (payload.eventType === "DEAL_CREATED") {
    const amountStr =
      payload.amount != null
        ? `¥${payload.amount.toLocaleString("ja-JP")}`
        : "未定";
    updateRow = `
      <tr>
        <th style="${thStyle}">更新内容</th>
        <td style="${tdStyle}">新規商談を登録しました（ステータス：${escHtml(payload.statusLabel)}、金額：${escHtml(amountStr)}）</td>
      </tr>`;
  } else {
    // DEAL_UPDATED
    updateRow = `
      <tr>
        <th style="${thStyle}">更新内容</th>
        <td style="${tdStyle}">商談情報を更新しました（ステータス：${escHtml(payload.statusLabel)}）</td>
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

/**
 * 請求依頼の作成・更新を通知する。
 * 宛先: EMAIL_CEO のみ
 */
export async function sendInvoiceNotification(
  payload: InvoiceNotificationPayload
): Promise<void> {
  const eventLabel =
    payload.eventType === "INVOICE_CREATED"   ? "新規申請" :
    payload.eventType === "INVOICE_SUBMITTED" ? "提出済み更新" : "更新";
  const to = resolveRecipients("ceo_only");
  const { subject, html } = buildInvoiceEmail(payload, eventLabel);
  await sendEmail("invoice", to, subject, html);
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
// 売上報告通知（送信先: EMAIL_CEO）
// ---------------------------------------------------------------
export type RevenueNotificationPayload = {
  eventType: "REVENUE_CREATED" | "REVENUE_UPDATED";
  reportId: string;
  targetMonth: string;   // "YYYY年M月" 形式
  amount: number;
  projectName: string | null;
  staffName: string;
};

/**
 * 売上報告の作成・更新を通知する。
 * 宛先: EMAIL_CEO のみ
 */
export async function sendRevenueNotification(
  payload: RevenueNotificationPayload
): Promise<void> {
  const to = ["hiroki.shirakawa@adarch.co.jp"];
  const { subject, html } = buildRevenueEmail(payload);
  await sendEmail("revenue", to, subject, html);
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

/**
 * 見積発行時に通知する。
 * 宛先: EMAIL_CEO のみ
 */
export async function sendEstimateNotification(
  payload: EstimateNotificationPayload
): Promise<void> {
  const to = resolveRecipients("ceo_only");
  const { subject, html } = buildEstimateEmail(payload);
  await sendEmail("estimate", to, subject, html);
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

/**
 * 媒体依頼の新規申請を通知する。
 * 宛先: EMAIL_CEO のみ
 */
export async function sendMediaRequestNotification(
  payload: MediaRequestNotificationPayload
): Promise<void> {
  const to = resolveRecipients("ceo_only");
  const { subject, html } = buildMediaRequestEmail(payload);
  await sendEmail("media", to, subject, html);
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
// TVer広告主 業態考査申請 通知
// ---------------------------------------------------------------
export type AdvertiserReviewCreatedPayload = {
  reviewId:       string;
  advertiserName: string;
  staffName:      string;
  productUrl:     string;
};

export type AdvertiserReviewResultPayload = {
  reviewId:       string;
  advertiserName: string;
  status:         "APPROVED" | "REJECTED";
  reviewNote:     string | null;
  creatorEmail:   string; // 申請者への直送
};

/**
 * 新規業態考査申請 → 管理者（EMAIL_CEO）へ通知
 */
export async function sendAdvertiserReviewCreatedNotification(
  payload: AdvertiserReviewCreatedPayload
): Promise<void> {
  const to = resolveRecipients("ceo_only");
  const { subject, html } = buildAdvertiserReviewCreatedEmail(payload);
  await sendEmail("advertiser-review-created", to, subject, html);
}

function buildAdvertiserReviewCreatedEmail(
  payload: AdvertiserReviewCreatedPayload
): { subject: string; html: string } {
  const { reviewId, advertiserName, staffName, productUrl } = payload;
  const url     = appUrl(`/dashboard/tver-review/${reviewId}`);
  const subject = `【アドアーチOS】TVer業態考査 新規申請：${advertiserName}`;

  const rows = [
    ["広告主名",       advertiserName],
    ["商材サイト",     productUrl],
    ["申請者",         staffName],
  ]
    .map(([label, value]) => `
      <tr>
        <th style="${thStyle}">${escHtml(label)}</th>
        <td style="${tdStyle}">${escHtml(value)}</td>
      </tr>`)
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
            <span style="color:#bfdbfe;font-size:13px;margin-left:8px;">TVer業態考査 新規申請通知</span>
          </td>
        </tr>
        <tr>
          <td style="padding:28px;">
            <p style="margin:0 0 20px;font-size:14px;color:#3f3f46;">
              TVer広告主の業態考査申請が届きました。内容をご確認の上、審査をお願いします。
            </p>
            <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;font-size:14px;">
              ${rows}
            </table>
            <div style="margin-top:24px;text-align:center;">
              <a href="${url}"
                 style="display:inline-block;padding:11px 28px;background:#1d4ed8;color:#ffffff;
                        text-decoration:none;border-radius:8px;font-size:14px;font-weight:600;">
                申請内容を確認・審査する →
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

  return { subject, html };
}

/**
 * 承認/否決結果 → 申請者（担当者）へ直接通知
 */
export async function sendAdvertiserReviewResultNotification(
  payload: AdvertiserReviewResultPayload
): Promise<void> {
  const { subject, html } = buildAdvertiserReviewResultEmail(payload);
  await sendEmail("advertiser-review-result", [payload.creatorEmail], subject, html);
}

function buildAdvertiserReviewResultEmail(
  payload: AdvertiserReviewResultPayload
): { subject: string; html: string } {
  const { reviewId, advertiserName, status, reviewNote } = payload;
  const url         = appUrl(`/dashboard/tver-review/${reviewId}`);
  const statusLabel = status === "APPROVED" ? "承認" : "否決";
  const headerColor = status === "APPROVED" ? "#059669" : "#dc2626";
  const btnColor    = status === "APPROVED" ? "#059669" : "#dc2626";
  const subject     = `【アドアーチOS】TVer業態考査 ${statusLabel}：${advertiserName}`;

  const noteRow = reviewNote
    ? `<tr>
        <th style="${thStyle}">審査コメント</th>
        <td style="${tdStyle}">${escHtml(reviewNote)}</td>
      </tr>`
    : "";

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
          <td style="background:${headerColor};padding:20px 28px;">
            <span style="color:#ffffff;font-size:18px;font-weight:700;letter-spacing:-0.3px;">Ad-Arch OS</span>
            <span style="color:#ffffff;font-size:13px;margin-left:8px;opacity:0.85;">TVer業態考査 審査結果</span>
          </td>
        </tr>
        <tr>
          <td style="padding:28px;">
            <p style="margin:0 0 20px;font-size:14px;color:#3f3f46;">
              申請された業態考査の審査結果をお知らせします。
            </p>
            <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;font-size:14px;">
              <tr>
                <th style="${thStyle}">広告主名</th>
                <td style="${tdStyle}">${escHtml(advertiserName)}</td>
              </tr>
              <tr>
                <th style="${thStyle}">審査結果</th>
                <td style="${tdStyle}"><strong>${statusLabel}</strong></td>
              </tr>
              ${noteRow}
            </table>
            <div style="margin-top:24px;text-align:center;">
              <a href="${url}"
                 style="display:inline-block;padding:11px 28px;background:${btnColor};color:#ffffff;
                        text-decoration:none;border-radius:8px;font-size:14px;font-weight:600;">
                申請詳細を確認する →
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

  return { subject, html };
}

// ---------------------------------------------------------------
// 顧客通知
// ---------------------------------------------------------------
export type CustomerNotificationPayload =
  | {
      eventType: "CUSTOMER_CREATED";
      customerId: string;
      customerName: string;
      contactName: string | null;
      prefecture: string | null;
      industry: string | null;
      staffName: string;
    }
  | {
      eventType: "CUSTOMER_UPDATED";
      customerId: string;
      customerName: string;
      contactName: string | null;
      prefecture: string | null;
      industry: string | null;
      staffName: string;
      changedCount: number;
    };

/**
 * 顧客管理に関するメール通知を一斉送信する。
 * 宛先: EMAIL_ALL + EMAIL_CEO
 */
export async function sendCustomerNotification(
  payload: CustomerNotificationPayload
): Promise<void> {
  const to = resolveRecipients("all_and_ceo");
  const { subject, html } = buildCustomerEmail(payload);
  await sendEmail("customer", to, subject, html);
}

function buildCustomerEmail(payload: CustomerNotificationPayload): {
  subject: string;
  html: string;
} {
  const { customerName, contactName, prefecture, industry, staffName, customerId } = payload;
  const url = appUrl(`/dashboard/customers/${customerId}`);
  const eventLabel =
    payload.eventType === "CUSTOMER_CREATED" ? "新規顧客登録" : "顧客情報更新";
  const subject = `【アドアーチOS】${eventLabel}：${customerName} 様`;

  const actionLabel =
    payload.eventType === "CUSTOMER_CREATED"
      ? "登録者"
      : `更新者（${payload.changedCount}項目変更）`;
  const rows = [
    ["会社名",       customerName],
    ["先方担当者",   contactName ?? "—"],
    ["都道府県",     prefecture  ?? "—"],
    ["業種",         industry    ?? "—"],
    [actionLabel,   staffName],
  ]
    .map(
      ([label, value]) => `
      <tr>
        <th style="${thStyle}">${escHtml(label)}</th>
        <td style="${tdStyle}">${escHtml(value)}</td>
      </tr>`
    )
    .join("");

  const bodyText =
    payload.eventType === "CUSTOMER_CREATED"
      ? "新しい顧客が登録されました。"
      : `顧客情報が更新されました（${payload.changedCount}項目）。`;

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
              ${escHtml(eventLabel)}通知
            </span>
          </td>
        </tr>

        <!-- 本文 -->
        <tr>
          <td style="padding:28px;">
            <p style="margin:0 0 20px;font-size:14px;color:#3f3f46;">
              ${escHtml(bodyText)}
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

// ---------------------------------------------------------------
// グループ連携依頼通知（送信先: EMAIL_CEO + EMAIL_SELECTED）
// ---------------------------------------------------------------
export type CollaborationNotificationPayload = {
  eventType: "COLLABORATION_CREATED";
  requestId: string;
  counterpartName: string;
  requestType: string;
  description: string;
  staffName: string;
  branchName: string | null;
};

/**
 * グループ連携依頼の新規申請を通知する。
 * 宛先: EMAIL_CEO + EMAIL_SELECTED
 */
export async function sendCollaborationNotification(
  payload: CollaborationNotificationPayload
): Promise<void> {
  const to = resolveRecipients("ceo_and_selected");
  const { subject, html } = buildCollaborationEmail(payload);
  await sendEmail("collaboration", to, subject, html);
}

function buildCollaborationEmail(payload: CollaborationNotificationPayload): {
  subject: string;
  html: string;
} {
  const { requestId, counterpartName, requestType, description, staffName, branchName } = payload;
  const url     = appUrl(`/dashboard/group-sync/${requestId}`);
  const subject = `【アドアーチOS】グループ連携依頼：${requestType} / ${counterpartName}`;
  const snippet = description.length > 120 ? description.slice(0, 120) + "…" : description;

  const rows = [
    ["連携先代表", counterpartName],
    ["依頼種別",   requestType],
    ["依頼内容",   snippet],
    ["申請者",     staffName],
    ["拠点",       branchName ?? "—"],
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
          <td style="background:#0f766e;padding:20px 28px;">
            <span style="color:#ffffff;font-size:18px;font-weight:700;letter-spacing:-0.3px;">Ad-Arch OS</span>
            <span style="color:#99f6e4;font-size:13px;margin-left:8px;">グループ連携依頼通知</span>
          </td>
        </tr>
        <tr>
          <td style="padding:28px;">
            <p style="margin:0 0 20px;font-size:14px;color:#3f3f46;">グループ連携依頼が申請されました。内容をご確認ください。</p>
            <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;font-size:14px;">
              ${rows}
            </table>
            <div style="margin-top:24px;text-align:center;">
              <a href="${url}" style="display:inline-block;padding:11px 28px;background:#0f766e;color:#ffffff;text-decoration:none;border-radius:8px;font-size:14px;font-weight:600;">依頼の詳細を開く →</a>
            </div>
          </td>
        </tr>
        <tr>
          <td style="background:#f4f4f5;padding:16px 28px;border-top:1px solid #e4e4e7;">
            <p style="margin:0;font-size:11px;color:#a1a1aa;text-align:center;">このメールは Ad-Arch Group OS から自動送信されています。<br />心当たりのない場合はシステム管理者にご連絡ください。</p>
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
// 名刺開示申請通知
// ---------------------------------------------------------------
export type DisclosureNotificationPayload =
  | {
      eventType: "DISCLOSURE_REQUESTED";
      requestId: string;
      cardOwnerName: string;
      companyName: string;
      requesterName: string;
      purpose: string;
      cardOwnerEmail: string;
    }
  | {
      eventType: "DISCLOSURE_APPROVED" | "DISCLOSURE_REJECTED";
      requestId: string;
      cardOwnerName: string;
      companyName: string;
      requesterName: string;
      requesterEmail: string;
      reviewNote: string | null;
    };

/**
 * 開示申請関連の通知を送信する。
 * - REQUESTED: 管理者（EMAIL_CEO）へ
 * - APPROVED/REJECTED: 申請者へ直接
 */
export async function sendDisclosureNotification(
  payload: DisclosureNotificationPayload
): Promise<void> {
  const { cardOwnerName, companyName, requesterName } = payload;
  const url = appUrl(`/dashboard/business-cards/requests`);

  if (payload.eventType === "DISCLOSURE_REQUESTED") {
    const to = [...new Set([...resolveRecipients("ceo_only"), payload.cardOwnerEmail])];
    const subject = `【アドアーチOS】名刺開示申請：${companyName} ${cardOwnerName}`;

    const rows = [
      ["対象名刺", `${companyName} / ${cardOwnerName}`],
      ["申請者",   requesterName],
      ["開示目的", payload.purpose.length > 120 ? payload.purpose.slice(0, 120) + "…" : payload.purpose],
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
          <td style="background:#0d9488;padding:20px 28px;">
            <span style="color:#ffffff;font-size:18px;font-weight:700;">Ad-Arch OS</span>
            <span style="color:#99f6e4;font-size:13px;margin-left:8px;">名刺開示申請通知</span>
          </td>
        </tr>
        <tr>
          <td style="padding:28px;">
            <p style="margin:0 0 20px;font-size:14px;color:#3f3f46;">名刺の秘匿情報の開示が申請されました。内容を確認し、承認または却下してください。</p>
            <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;font-size:14px;">${rows}</table>
            <div style="margin-top:24px;text-align:center;">
              <a href="${url}" style="display:inline-block;padding:11px 28px;background:#0d9488;color:#ffffff;text-decoration:none;border-radius:8px;font-size:14px;font-weight:600;">申請一覧を確認する →</a>
            </div>
          </td>
        </tr>
        <tr>
          <td style="background:#f4f4f5;padding:16px 28px;border-top:1px solid #e4e4e7;">
            <p style="margin:0;font-size:11px;color:#a1a1aa;text-align:center;">このメールは Ad-Arch Group OS から自動送信されています。</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

    await sendEmail("disclosure-request", to, subject, html);
  } else {
    // 承認 / 却下 → 申請者へ直接
    const statusLabel = payload.eventType === "DISCLOSURE_APPROVED" ? "承認" : "却下";
    const headerColor = payload.eventType === "DISCLOSURE_APPROVED" ? "#059669" : "#dc2626";
    const subject = `【アドアーチOS】名刺開示申請 ${statusLabel}：${companyName} ${cardOwnerName}`;

    const noteRow = payload.reviewNote
      ? `<tr><th style="${thStyle}">審査コメント</th><td style="${tdStyle}">${escHtml(payload.reviewNote)}</td></tr>`
      : "";

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
          <td style="background:${headerColor};padding:20px 28px;">
            <span style="color:#ffffff;font-size:18px;font-weight:700;">Ad-Arch OS</span>
            <span style="color:#ffffff;font-size:13px;margin-left:8px;opacity:0.85;">名刺開示 審査結果</span>
          </td>
        </tr>
        <tr>
          <td style="padding:28px;">
            <p style="margin:0 0 20px;font-size:14px;color:#3f3f46;">名刺の秘匿情報の開示申請が<strong>${statusLabel}</strong>されました。</p>
            <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;font-size:14px;">
              <tr><th style="${thStyle}">対象名刺</th><td style="${tdStyle}">${escHtml(companyName)} / ${escHtml(cardOwnerName)}</td></tr>
              <tr><th style="${thStyle}">審査結果</th><td style="${tdStyle}"><strong>${statusLabel}</strong></td></tr>
              ${noteRow}
            </table>
          </td>
        </tr>
        <tr>
          <td style="background:#f4f4f5;padding:16px 28px;border-top:1px solid #e4e4e7;">
            <p style="margin:0;font-size:11px;color:#a1a1aa;text-align:center;">このメールは Ad-Arch Group OS から自動送信されています。</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

    await sendEmail("disclosure-result", [payload.requesterEmail], subject, html);
  }
}
