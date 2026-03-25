"use client";

import { useTransition } from "react";
import { markLessonComplete } from "@/lib/actions/learning";
import { Check } from "lucide-react";

export function LessonCompleteButton({ lessonId }: { lessonId: string }) {
  const [isPending, startTransition] = useTransition();

  return (
    <button
      disabled={isPending}
      onClick={() => startTransition(() => markLessonComplete(lessonId))}
      className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-xl transition-colors disabled:opacity-50"
    >
      <Check className="w-3.5 h-3.5" />
      {isPending ? "記録中..." : "学習完了にする"}
    </button>
  );
}
