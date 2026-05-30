"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Loader2 } from "lucide-react";
import { setRoyaltyAdjustment } from "@/lib/actions/group-invoice";

type Props = {
  groupCompanyId: string;
  month: string;
  branchLabels: string[]; // 空=単一拠点
  manualOverrides: Record<string, number>;
  effectiveTotal: number; // 現在の相殺合計（表示用）
};

export function RoyaltyAdjust({ groupCompanyId, month, branchLabels, manualOverrides, effectiveTotal }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const keys = branchLabels.length > 0 ? branchLabels : [""];
  const hasManual = Object.keys(manualOverrides).length > 0;

  const [vals, setVals] = useState<Record<string, string>>(() => {
    const o: Record<string, string> = {};
    for (const k of keys) o[k] = manualOverrides[k] != null ? String(manualOverrides[k]) : "";
    return o;
  });

  function save() {
    startTransition(async () => {
      for (const k of keys) {
        const raw = (vals[k] ?? "").trim();
        const amount = raw === "" ? null : Math.max(0, parseInt(raw.replace(/,/g, ""), 10) || 0);
        await setRoyaltyAdjustment(groupCompanyId, month, k, amount);
      }
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <div className="text-right">
      <div className="flex items-center justify-end gap-1.5">
        <span className={hasManual ? "text-indigo-700 font-semibold" : ""}>¥{effectiveTotal.toLocaleString("ja-JP")}</span>
        {hasManual && <span className="text-[9px] text-indigo-500">手入力</span>}
        <button onClick={() => setOpen((v) => !v)} className="text-zinc-300 hover:text-indigo-600" title="相殺を手入力で調整">
          <Pencil className="w-3 h-3" />
        </button>
      </div>

      {open && (
        <div className="mt-1.5 p-2 rounded-lg bg-indigo-50 border border-indigo-200 text-left space-y-1.5">
          {keys.map((k) => (
            <div key={k} className="flex items-center gap-1">
              {k && <span className="text-[10px] text-zinc-500 w-10 shrink-0">{k}</span>}
              <span className="text-[10px] text-zinc-400">¥</span>
              <input
                type="number"
                min={0}
                value={vals[k] ?? ""}
                onChange={(e) => setVals((p) => ({ ...p, [k]: e.target.value }))}
                placeholder="自動"
                className="w-24 px-1.5 py-0.5 text-[11px] border border-zinc-200 rounded text-right bg-white"
              />
            </div>
          ))}
          <div className="flex items-center justify-end pt-0.5">
            <button onClick={save} disabled={isPending} className="inline-flex items-center gap-1 px-2.5 py-0.5 text-[10px] font-semibold text-white bg-indigo-600 rounded hover:bg-indigo-700 disabled:opacity-60">
              {isPending && <Loader2 className="w-3 h-3 animate-spin" />}保存
            </button>
          </div>
          <p className="text-[9px] text-zinc-400">空欄で保存＝自動集計に戻す</p>
        </div>
      )}
    </div>
  );
}
