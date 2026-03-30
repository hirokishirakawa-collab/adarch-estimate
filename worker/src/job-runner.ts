import { chromium, type Browser, type Page } from "playwright";
import { db } from "./db.js";
import { analyzeForm } from "./form-analyzer.js";
import { fillForm, clickSubmit, clickConfirmButton } from "./form-filler.js";
import { findContactFormUrl } from "./form-finder.js";
import { solveCaptcha } from "./captcha-solver.js";

const DRY_RUN = process.env.DRY_RUN === "true";
const PAGE_TIMEOUT = 30_000;

let browser: Browser | null = null;

async function getBrowser(): Promise<Browser> {
  if (!browser || !browser.isConnected()) {
    browser = await chromium.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage"],
    });
  }
  return browser;
}

/**
 * QUEUEDのジョブを1件取得して処理する
 * 戻り値: ジョブがあればtrue、なければfalse
 */
export async function processNextJob(): Promise<boolean> {
  // QUEUEDのジョブを1件取得（開始日を過ぎたもののみ）
  const now = new Date();
  const job = await db.autoSalesJob.findFirst({
    where: {
      status: "QUEUED",
      template: {
        OR: [
          { scheduledStartDate: null },
          { scheduledStartDate: { lte: now } },
        ],
      },
    },
    orderBy: { createdAt: "asc" },
    include: {
      target: true,
      template: true,
    },
  });

  if (!job) return false;

  // PROCESSINGに更新
  await db.autoSalesJob.update({
    where: { id: job.id },
    data: { status: "PROCESSING", startedAt: new Date() },
  });

  console.log(`[job-runner] 処理開始: ${job.target.companyName} (${job.target.url})`);

  let page: Page | null = null;

  try {
    // ブラックリストチェック
    const domain = new URL(job.target.url).hostname;
    const blacklisted = await db.autoSalesBlacklist.findUnique({
      where: { domain },
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

    // ブラウザでページを開く
    const b = await getBrowser();
    page = await b.newPage({
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
    });

    // ダイアログ自動処理
    page.on("dialog", async (dialog) => {
      await dialog.accept();
    });

    await page.goto(job.target.url, {
      waitUntil: "networkidle",
      timeout: PAGE_TIMEOUT,
    });

    // SPAの追加レンダリングを待つ
    await page.waitForTimeout(3000);

    // フォームURL自動検出: トップページ等の場合、お問い合わせフォームを探す
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

    // DOM取得
    const html = await page.content();

    // Claude Haikuでフォーム解析
    const analysis = await analyzeForm(html, {
      companyName: job.template.companyName,
      senderName: job.template.senderName,
      phone: job.template.phone,
      email: job.template.email,
      body: job.template.body,
    }, job.target.industry);

    // CAPTCHA解決
    if (analysis.captchaType !== "none") {
      console.log(`[job-runner] CAPTCHA検出 (${analysis.captchaType}): ${job.target.companyName}`);
      const { solved, method } = await solveCaptcha(page, analysis.captchaType, analysis.siteKey);
      if (!solved) {
        await db.autoSalesJob.update({
          where: { id: job.id },
          data: {
            status: "SKIPPED",
            completedAt: new Date(),
            errorMessage: `CAPTCHA解決失敗 (${analysis.captchaType}, ${method})`,
          },
        });
        console.log(`[job-runner] スキップ（CAPTCHA未解決）: ${job.target.companyName}`);
        return true;
      }
      console.log(`[job-runner] CAPTCHA解決: ${method}`);
    }

    // フォーム入力
    const { filled, errors } = await fillForm(page, analysis.fields);

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
          screenshotUrl,
          errorMessage: errors.length > 0 ? `入力エラー: ${errors.join("; ")}` : null,
        },
      });
      console.log(`[job-runner] ドライラン完了: ${job.target.companyName} (${Object.keys(filled).length}フィールド入力)`);
      return true;
    }

    // 送信（確認画面がある2段階フォームにも対応）
    const submitted = await clickSubmit(page, analysis.submitSelector);

    if (!submitted) {
      await db.autoSalesJob.update({
        where: { id: job.id },
        data: {
          status: "FAILED",
          completedAt: new Date(),
          filledData: filled,
          screenshotUrl,
          errorMessage: "送信ボタンが見つからないか、クリックできませんでした",
        },
      });
      console.log(`[job-runner] 失敗（送信ボタン不明）: ${job.target.companyName}`);
      return true;
    }

    // 確認画面→最終送信の2段階フォーム対応
    await page.waitForTimeout(3000);

    // 確認画面の送信ボタンを探す（「送信」「送信する」「Submit」等）
    const confirmSubmitted = await clickConfirmButton(page);
    if (confirmSubmitted) {
      console.log(`[job-runner] 確認画面の送信ボタンをクリック: ${job.target.companyName}`);
      await page.waitForTimeout(3000);
    }

    // 成功
    await db.autoSalesJob.update({
      where: { id: job.id },
      data: {
        status: "COMPLETED",
        completedAt: new Date(),
        filledData: filled,
        screenshotUrl,
        errorMessage: errors.length > 0 ? `入力警告: ${errors.join("; ")}` : null,
      },
    });
    console.log(`[job-runner] 送信完了: ${job.target.companyName}`);
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
