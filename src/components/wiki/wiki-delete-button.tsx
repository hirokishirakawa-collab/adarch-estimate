"use client";

import { Trash2 } from "lucide-react";
import { useTransition } from "react";

interface Props {
  action: () => Promise<void>;
}

export function WikiDeleteButton({ action }: Props) {
  const [isPending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={isPending}
      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors disabled:opacity-50"
      onClick={() => {
        if (!confirm("この記事を削除しますか？")) return;
        startTransition(() => action());
      }}
    >
      <Trash2 className="w-3.5 h-3.5" />
      {isPending ? "削除中..." : "削除"}
    </button>
  );
}
