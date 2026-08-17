import { chromium, type Browser, type Page } from "playwright";
import { db } from "./db.js";
import { analyzeForm } from "./form-analyzer.js";
import { fillForm, clickSubmit, clickConfirmButton } from "./form-filler.js";
import { findContactFormUrl } from "./form-finder.js";
import { solveCaptcha } from "./captcha-solver.js";
import { normalizeDomain } from "./domain.js";

const DRY_RUN = process.env.DRY_RUN === "true";
const PAGE_TIMEOUT = 60_000;

let browser: Browser | null = null;

async function getBrowser(): Promise<Browser> {
  // 既にブラウザが起動中ならそのまま再利用
  if (browser && browser.isConnected()) {
    return browser;
  }

  const proxyUrl = process.env.RESIDENTIAL_PROXY_URL;
  const args = ["--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage"];
  if (proxyUrl) args.push("--ignore-certificate-errors");

  const launchOptions: Record<string, unknown> = {
    headless: process.env.HEADLESS !== "false",
    args,
  };

  if (proxyUrl) {
    console.log("[job-runner] レジデンシャルプロキシ使用");
    try {
      const url = new URL(proxyUrl);
      launchOptions.proxy = {
        server: `${url.protocol}//${url.hostname}:${url.port}`,
        username: decodeURIComponent(url.username),
        password: decodeURIComponent(url.password),
      };
    } catch {
      console.error("[job-runner] プロキシURL解析失敗:", proxyUrl);
    }
  }

  browser = await chromium.launch(launchOptions as Parameters<typeof chromium.launch>[0]);
  return browser;
}

/**
 * 現在このプロセスが処理中のドメイン。
 * 並列実行時に同じサイトへ同時アクセスしないようにする（相手側から見て連打にならないように）。
 */
const inFlightDomains = new Set<string>();

function hostOf(url: string): string | null {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

/**
 * QUEUEDのジョブを1件取得して処理する
 * 戻り値: ジョブがあればtrue、なければfalse
 */
/**
 * 本日の上限に達したテンプレートのIDを返す。
 * 上限は本部が承認時に決める（dailyLimit）。null のテンプレートは無制限。
 */
async function templatesOverDailyLimit(): Promise<string[]> {
  const capped = (await db.autoSalesTemplate.findMany({
    where: { isApproved: true, isActive: true, dailyLimit: { not: null } },
    select: { id: true, dailyLimit: true },
  })) as Array<{ id: string; dailyLimit: number | null }>;
  if (capped.length === 0) return [];

  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);

  const sentToday = (await db.autoSalesJob.groupBy({
    by: ["templateId"],
    where: {
      templateId: { in: capped.map((t) => t.id) },
      // 上限は「実際に送った件数」で数える。失敗・スキップは消費しない。
      status: { in: ["COMPLETED", "PROCESSING"] },
      createdAt: { gte: dayStart },
    },
    _count: { _all: true },
  })) as Array<{ templateId: string; _count: { _all: number } }>;

  const countById = new Map<string, number>(
    sentToday.map((row) => [row.templateId, row._count._all])
  );
  return capped
    .filter((t) => (countById.get(t.id) ?? 0) >= (t.dailyLimit ?? Infinity))
    .map((t) => t.id);
}

/**
 * 送信に成功したら全社共有の台帳へ載せる。
 * domain に UNIQUE が張ってあるので、ここが二重送信の最終ガードになる。
 * 既に他拠点が載せていた場合は握りつぶす（送信自体は完了しているため）。
 */
async function recordSentDomain(args: {
  url: string;
  companyName: string;
  branchId: string;
  jobId: string;
}): Promise<void> {
  const domain = normalizeDomain(args.url);
  if (!domain) return;
  try {
    await db.autoSalesSentDomain.create({
      data: {
        domain,
        companyName: args.companyName,
        branchId: args.branchId,
        jobId: args.jobId,
      },
    });
  } catch (err) {
    // UNIQUE 違反＝他拠点が先に載せた。送信済みという結論は同じなので進める。
    console.warn(
      `[job-runner] 送信済み台帳への登録をスキップ (${domain}):`,
      err instanceof Error ? err.message : err
    );
  }
}

export async function processNextJob(): Promise<boolean> {
  // QUEUEDのジョブを取得（開始日を過ぎたもののみ）。
  // 並列実行では他ワーカーが処理中のドメインを避けたいので、候補を数件まとめて引く。
  const now = new Date();
  const cappedTemplateIds = await templatesOverDailyLimit();

  const candidates = await db.autoSalesJob.findMany({
    where: {
      status: "QUEUED",
      ...(cappedTemplateIds.length > 0
        ? { templateId: { notIn: cappedTemplateIds } }
        : {}),
      template: {
        // 本部が承認したテンプレートのジョブしか動かさない。
        // 承認取消（revoke）を受けたら、キューに残っているジョブも自動的に止まる。
        isApproved: true,
        isActive: true,
        OR: [
          { scheduledStartDate: null },
          { scheduledStartDate: { lte: now } },
        ],
      },
    },
    orderBy: { createdAt: "asc" },
    take: 20,
    select: { id: true, target: { select: { url: true } } },
  });

  let pickedId: string | null = null;
  let jobDomain = "";
  for (const c of candidates as Array<{ id: string; target: { url: string } }>) {
    const host = hostOf(c.target.url);
    if (host && !inFlightDomains.has(host)) {
      pickedId = c.id;
      jobDomain = host;
      break;
    }
  }

  if (!pickedId) return false;

  // ドメインの確保は await をまたぐ前に済ませる。
  // await を挟んでから add すると、その隙に別レーンが同じドメインを拾ってしまう。
  inFlightDomains.add(jobDomain);

  const job = await db.autoSalesJob.findUnique({
    where: { id: pickedId },
    include: { target: true, template: true },
  });
  if (!job) {
    inFlightDomains.delete(jobDomain);
    return false;
  }

  // PROCESSINGに更新。status=QUEUED を条件に入れることで、
  // 他ワーカーが同じジョブを先に取っていた場合は count=0 になり、二重送信を防げる。
  const claimed = await db.autoSalesJob.updateMany({
    where: { id: job.id, status: "QUEUED" },
    data: { status: "PROCESSING", startedAt: new Date() },
  });
  if (claimed.count === 0) {
    // 別のワーカーが先に確保した。呼び出し元にはすぐ次を探させる。
    inFlightDomains.delete(jobDomain);
    return true;
  }

  console.log(`[job-runner] 処理開始: ${job.target.companyName} (${job.target.url})`);
  console.log(`[job-runner] ブラウザ起動中...`);

  // ジョブ全体のタイムアウト（3分）
  const JOB_TIMEOUT = 180_000;
  const jobTimer = setTimeout(async () => {
    console.error(`[job-runner] ジョブタイムアウト（3分）: ${job.target.companyName}`);
    await db.autoSalesJob.update({
      where: { id: job.id },
      data: { status: "FAILED", completedAt: new Date(), errorMessage: "ジョブ全体がタイムアウト（3分）" },
    }).catch(() => {});
  }, JOB_TIMEOUT);

  let page: Page | null = null;

  try {
    // 返信先が未設定のテンプレートは送らない。
    // 本部の media@ に相手の返信が集まってしまい、拠点が反響に気づけないため。
    if (!job.template.email?.trim()) {
      await db.autoSalesJob.update({
        where: { id: job.id },
        data: {
          status: "FAILED",
          completedAt: new Date(),
          errorMessage:
            "テンプレートに返信先アドレスが未設定です。拠点の @adarch.co.jp アドレスを設定してください。",
        },
      });
      console.log(`[job-runner] 中止（返信先未設定）: ${job.template.name}`);
      return true;
    }

    // ブラックリストチェック
    const domain = new URL(job.target.url).hostname;
    const normalized = normalizeDomain(job.target.url);
    const blacklisted = await db.autoSalesBlacklist.findFirst({
      where: { domain: { in: normalized ? [domain, normalized] : [domain] } },
    });
    if (blacklisted) {
      await db.autoSalesJob.update({
        where: { id: job.id },
        data: {
          status: "SKIPPED",
          completedAt: new Date(),
          errorMessage: `ブラックリスト登録済み: ${blacklisted.reason ?? domain}`,
        },
      });
      console.log(`[job-runner] スキップ（ブラックリスト）: ${domain}`);
      return true;
    }

    // 全社の送信済み台帳と突き合わせ。
    // 営業先の登録時にも見ているが、その後に他拠点が送っている可能性があるので送信直前に再確認する。
    if (normalized) {
      const alreadySent = await db.autoSalesSentDomain.findUnique({
        where: { domain: normalized },
      });
      if (alreadySent) {
        await db.autoSalesJob.update({
          where: { id: job.id },
          data: {
            status: "SKIPPED",
            completedAt: new Date(),
            errorMessage: `二重送信の防止: ${alreadySent.companyName} には既に送信済み（${alreadySent.sentAt.toISOString().slice(0, 10)}）`,
          },
        });
        console.log(`[job-runner] スキップ（送信済み）: ${normalized}`);
        return true;
      }
    }

    // ブラウザでページを開く
    const b = await getBrowser();
    console.log(`[job-runner] ブラウザ取得完了、ページ作成中...`);
    page = await b.newPage({
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
      ignoreHTTPSErrors: true,
    });

    // CF7等のAjaxレスポンスをログに出力 + spam検出用に保存
    let lastAjaxStatus = "";
    page.on("response", async (response) => {
      const url = response.url();
      if (url.includes("wpcf7") || url.includes("contact-form") || url.includes("admin-ajax") || url.includes("feedback")) {
        try {
          const body = await response.text();
          console.log(`[job-runner] Ajax応答 (${response.status()}): ${url.substring(0, 100)}`);
          console.log(`[job-runner] Ajax本文: ${body.substring(0, 300)}`);
          // feedbackレスポンスのstatusを保存
          if (url.includes("feedback") && body.includes('"status"')) {
            try {
              const json = JSON.parse(body);
              lastAjaxStatus = json.status ?? "";
            } catch {}
          }
        } catch {}
      }
    });
    console.log(`[job-runner] ページ作成完了、ナビゲーション開始: ${job.target.url}`);

    // ダイアログ自動処理
    page.on("dialog", async (dialog) => {
      await dialog.accept();
    });

    // レジデンシャルプロキシ未設定時のみ、reCAPTCHAモジュールを書き換え（フォールバック）
    if (!process.env.RESIDENTIAL_PROXY_URL) {
      await page.route("**/contact-form-7/modules/recaptcha/index.js**", async (route) => {
        console.log(`[job-runner] CF7 recaptchaモジュールを書き換え（プロキシなし）`);
        route.fulfill({
          status: 200,
          contentType: "application/javascript",
          body: `
            document.addEventListener("DOMContentLoaded", function() {
              window.wpcf7_recaptcha = window.wpcf7_recaptcha || {};
              window.__cf7RecaptchaToken = "PENDING";
              if (typeof window.grecaptcha === "undefined") {
                window.grecaptcha = {
                  ready: function(cb) { cb(); },
                  execute: function() { return Promise.resolve(window.__cf7RecaptchaToken || "PENDING"); }
                };
              }
            });
          `,
        });
      });
    }

    await page.goto(job.target.url, {
      waitUntil: "domcontentloaded",
      timeout: PAGE_TIMEOUT,
    });
    console.log(`[job-runner] ページ読み込み完了`);

    // SPAの追加レンダリングを待つ
    await page.waitForTimeout(3000);

    // 営業お断りチェック
    const pageText = await page.evaluate(() => document.body?.innerText ?? "");
    const rejectKeywords = [
      "営業お断り",
      "営業はお断り",
      "営業の方はお断り",
      "営業目的のお問い合わせはご遠慮",
      "営業目的でのご連絡はご遠慮",
      "営業メールお断り",
      "セールスお断り",
      "売り込みお断り",
      "売込みお断り",
      "営業についてはお断り",
      "営業のご連絡はご遠慮",
      "勧誘・営業はご遠慮",
      "営業・勧誘はご遠慮",
      "営業等のお問い合わせはご遠慮",
      "このフォームからの営業",
      "フォームからの営業はご遠慮",
      "営業についてはお控え",
    ];
    const lowerText = pageText.toLowerCase();
    const matchedReject = rejectKeywords.find((kw) => lowerText.includes(kw.toLowerCase()));
    if (matchedReject) {
      await db.autoSalesJob.update({
        where: { id: job.id },
        data: {
          status: "SKIPPED",
          completedAt: new Date(),
          errorMessage: `営業お断り検出: 「${matchedReject}」`,
        },
      });
      // ブラックリストに自動追加
      const skipDomain = new URL(job.target.url).hostname;
      await db.autoSalesBlacklist.upsert({
        where: { domain: skipDomain },
        create: { domain: skipDomain, companyName: job.target.companyName, reason: `営業お断り検出: 「${matchedReject}」` },
        update: {},
      });
      console.log(`[job-runner] スキップ（営業お断り）: ${job.target.companyName} — 「${matchedReject}」`);
      return true;
    }

    // 相手サイトを読んで営業文に一言を差し込む処理は廃止した。
    // 1社ごとに「御社の○○を拝見し」を自動生成する型そのものが、
    // 受け手から見て機械送信の目印になるため。文面は人が書いたものをそのまま送る。
    // （Claude呼び出しが1回減るので、1件あたりのコストと所要時間も下がる）

    // フォームURL自動検出: トップページ等の場合、お問い合わせフォームを探す
    console.log(`[job-runner] フォーム検出開始...`);
    const formPageUrl = await findContactFormUrl(page);
    if (!formPageUrl) {
      await db.autoSalesJob.update({
        where: { id: job.id },
        data: {
          status: "FAILED",
          completedAt: new Date(),
          errorMessage: "問い合わせフォームが見つかりませんでした",
        },
      });
      console.log(`[job-runner] 失敗（フォームなし）: ${job.target.companyName}`);
      return true;
    }

    // フォームページに遷移した場合、ターゲットURLを更新
    if (formPageUrl !== job.target.url) {
      console.log(`[job-runner] フォーム検出: ${job.target.url} → ${formPageUrl}`);
      await db.autoSalesTarget.update({
        where: { id: job.targetId },
        data: { url: formPageUrl },
      });
    }

    // フォームページでも営業お断りチェック
    if (formPageUrl !== job.target.url) {
      const formPageText = await page.evaluate(() => document.body?.innerText ?? "");
      const lowerFormText = formPageText.toLowerCase();
      const matchedRejectForm = rejectKeywords.find((kw) => lowerFormText.includes(kw.toLowerCase()));
      if (matchedRejectForm) {
        await db.autoSalesJob.update({
          where: { id: job.id },
          data: {
            status: "SKIPPED",
            completedAt: new Date(),
            errorMessage: `営業お断り検出（フォームページ）: 「${matchedRejectForm}」`,
          },
        });
        const skipDomain2 = new URL(job.target.url).hostname;
        await db.autoSalesBlacklist.upsert({
          where: { domain: skipDomain2 },
          create: { domain: skipDomain2, companyName: job.target.companyName, reason: `営業お断り検出: 「${matchedRejectForm}」` },
          update: {},
        });
        console.log(`[job-runner] スキップ（営業お断り・フォームページ）: ${job.target.companyName} — 「${matchedRejectForm}」`);
        return true;
      }
    }

    // DOM取得
    console.log(`[job-runner] DOM取得中...`);
    const html = await page.content();
    console.log(`[job-runner] フォーム解析中（Claude Haiku）...`);

    // Claude Haikuでフォーム解析
    const analysis = await analyzeForm(html, {
      companyName: job.template.companyName,
      senderName: job.template.senderName,
      phone: job.template.phone,
      email: job.template.email,
      subject: job.template.subject,
      body: job.template.body,
    }, job.target.industry, job.target.area);

    // フォーム入力
    console.log(`[job-runner] フォーム解析完了: ${analysis.fields.length}フィールド, CAPTCHA: ${analysis.captchaType}`);
    console.log(`[job-runner] フォーム入力中...`);
    const { filled, errors } = await fillForm(page, analysis.fields);
    console.log(`[job-runner] 入力完了: ${Object.keys(filled).length}フィールド, エラー: ${errors.length}件`);

    // スクリーンショット撮影
    let screenshotUrl: string | null = null;
    try {
      const screenshotBuffer = await page.screenshot({ fullPage: false });
      screenshotUrl = `data:image/png;base64,${screenshotBuffer.toString("base64")}`;
    } catch (err) {
      console.warn("[job-runner] スクリーンショット撮影失敗:", err);
    }

    // DRY_RUNモード: 送信しない
    if (DRY_RUN) {
      await db.autoSalesJob.update({
        where: { id: job.id },
        data: {
          status: "DRY_RUN",
          completedAt: new Date(),
          filledData: filled,
          sentBody: analysis.resolvedBody,
          sentFromEmail: analysis.replyEmail,
          screenshotUrl,
          errorMessage: errors.length > 0 ? `入力エラー: ${errors.join("; ")}` : null,
        },
      });
      console.log(`[job-runner] ドライラン完了: ${job.target.companyName} (${Object.keys(filled).length}フィールド入力)`);
      return true;
    }

    // CAPTCHAサイトはスキップ → 手動対応に回す
    if (analysis.captchaType !== "none") {
      await db.autoSalesJob.update({
        where: { id: job.id },
        data: {
          status: "SKIPPED",
          completedAt: new Date(),
          filledData: filled,
          sentBody: analysis.resolvedBody,
          sentFromEmail: analysis.replyEmail,
          screenshotUrl,
          errorMessage: `CAPTCHAサイトのため手動対応が必要（${analysis.captchaType}）`,
        },
      });
      console.log(`[job-runner] スキップ（CAPTCHA: ${analysis.captchaType}）→ 手動対応: ${job.target.companyName}`);
      return true;
    }

    // CF7サイトの場合、REST APIに直接POSTして送信（ブラウザ送信よりreCAPTCHA回避率が高い）
    const cf7FormId = await page.evaluate(`(function() {
      var form = document.querySelector('.wpcf7 form, form.wpcf7-form');
      if (!form) return null;
      var input = form.querySelector('input[name="_wpcf7"]');
      return input ? input.value : null;
    })()`);

    if (cf7FormId && analysis.captchaType === "v3") {
      console.log(`[job-runner] CF7 REST API直接送信 (form_id: ${cf7FormId})...`);

      // フォームデータを構築
      const cf7Result = await page.evaluate(`(function() {
        var form = document.querySelector('.wpcf7 form, form.wpcf7-form');
        if (!form) return { error: "form not found" };

        var formData = new FormData(form);
        var token = window.__cf7RecaptchaToken || "";
        formData.set("_wpcf7_recaptcha_response", token);

        // ページURLからエンドポイントを構築
        var formId = formData.get("_wpcf7");
        var endpoint = location.origin + "/wp-json/contact-form-7/v1/contact-forms/" + formId + "/feedback";

        return fetch(endpoint, {
          method: "POST",
          body: formData,
        })
        .then(function(res) { return res.json(); })
        .then(function(json) { return { status: json.status, message: json.message }; })
        .catch(function(err) { return { error: err.message }; });
      })()`);

      console.log(`[job-runner] CF7 REST応答: ${JSON.stringify(cf7Result)}`);

      const cf7Status = (cf7Result as { status?: string; message?: string; error?: string })?.status;
      const cf7Message = (cf7Result as { status?: string; message?: string; error?: string })?.message ?? "";
      const cf7Error = (cf7Result as { status?: string; message?: string; error?: string })?.error;

      if (cf7Status === "mail_sent") {
        await db.autoSalesJob.update({
          where: { id: job.id },
          data: {
            status: "COMPLETED",
            completedAt: new Date(),
            filledData: filled,
            sentBody: analysis.resolvedBody,
            sentFromEmail: analysis.replyEmail,
            screenshotUrl,
          },
        });
        await recordSentDomain({
          url: job.target.url,
          companyName: job.target.companyName,
          branchId: job.target.branchId,
          jobId: job.id,
        });
        console.log(`[job-runner] 送信完了（CF7 API）: ${job.target.companyName}`);
        return true;
      } else {
        await db.autoSalesJob.update({
          where: { id: job.id },
          data: {
            status: "FAILED",
            completedAt: new Date(),
            filledData: filled,
            sentBody: analysis.resolvedBody,
            sentFromEmail: analysis.replyEmail,
            screenshotUrl,
            errorMessage: `CF7送信拒否: ${cf7Status ?? cf7Error ?? "unknown"} - ${cf7Message}`,
          },
        });
        console.log(`[job-runner] CF7送信拒否: ${job.target.companyName} - ${cf7Status}`);
        return true;
      }
    }

    // 通常のフォーム送信（CF7以外）
    console.log(`[job-runner] 送信ボタンクリック中...`);
    const submitted = await clickSubmit(page, analysis.submitSelector);

    if (!submitted) {
      await db.autoSalesJob.update({
        where: { id: job.id },
        data: {
          status: "FAILED",
          completedAt: new Date(),
          filledData: filled,
          sentBody: analysis.resolvedBody,
          sentFromEmail: analysis.replyEmail,
          screenshotUrl,
          errorMessage: "送信ボタンが見つからないか、クリックできませんでした",
        },
      });
      console.log(`[job-runner] 失敗（送信ボタン不明）: ${job.target.companyName}`);
      return true;
    }

    // 送信後のレスポンスを確認
    await page.waitForTimeout(5000);
    const afterUrl = page.url();
    console.log(`[job-runner] 送信後URL: ${afterUrl}`);

    // CF7等のエラーメッセージをチェック（spam, validation_failed等）
    const pageResponse = await page.evaluate(`(function() {
      var msgs = document.querySelectorAll('.wpcf7-response-output, .wpcf7-mail-sent-ok, .wpcf7-validation-errors, .wpcf7-spam-blocked, .wpcf7-mail-sent-ng, [role="alert"]');
      var texts = [];
      for (var i = 0; i < msgs.length; i++) {
        var text = msgs[i].textContent.trim();
        if (text) texts.push(text);
      }
      return texts.join(' | ');
    })()`) as string;
    if (pageResponse) {
      console.log(`[job-runner] フォームレスポンス: ${pageResponse}`);
    }

    // 送信失敗を検出（spam判定、エラーメッセージ、Ajaxレスポンス）
    const failKeywords = ["spam", "failed", "失敗", "エラー", "error", "送信できません"];
    const isFailed =
      failKeywords.some((kw) => pageResponse?.toLowerCase().includes(kw)) ||
      lastAjaxStatus === "spam" ||
      lastAjaxStatus === "validation_failed" ||
      lastAjaxStatus === "mail_failed";

    if (isFailed) {
      await db.autoSalesJob.update({
        where: { id: job.id },
        data: {
          status: "FAILED",
          completedAt: new Date(),
          filledData: filled,
          sentBody: analysis.resolvedBody,
          sentFromEmail: analysis.replyEmail,
          screenshotUrl,
          errorMessage: `フォーム送信拒否: ${pageResponse?.substring(0, 200) ?? "不明"}`,
        },
      });
      console.log(`[job-runner] 送信拒否: ${job.target.companyName} - ${pageResponse}`);
      return true;
    }

    // thanks/完了ページの判定（厳格）
    const checkThanksPage = async (): Promise<{ isThanks: boolean; detail: string }> => {
      const url = page.url();
      const bodyText = await page.evaluate("document.body ? document.body.innerText : ''") as string;
      const lowerText = bodyText.toLowerCase();
      const lowerUrl = url.toLowerCase();

      // URLに thanks/complete/done 等が含まれる
      const urlMatch =
        lowerUrl.includes("thanks") ||
        lowerUrl.includes("complete") ||
        lowerUrl.includes("done") ||
        lowerUrl.includes("finish") ||
        lowerUrl.includes("success");

      // ページ本文に完了メッセージ
      const textMatch =
        bodyText.includes("送信が完了") ||
        bodyText.includes("送信完了") ||
        bodyText.includes("受け付けました") ||
        bodyText.includes("受付けました") ||
        bodyText.includes("お問い合わせありがとう") ||
        bodyText.includes("お問合せありがとう") ||
        bodyText.includes("ありがとうございました") ||
        bodyText.includes("自動返信") ||
        lowerText.includes("thank you for") ||
        lowerText.includes("has been sent") ||
        lowerText.includes("successfully");

      return { isThanks: urlMatch || textMatch, detail: urlMatch ? `URL: ${url}` : textMatch ? "完了メッセージ検出" : "未確認" };
    };

    let thanksCheck = await checkThanksPage();

    // 初回クリック後にthanksページでなければ、確認画面の可能性あり → confirm ボタン試行
    if (!thanksCheck.isThanks) {
      const confirmSubmitted = await clickConfirmButton(page);
      if (confirmSubmitted) {
        console.log(`[job-runner] 確認画面の送信ボタンをクリック: ${job.target.companyName}`);
        await page.waitForTimeout(5000);
        thanksCheck = await checkThanksPage();
      }
    }

    // thanks判定がtrueなら成功、falseなら送信不確実として記録
    if (thanksCheck.isThanks) {
      await db.autoSalesJob.update({
        where: { id: job.id },
        data: {
          status: "COMPLETED",
          completedAt: new Date(),
          filledData: filled,
          sentBody: analysis.resolvedBody,
          sentFromEmail: analysis.replyEmail,
          screenshotUrl,
          errorMessage: errors.length > 0 ? `入力警告: ${errors.join("; ")}` : null,
        },
      });
      await recordSentDomain({
        url: job.target.url,
        companyName: job.target.companyName,
        branchId: job.target.branchId,
        jobId: job.id,
      });
      console.log(`[job-runner] 送信完了: ${job.target.companyName} (${thanksCheck.detail})`);
    } else {
      await db.autoSalesJob.update({
        where: { id: job.id },
        data: {
          status: "FAILED",
          completedAt: new Date(),
          filledData: filled,
          sentBody: analysis.resolvedBody,
          sentFromEmail: analysis.replyEmail,
          screenshotUrl,
          errorMessage: "送信完了ページが確認できませんでした（未送信の可能性あり）",
        },
      });
      console.log(`[job-runner] 送信不確実（FAILED扱い）: ${job.target.companyName}`);
    }
    return true;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await db.autoSalesJob.update({
      where: { id: job.id },
      data: {
        status: "FAILED",
        completedAt: new Date(),
        errorMessage: msg.substring(0, 2000),
      },
    });
    console.error(`[job-runner] エラー: ${job.target.companyName} - ${msg}`);
    return true;
  } finally {
    clearTimeout(jobTimer);
    inFlightDomains.delete(jobDomain);
    if (page) {
      try {
        await page.close();
      } catch {}
    }
  }
}

/**
 * ブラウザを安全に終了する
 */
export async function closeBrowser(): Promise<void> {
  if (browser) {
    await browser.close();
    browser = null;
  }
}
