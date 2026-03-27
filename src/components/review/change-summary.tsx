"use client";

import { useState } from "react";
import { FileText, Copy, CheckCircle2 } from "lucide-react";

const CHANGE_LABELS: Record<string, string> = {
  TELOP: "テロップ変更",
  CUT_REPLACE: "カット差し替え",
  COLOR: "色味変更",
  DURATION: "尺変更",
  ANIMATION: "アニメーション変更",
  OTHER: "映像変更",
};

interface Change {
  version: number;
  type: string;
  timecodeIn: number;
  timecodeOut: number | null;
  description: string;
  status: string;
}

interface Note {
  version: number;
  timecode: number;
  text: string;
  author: string;
}

interface Props {
  projectTitle: string;
  versions: number[];
  allChanges: Change[];
  allNotes: Note[];
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function ChangeSummary({ projectTitle, versions, allChanges, allNotes }: Props) {
  const [copied, setCopied] = useState(false);

  const generateSummaryText = () => {
    const lines: string[] = [];
    lines.push(`=== ${projectTitle} 修正履歴 ===`);
    lines.push("");

    for (const v of versions) {
      const changes = allChanges.filter((c) => c.version === v);
      const notes = allNotes.filter((n) => n.version === v);

      if (changes.length === 0 && notes.length === 0) continue;

      lines.push(`--- v${v} ---`);

      if (changes.length > 0) {
        lines.push("[自動検出]");
        for (const c of changes) {
          const label = CHANGE_LABELS[c.type] || c.type;
          const time = c.timecodeOut
            ? `${formatTime(c.timecodeIn)}〜${formatTime(c.timecodeOut)}`
            : formatTime(c.timecodeIn);
          lines.push(`  ${label} (${time})`);
        }
      }

      if (notes.length > 0) {
        lines.push("[メモ]");
        for (const n of notes) {
          lines.push(`  ${formatTime(n.timecode)} ${n.text} (${n.author})`);
        }
      }

      lines.push("");
    }

    // Summary stats
    const totalChanges = allChanges.length;
    const byType: Record<string, number> = {};
    for (const c of allChanges) {
      byType[c.type] = (byType[c.type] || 0) + 1;
    }

    lines.push("--- 合計 ---");
    lines.push(`全${versions.length}バージョン / ${totalChanges}件の変更`);
    for (const [type, count] of Object.entries(byType)) {
      lines.push(`  ${CHANGE_LABELS[type] || type}: ${count}件`);
    }

    return lines.join("\n");
  };

  const handleCopy = () => {
    const text = generateSummaryText();
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (allChanges.length === 0 && allNotes.length === 0) return null;

  return (
    <div className="rounded-xl bg-zinc-900 border border-zinc-800 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-amber-500" />
          <h3 className="text-sm font-semibold text-zinc-300">修正履歴サマリー</h3>
        </div>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-400 hover:text-white hover:bg-zinc-800 border border-zinc-700 transition-all"
        >
          {copied ? (
            <><CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> コピー済み</>
          ) : (
            <><Copy className="w-3.5 h-3.5" /> テキストコピー</>
          )}
        </button>
      </div>

      <div className="p-4 space-y-4 max-h-96 overflow-y-auto">
        {versions.map((v) => {
          const changes = allChanges.filter((c) => c.version === v);
          const notes = allNotes.filter((n) => n.version === v);
          if (changes.length === 0 && notes.length === 0) return null;

          return (
            <div key={v}>
              <h4 className="text-xs font-bold text-amber-500/70 uppercase tracking-wider mb-2">
                v{v}
              </h4>
              <div className="space-y-1">
                {changes.map((c, i) => {
                  const label = CHANGE_LABELS[c.type] || c.type;
                  const time = c.timecodeOut
                    ? `${formatTime(c.timecodeIn)}〜${formatTime(c.timecodeOut)}`
                    : formatTime(c.timecodeIn);
                  return (
                    <div key={`c-${i}`} className="flex items-center gap-2 text-xs text-zinc-400">
                      <span className="font-mono text-zinc-600 w-16 flex-shrink-0">{time}</span>
                      <span className="px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-500 font-medium flex-shrink-0">
                        {label}
                      </span>
                    </div>
                  );
                })}
                {notes.map((n, i) => (
                  <div key={`n-${i}`} className="flex items-start gap-2 text-xs">
                    <span className="font-mono text-zinc-600 w-16 flex-shrink-0">{formatTime(n.timecode)}</span>
                    <span className="text-zinc-300">{n.text}</span>
                    <span className="text-zinc-600 flex-shrink-0">({n.author})</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
