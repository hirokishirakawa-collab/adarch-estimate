"use client";

import { useState } from "react";
import { MoveForm } from "./move-form";
import { PasteForm } from "./paste-form";

// ---------------------------------------------------------------
// /move の2つの入口を切り替える。
//   「1件ずつ」＝従来のフォーム。「AIに書かせて貼る」＝OSを使っていない代表向け。
// ---------------------------------------------------------------
export function MoveTabs({ chatSpaceId, partnerName }: { chatSpaceId: string; partnerName: string }) {
  const [tab, setTab] = useState<"one" | "paste">("one");

  return (
    <>
      <div className="mb-5 flex rounded-lg bg-zinc-100 p-1 text-xs font-semibold">
        {(
          [
            { key: "one", label: "1件ずつ出す" },
            { key: "paste", label: "AIに書かせて貼る" },
          ] as const
        ).map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`flex-1 py-2 rounded-md transition-colors ${
              tab === t.key ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-700"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "one" ? (
        <MoveForm chatSpaceId={chatSpaceId} partnerName={partnerName} />
      ) : (
        <>
          <div className="mb-4">
            <h1 className="text-lg font-bold text-zinc-900">AIに書かせて貼る</h1>
            <p className="text-xs text-zinc-500 mt-1">
              {partnerName} さん — OSに打ち込まなくても、手元の記録をAIに整えさせて貼るだけです
            </p>
          </div>
          <PasteForm chatSpaceId={chatSpaceId} />
        </>
      )}
    </>
  );
}
