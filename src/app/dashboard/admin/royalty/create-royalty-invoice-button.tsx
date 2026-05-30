"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, FilePlus2 } from "lucide-react";
import { createRoyaltyInvoiceForMonth } from "@/lib/actions/group-invoice";

export function CreateRoyaltyInvoiceButton({ groupCompanyId, month }: { groupCompanyId: string; month: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function onClick() {
    startTransition(async () => {
      const res = await createRoyaltyInvoiceForMonth(groupCompanyId, month);
      if (res.error) {
        alert(res.error);
        if (res.id) router.push(`/dashboard/admin/group-invoices/${res.id}`);
        return;
      }
      if (res.id) router.push(`/dashboard/admin/group-invoices/${res.id}`);
    });
  }

  return (
    <button onClick={onClick} disabled={isPending} className="inline-flex items-center gap-1 px-2.5 py-1 bg-indigo-600 text-white text-[11px] font-semibold rounded-md hover:bg-indigo-700 disabled:opacity-60 transition-colors">
      {isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <FilePlus2 className="w-3 h-3" />}
      差額を請求
    </button>
  );
}
