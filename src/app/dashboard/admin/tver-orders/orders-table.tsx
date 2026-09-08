"use client";

// TVer小口申込 一覧テーブル（並べ替え・一括選択・未入金の一括取り下げ）

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { cancelUnpaidOrders } from "@/lib/actions/tver-orders";

export type OrderRow = {
  id: string; no: string; token: string; createdAt: string; paidAt: string | null;
  status: string; statusLabel: string; advertiser: string; contact: string; email: string;
  area: string; plan: string; total: number; payment: string; company: string; detailsDone: boolean; hasMaterial: boolean;
};

type Key = "createdAt" | "no" | "advertiser" | "area" | "plan" | "total" | "status" | "company" | "paidAt";
const COLS: { key: Key; label: string; num?: boolean }[] = [
  { key: "no", label: "申込番号" },
  { key: "createdAt", label: "申込日" },
  { key: "status", label: "状態" },
  { key: "advertiser", label: "広告主" },
  { key: "area", label: "エリア" },
  { key: "plan", label: "プラン" },
  { key: "total", label: "税込", num: true },
  { key: "paidAt", label: "入金" },
  { key: "company", label: "案内元（商談中の代表）" },
];

const badge: Record<string, string> = {
  AWAITING_PAYMENT: "bg-zinc-100 text-zinc-600",
  PAID: "bg-orange-50 text-orange-700",
  REVIEWING: "bg-sky-50 text-sky-700",
  MATERIAL_WAITING: "bg-violet-50 text-violet-700",
  MATERIAL_RECEIVED: "bg-orange-50 text-orange-700",
  LIVE: "bg-emerald-50 text-emerald-700",
  COMPLETED: "bg-zinc-100 text-zinc-500",
  CANCELLED: "bg-zinc-100 text-zinc-400",
  REFUNDED: "bg-rose-50 text-rose-700",
};
const d = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("ja-JP", { timeZone: "Asia/Tokyo", month: "numeric", day: "numeric" }) : "—");

export function OrdersTable({ rows }: { rows: OrderRow[] }) {
  const [sort, setSort] = useState<{ key: Key; dir: 1 | -1 }>({ key: "createdAt", dir: -1 });
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  const sorted = useMemo(() => {
    const arr = [...rows];
    arr.sort((a, b) => {
      const va = a[sort.key] ?? "", vb = b[sort.key] ?? "";
      const c = typeof va === "number" && typeof vb === "number" ? va - vb : String(va).localeCompare(String(vb), "ja");
      return c * sort.dir;
    });
    return arr;
  }, [rows, sort]);

  const toggleAll = () => setSel(sel.size === rows.length ? new Set() : new Set(rows.map((r) => r.id)));
  const unpaidSelected = rows.filter((r) => sel.has(r.id) && r.status === "AWAITING_PAYMENT").length;

  return (
    <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-2 border-b border-zinc-100 text-xs text-zinc-500">
        <span>{sel.size}件選択</span>
        <button
          type="button"
          disabled={pending || unpaidSelected === 0}
          className="px-2.5 py-1 rounded-md border border-zinc-200 hover:bg-zinc-50 disabled:opacity-40"
          onClick={() => {
            if (!confirm(`未入金 ${unpaidSelected}件を取り下げます。入金済みの申込は対象外です。よろしいですか？`)) return;
            start(async () => {
              const r = await cancelUnpaidOrders([...sel]);
              setMsg(r.error ?? r.message ?? null);
              setSel(new Set());
            });
          }}
        >
          未入金を一括取り下げ（{unpaidSelected}）
        </button>
        {msg && <span className="text-zinc-700">{msg}</span>}
        <span className="ml-auto">入金済みは契約・財務記録のため一覧から消しません（詳細で「返金済」「取り下げ」に）</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 text-xs text-zinc-500">
            <tr>
              <th className="px-3 py-2 w-8"><input type="checkbox" checked={rows.length > 0 && sel.size === rows.length} onChange={toggleAll} /></th>
              {COLS.map((c) => (
                <th key={c.key} className={`px-3 py-2 text-left whitespace-nowrap cursor-pointer select-none ${c.num ? "text-right" : ""}`} onClick={() => setSort((s) => ({ key: c.key, dir: s.key === c.key ? (s.dir === 1 ? -1 : 1) : -1 }))}>
                  {c.label}{sort.key === c.key ? (sort.dir === 1 ? " ↑" : " ↓") : ""}
                </th>
              ))}
              <th className="px-3 py-2 text-left">手番</th>
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 && (
              <tr><td colSpan={COLS.length + 2} className="px-3 py-10 text-center text-zinc-400">申込はまだありません</td></tr>
            )}
            {sorted.map((r) => {
              const todo = r.status === "PAID" && r.detailsDone ? "考査を申請" : r.status === "PAID" ? "お客様の詳細待ち" : r.status === "MATERIAL_RECEIVED" ? "入稿→配信開始" : r.status === "AWAITING_PAYMENT" && r.payment === "振込" ? "入金待ち" : r.status === "LIVE" ? "終了後レポート" : "";
              return (
                <tr key={r.id} className="border-t border-zinc-100 hover:bg-zinc-50/60">
                  <td className="px-3 py-2"><input type="checkbox" checked={sel.has(r.id)} onChange={() => setSel((s) => { const n = new Set(s); if (n.has(r.id)) n.delete(r.id); else n.add(r.id); return n; })} /></td>
                  <td className="px-3 py-2 whitespace-nowrap"><Link href={`/dashboard/admin/tver-orders/${r.id}`} className="font-medium text-zinc-900 hover:text-orange-600">{r.no}</Link></td>
                  <td className="px-3 py-2 whitespace-nowrap text-zinc-500">{d(r.createdAt)}</td>
                  <td className="px-3 py-2 whitespace-nowrap"><span className={`px-2 py-0.5 rounded-md text-xs ${badge[r.status] ?? ""}`}>{r.statusLabel}</span></td>
                  <td className="px-3 py-2"><div className="font-medium text-zinc-900">{r.advertiser}</div><div className="text-xs text-zinc-500">{r.contact}・{r.email}</div></td>
                  <td className="px-3 py-2 whitespace-nowrap">{r.area}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{r.plan}</td>
                  <td className="px-3 py-2 whitespace-nowrap text-right tabular-nums">¥{r.total.toLocaleString("ja-JP")}<span className="text-xs text-zinc-400 ml-1">{r.payment}</span></td>
                  <td className="px-3 py-2 whitespace-nowrap text-zinc-500">{d(r.paidAt)}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{r.company}</td>
                  <td className="px-3 py-2 whitespace-nowrap text-xs text-orange-700">{todo}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
