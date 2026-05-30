"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Trash2, ArrowUpDown, Loader2 } from "lucide-react";
import { bulkDeleteGroupInvoices } from "@/lib/actions/group-invoice";

type Row = {
  id: string;
  invoiceNo: string;
  type: string;
  title: string;
  targetMonth: string | null;
  partnerName: string;
  ownerName: string;
  totalInclTax: number;
  status: string;
  createdAt: string;
};

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  DRAFT: { label: "下書き", cls: "bg-zinc-100 text-zinc-600 border-zinc-200" },
  ISSUED: { label: "発行済", cls: "bg-blue-50 text-blue-700 border-blue-200" },
  PAID: { label: "入金済", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
};
const TYPE_LABEL: Record<string, string> = { ROYALTY: "ロイヤリティ", MEMBERSHIP: "加盟参画費用", OTHER: "その他" };

type SortKey = "invoiceNo" | "partnerName" | "totalInclTax" | "status" | "createdAt";

function fmtDate(d: string): string {
  return new Date(d).toLocaleDateString("ja-JP", { year: "numeric", month: "2-digit", day: "2-digit" });
}

function SortTh({
  k, label, align = "left", sortKey, onSort,
}: { k: SortKey; label: string; align?: "left" | "right" | "center"; sortKey: SortKey; onSort: (k: SortKey) => void }) {
  const alignCls = align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left";
  return (
    <th className={`px-4 py-3 ${alignCls} text-xs font-semibold text-zinc-600`}>
      <button onClick={() => onSort(k)} className="inline-flex items-center gap-1 hover:text-zinc-900">
        {label}
        <ArrowUpDown className={`w-3 h-3 ${sortKey === k ? "text-indigo-500" : "text-zinc-300"}`} />
      </button>
    </th>
  );
}

export function GroupInvoiceTable({ rows }: { rows: Row[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sortKey, setSortKey] = useState<SortKey>("createdAt");
  const [sortAsc, setSortAsc] = useState(false);

  const sorted = useMemo(() => {
    const copy = [...rows];
    copy.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "totalInclTax": cmp = a.totalInclTax - b.totalInclTax; break;
        case "createdAt": cmp = a.createdAt.localeCompare(b.createdAt); break;
        default: cmp = String(a[sortKey]).localeCompare(String(b[sortKey]), "ja"); break;
      }
      return sortAsc ? cmp : -cmp;
    });
    return copy;
  }, [rows, sortKey, sortAsc]);

  // 一括削除は下書きのみ対象
  const deletableSelected = useMemo(
    () => sorted.filter((r) => selected.has(r.id) && r.status === "DRAFT").map((r) => r.id),
    [sorted, selected],
  );

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortAsc((v) => !v);
    else { setSortKey(key); setSortAsc(false); }
  }
  function toggleOne(id: string) {
    setSelected((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  }
  function toggleAll() {
    setSelected((prev) => (prev.size === sorted.length ? new Set() : new Set(sorted.map((r) => r.id))));
  }
  function onBulkDelete() {
    if (deletableSelected.length === 0) return;
    if (!confirm(`下書き ${deletableSelected.length} 件を削除します。よろしいですか？（発行済・入金済は削除されません）`)) return;
    startTransition(async () => {
      const res = await bulkDeleteGroupInvoices(deletableSelected);
      if (res.error) alert(res.error);
      setSelected(new Set());
      router.refresh();
    });
  }

  if (rows.length === 0) {
    return (
      <div className="bg-white border border-zinc-200 rounded-xl px-6 py-12 text-center">
        <p className="text-sm text-zinc-400">請求書がまだありません</p>
        <Link href="/dashboard/admin/group-invoices/new" className="inline-flex items-center gap-1.5 mt-3 text-xs text-indigo-600 hover:text-indigo-700 font-medium">
          <Plus className="w-3 h-3" />
          最初の請求書を作成する
        </Link>
      </div>
    );
  }

  return (
    <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
      {/* 一括操作バー */}
      {selected.size > 0 && (
        <div className="flex items-center justify-between px-4 py-2.5 bg-indigo-50 border-b border-indigo-100">
          <p className="text-xs text-indigo-700 font-medium">{selected.size} 件を選択中</p>
          <button
            onClick={onBulkDelete}
            disabled={isPending || deletableSelected.length === 0}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-600 text-white text-xs font-medium rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
          >
            {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
            下書きを削除（{deletableSelected.length}）
          </button>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-zinc-50 border-b border-zinc-200">
              <th className="px-4 py-3 w-10">
                <input type="checkbox" checked={selected.size === sorted.length && sorted.length > 0} onChange={toggleAll} className="rounded border-zinc-300" />
              </th>
              <SortTh k="invoiceNo" label="請求書番号" sortKey={sortKey} onSort={toggleSort} />
              <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-600">件名</th>
              <SortTh k="partnerName" label="パートナー" sortKey={sortKey} onSort={toggleSort} />
              <SortTh k="totalInclTax" label="請求額（税込）" align="right" sortKey={sortKey} onSort={toggleSort} />
              <SortTh k="status" label="ステータス" align="center" sortKey={sortKey} onSort={toggleSort} />
              <SortTh k="createdAt" label="作成日" sortKey={sortKey} onSort={toggleSort} />
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {sorted.map((r) => {
              const badge = STATUS_BADGE[r.status] ?? STATUS_BADGE.DRAFT;
              return (
                <tr key={r.id} className={`hover:bg-zinc-50/50 ${selected.has(r.id) ? "bg-indigo-50/30" : ""}`}>
                  <td className="px-4 py-3">
                    <input type="checkbox" checked={selected.has(r.id)} onChange={() => toggleOne(r.id)} className="rounded border-zinc-300" />
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`/dashboard/admin/group-invoices/${r.id}`} className="text-xs font-mono font-medium text-indigo-600 hover:underline">
                      {r.invoiceNo}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-sm text-zinc-800">{r.title}</p>
                    <p className="text-[11px] text-zinc-400">{TYPE_LABEL[r.type] ?? r.type}{r.targetMonth ? `・${r.targetMonth}` : ""}</p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-sm text-zinc-800">{r.partnerName}</p>
                    <p className="text-[11px] text-zinc-400">{r.ownerName}</p>
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-zinc-900">¥{r.totalInclTax.toLocaleString("ja-JP")}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-block px-2 py-0.5 text-[11px] font-semibold rounded-full border ${badge.cls}`}>{badge.label}</span>
                  </td>
                  <td className="px-4 py-3 text-xs text-zinc-400">{fmtDate(r.createdAt)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
