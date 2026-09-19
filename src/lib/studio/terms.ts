// ==============================================================
// Ad Arch Studio（AI相談窓口）ご利用条件 — 正本（公開ページと窓口の返答はここから作る）
//   文案: client_mcp_legal_2026-09 §3-2（legal-counsel・弁護士レビュー前）
//   ・版（STUDIO_TERMS_VERSION）を上げるときは、制定日/改定日と、効力が生じる日を事前にこのページで知らせる（第8条）
//   ・request_order は同意（agreeToTerms）と版を studio_inquiries に保存する
//   ⚠️ 【未定】の所は代表が埋めてから公開する（窓口メール・グループ一覧URL・保存先の国・制定日）
// ==============================================================

export const STUDIO_TERMS_VERSION = "1";
/** 制定日（公開日）。【未定】のまま公開しない */
export const STUDIO_TERMS_DATE = "2026年【 】月【 】日";
export const STUDIO_TERMS_CONTACT = "【窓口メールアドレス】";
export const STUDIO_TERMS_GROUP_LIST_URL = "【グループ一覧のURL】";
export const STUDIO_TERMS_STORAGE = "【クラウド事業者名・国】";

export const STUDIO_TERMS_PATH = "/api/mcp/public/terms";

export function studioTermsUrl(): string {
  const base = (process.env.NEXT_PUBLIC_APP_URL ?? process.env.AUTH_URL ?? "").replace(/\/$/, "");
  return `${base}${STUDIO_TERMS_PATH}`;
}

type Article = { title: string; paragraphs: (string | string[])[] };

/** 全9条（配列＝号の並び） */
export const STUDIO_TERMS: Article[] = [
  {
    title: "第1条（本窓口）",
    paragraphs: [
      "Ad Arch Studio（以下「本窓口」）は、利用者が自ら使うAIアシスタントを通じて、動画制作・撮影・SNS運用・広告媒体に関する情報の提供を受け、当社にご相談・ご依頼をいただくための窓口です。",
      "本窓口は、事業のためにご利用いただく方（法人および個人事業主）を対象とします。",
      "本窓口は、本条件に同意いただいた方がご利用いただけます。依頼を送信した時点で、本条件に同意いただいたものとみなします。",
    ],
  },
  {
    title: "第2条（提供する情報とAIの回答）",
    paragraphs: [
      "本窓口が提供する情報は、制作・広告に関する一般的な情報、当社が公開用に作成した資料、公的機関や主催者が公表している情報（補助金・広告賞等）の要約です。個別の事情に合わせた助言ではありません。",
      "利用者が目にする回答の文章は、利用者のAIアシスタントが本窓口の情報をもとに作成するものです。当社が責任を負うのは、本窓口が返した情報の範囲に限られます。",
      "当社は、本窓口の情報に基づく広告効果・売上・補助金の採択・広告賞の受賞・媒体の考査結果その他の結果を保証しません。補助金・広告賞・媒体の条件は、必ず公式の要領・主催者・媒体社の最新情報でご確認ください。",
      "本窓口では金額をお伝えしません。金額は、ご依頼を受けた当社の担当がお見積りでお伝えします。",
    ],
  },
  {
    title: "第3条（ご依頼と契約の成立）",
    paragraphs: [
      "本窓口からのご依頼（仮押さえ）は、見積りと日程調整のご依頼として受け付けるものであり、契約の申込みではありません。受付番号の発行によって契約は成立しません。",
      "個別の契約は、当社が内容・金額・日程を記載したお見積り（確定のご連絡）をお送りし、利用者が承諾した時点で成立します。別に契約書または発注書を取り交わす場合は、その定めによります。",
      "当社は、ご依頼の内容・日程・地域・当社の体制により、ご依頼をお受けできない場合があります。その場合、理由をお伝えしないことがあります。",
      "営業時間内に2時間以内にご連絡することを目安としていますが、お約束するものではありません。",
      "契約の相手方は当社です。当社は、業務の全部または一部を、当社のグループ会社（当社と認定パートナー契約を結ぶ会社・個人事業主）または当社に登録した制作者に委託して行うことがあります。この場合も、利用者に対する責任は当社が負います。",
    ],
  },
  {
    title: "第4条（個人情報の取扱い）",
    paragraphs: [
      "取得する情報：会社名、担当者名、メールアドレス、電話番号、所在地・撮影地の都道府県、ご依頼・ご相談の内容。",
      [
        "利用目的：",
        "(1) ご依頼への回答、お見積り、日程調整、業務の実施と連絡",
        "(2) ご依頼を担当する拠点の決定と、その拠点への共有",
        "(3) 当社および当社グループが、今後のご提案・ご案内を行うための見込み先としての記録",
        "(4) 本窓口の改善と、個人を特定しない形での集計",
      ],
      [
        "共同利用：当社は、前項の情報を次のとおり共同で利用します。",
        `(1) 共同利用する者の範囲：当社、および当社と認定パートナー契約を締結しているグループ各社（一覧：${STUDIO_TERMS_GROUP_LIST_URL}）`,
        "(2) 共同利用する項目：第1項の情報",
        "(3) 利用目的：第2項(1)〜(3)",
        "(4) 管理について責任を有する者：Ad Arch株式会社（住所・代表者は冒頭のとおり）",
      ],
      "当社は、法令に基づく場合と前項の共同利用を除き、本人の同意なく個人情報を第三者に提供しません。",
      `ご依頼の内容は、当社の業務システム（保存先：${STUDIO_TERMS_STORAGE}）に保存します。本窓口に送信されたご依頼の本文を、当社がAIの学習に使うことはありません。`,
      "当社および当社グループからのご案内のメールは、いつでも配信を停止できます。",
      "保有個人データの開示・訂正・利用停止等のご請求、苦情のお申し出は、冒頭のお問い合わせ先で受け付けます。",
    ],
  },
  {
    title: "第5条（利用者にお願いすること）",
    paragraphs: [
      [
        "次の行為を禁止します。",
        "(1) 虚偽の情報や他人の情報による依頼",
        "(2) 営業・勧誘・求人・宣伝を目的とした依頼の送信",
        "(3) 自動化された大量の送信、本窓口への過度な負荷、情報の網羅的な収集",
        "(4) 本窓口の情報の転載・再配布・販売",
        "(5) 法令や公序良俗に反する行為、第三者の権利を侵害する行為",
      ],
      "当社がお受けするのは、AIアシスタントから本窓口に渡された内容だけです。第三者の個人情報、営業秘密その他の機密情報は入力しないでください。",
      "当社は、前各項に反すると判断した送信について、回答・受付をしないこと、または以後の利用を制限することがあります。",
    ],
  },
  {
    title: "第6条（権利）",
    paragraphs: ["本窓口が提供する資料・文章の著作権その他の権利は、当社または正当な権利者に帰属します。利用者は、自社の検討に必要な範囲で利用できます。"],
  },
  {
    title: "第7条（責任）",
    paragraphs: [
      "当社は、本窓口の情報の正確性・完全性・最新性に努めますが、これを保証しません。",
      "本窓口の利用に関して利用者に生じた損害について、当社は、当社の故意または重大な過失による場合を除き、責任を負いません。",
      "本窓口は、保守・障害その他の理由で予告なく停止・変更・終了することがあります。",
    ],
  },
  {
    title: "第8条（本条件の変更）",
    paragraphs: ["当社は、本条件を変更することがあります。変更する場合は、効力が生じる日と変更の内容をこのページで事前にお知らせします。変更後にご依頼を送信した場合、変更後の条件に同意いただいたものとみなします。"],
  },
  {
    title: "第9条（準拠法・管轄）",
    paragraphs: ["本条件は日本法に従います。本窓口に関する紛争は、東京地方裁判所を第一審の専属的合意管轄裁判所とします。"],
  },
];

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** 公開ページのHTML（1枚・書面体） */
export function studioTermsHtml(): string {
  const body = STUDIO_TERMS.map((a) => {
    const items = a.paragraphs
      .map((p, i) => {
        const num = a.paragraphs.length > 1 ? `${i + 1}. ` : "";
        if (Array.isArray(p)) return `<li>${num}${esc(p[0])}<ul>${p.slice(1).map((x) => `<li>${esc(x)}</li>`).join("")}</ul></li>`;
        return `<li>${num}${esc(p)}</li>`;
      })
      .join("");
    return `<section><h2>${esc(a.title)}</h2><ul>${items}</ul></section>`;
  }).join("");
  return `<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex">
<title>Ad Arch Studio（AI相談窓口）ご利用条件</title>
<style>body{font-family:-apple-system,"Hiragino Sans","Noto Sans JP",sans-serif;color:#18181b;background:#fafaf9;margin:0}main{max-width:760px;margin:0 auto;padding:40px 20px 80px;line-height:1.85;font-size:15px}h1{font-size:22px;margin:0 0 8px}h2{font-size:16px;margin:28px 0 6px}ul{list-style:none;padding-left:0;margin:0}ul ul{padding-left:1.2em}p.meta{color:#52525b;font-size:13px;margin:0}</style></head>
<body><main><h1>Ad Arch Studio（AI相談窓口）ご利用条件</h1>
<p class="meta">制定日：${esc(STUDIO_TERMS_DATE)}（第${esc(STUDIO_TERMS_VERSION)}版）</p>
<p class="meta">運営者：Ad Arch株式会社（以下「当社」）　東京都港区南青山2-15-5 FARO 1階　代表取締役 白川 裕喜</p>
<p class="meta">お問い合わせ：${esc(STUDIO_TERMS_CONTACT)}</p>
${body}
</main></body></html>`;
}
