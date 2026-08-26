"use client";

import { useState } from "react";

/** 納品後に先方へ伝える一文をクリップボードへコピーする。文面はサーバー側で組み立て済み。 */
export function CopyPitchButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  async function onClick() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // クリップボードが使えない環境（http等）では何もしない
    }
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-md border border-zinc-200 bg-white px-2.5 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
    >
      {copied ? "コピーしました" : "案内文をコピー"}
    </button>
  );
}
