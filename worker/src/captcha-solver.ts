import type { Page } from "playwright";
import type { CaptchaType } from "./form-analyzer.js";

const TWOCAPTCHA_API_KEY = process.env.TWOCAPTCHA_API_KEY ?? "";
const TWOCAPTCHA_API = "https://2captcha.com";
const POLL_INTERVAL = 5000; // 5秒
const MAX_WAIT = 120000; // 最大2分

/**
 * CAPTCHAを解決する
 * v3: まずそのまま送信を試み、失敗時に2Captchaフォールバック
 * v2/hcaptcha/turnstile: 2Captchaで解決
 *
 * @returns true=解決済み（またはCAPTCHAなし）, false=解決失敗
 */
export async function solveCaptcha(
  page: Page,
  captchaType: CaptchaType,
  siteKey: string | null,
): Promise<{ solved: boolean; method: string }> {
  if (captchaType === "none") {
    return { solved: true, method: "none" };
  }

  // v3はスコアベースなので、まず2Captchaなしで送信を試みる
  if (captchaType === "v3") {
    // siteKeyがあり、2CaptchaのAPIキーもあれば、トークンを取得して注入
    if (siteKey && TWOCAPTCHA_API_KEY) {
      try {
        const token = await solveRecaptchaV3(siteKey, page.url());
        if (token) {
          await injectRecaptchaToken(page, token);
          return { solved: true, method: "2captcha-v3" };
        }
      } catch (err) {
        console.warn("[captcha-solver] v3解決失敗、そのまま送信を試みます:", err);
      }
    }
    // 2Captchaなしでもv3はそのまま通ることがある
    return { solved: true, method: "v3-passthrough" };
  }

  // v2: 2Captchaで解決
  if (captchaType === "v2" && siteKey && TWOCAPTCHA_API_KEY) {
    try {
      const token = await solveRecaptchaV2(siteKey, page.url());
      if (token) {
        await injectRecaptchaToken(page, token);
        return { solved: true, method: "2captcha-v2" };
      }
    } catch (err) {
      console.error("[captcha-solver] v2解決失敗:", err);
    }
    return { solved: false, method: "2captcha-v2-failed" };
  }

  // hCaptcha
  if (captchaType === "hcaptcha" && siteKey && TWOCAPTCHA_API_KEY) {
    try {
      const token = await solveHCaptcha(siteKey, page.url());
      if (token) {
        await page.evaluate((t) => {
          const textarea = document.querySelector('[name="h-captcha-response"], [name="g-recaptcha-response"]') as HTMLTextAreaElement;
          if (textarea) textarea.value = t;
        }, token);
        return { solved: true, method: "2captcha-hcaptcha" };
      }
    } catch (err) {
      console.error("[captcha-solver] hCaptcha解決失敗:", err);
    }
    return { solved: false, method: "2captcha-hcaptcha-failed" };
  }

  // Turnstile
  if (captchaType === "turnstile" && siteKey && TWOCAPTCHA_API_KEY) {
    try {
      const token = await solveTurnstile(siteKey, page.url());
      if (token) {
        await page.evaluate((t) => {
          const input = document.querySelector('[name="cf-turnstile-response"]') as HTMLInputElement;
          if (input) input.value = t;
        }, token);
        return { solved: true, method: "2captcha-turnstile" };
      }
    } catch (err) {
      console.error("[captcha-solver] Turnstile解決失敗:", err);
    }
    return { solved: false, method: "2captcha-turnstile-failed" };
  }

  // APIキーなし or siteKey不明 → v3以外はスキップ
  if (!TWOCAPTCHA_API_KEY) {
    console.warn("[captcha-solver] TWOCAPTCHA_API_KEY が未設定。CAPTCHAをスキップします");
    return { solved: false, method: "no-api-key" };
  }

  return { solved: false, method: "unsupported" };
}

// ─── 2Captcha API 呼び出し ─────────────────────

async function solveRecaptchaV2(siteKey: string, pageUrl: string): Promise<string | null> {
  return solve2Captcha({
    method: "userrecaptcha",
    googlekey: siteKey,
    pageurl: pageUrl,
  });
}

async function solveRecaptchaV3(siteKey: string, pageUrl: string): Promise<string | null> {
  return solve2Captcha({
    method: "userrecaptcha",
    googlekey: siteKey,
    pageurl: pageUrl,
    version: "v3",
    action: "submit",
    min_score: "0.3",
  });
}

async function solveHCaptcha(siteKey: string, pageUrl: string): Promise<string | null> {
  return solve2Captcha({
    method: "hcaptcha",
    sitekey: siteKey,
    pageurl: pageUrl,
  });
}

async function solveTurnstile(siteKey: string, pageUrl: string): Promise<string | null> {
  return solve2Captcha({
    method: "turnstile",
    sitekey: siteKey,
    pageurl: pageUrl,
  });
}

async function solve2Captcha(params: Record<string, string>): Promise<string | null> {
  // Step 1: タスク送信
  const submitParams = new URLSearchParams({
    key: TWOCAPTCHA_API_KEY,
    json: "1",
    ...params,
  });

  const submitRes = await fetch(`${TWOCAPTCHA_API}/in.php?${submitParams}`);
  const submitData = await submitRes.json() as { status: number; request: string };

  if (submitData.status !== 1) {
    console.error("[2captcha] タスク送信エラー:", submitData.request);
    return null;
  }

  const taskId = submitData.request;
  console.log(`[2captcha] タスク送信完了: ${taskId}`);

  // Step 2: 結果ポーリング
  const startTime = Date.now();
  while (Date.now() - startTime < MAX_WAIT) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL));

    const resultParams = new URLSearchParams({
      key: TWOCAPTCHA_API_KEY,
      action: "get",
      id: taskId,
      json: "1",
    });

    const resultRes = await fetch(`${TWOCAPTCHA_API}/res.php?${resultParams}`);
    const resultData = await resultRes.json() as { status: number; request: string };

    if (resultData.status === 1) {
      console.log(`[2captcha] 解決完了: ${taskId}`);
      return resultData.request;
    }

    if (resultData.request !== "CAPCHA_NOT_READY") {
      console.error("[2captcha] エラー:", resultData.request);
      return null;
    }
  }

  console.error("[2captcha] タイムアウト:", taskId);
  return null;
}

// ─── トークン注入 ─────────────────────────────

async function injectRecaptchaToken(page: Page, token: string): Promise<void> {
  await page.evaluate((t) => {
    // g-recaptcha-response textarea にトークンをセット
    const textareas = document.querySelectorAll('[name="g-recaptcha-response"], #g-recaptcha-response');
    textareas.forEach((el) => {
      (el as HTMLTextAreaElement).value = t;
      (el as HTMLTextAreaElement).style.display = "block";
    });

    // コールバック実行（あれば）
    try {
      if (typeof (window as any).___grecaptcha_cfg !== "undefined") {
        const clients = (window as any).___grecaptcha_cfg.clients;
        if (clients) {
          for (const key in clients) {
            const client = clients[key];
            // v2/v3のコールバックを探して実行
            const findCallback = (obj: any, depth: number): any => {
              if (depth > 5 || !obj) return null;
              if (typeof obj === "function") return obj;
              if (typeof obj === "object") {
                for (const k in obj) {
                  if (k === "callback" && typeof obj[k] === "function") return obj[k];
                  const found = findCallback(obj[k], depth + 1);
                  if (found) return found;
                }
              }
              return null;
            };
            const cb = findCallback(client, 0);
            if (cb) cb(t);
          }
        }
      }
    } catch {}
  }, token);
}
