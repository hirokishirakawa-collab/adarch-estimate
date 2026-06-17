"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Moon,
  ArrowRight,
  Loader2,
} from "lucide-react";
import { DEAL_STATUS_OPTIONS } from "@/lib/constants/deals";
import { bulkUpdateDealStatus } from "@/lib/actions/deal";

export interface StalledDeal {
  id: string;
  title: string;
  customerName: string;
  assigneeName: string | null;
  status: string;
  daysStale: number;
  overdue: boolean;
}

// 停滞商談の「休眠/先送り」への移動先。このアプリでは NEGOTIATION 列が
// 「休眠/先送り」として運用されている（DORMANT/DEFERRED は未使用）。
const PARK_STATUS = "NEGOTIATION";

function statusMeta(value: string) {
  return (
    DEAL_STATUS_OPTIONS.find((o) => o.value === value) ?? {
      label: value,
      color: "bg-zinc-100 text-zinc-600 border-zinc-200",
    }
  );
}

export function StalledDealsPanel({
  deals,
  thresholdDays,
}: {
  deals: StalledDeal[];
  thresholdDays: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();

  if (deals.length === 0) return null;

  const allSelected = selected.size === deals.length && deals.length > 0;

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected((prev) =>
      prev.size === deals.length ? new Set() : new Set(deals.map((d) => d.id))
    );
  }

  function handlePark() {
    if (selected.size === 0) return;
    if (
      !confirm(
        `選択した${selected.size}件を「休眠/先送り」へ移します。\nパイプラインの商談中から外れます（削除ではありません）。よろしいですか？`
      )
    )
      return;
    const ids = Array.from(selected);
    startTransition(async () => {
      const res = await bulkUpdateDealStatus(ids, PARK_STATUS);
      if (res.error) {
        alert(res.error);
        return;
      }
      setSelected(new Set());
      router.refresh();
    });
  }

  return (
    <div className="mb-6 rounded-xl border border-amber-300 bg-amber-50/60 overflow-hidden">
      {/* ヘッダー（クリックで開閉） */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 hover:bg-amber-50 transition-colors"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-left min-w-0">
            <p className="text-sm font-bold text-amber-900">
              要対応：停滞商談 {deals.length}件
            </p>
            <p className="text-[11px] text-amber-700">
              {thresholdDays}日以上 動きのない実商談。休眠へ移すか、フォローして動かしてください
            </p>
          </div>
        </div>
        {open ? (
          <ChevronUp className="w-4 h-4 text-amber-600 flex-shrink-0" />
        ) : (
          <ChevronDown className="w-4 h-4 text-amber-600 flex-shrink-0" />
        )}
      </button>

      {open && (
        <div className="border-t border-amber-200 bg-white">
          {/* ツールバー */}
          <div className="flex items-center justify-between gap-3 px-4 py-2.5 border-b border-zinc-100">
            <label className="flex items-center gap-2 text-xs text-zinc-600 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={toggleAll}
                className="rounded border-zinc-300"
              />
              {selected.size > 0 ? `${selected.size}件選択中` : "全選択"}
            </label>
            <button
              onClick={handlePark}
              disabled={selected.size === 0 || isPending}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-amber-600 rounded-lg hover:bg-amber-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {isPending ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Moon className="w-3.5 h-3.5" />
              )}
              選択を休眠/先送りへ
            </button>
          </div>

          {/* 一覧 */}
          <div className="max-h-[360px] overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-zinc-50 text-zinc-400">
                <tr>
                  <th className="w-9 px-3 py-2"></th>
                  <th className="px-3 py-2 text-left font-medium">顧客</th>
                  <th className="px-3 py-2 text-left font-medium">商談</th>
                  <th className="px-3 py-2 text-left font-medium">担当</th>
                  <th className="px-3 py-2 text-left font-medium">状態</th>
                  <th className="px-3 py-2 text-right font-medium">停滞</th>
                  <th className="px-3 py-2 text-center font-medium">受注予定</th>
                  <th className="w-9 px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {deals.map((d) => {
                  const meta = statusMeta(d.status);
                  const isSel = selected.has(d.id);
                  return (
                    <tr
                      key={d.id}
                      className={`border-t border-zinc-100 hover:bg-amber-50/40 ${
                        isSel ? "bg-amber-50/60" : ""
                      }`}
                    >
                      <td className="px-3 py-2 text-center">
                        <input
                          type="checkbox"
                          checked={isSel}
                          onChange={() => toggle(d.id)}
                          className="rounded border-zinc-300"
                        />
                      </td>
                      <td className="px-3 py-2 text-zinc-700 max-w-[160px] truncate">
                        {d.customerName}
                      </td>
                      <td className="px-3 py-2 text-zinc-600 max-w-[220px] truncate">
                        <Link
                          href={`/dashboard/deals/${d.id}`}
                          className="hover:text-blue-600 hover:underline"
                        >
                          {d.title}
                        </Link>
                      </td>
                      <td className="px-3 py-2 text-zinc-500 whitespace-nowrap">
                        {d.assigneeName ?? <span className="text-zinc-300">未割当</span>}
                      </td>
                      <td className="px-3 py-2">
                        <span
                          className={`inline-block px-1.5 py-0.5 rounded border text-[10px] font-medium ${meta.color}`}
                        >
                          {meta.label}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right font-semibold text-amber-700 whitespace-nowrap">
                        {d.daysStale}日
                      </td>
                      <td className="px-3 py-2 text-center">
                        {d.overdue ? (
                          <span className="inline-block px-1.5 py-0.5 rounded bg-red-50 text-red-600 border border-red-200 text-[10px] font-medium">
                            予定日超過
                          </span>
                        ) : (
                          <span className="text-zinc-300">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-center">
                        <Link
                          href={`/dashboard/deals/${d.id}`}
                          className="inline-flex text-zinc-400 hover:text-blue-600"
                          title="商談を開く"
                        >
                          <ArrowRight className="w-3.5 h-3.5" />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
