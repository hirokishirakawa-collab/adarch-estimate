/** UI-only identities. No backend or database imports in this module. */
export interface LiveEvent {
  at: string;
  kind: string;
  actor: string;
  prefs: string[];
  text: string;
  ref?: { kind: string; id: string };
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
