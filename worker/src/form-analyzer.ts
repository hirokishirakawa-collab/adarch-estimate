import Anthropic from "@anthropic-ai/sdk";
import * as cheerio from "cheerio";

const anthropic = new Anthropic();

export interface FormField {
  selector: string;
  value: string;
  type: "text" | "textarea" | "select" | "radio" | "checkbox" | "email" | "tel";
}

export type CaptchaType = "none" | "v2" | "v3" | "hcaptcha" | "turnstile" | "unknown";

export interface AnalysisResult {
  fields: FormField[];
  captchaType: CaptchaType;
  siteKey: string | null;
  submitSelector: string | null;
  /** 変数置換後の本文。何を送ったかを本部が後から読むために保存する。 */
  resolvedBody: string;
  /** フォームに入れた返信先アドレス。反響はこの受信箱に届く。 */
  replyEmail: string;
}

/**
 * HTMLからフォーム部分を抽出・前処理する
 */
function extractFormHtml(html: string): { formHtml: string; captchaType: CaptchaType; siteKey: string | null } {
  const $ = cheerio.load(html);

  // CAPTCHA種類を詳細検出
  let captchaType: CaptchaType = "none";
  let siteKey: string | null = null;

  // reCAPTCHA v2（チェックボックス型）
  const v2El = $('[class*="g-recaptcha"][data-sitekey]');
  if (v2El.length > 0) {
    captchaType = "v2";
    siteKey = v2El.attr("data-sitekey") ?? null;
  }

  // reCAPTCHA v3（スコアベース・非表示型）
  if (captchaType === "none") {
    const hasV3Script = html.includes("recaptcha/api.js?render=") || html.includes("grecaptcha.execute");
    const v3Badge = $(".grecaptcha-badge");
    const v3Iframe = $('iframe[src*="recaptcha"]');
    if (hasV3Script || v3Badge.length > 0 || v3Iframe.length > 0) {
      captchaType = "v3";
      const scriptMatch = html.match(/recaptcha\/api\.js\?render=([^&"']+)/);
      if (scriptMatch) siteKey = scriptMatch[1];
      if (!siteKey) {
        const dsEl = $('[data-sitekey]');
        if (dsEl.length > 0) siteKey = dsEl.attr("data-sitekey") ?? null;
      }
    }
  }

  // hCaptcha
  if (captchaType === "none") {
    const hcEl = $('[class*="h-captcha"][data-sitekey]');
    if (hcEl.length > 0 || $('iframe[src*="hcaptcha"]').length > 0) {
      captchaType = "hcaptcha";
      siteKey = hcEl.attr("data-sitekey") ?? null;
    }
  }

  // Cloudflare Turnstile
  if (captchaType === "none") {
    const cfEl = $('[class*="cf-turnstile"][data-sitekey]');
    if (cfEl.length > 0) {
      captchaType = "turnstile";
      siteKey = cfEl.attr("data-sitekey") ?? null;
    }
  }

  // script, style, コメント, hidden要素を除去
  $("script, style, noscript, svg, img, video, audio, iframe, link, meta").remove();

  // formタグを探す
  const forms = $("form");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let formEl: cheerio.Cheerio<any>;

  if (forms.length === 0) {
    // formタグがない場合、input/textareaを含むコンテナを探す
    const inputs = $("input, textarea, select");
    if (inputs.length === 0) {
      return { formHtml: "", captchaType, siteKey };
    }
    // 最も近い共通親を使う
    formEl = inputs.first().closest("div, section, main");
    if (formEl.length === 0) {
      formEl = $("body");
    }
  } else if (forms.length === 1) {
    formEl = forms.first();
  } else {
    // 複数formの場合、「お問い合わせ」に関連するものを優先
    const contactKeywords = ["contact", "inquiry", "問い合わせ", "お問い合", "相談", "資料請求"];
    let found = false;
    forms.each((_, el) => {
      if (found) return;
      const formText = $(el).text() + " " + ($(el).attr("action") ?? "") + " " + ($(el).attr("id") ?? "");
      if (contactKeywords.some((kw) => formText.toLowerCase().includes(kw))) {
        formEl = $(el);
        found = true;
      }
    });
    if (!found) {
      // inputフィールドが最も多いformを選択
      let maxInputs = 0;
      forms.each((_, el) => {
        const count = $(el).find("input, textarea, select").length;
        if (count > maxInputs) {
          maxInputs = count;
          formEl = $(el);
        }
      });
    }
  }

  // フォーム内をさらに軽量化: label, input, textarea, select, button, option のみ残す
  const formHtml = formEl!.html() ?? "";

  // 8000文字に収める（Claude Haikuのコスト削減）
  return {
    formHtml: formHtml.substring(0, 8000),
    captchaType,
    siteKey,
  };
}

/**
 * Claude Haikuでフォーム構造を解析し、テンプレート値をマッピングする
 */
export async function analyzeForm(
  pageHtml: string,
  template: {
    companyName: string;
    senderName: string;
    phone: string | null;
    email: string | null;
    subject: string | null;
    body: string;
  },
  targetIndustry: string | null,
  targetArea: string | null = null
): Promise<AnalysisResult> {
  const { formHtml, captchaType, siteKey } = extractFormHtml(pageHtml);

  // フォームに入れる返信先。拠点が自分の @adarch.co.jp アドレスを登録していればそれを使う。
  // 署名の「Mail:」と食い違わないよう、必ずテンプレートの値を優先する。
  const replyEmail =
    template.email?.trim() || process.env.AUTO_SALES_REPLY_EMAIL || "media@adarch.co.jp";

  // 差し込み変数の置換。事実を差し替えるだけで、文章はAIに書かせない。
  // かつて {companyInsight} でAIに「御社の○○を拝見し」を1社ずつ書かせていたが、
  // この型が受け手から見て機械送信の目印になるため廃止した。
  const fill = (s: string) =>
    s
      .replace(/\{industry\}/g, targetIndustry ?? "")
      .replace(/\{area\}/g, targetArea ?? "")
      .replace(/\{companyName\}/g, template.companyName ?? "");

  const bodyText = fill(template.body);
  const subjectText = fill(template.subject ?? "");

  if (!formHtml) {
    return { fields: [], captchaType: "none", siteKey: null, submitSelector: null, resolvedBody: bodyText, replyEmail };
  }

  const response = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 1024,
    messages: [
      {
        role: "user",
        content: `以下はお問い合わせフォームのHTML構造です。テンプレートの各値を適切なフォームフィールドにマッピングしてください。

テンプレート値:
- 会社名: "${template.companyName}"
- 氏名: "${template.senderName}"
- 電話番号: "${template.phone ?? ""}"
- メールアドレス: "${replyEmail}"
- 件名: """
${subjectText}
"""
- お問い合わせ内容: """
${bodyText}
"""

フォームHTML:
${formHtml}

以下のJSON形式で回答してください。それ以外のテキストは出力しないでください:
{
  "fields": [
    { "selector": "CSSセレクタ(name属性ベース推奨: [name=\\"xxx\\"])", "value": "入力値", "type": "text|textarea|select|radio|checkbox|email|tel" }
  ],
  "submitSelector": "送信ボタンのCSSセレクタ（見つからなければnull）"
}

ルール:
- name属性がある場合は [name="xxx"] を使う
- 必須フィールドを優先的にマッピング
- 該当するフィールドがなければスキップ
- selectの場合、最も適切なoption valueを選ぶ
- radioの場合、valueも指定する
- 「個人情報の取り扱い」同意チェックボックスがあれば checked: true にする
- 件名・タイトル・題名にあたる入力欄があれば、上の「件名」をそのまま入れる
- **値は上に与えられたものだけを使う。文章を要約・言い換え・新規作成しない。**
  お問い合わせ内容の欄には本文を一字一句そのまま入れる`,
      },
    ],
  });

  try {
    const text = response.content[0].type === "text" ? response.content[0].text : "";
    // JSON部分を抽出
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error("[form-analyzer] Claude応答からJSONを抽出できませんでした:", text);
      return { fields: [], captchaType, siteKey, submitSelector: null, resolvedBody: bodyText, replyEmail };
    }

    const parsed = JSON.parse(jsonMatch[0]);
    return {
      fields: parsed.fields ?? [],
      captchaType,
      siteKey,
      submitSelector: parsed.submitSelector ?? null,
      resolvedBody: bodyText,
      replyEmail,
    };
  } catch (err) {
    console.error("[form-analyzer] JSONパースエラー:", err);
    return { fields: [], captchaType, siteKey, submitSelector: null, resolvedBody: bodyText, replyEmail };
  }
}
