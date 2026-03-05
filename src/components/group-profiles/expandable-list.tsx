"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

const INITIAL_COUNT = 5;

interface ExpandableListProps {
  totalCount: number;
  children: React.ReactNode[];
}

export function ExpandableList({ totalCount, children }: ExpandableListProps) {
  const [expanded, setExpanded] = useState(false);

  const visible = expanded ? children : children.slice(0, INITIAL_COUNT);
  const hasMore = totalCount > INITIAL_COUNT;

  return (
    <>
      <div className="space-y-2">{visible}</div>
      {hasMore && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-2 inline-flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-800 transition-colors"
        >
          {expanded ? (
            <>
              <ChevronUp className="w-3.5 h-3.5" />
              閉じる
            </>
          ) : (
            <>
              <ChevronDown className="w-3.5 h-3.5" />
              他 {totalCount - INITIAL_COUNT}件を表示
            </>
          )}
        </button>
      )}
    </>
  );
}
