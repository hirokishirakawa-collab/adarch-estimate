"use client";

import { useState } from "react";

/** この文面のURLをコピーする（チャットに貼って共有する用） */
export function CopyUrlButton({ path }: { path: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        await navigator.clipboard.writeText(`${window.location.origin}${path}`);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
      className="text-xs px-2.5 py-1 border border-zinc-200 rounded hover:bg-zinc-50"
    >
      {copied ? "コピーしました" : "URLをコピー"}
    </button>
  );
}
