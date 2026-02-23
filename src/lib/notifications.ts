// ---------------------------------------------------------------
// 通知ユーティリティ — Resend によるメール送信
//
// 【宛先環境変数（Railway Variables に設定）】
//   EMAIL_ALL      : 全メンバー向けアドレス（カンマ区切り）
//   EMAIL_CEO      : 白川専用（全通知を受信）
//   EMAIL_SELECTED : 選抜メンバー向け（グループ連携依頼）
//   RESEND_API_KEY : Resend の API キー
//
// 【振り分けルール】
//   顧客管理・商談管理（作成・更新）   → EMAIL_ALL + EMAIL_CEO
//   請求依頼・見積・売上報告・媒体依頼 → EMAIL_CEO のみ
//   グループ連携依頼                   → EMAIL_CEO + EMAIL_SELECTED
//
// 【送信元】
//   adarch.co.jp の DNS 認証済み。
//   RESEND_FROM_ADDRESS 環境変数で上書き可能（未設定時は下記デフォルト）。
// ---------------------------------------------------------------

import { Resend } from "resend";

const FROM_ADDRESS =
  process.env.RESEND_FROM_ADDRESS ?? "Ad-Arch Group <system@adarch.co.jp>";

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
// 共通メール送信ヘルパー（1件ずつ個別送信・詳細ログ・フォールバック付き）
// ---------------------------------------------------------------

/** ドメイン認証エラーかどうかを判定するキーワード */
const DOMAIN_ERROR_KEYWORDS = [
  "domain",
  "verified",
  "validation_error",
  "from address",
  "testing emails",
  "verify a domain",
];

async function sendEmail(
  tag: string,
  to: string[],
  subject: string,
  html: string
): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;

  // ① API キーの存在確認（先頭8文字＋文字数だけ表示）
  if (!apiKey) {
    console.error(`[notifications:${tag}] ❌ RESEND_API_KEY が未設定です → 送信スキップ`);
    return;
  }
  const maskedKey = `${apiKey.slice(0, 8)}...(${apiKey.length}文字)`;
  console.log(`[notifications:${tag}] ✅ RESEND_API_KEY 確認: ${maskedKey}`);

  // ② 宛先ゼロ件チェック
  if (to.length === 0) {
    console.warn(
      `[notifications:${tag}] ⚠️ 宛先が0件 → スキップ` +
      `（EMAIL_ALL / EMAIL_CEO / EMAIL_SELECTED が Railway Variables に設定されているか確認してください）`
    );
    return;
  }

  console.log(
    `[notifications:${tag}] 📤 送信開始 from="${FROM_ADDRESS}" 宛先${to.length}件 subject="${subject}"`
  );

  const resend = new Resend(apiKey);
  // ドメイン認証エラー時のフォールバック送信元（Resend テスト用・アカウントオーナー宛のみ届く）
  const FALLBACK_FROM = "Ad-Arch Group <onboarding@resend.dev>";

  // ③ 宛先ごとに個別送信
  for (const addr of to) {
    let fromAddr = FROM_ADDRESS;

    // --- 1st attempt ---
    try {
      console.log(`[notifications:${tag}]   → 送信試行 from="${fromAddr}" to="${addr}"`);

      const result = await resend.emails.send({
        from: fromAddr,
        to:   [addr],
        subject,
        html,
      });

      // レスポンス全体をそのまま出力（成功・失敗問わず）
      console.log(
        `[notifications:${tag}]   Resend レスポンス (to=${addr}):`,
        JSON.stringify(result)
      );

      const { data, error } = result;

      if (error) {
        const raw     = JSON.stringify(error);
        const status  = (error as { statusCode?: number }).statusCode ?? "不明";
        const isDomainError =
          DOMAIN_ERROR_KEYWORDS.some((kw) => raw.toLowerCase().includes(kw)) ||
          status === 403;

        if (isDomainError) {
          // ドメイン認証エラー → フォールバック送信元でリトライ
          console.error(
            `[notifications:${tag}]   ❌ ドメイン認証エラー HTTP ${status} (to=${addr})\n` +
            `     FROM="${fromAddr}"\n` +
            `     エラー内容: ${raw}\n` +
            `     → フォールバック "${FALLBACK_FROM}" でリトライします`
          );
          fromAddr = FALLBACK_FROM;

          // --- 2nd attempt (fallback) ---
          const retry = await resend.emails.send({
            from: fromAddr,
            to:   [addr],
            subject,
            html,
          });
          console.log(
            `[notifications:${tag}]   フォールバック Resend レスポンス (to=${addr}):`,
            JSON.stringify(retry)
          );
          if (retry.error) {
            console.error(
              `[notifications:${tag}]   ❌ フォールバックも失敗 HTTP ${
                (retry.error as { statusCode?: number }).statusCode ?? "不明"
              } (to=${addr}): ${JSON.stringify(retry.error)}`
            );
          } else {
            console.log(
              `[notifications:${tag}]   ✅ フォールバック送信成功 to=${addr} Resend id=${retry.data?.id}`
            );
          }
        } else {
          // その他のエラー（認証失敗・不正アドレスなど）
          console.error(
            `[notifications:${tag}]   ❌ Resend エラー HTTP ${status} (to=${addr}): ${raw}`
          );
        }
      } else {
        console.log(
          `[notifications:${tag}]   ✅ 送信成功 to=${addr} Resend id=${data?.id}`
        );
      }
    } catch (e) {
      console.error(
        `[notifications:${tag}]   ❌ 送信例外 (to=${addr}):`,
        e instanceof Error ? e.message : String(e)
      );
    }
  }

  console.log(`[notifications:${tag}] 📬 全宛先の送信処理が完了しました`);
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
  const to = resolveRecipients("ceo_only");
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
