"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

export function CopyTextButton({ text, label = "コピー", className = "" }: { text: string; label?: string; className?: string }) {
  const [done, setDone] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setDone(true);
      setTimeout(() => setDone(false), 1200);
    } catch {
      /* noop */
    }
  }
  return (
    <button
      type="button"
      onClick={copy}
      className={`inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold rounded border border-zinc-200 text-zinc-600 hover:bg-zinc-50 ${className}`}
    >
      {done ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
      {done ? "コピーしました" : label}
    </button>
  );
}
