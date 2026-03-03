"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Loader2 } from "lucide-react";
import { deleteBusinessCard } from "@/lib/actions/business-card";

interface Props {
  cardId: string;
  cardLabel: string;
}

export function BusinessCardDeleteButton({ cardId, cardLabel }: Props) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleDelete() {
    const confirmed = window.confirm(
      `「${cardLabel}」の名刺を削除しますか？\nこの操作は取り消せません。`
    );
    if (!confirmed) return;

    startTransition(async () => {
      await deleteBusinessCard(cardId);
      router.push("/dashboard/business-cards");
      router.refresh();
    });
  }

  return (
    <button
      onClick={handleDelete}
      disabled={isPending}
      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium
                 text-red-600 border border-red-200 rounded-lg bg-white
                 hover:bg-red-50 hover:border-red-300 transition-colors
                 disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {isPending ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
      ) : (
        <Trash2 className="w-3.5 h-3.5" />
      )}
      削除
    </button>
  );
}
