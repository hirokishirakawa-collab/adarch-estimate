"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Ban, RotateCcw } from "lucide-react";
import { toggleRoyaltyMonthExempt } from "@/lib/actions/group-invoice";

export function RoyaltyExemptToggle({ groupCompanyId, month, isMonthExempt }: { groupCompanyId: string; month: string; isMonthExempt: boolean }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function toggle() {
    if (!isMonthExempt && !confirm("この代表を今月だけロイヤリティ免除にします。よろしいですか？")) return;
    startTransition(async () => {
      const res = await toggleRoyaltyMonthExempt(groupCompanyId, month, !isMonthExempt);
      if (res.error) alert(res.error);
      router.refresh();
    });
  }

  return (
    <button
      onClick={toggle}
      disabled={isPending}
      className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded border transition-colors disabled:opacity-60 ${
        isMonthExempt
          ? "bg-white text-zinc-500 border-zinc-200 hover:bg-zinc-50"
          : "bg-zinc-50 text-zinc-500 border-zinc-200 hover:bg-amber-50 hover:text-amber-700 hover:border-amber-200"
      }`}
      title={isMonthExempt ? "当月免除を解除" : "今月だけ免除する"}
    >
      {isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : isMonthExempt ? <RotateCcw className="w-3 h-3" /> : <Ban className="w-3 h-3" />}
      {isMonthExempt ? "免除解除" : "今月免除"}
    </button>
  );
}
