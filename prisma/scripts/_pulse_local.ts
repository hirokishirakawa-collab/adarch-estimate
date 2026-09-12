import { buildPulseEvents } from "../../src/lib/live/pulse";
buildPulseEvents({ days: 7 }).then((r) => { console.log("events", r.events.length, "ai", r.ai.length); for (const e of r.events.slice(0, 6)) console.log(" EV", e.at.slice(5, 16), e.kind, e.actor, e.text, e.prefs.join("/")); for (const a of r.ai.slice(0, 8)) console.log(" AI", a.at.slice(5, 16), a.text); process.exit(0); });
