import { jstDayStart } from "../jst-range";

const DAY = 86_400_000;
interface SummaryEvent { at: string; kind: string }

/** Count the same activity rows as the feed, before its display limit is applied. */
export function buildLiveSummary(events: readonly SummaryEvent[], now: Date = new Date()) {
  const end = now.getTime();
  const todayStart = jstDayStart(now).getTime();
  // Three Japanese calendar days: today, yesterday and the day before yesterday.
  const recentStart = todayStart - 2 * DAY;
  const countSince = (start: number, exclusiveStart = false) => {
    const counts = { approach: 0, deal: 0, won: 0, hq: 0, auto: 0, visit: 0 };
    for (const event of events) {
      const at = Date.parse(event.at);
      if (!Number.isFinite(at) || at > end || (exclusiveStart ? at <= start : at < start)) continue;
      // Recipient-side mail opens/clicks are shown in the feed but are not group activity counts.
      if (event.kind === "mail") continue;
      if (["sent", "move", "log", "lead", "tver", "tool"].includes(event.kind)) counts.approach++;
      else if (event.kind === "deal") counts.deal++;
      else if (event.kind === "won") counts.won++;
      else if (event.kind === "auto") counts.auto++;
      else if (event.kind === "visit") counts.visit++;
      else counts.hq++;
    }
    return counts;
  };
  return {
    counts: {
      today: countSince(todayStart),
      recent3days: countSince(recentStart),
      // Preserve the existing rolling seven-day summary for other consumers.
      week: countSince(end - 7 * DAY, true),
    },
    periods: { recent3days: { from: new Date(recentStart).toISOString(), to: now.toISOString() } },
  };
}
