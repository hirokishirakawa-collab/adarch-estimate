"use client";

import { useTransition } from "react";
import { Trash2, Loader2 } from "lucide-react";
import { deleteTverCampaign } from "@/lib/actions/tver-campaign";

export function DeleteButton({ campaignId }: { campaignId: string }) {
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    if (!confirm("このTVer配信申請を削除しますか？この操作は取り消せません。")) return;
    startTransition(() => deleteTverCampaign(campaignId));
  }

  return (
    <button
      onClick={handleDelete}
      disabled={isPending}
      className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold
                 text-red-600 border border-red-200 rounded-lg hover:bg-red-50
                 disabled:opacity-60 transition-colors"
    >
      {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
      削除
    </button>
  );
}
