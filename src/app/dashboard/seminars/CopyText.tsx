"use client";

import { useState } from "react";

/** 文字列をクリップボードへ。label=ボタン名 */
export function CopyText({ text, label }: { text: string; label: string }) {
  const [done, setDone] = useState(false);
  async function onClick() {
    try {
      await navigator.clipboard.writeText(text);
      setDone(true);
      setTimeout(() => setDone(false), 1800);
    } catch {
      /* http 等で使えない環境 */
    }
  }
  return (
    <button type="button" onClick={onClick} className="rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-50">
      {done ? "コピーしました" : label}
    </button>
  );
}
