"use client";

import { useTransition } from "react";
import { Eye, EyeOff } from "lucide-react";
import { toggleCoursePublished } from "@/lib/actions/learning";

export function CoursePublishToggle({ id, published }: { id: string; published: boolean }) {
  const [isPending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() =>
        startTransition(async () => {
          await toggleCoursePublished(id);
        })
      }
      className={`inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-bold rounded-lg border transition-colors ${
        published
          ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
          : "bg-zinc-50 text-zinc-600 border-zinc-200 hover:bg-zinc-100"
      } disabled:opacity-50`}
      title={published ? "公開中（クリックで非公開）" : "非公開（クリックで公開）"}
    >
      {published ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
      {published ? "公開中" : "非公開"}
    </button>
  );
}
