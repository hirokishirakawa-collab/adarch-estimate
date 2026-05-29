"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, CheckCircle2, Banknote, Trash2 } from "lucide-react";
import { updatePaymentStatementStatus, deletePaymentStatement } from "@/lib/actions/payment-statement";

export function PaymentStatusActions({
  id,
  currentStatus,
}: {
  id: string;
  currentStatus: string;
}) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleAction(newStatus: "CONFIRMED" | "PAID") {
    const msg =
      newStatus === "CONFIRMED"
        ? "この支払明細を確定しますか？パートナーに公開されます。"
        : "この支払明細を支払済みにしますか？";
    if (!confirm(msg)) return;

    startTransition(async () => {
      await updatePaymentStatementStatus(id, newStatus);
      router.refresh();
    });
  }

  function handleDelete() {
    if (!confirm("この下書きを削除しますか？この操作は取り消せません。")) return;
    startTransition(async () => {
      const res = await deletePaymentStatement(id);
      // 成功時はサーバー側で一覧へリダイレクトされる。失敗時のみ通知。
      if (res?.error) {
        alert(res.error);
      }
    });
  }

  return (
    <div className="flex gap-3">
      {currentStatus === "DRAFT" && (
        <button
          onClick={() => handleAction("CONFIRMED")}
          disabled={isPending}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-60 transition-colors"
        >
          {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
          確定する（パートナーに公開）
        </button>
      )}
      {(currentStatus === "DRAFT" || currentStatus === "CONFIRMED") && (
        <button
          onClick={() => handleAction("PAID")}
          disabled={isPending}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-60 transition-colors"
        >
          {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Banknote className="w-4 h-4" />}
          支払済みにする
        </button>
      )}
      {currentStatus === "DRAFT" && (
        <button
          onClick={handleDelete}
          disabled={isPending}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold bg-white text-red-600 border border-red-200 rounded-lg hover:bg-red-50 disabled:opacity-60 transition-colors"
        >
          <Trash2 className="w-4 h-4" />
          下書きを削除
        </button>
      )}
    </div>
  );
}
