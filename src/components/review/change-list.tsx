"use client";

import { Eye } from "lucide-react";

const CHANGE_TYPE_CONFIG: Record<
  string,
  { label: string; color: string; bgColor: string }
> = {
  TELOP:       { label: "テロップ",     color: "#ef4444", bgColor: "bg-red-500/10 text-red-400 border-red-500/20" },
  CUT_REPLACE: { label: "カット差替",   color: "#f59e0b", bgColor: "bg-amber-500/10 text-amber-400 border-amber-500/20" },
  COLOR:       { label: "色味",         color: "#3b82f6", bgColor: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
  DURATION:    { label: "尺変更",       color: "#f97316", bgColor: "bg-orange-500/10 text-orange-400 border-orange-500/20" },
  ANIMATION:   { label: "アニメーション", color: "#a855f7", bgColor: "bg-purple-500/10 text-purple-400 border-purple-500/20" },
  OTHER:       { label: "その他",       color: "#6b7280", bgColor: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20" },
};

export function getChangeColor(type: string): string {
  return CHANGE_TYPE_CONFIG[type]?.color ?? "#6b7280";
}

interface Change {
  id: string;
  type: string;
  timecodeIn: number;
  timecodeOut: number | null;
  description: string;
  confidence: number;
  diffFramePath: string | null;
}

interface Props {
  changes: Change[];
  onSeek: (timecode: number) => void;
  onViewDiff?: (changeId: string) => void;
  selectedChangeId?: string | null;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function ChangeList({ changes, onSeek, onViewDiff, selectedChangeId }: Props) {
  if (changes.length === 0) {
    return (
      <div className="text-center py-8 text-white/40 text-sm">
        変更は検出されませんでした
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {changes.map((c) => {
        const config = CHANGE_TYPE_CONFIG[c.type] ?? CHANGE_TYPE_CONFIG.OTHER;
        const isSelected = c.id === selectedChangeId;

        return (
          <button
            key={c.id}
            onClick={() => onSeek(c.timecodeIn)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all hover:bg-white/[0.04] group ${
              isSelected ? "bg-white/[0.06] ring-1 ring-amber-500/30" : ""
            }`}
          >
            {/* Color dot */}
            <span
              className="w-2.5 h-2.5 rounded-full flex-shrink-0"
              style={{ backgroundColor: config.color }}
            />

            {/* Timecode */}
            <span className="text-xs font-mono text-white/50 w-14 flex-shrink-0">
              {formatTime(c.timecodeIn)}
              {c.timecodeOut ? `〜${formatTime(c.timecodeOut)}` : ""}
            </span>

            {/* Type badge */}
            <span
              className={`text-[10px] px-1.5 py-0.5 rounded border font-semibold tracking-wide flex-shrink-0 ${config.bgColor}`}
            >
              {config.label}
            </span>

            {/* Description */}
            <span className="text-sm text-white/60 truncate flex-1">
              {c.description}
            </span>

            {/* View diff button */}
            {c.diffFramePath && onViewDiff && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onViewDiff(c.id);
                }}
                className="p-1 rounded-md opacity-0 group-hover:opacity-100 hover:bg-white/[0.06] transition-all"
                title="差分表示"
              >
                <Eye className="w-3.5 h-3.5 text-white/40" />
              </button>
            )}

            {/* Confidence */}
            <span className="text-[10px] text-white/30 flex-shrink-0 w-8 text-right">
              {Math.round(c.confidence * 100)}%
            </span>
          </button>
        );
      })}
    </div>
  );
}
