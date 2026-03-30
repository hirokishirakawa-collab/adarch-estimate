import type { Page } from "playwright";
import type { CaptchaType } from "./form-analyzer.js";

const TWOCAPTCHA_API_KEY = process.env.TWOCAPTCHA_API_KEY ?? "";
const TWOCAPTCHA_API = "https://2captcha.com";
const POLL_INTERVAL = 5000;
const MAX_WAIT = 120000;

/**
 * CAPTCHAを解決する
 * v3: 2Captchaでトークンをとってgrecaptchaをハイジャック
 * v2/hcaptcha/turnstile: 2Captchaで解決
 */
export async function solveCaptcha(
  page: Page,
  captchaType: CaptchaType,
  siteKey: string | null,
): Promise<{ solved: boolean; method: string }> {
  if (captchaType === "none") {
    return { solved: true, method: "none" };
  }

  if (!TWOCAPTCHA_API_KEY) {
    // APIキーなし → v3はパススルーで試す、それ以外はスキ��プ
    if (captchaType === "v3") {
      return { solved: true, method: "v3-passthrough" };
    }
    console.warn("[captcha-solver] TWOCAPTCHA_API_KEY が未設定");
    return { solved: false, method: "no-api-key" };
  }

  if (!siteKey) {
    console.warn("[captcha-solver] siteKeyが不明");
    if (captchaType === "v3") {
      return { solved: true, method: "v3-passthrough" };
    }
    return { solved: false, method: "no-sitekey" };
  }

  // ──── reCAPTCHA v3 ────
  if (captchaType === "v3") {
    try {
      console.log("[captcha-solver] v3: 2Captchaでトークン取得中...");
      const token = await solveRecaptchaV3(siteKey, page.url());
      if (token) {
        // grecaptcha.execute をハイジャックし、常に2Captchaトークンを返す
        await page.evaluate((t) => {
          // g-recaptcha-response に注入
          const textareas = document.querySelectorAll<HTMLTextAreaElement>(
            'textarea[name="g-recaptcha-response"]'
          );
          textareas.forEach((el) => { el.value = t; });

          // grecaptcha.execute を乗っ取り、常にこのトークンを返す
          if (typeof (window as any).grecaptcha !== "undefined") {
            const original = (window as any).grecaptcha;
            (window as any).grecaptcha = {
              ...original,
              execute: () => Promise.resolve(t),
              ready: (cb: () => void) => cb(),
            };
            // enterprise版も対応
            if (original.enterprise) {
              (window as any).grecaptcha.enterprise = {
                ...original.enterprise,
                execute: () => Promise.resolve(t),
                ready: (cb: () => void) => cb(),
              };
            }
          }

          // wpcf7（Contact Form 7）のrecaptchaハンドラーも上書き
          if (typeof (window as any).wpcf7 !== "undefined") {
            const wpcf7 = (window as any).wpcf7;
            if (wpcf7.recaptcha) {
              wpcf7.recaptcha.execute = () => Promise.resolve(t);
            }
          }
        }, token);
        console.log("[captcha-solver] v3: grecaptchaハイジャック完了");
        return { solved: true, method: "2captcha-v3" };
      }
    } catch (err) {
      console.warn("[captcha-solver] v3解決エラー:", err);
    }
    // フォールバック: そのまま送信を試みる
    return { solved: true, method: "v3-passthrough" };
  }

  // ──── reCAPTCHA v2 ────
  if (captchaType === "v2") {
    try {
      console.log("[captcha-solver] v2: 2Captchaでトークン取得中...");
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

  // ──── hCaptcha ────
  if (captchaType === "hcaptcha") {
    try {
      console.log("[captcha-solver] hCaptcha: 2Captchaでトークン取得中...");
      const token = await solveHCaptcha(siteKey, page.url());
      if (token) {
        await page.evaluate((t) => {
          const el = document.querySelector<HTMLTextAreaElement>(
            '[name="h-captcha-response"], [name="g-recaptcha-response"]'
          );
          if (el) el.value = t;
        }, token);
        return { solved: true, method: "2captcha-hcaptcha" };
      }
    } catch (err) {
      console.error("[captcha-solver] hCaptcha解決失敗:", err);
    }
    return { solved: false, method: "2captcha-hcaptcha-failed" };
  }

  // ──── Turnstile ────
  if (captchaType === "turnstile") {
    try {
      console.log("[captcha-solver] Turnstile: 2Captchaでトークン取得中...");
      const token = await solveTurnstile(siteKey, page.url());
      if (token) {
        await page.evaluate((t) => {
          const el = document.querySelector<HTMLInputElement>('[name="cf-turnstile-response"]');
          if (el) el.value = t;
        }, token);
        return { solved: true, method: "2captcha-turnstile" };
      }
    } catch (err) {
      console.error("[captcha-solver] Turnstile解決失敗:", err);
    }
    return { solved: false, method: "2captcha-turnstile-failed" };
  }

  return { solved: false, method: "unsupported" };
}

// ─── 2Captcha API ─────────────────────────────

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
      console.log(`[2captcha] 解決完了: ${taskId} (${Math.round((Date.now() - startTime) / 1000)}秒)`);
      return resultData.request;
    }

    if (resultData.request !== "CAPCHA_NOT_READY") {
      console.error("[2captcha] エラー:", resultData.request);
      return null;
    }

    console.log(`[2captcha] 待機中... (${Math.round((Date.now() - startTime) / 1000)}秒経過)`);
  }

  console.error("[2captcha] タイムアウト:", taskId);
  return null;
}

// ─── トークン注入（v2用） ─────────────────────────

async function injectRecaptchaToken(page: Page, token: string): Promise<void> {
  await page.evaluate((t) => {
    const textareas = document.querySelectorAll<HTMLTextAreaElement>(
      '[name="g-recaptcha-response"], #g-recaptcha-response'
    );
    textareas.forEach((el) => { el.value = t; });

    // コールバック実行
    try {
      if (typeof (window as any).___grecaptcha_cfg !== "undefined") {
        const clients = (window as any).___grecaptcha_cfg.clients;
        if (clients) {
          for (const key in clients) {
            const client = clients[key];
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
