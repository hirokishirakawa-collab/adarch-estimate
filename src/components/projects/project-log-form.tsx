"use client";

import { useActionState, useRef, useState } from "react";
import { Send } from "lucide-react";
import { addProjectLog } from "@/lib/actions/project";

interface Props {
  projectId: string;
}

const LOG_TYPES = [
  { value: "NOTE", label: "メモ", icon: "📝" },
  { value: "MEETING", label: "商談・会議", icon: "🤝" },
];

export function ProjectLogForm({ projectId }: Props) {
  const [state, action, isPending] = useActionState(addProjectLog, null);
  const [type, setType] = useState("NOTE");
  const formRef = useRef<HTMLFormElement>(null);

  const handleSubmit = (formData: FormData) => {
    formData.set("projectId", projectId);
    formData.set("type", type);
    action(formData);
    // Reset after submit
    setTimeout(() => formRef.current?.reset(), 100);
  };

  return (
    <form ref={formRef} action={handleSubmit} className="space-y-2">
      {/* Type selector */}
      <div className="flex gap-1">
        {LOG_TYPES.map((t) => (
          <button
            key={t.value}
            type="button"
            onClick={() => setType(t.value)}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
              type === t.value
                ? t.value === "MEETING"
                  ? "bg-blue-100 text-blue-700 border border-blue-200"
                  : "bg-violet-100 text-violet-700 border border-violet-200"
                : "bg-zinc-100 text-zinc-500 border border-zinc-200 hover:bg-zinc-200"
            }`}
          >
            <span>{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>

      {/* Input */}
      <div className="flex gap-2">
        <textarea
          name="content"
          required
          rows={2}
          placeholder={
            type === "MEETING"
              ? "商談・会議の内容を記録...\n例: クライアントと初回打ち合わせ。要望ヒアリング完了。"
              : "メモを入力..."
          }
          className="flex-1 px-3 py-2 bg-white border border-zinc-200 rounded-lg text-xs text-zinc-700 placeholder:text-zinc-400 focus:border-violet-400 focus:ring-1 focus:ring-violet-200 focus:outline-none transition-colors resize-none"
        />
        <button
          type="submit"
          disabled={isPending}
          className="self-end px-3 py-2 bg-zinc-800 text-white rounded-lg text-xs font-medium hover:bg-zinc-700 disabled:opacity-40 transition-colors flex items-center gap-1"
        >
          <Send className="w-3 h-3" />
          投稿
        </button>
      </div>

      {state?.error && (
        <p className="text-xs text-red-500">{state.error}</p>
      )}
    </form>
  );
}
