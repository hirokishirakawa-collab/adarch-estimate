// ==============================================================
// LINE 配信スケジューラ（アプリ内）
// GitHub Actions の */5 cron は遅延・間引きが大きい（実測: 1時間に2回）ため、
// サーバープロセス内で60秒ごとに runScenarioTick / runBroadcasts を回す。
// 複数インスタンスでの二重実行は Postgres のアドバイザリロックで防ぐ。
// ==============================================================

import { db } from "@/lib/db";

const LOCK_KEY = 8_250_001; // 任意の固定値
const INTERVAL_MS = 60 * 1000;

declare global {
  // eslint-disable-next-line no-var
  var __lineSchedulerStarted: boolean | undefined;
}

export async function runLineTickWithLock(): Promise<{ ran: boolean; scenario?: { sent: number; failed: number }; broadcasts?: { processed: number } }> {
  const rows = (await db.$queryRawUnsafe(`SELECT pg_try_advisory_lock(${LOCK_KEY}) AS locked`)) as { locked: boolean }[];
  if (!rows[0]?.locked) return { ran: false };
  try {
    const { runScenarioTick, runBroadcasts } = await import("@/lib/line/service");
    const scenario = await runScenarioTick();
    const broadcasts = await runBroadcasts();
    return { ran: true, scenario, broadcasts };
  } finally {
    await db.$queryRawUnsafe(`SELECT pg_advisory_unlock(${LOCK_KEY})`).catch(() => {});
  }
}

export function startLineScheduler(): void {
  if (globalThis.__lineSchedulerStarted) return;
  globalThis.__lineSchedulerStarted = true;
  const tick = async () => {
    try {
      const r = await runLineTickWithLock();
      if (r.ran && ((r.scenario?.sent ?? 0) > 0 || (r.broadcasts?.processed ?? 0) > 0)) {
        console.log("[line-scheduler]", JSON.stringify(r));
      }
    } catch (e) {
      console.error("[line-scheduler] tick failed", e);
    }
  };
  // 起動直後に1回、その後は60秒ごと
  setTimeout(tick, 15 * 1000);
  setInterval(tick, INTERVAL_MS).unref();
  console.log("[line-scheduler] started (60s interval)");
}
