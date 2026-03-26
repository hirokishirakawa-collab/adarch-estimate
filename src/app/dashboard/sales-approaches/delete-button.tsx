"use client";

import { useTransition } from "react";
import { Trash2, Loader2 } from "lucide-react";
import { deleteSalesApproach } from "@/lib/actions/sales-approach";

export function DeleteButton({ id }: { id: string }) {
  const [isPending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() => {
        if (!confirm("この投稿を削除しますか？")) return;
        startTransition(() => deleteSalesApproach(id));
      }}
      className="inline-flex items-center gap-1 px-2 py-1 text-[10px] text-red-500
                 hover:text-red-700 hover:bg-red-50 rounded transition-colors disabled:opacity-50"
    >
      {isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
      削除
    </button>
  );
}
