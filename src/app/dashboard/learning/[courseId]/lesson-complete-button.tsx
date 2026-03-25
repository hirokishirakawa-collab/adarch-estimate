"use client";

import { useTransition } from "react";
import { markLessonComplete } from "@/lib/actions/learning";

export function LessonCompleteButton({ lessonId }: { lessonId: string }) {
  const [isPending, startTransition] = useTransition();

  return (
    <button
      disabled={isPending}
      onClick={() => startTransition(() => markLessonComplete(lessonId))}
      className="px-3 py-1.5 text-xs font-medium text-zinc-600 bg-zinc-100 hover:bg-zinc-200 rounded-lg transition-colors disabled:opacity-50"
    >
      {isPending ? "..." : "完了"}
    </button>
  );
}
