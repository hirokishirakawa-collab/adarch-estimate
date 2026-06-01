"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Repeat, Loader2 } from "lucide-react";
import { setDealRegular } from "@/lib/actions/deal";

type Props = {
  dealId: string;
  initial: {
    isRegular: boolean;
    monthlyAmount: number | null;
    startDate: string | null; // "YYYY-MM-DD"
    renewalDate: string | null;
    endedAt: string | null;
  };
};

const inputCls =
  "w-full px-2.5 py-1.5 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-300 focus:border-violet-400 bg-white text-zinc-900";

export function DealRegularCard({ dealId, initial }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isRegular, setIsRegular] = useState(initial.isRegular);
  const [monthly, setMonthly] = useState(initial.monthlyAmount != null ? String(initial.monthlyAmount) : "");
  const [startDate, setStartDate] = useState(initial.startDate ?? "");
  const [renewalDate, setRenewalDate] = useState(initial.renewalDate ?? "");
  const [endedAt, setEndedAt] = useState(initial.endedAt ?? "");

  function save() {
    startTransition(async () => {
      const res = await setDealRegular(dealId, {
        isRegular,
        monthlyAmount: monthly.trim() === "" ? null : Math.max(0, parseInt(monthly.replace(/,/g, ""), 10) || 0),
        startDate: startDate || null,
        renewalDate: renewalDate || null,
        endedAt: endedAt || null,
      });
      if (res.error) alert(res.error);
      router.refresh();
    });
  }

  return (
    <div className={`rounded-xl border p-4 ${isRegular ? "bg-violet-50/40 border-violet-200" : "bg-white border-zinc-200"}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Repeat className={`w-4 h-4 ${isRegular ? "text-violet-600" : "text-zinc-400"}`} />
          <span className="text-sm font-bold text-zinc-800">レギュラー（継続）案件</span>
        </div>
        <label className="flex items-center gap-1.5 text-xs text-zinc-600">
          <input type="checkbox" checked={isRegular} onChange={(e) => setIsRegular(e.target.checked)} className="rounded border-zinc-300" />
          レギュラーにする
        </label>
      </div>

      {isRegular && (
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="block text-[11px] font-semibold text-zinc-600 mb-1">月額（税抜・固定収入/MRR）</label>
            <div className="relative">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400 text-sm">¥</span>
              <input type="number" min={0} step={1000} value={monthly} onChange={(e) => setMonthly(e.target.value)} placeholder="例: 50000" className={`${inputCls} pl-6`} />
            </div>
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-zinc-600 mb-1">開始日</label>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-zinc-600 mb-1">次回更新日</label>
            <input type="date" value={renewalDate} onChange={(e) => setRenewalDate(e.target.value)} className={inputCls} />
          </div>
          <div className="col-span-2">
            <label className="block text-[11px] font-semibold text-zinc-600 mb-1">解約日<span className="font-normal text-zinc-400 ml-1">（入れると継続終了・空欄＝継続中）</span></label>
            <input type="date" value={endedAt} onChange={(e) => setEndedAt(e.target.value)} className={inputCls} />
          </div>
        </div>
      )}

      <div className="flex justify-end mt-3">
        <button onClick={save} disabled={isPending} className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-violet-600 text-white text-xs font-semibold rounded-lg hover:bg-violet-700 disabled:opacity-60 transition-colors">
          {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}保存
        </button>
      </div>
    </div>
  );
}
