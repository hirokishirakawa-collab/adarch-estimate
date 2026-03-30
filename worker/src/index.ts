import { processNextJob, closeBrowser } from "./job-runner.js";

const POLL_INTERVAL = Number(process.env.POLL_INTERVAL_MS ?? "10000"); // デフォルト10秒
const SUBMIT_DELAY_MIN = Number(process.env.SUBMIT_DELAY_MS_MIN ?? "30000"); // 最小30秒
const SUBMIT_DELAY_MAX = Number(process.env.SUBMIT_DELAY_MS_MAX ?? "60000"); // 最大60秒
const DAILY_LIMIT = Number(process.env.DAILY_LIMIT ?? "2000");

let todayCount = 0;
let lastResetDate = new Date().toDateString();

function randomDelay(): number {
  return SUBMIT_DELAY_MIN + Math.random() * (SUBMIT_DELAY_MAX - SUBMIT_DELAY_MIN);
}

function resetDailyCount(): void {
  const today = new Date().toDateString();
  if (today !== lastResetDate) {
    todayCount = 0;
    lastResetDate = today;
    console.log("[worker] 日次カウンターをリセット");
  }
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main(): Promise<void> {
  console.log("===========================================");
  console.log("  Auto Sales Worker 起動");
  console.log(`  DRY_RUN: ${process.env.DRY_RUN === "true" ? "ON" : "OFF"}`);
  console.log(`  ポーリング間隔: ${POLL_INTERVAL}ms`);
  console.log(`  送信間隔: ${SUBMIT_DELAY_MIN}-${SUBMIT_DELAY_MAX}ms`);
  console.log(`  日次上限: ${DAILY_LIMIT}件`);
  console.log("===========================================");

  // シャットダウン処理
  const shutdown = async () => {
    console.log("[worker] シャットダウン中...");
    await closeBrowser();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  // メインループ
  while (true) {
    try {
      resetDailyCount();

      // 日次上限チェック
      if (todayCount >= DAILY_LIMIT) {
        console.log(`[worker] 日次上限到達 (${todayCount}/${DAILY_LIMIT})。明日まで待機`);
        await sleep(60_000); // 1分ごとに再チェック
        continue;
      }

      const processed = await processNextJob();

      if (processed) {
        todayCount++;
        console.log(`[worker] 本日の処理数: ${todayCount}/${DAILY_LIMIT}`);

        // 送信間隔をランダムに空ける
        const delay = randomDelay();
        console.log(`[worker] 次のジョブまで ${Math.round(delay / 1000)}秒 待機`);
        await sleep(delay);
      } else {
        // キューが空の場合、ポーリング間隔で待機
        await sleep(POLL_INTERVAL);
      }
    } catch (err) {
      console.error("[worker] メインループエラー:", err);
      await sleep(POLL_INTERVAL);
    }
  }
}

main().catch((err) => {
  console.error("[worker] 致命的エラー:", err);
  process.exit(1);
});

