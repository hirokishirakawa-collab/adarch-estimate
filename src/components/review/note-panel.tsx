"use client";

import { useActionState, useRef } from "react";
import { MessageSquarePlus, Trash2, Clock } from "lucide-react";
import { addNote, deleteNote } from "@/lib/actions/review";

interface Note {
  id: string;
  timecode: number;
  text: string;
  author: string;
  createdAt: string;
}

interface Props {
  reviewId: string;
  notes: Note[];
  currentTime: number;
  onSeek: (timecode: number) => void;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function NotePanel({ reviewId, notes, currentTime, onSeek }: Props) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, action, isPending] = useActionState(addNote, null);

  const handleSubmit = (formData: FormData) => {
    formData.set("reviewId", reviewId);
    formData.set("timecode", String(currentTime));
    action(formData);
    formRef.current?.reset();
  };

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-white/70 flex items-center gap-2">
        <MessageSquarePlus className="w-4 h-4" />
        メモ
      </h3>

      {/* Add note form */}
      <form ref={formRef} action={handleSubmit} className="flex gap-2">
        <div className="flex-1 relative">
          <input
            name="text"
            type="text"
            required
            placeholder={`${formatTime(currentTime)} にメモを追加...`}
            className="w-full px-3 py-2 bg-white/[0.04] border border-white/10 rounded-lg text-white/90 text-sm placeholder:text-white/30 focus:border-amber-500/40 focus:outline-none transition-colors pr-16"
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-mono text-white/30">
            {formatTime(currentTime)}
          </span>
        </div>
        <button
          type="submit"
          disabled={isPending}
          className="px-4 py-2 bg-amber-600/20 text-amber-400 border border-amber-500/20 rounded-lg text-sm font-medium hover:bg-amber-600/30 disabled:opacity-40 transition-colors"
        >
          追加
        </button>
      </form>

      {state?.error && (
        <p className="text-red-400 text-xs">{state.error}</p>
      )}

      {/* Notes list */}
      <div className="space-y-1.5 max-h-60 overflow-y-auto">
        {notes.length === 0 ? (
          <p className="text-white/30 text-xs py-2">メモはまだありません</p>
        ) : (
          notes
            .sort((a, b) => a.timecode - b.timecode)
            .map((note) => (
              <div
                key={note.id}
                className="flex items-start gap-2.5 px-3 py-2 rounded-lg bg-white/[0.02] border border-white/5 hover:border-white/10 transition-colors group"
              >
                <button
                  onClick={() => onSeek(note.timecode)}
                  className="flex items-center gap-1 text-xs font-mono text-amber-500/60 hover:text-amber-400 flex-shrink-0 mt-0.5 transition-colors"
                >
                  <Clock className="w-3 h-3" />
                  {formatTime(note.timecode)}
                </button>
                <p className="text-sm text-white/70 flex-1">{note.text}</p>
                <span className="text-[10px] text-white/25 flex-shrink-0 mt-0.5">
                  {note.author}
                </span>
                <form
                  action={async () => {
                    await deleteNote(note.id, reviewId);
                  }}
                >
                  <button
                    type="submit"
                    className="p-1 rounded-md opacity-0 group-hover:opacity-100 hover:bg-red-500/10 text-red-400/40 hover:text-red-400 transition-all flex-shrink-0"
                    title="削除"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </form>
              </div>
            ))
        )}
      </div>
    </div>
  );
}
