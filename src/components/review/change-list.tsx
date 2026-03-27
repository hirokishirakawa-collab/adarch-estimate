"use client";

import { useState } from "react";
import { Eye, Pencil, Trash2, Check, X } from "lucide-react";
import { updateChange, deleteChange } from "@/lib/actions/review";

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

const CHANGE_TYPES = Object.entries(CHANGE_TYPE_CONFIG).map(([key, val]) => ({
  value: key,
  label: val.label,
}));

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
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [editType, setEditType] = useState("");
  const [saving, setSaving] = useState(false);

  const startEdit = (c: Change) => {
    setEditingId(c.id);
    setEditText(c.description);
    setEditType(c.type);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditText("");
    setEditType("");
  };

  const saveEdit = async () => {
    if (!editingId || !editText.trim()) return;
    setSaving(true);
    await updateChange(editingId, editText.trim(), editType);
    setSaving(false);
    setEditingId(null);
  };

  const handleDelete = async (id: string) => {
    await deleteChange(id);
  };

  if (changes.length === 0) {
    return (
      <div className="text-center py-8 text-zinc-500 text-sm">
        変更は検出されませんでした
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {changes.map((c) => {
        const config = CHANGE_TYPE_CONFIG[c.type] ?? CHANGE_TYPE_CONFIG.OTHER;
        const isSelected = c.id === selectedChangeId;
        const isEditing = c.id === editingId;

        if (isEditing) {
          return (
            <div key={c.id} className="px-3 py-2.5 rounded-lg bg-zinc-800 border border-zinc-700 space-y-2">
              <div className="flex items-center gap-2">
                <select
                  value={editType}
                  onChange={(e) => setEditType(e.target.value)}
                  className="px-2 py-1 bg-zinc-900 border border-zinc-700 rounded text-xs text-white focus:outline-none focus:border-amber-500"
                >
                  {CHANGE_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
                <span className="text-xs font-mono text-zinc-500">
                  {formatTime(c.timecodeIn)}
                </span>
              </div>
              <input
                type="text"
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") saveEdit(); if (e.key === "Escape") cancelEdit(); }}
                autoFocus
                className="w-full px-2 py-1.5 bg-zinc-900 border border-zinc-700 rounded text-sm text-white focus:outline-none focus:border-amber-500"
              />
              <div className="flex items-center gap-2 justify-end">
                <button onClick={cancelEdit} className="p-1 rounded text-zinc-500 hover:text-white hover:bg-zinc-700 transition-colors">
                  <X className="w-3.5 h-3.5" />
                </button>
                <button onClick={saveEdit} disabled={saving} className="p-1 rounded text-emerald-400 hover:bg-emerald-500/10 transition-colors disabled:opacity-40">
                  <Check className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          );
        }

        return (
          <div
            key={c.id}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all hover:bg-white/[0.04] group ${
              isSelected ? "bg-white/[0.06] ring-1 ring-amber-500/30" : ""
            }`}
          >
            {/* Clickable area for seek */}
            <button onClick={() => onSeek(c.timecodeIn)} className="flex items-center gap-3 flex-1 min-w-0 text-left">
              <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: config.color }} />
              <span className="text-xs font-mono text-zinc-500 w-14 flex-shrink-0">
                {formatTime(c.timecodeIn)}
                {c.timecodeOut ? `〜${formatTime(c.timecodeOut)}` : ""}
              </span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded border font-semibold tracking-wide flex-shrink-0 ${config.bgColor}`}>
                {config.label}
              </span>
              <span className="text-sm text-zinc-400 truncate flex-1">{c.description}</span>
            </button>

            {/* Action buttons */}
            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
              {c.diffFramePath && onViewDiff && (
                <button onClick={() => onViewDiff(c.id)} className="p-1 rounded-md hover:bg-white/[0.06] text-zinc-500 hover:text-white transition-colors" title="差分表示">
                  <Eye className="w-3.5 h-3.5" />
                </button>
              )}
              <button onClick={() => startEdit(c)} className="p-1 rounded-md hover:bg-white/[0.06] text-zinc-500 hover:text-white transition-colors" title="編集">
                <Pencil className="w-3.5 h-3.5" />
              </button>
              <button onClick={() => handleDelete(c.id)} className="p-1 rounded-md hover:bg-red-500/10 text-zinc-500 hover:text-red-400 transition-colors" title="削除">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
