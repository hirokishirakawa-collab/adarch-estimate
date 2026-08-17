import { processNextJob, closeBrowser } from "./job-runner.js";

const POLL_INTERVAL = Number(process.env.POLL_INTERVAL_MS ?? "10000"); // デフォルト10秒
const SUBMIT_DELAY_MIN = Number(process.env.SUBMIT_DELAY_MS_MIN ?? "15000"); // 最小15秒
const SUBMIT_DELAY_MAX = Number(process.env.SUBMIT_DELAY_MS_MAX ?? "30000"); // 最大30秒
const DAILY_LIMIT = Number(process.env.DAILY_LIMIT ?? "3500");

// 同時に走らせるレーン数。1レーン＝1件ずつ順番に処理する流れ。
// レーンを増やすほど1日に捌ける件数は増えるが、Playwrightのメモリも比例して増える。
// 1ページ150〜250MB。Railway 2GBプランで5が目安、4GBなら8〜10まで伸ばせる。
// 同一ドメインへの同時アクセスは job-runner 側で防いでいる。
const CONCURRENCY = Math.max(1, Number(process.env.CONCURRENCY ?? "5"));

// 送信する時間帯（サーバのタイムゾーン基準の「時」）。
// 深夜に問い合わせフォームが届くと機械送信だと分かりやすいので、既定は 8:00〜20:00。
// SEND_WINDOW_START=0 かつ SEND_WINDOW_END=24 で24時間稼働。
const SEND_WINDOW_START = Number(process.env.SEND_WINDOW_START ?? "8");
const SEND_WINDOW_END = Number(process.env.SEND_WINDOW_END ?? "20");

let todayCount = 0;
let lastResetDate = new Date().toDateString();
let shuttingDown = false;

function isWithinSendWindow(): boolean {
  const hour = new Date().getHours();
  return hour >= SEND_WINDOW_START && hour < SEND_WINDOW_END;
}

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

/**
 * 1レーン分の処理ループ。
 * 日次上限は全レーン共通のカウンターで見る（Node は単一スレッドなので ++ は競合しない）。
 */
async function runLane(laneId: number): Promise<void> {
  while (!shuttingDown) {
    try {
      resetDailyCount();

      // 送信時間帯の外では止める
      if (!isWithinSendWindow()) {
        await sleep(60_000); // 1分ごとに再チェック
        continue;
      }

      // 日次上限チェック（グループ全体）。拠点ごとの上限は job-runner 側で見ている
      if (todayCount >= DAILY_LIMIT) {
        console.log(`[worker:${laneId}] 日次上限到達 (${todayCount}/${DAILY_LIMIT})。明日まで待機`);
        await sleep(60_000); // 1分ごとに再チェック
        continue;
      }

      const processed = await processNextJob();

      if (processed) {
        todayCount++;
        console.log(`[worker:${laneId}] 本日の処理数: ${todayCount}/${DAILY_LIMIT}`);

        // 送信間隔をランダムに空ける
        const delay = randomDelay();
        console.log(`[worker:${laneId}] 次のジョブまで ${Math.round(delay / 1000)}秒 待機`);
        await sleep(delay);
      } else {
        // キューが空の場合、ポーリング間隔で待機
        await sleep(POLL_INTERVAL);
      }
    } catch (err) {
      console.error(`[worker:${laneId}] ループエラー:`, err);
      await sleep(POLL_INTERVAL);
    }
  }
}

async function main(): Promise<void> {
  console.log("===========================================");
  console.log("  Auto Sales Worker 起動");
  console.log(`  DRY_RUN: ${process.env.DRY_RUN === "true" ? "ON" : "OFF"}`);
  console.log(`  並列レーン数: ${CONCURRENCY}`);
  console.log(`  送信時間帯: ${SEND_WINDOW_START}:00-${SEND_WINDOW_END}:00`);
  console.log(`  ポーリング間隔: ${POLL_INTERVAL}ms`);
  console.log(`  送信間隔: ${SUBMIT_DELAY_MIN}-${SUBMIT_DELAY_MAX}ms`);
  console.log(`  日次上限: ${DAILY_LIMIT}件（グループ全体）`);
  console.log("===========================================");

  // シャットダウン処理
  const shutdown = async () => {
    console.log("[worker] シャットダウン中...");
    shuttingDown = true;
    await closeBrowser();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  // レーンを起動。1本でも落ちたら異常なのでプロセスごと終了させる（Railway が再起動する）。
  await Promise.all(
    Array.from({ length: CONCURRENCY }, (_, i) => runLane(i + 1))
  );
}

main().catch((err) => {
  console.error("[worker] 致命的エラー:", err);
  process.exit(1);
});
