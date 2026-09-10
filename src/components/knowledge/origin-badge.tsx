import { ORIGIN_UI, type KnowledgeOrigin } from "./types";

export function OriginBadge({ origin, size = "sm" }: { origin: KnowledgeOrigin; size?: "sm" | "xs" }) {
  const o = ORIGIN_UI[origin];
  return (
    <span title={o.hint} className={`inline-flex items-center rounded-md border font-bold ${size === "xs" ? "px-1.5 py-0 text-[10px]" : "px-2 py-0.5 text-[11px]"} ${o.cls}`}>
      {o.short}
    </span>
  );
}
