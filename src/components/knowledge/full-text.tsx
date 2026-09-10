"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";

export function KnowledgeFullText({ content, charCount }: { content: string; charCount: number }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-xl border border-zinc-200 bg-white">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between px-4 py-3 text-left">
        <span className="text-sm font-bold text-zinc-800">全文（{Math.round(charCount / 1000)}千字）</span>
        <span className="text-xs text-zinc-500">{open ? "閉じる" : "開く"}</span>
      </button>
      {open && (
        <div className="px-4 pb-4 border-t border-zinc-100">
          <div className="prose prose-sm max-w-none prose-headings:mt-4 prose-h2:text-sm prose-h2:text-amber-700 prose-table:text-[11px] text-zinc-700 max-h-[70vh] overflow-y-auto pr-2">
            <ReactMarkdown>{content}</ReactMarkdown>
          </div>
        </div>
      )}
    </div>
  );
}
