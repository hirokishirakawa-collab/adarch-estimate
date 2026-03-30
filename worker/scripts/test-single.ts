/**
 * 単一URLでフォーム解析をテストするスクリプト
 *
 * 使い方:
 *   cd worker
 *   npx tsx scripts/test-single.ts https://example.com/contact
 */
import { chromium } from "playwright";
import { analyzeForm } from "../src/form-analyzer.js";

const url = process.argv[2];
if (!url) {
  console.error("Usage: npx tsx scripts/test-single.ts <URL>");
  process.exit(1);
}

async function main() {
  console.log(`\nテスト対象: ${url}\n`);

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  console.log("ページを読み込み中...");
  await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForTimeout(3000);

  const html = await page.content();
  console.log(`HTML取得: ${html.length} 文字\n`);

  console.log("Claude Haiku でフォーム解析中...");
  const result = await analyzeForm(html, {
    companyName: "テスト株式会社 AdArch",
    senderName: "テスト 太郎",
    phone: "03-1234-5678",
    email: "test@example.com",
    body: "突然のご連絡失礼いたします。テスト株式会社の太郎と申します。広告・プロモーションのお手伝いをしております。ご興味がございましたら、お気軽にご返信ください。",
  }, "飲食店");

  console.log("\n=== 解析結果 ===");
  console.log(`CAPTCHA: ${result.captcha ? "検出" : "なし"}`);
  console.log(`送信ボタン: ${result.submitSelector ?? "不明"}`);
  console.log(`フィールド数: ${result.fields.length}`);
  console.log("\nフィールドマッピング:");
  for (const f of result.fields) {
    console.log(`  [${f.type}] ${f.selector} → "${f.value.substring(0, 50)}${f.value.length > 50 ? "..." : ""}"`);
  }

  await browser.close();
  console.log("\n完了");
}

main().catch((err) => {
  console.error("エラー:", err);
  process.exit(1);
});
