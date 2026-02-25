"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { deleteEstimation } from "@/lib/actions/estimate";

export function DeleteEstimateButton({ id }: { id: string }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleClick() {
    if (!window.confirm("この見積書を削除しますか？この操作は取り消せません。")) return;
    startTransition(async () => {
      const result = await deleteEstimation(id);
      if (result?.error) {
        alert(result.error);
      } else {
        router.push("/dashboard/estimates");
      }
    });
  }

  return (
    <button
      onClick={handleClick}
      disabled={isPending}
      className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-red-600 bg-white border border-red-200 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50"
    >
      <Trash2 className="w-3.5 h-3.5" />
      {isPending ? "削除中..." : "削除"}
    </button>
  );
}
