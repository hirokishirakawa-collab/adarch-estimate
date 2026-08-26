// ==============================================================
// LINE 配信スケジューラ（アプリ内）
// GitHub Actions の */5 cron は遅延・間引きが大きい（実測: 1時間に2回）ため、
// サーバープロセス内で60秒ごとに runScenarioTick / runBroadcasts を回す。
// 二重実行は「行ごとの原子的なクレーム」（enrollment / broadcast の updateMany）で防ぐ。
// ==============================================================

declare global {
  // eslint-disable-next-line no-var
  var __lineSchedulerStarted: boolean | undefined;
  // eslint-disable-next-line no-var
  var __lineTickRunning: boolean | undefined;
}

const INTERVAL_MS = 60 * 1000;

export async function runLineTickWithLock(): Promise<{ ran: boolean; scenario?: { sent: number; failed: number }; broadcasts?: { processed: number } }> {
  if (globalThis.__lineTickRunning) return { ran: false };
  globalThis.__lineTickRunning = true;
  try {
    const { runScenarioTick, runBroadcasts, runBookingReminders } = await import("@/lib/line/service");
    const scenario = await runScenarioTick();
    const broadcasts = await runBroadcasts();
    await runBookingReminders().catch((e) => console.error("[line-scheduler] reminders failed", e));
    return { ran: true, scenario, broadcasts };
  } finally {
    globalThis.__lineTickRunning = false;
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
  setTimeout(tick, 15 * 1000);
  setInterval(tick, INTERVAL_MS).unref();
  console.log("[line-scheduler] started (60s interval)");
}
