"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, CheckCircle2, Banknote } from "lucide-react";
import { updatePaymentStatementStatus } from "@/lib/actions/payment-statement";

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
    </div>
  );
}
