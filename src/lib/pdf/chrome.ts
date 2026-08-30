// HTML → PDF（Chrome headless / puppeteer-core）。サーバー専用。
//   実行ファイル: 環境変数 CHROME_PATH → macOS の Google Chrome → Alpine の chromium の順で探す
//   本番(Dockerfile)は `apk add chromium` + CHROME_PATH=/usr/bin/chromium-browser
import fs from "fs";
import os from "os";
import path from "path";

const CANDIDATES = [
  process.env.CHROME_PATH,
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/chromium-browser",
  "/usr/bin/chromium",
  "/usr/bin/google-chrome",
].filter((p): p is string => !!p);

export function findChrome(): string | null {
  for (const p of CANDIDATES) {
    try { if (fs.existsSync(p)) return p; } catch { /* skip */ }
  }
  return null;
}

export interface HtmlPdfOptions {
  /** A4 縦が既定。CSS の @page があれば preferCSSPageSize で優先 */
  format?: "A4" | "Letter";
  landscape?: boolean;
  timeoutMs?: number;
}

/** HTML文字列をPDF(Buffer)にする。Chromeが見つからなければ null を返す（呼び出し側でフォールバック） */
export async function renderHtmlToPdf(html: string, opts: HtmlPdfOptions = {}): Promise<Buffer | null> {
  const executablePath = findChrome();
  if (!executablePath) return null;

  const puppeteer = await import("puppeteer-core");
  const browser = await puppeteer.launch({
    executablePath,
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--font-render-hinting=none",
      "--allow-file-access-from-files", // file:// のフォントを読ませる
    ],
  });
  try {
    // about:blank から file:// のフォントは読めないため、一時HTMLに書いて file:// で開く
    const tmp = path.join(os.tmpdir(), `html-pdf-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}.html`);
    fs.writeFileSync(tmp, html, "utf8");
    const page = await browser.newPage();
    try {
      await page.goto("file://" + tmp, { waitUntil: "load", timeout: opts.timeoutMs ?? 30_000 });
      await page.evaluateHandle("document.fonts.ready");
    } finally {
      try { fs.unlinkSync(tmp); } catch { /* ignore */ }
    }
    const pdf = await page.pdf({
      format: opts.format ?? "A4",
      landscape: opts.landscape ?? false,
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
    });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}
