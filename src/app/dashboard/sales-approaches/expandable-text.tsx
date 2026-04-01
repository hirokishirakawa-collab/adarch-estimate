"use client";

import { useState } from "react";

export function ExpandableText({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div>
      <p
        className={`text-xs text-zinc-700 whitespace-pre-wrap leading-relaxed cursor-pointer ${
          expanded ? "" : "line-clamp-6"
        }`}
        onClick={() => setExpanded(!expanded)}
      >
        {text}
      </p>
      {!expanded && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="text-[10px] text-teal-600 hover:text-teal-800 mt-1 font-medium"
        >
          全文を表示 ▼
        </button>
      )}
      {expanded && (
        <button
          type="button"
          onClick={() => setExpanded(false)}
          className="text-[10px] text-teal-600 hover:text-teal-800 mt-1 font-medium"
        >
          閉じる ▲
        </button>
      )}
    </div>
  );
}
