"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Send, CheckCircle2, Trash2 } from "lucide-react";
import { updateGroupInvoiceStatus, deleteGroupInvoice } from "@/lib/actions/group-invoice";

export function GroupInvoiceActions({ id, status }: { id: string; status: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function setStatus(next: "ISSUED" | "PAID") {
    startTransition(async () => {
      const res = await updateGroupInvoiceStatus(id, next);
      if (res.error) alert(res.error);
      router.refresh();
    });
  }
  function onDelete() {
    if (!confirm("この下書きを削除します。よろしいですか？")) return;
    startTransition(async () => {
      const res = await deleteGroupInvoice(id);
      if (res?.error) alert(res.error);
      // 成功時はサーバー側 redirect で一覧へ遷移
    });
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {status === "DRAFT" && (
        <>
          <button onClick={() => setStatus("ISSUED")} disabled={isPending} className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-60 transition-colors">
            {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            発行する（パートナーに公開）
          </button>
          <button onClick={onDelete} disabled={isPending} className="inline-flex items-center gap-1.5 px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg disabled:opacity-60 transition-colors">
            <Trash2 className="w-4 h-4" />削除
          </button>
        </>
      )}
      {status === "ISSUED" && (
        <button onClick={() => setStatus("PAID")} disabled={isPending} className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white text-sm font-semibold rounded-lg hover:bg-emerald-700 disabled:opacity-60 transition-colors">
          {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
          入金済みにする
        </button>
      )}
    </div>
  );
}
