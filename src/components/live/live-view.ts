/** UI-only identities. No backend or database imports in this module. */
export interface LiveEvent {
  at: string;
  kind: string;
  actor: string;
  prefs: string[];
  text: string;
  result?: "won" | "reply" | "appointment";
  ref?: { kind: string; id: string };
}

/** Color known outcomes, never infer success from company names or free text. */
export function eventOutcome(event?: LiveEvent): { tone: "won" | "positive"; label: string } | null {
  if (!event) return null;
  const result = event.result ?? (event.kind === "won" ? "won" : event.kind === "booking" ? "appointment" : null);
  if (result === "won") return { tone: "won", label: "受注" };
  if (result === "reply") return { tone: "positive", label: "反響あり" };
  if (result === "appointment") return { tone: "positive", label: event.kind === "booking" ? "面談予約" : "アポ獲得" };
  return null;
}

export function periodLabel(period?: { from: string; to: string }): string {
  if (!period) return "今日を含む3日間 · 日本時間";
  const format = (value: string) => new Date(value).toLocaleDateString("ja-JP", { timeZone: "Asia/Tokyo", month: "numeric", day: "numeric" });
  return `${format(period.from)}–${format(period.to)} · 日本時間`;
}

export function eventKey(event: LiveEvent): string {
  return JSON.stringify([event.at, event.kind, event.actor, event.text, event.ref?.kind, event.ref?.id]);
}

export function aiKey(event: { at: string; text: string }): string {
  return JSON.stringify([event.at, event.text]);
}

/** Initial snapshots, reordering and deleted rows must not look like new activity. */
export function newKeys(previous: ReadonlySet<string> | null, current: string[]): Set<string> {
  return new Set(previous === null ? [] : current.filter((key) => !previous.has(key)));
}

/** Keep the original event text intact; only separate a quoted client for typography. */
export function eventCopy(text: string): { client: string | null; action: string } {
  const match = /^「([^」]+)」(.+)$/.exec(text);
  return match ? { client: `「${match[1]}」`, action: match[2] } : { client: null, action: text };
}
