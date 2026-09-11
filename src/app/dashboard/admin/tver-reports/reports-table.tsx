"use client";

// TVer配信実績 一覧テーブル（本部）。並べ替え・一括選択・一括削除・卸値と売価を並べて表示

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { deleteDeliveryReports } from "@/lib/actions/tver-delivery";

export type ReportRow = {
  id: string; createdAt: string; periodStart: string; periodEnd: string;
  advertiser: string; advertiserTverId: string; company: string; adSeconds: number | null;
  impressions: number; completes: number; wholesaleAmount: number; sellAmount: number; diffPct: number; warnings: number;
  status: "IMPORTED" | "PUBLISHED";
};

type Key = "createdAt" | "periodStart" | "advertiser" | "company" | "impressions" | "completes" | "wholesaleAmount" | "sellAmount" | "diffPct" | "status";
const COLS: { key: Key; label: string; num?: boolean }[] = [
  { key: "createdAt", label: "取込日" },
  { key: "status", label: "状態" },
  { key: "advertiser", label: "広告主" },
  { key: "periodStart", label: "期間" },
  { key: "company", label: "公開先の拠点" },
  { key: "impressions", label: "表示回数", num: true },
  { key: "completes", label: "100%再生", num: true },
  { key: "wholesaleAmount", label: "卸値（本部のみ）", num: true },
  { key: "sellAmount", label: "売価（拠点に見える）", num: true },
  { key: "diffPct", label: "裏計算ずれ", num: true },
];
const badge: Record<string, string> = { IMPORTED: "bg-orange-50 text-orange-700", PUBLISHED: "bg-emerald-50 text-emerald-700" };
const label: Record<string, string> = { IMPORTED: "確認待ち", PUBLISHED: "公開済み" };
const d = (iso: string) => new Date(iso).toLocaleDateString("ja-JP", { timeZone: "Asia/Tokyo", month: "numeric", day: "numeric" });
const yen = (n: number) => `¥${n.toLocaleString("ja-JP")}`;

export function ReportsTable({ rows }: { rows: ReportRow[] }) {
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

  return (
    <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-2 border-b border-zinc-100 text-xs text-zinc-500">
        <span>{sel.size}件選択</span>
        <button
          type="button"
          disabled={pending || sel.size === 0}
          className="px-2.5 py-1 rounded-md border border-zinc-200 hover:bg-zinc-50 disabled:opacity-40"
          onClick={() => {
            if (!confirm(`選択した ${sel.size}件のレポート（明細も）を削除します。公開済みなら拠点からも消えます。よろしいですか？`)) return;
            start(async () => {
              const r = await deleteDeliveryReports([...sel]);
              setMsg(r.error ?? r.message ?? null);
              setSel(new Set());
            });
          }}
        >
          一括削除（{sel.size}）
        </button>
        {msg && <span className="text-zinc-700">{msg}</span>}
        <span className="ml-auto">売価＝卸値×3を取込時に固定。同じ広告主の再取込は自動で差し替え（公開済みは公開のまま更新・警告が出たら確認待ちに戻る）</span>
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
              <th className="px-3 py-2 text-left">警告</th>
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 && (
              <tr><td colSpan={COLS.length + 2} className="px-3 py-10 text-center text-zinc-400">取り込んだレポートはまだありません</td></tr>
            )}
            {sorted.map((r) => (
              <tr key={r.id} className="border-t border-zinc-100 hover:bg-zinc-50/60">
                <td className="px-3 py-2"><input type="checkbox" checked={sel.has(r.id)} onChange={() => setSel((s) => { const n = new Set(s); if (n.has(r.id)) n.delete(r.id); else n.add(r.id); return n; })} /></td>
                <td className="px-3 py-2 whitespace-nowrap text-zinc-500">{d(r.createdAt)}</td>
                <td className="px-3 py-2 whitespace-nowrap"><span className={`px-2 py-0.5 rounded-md text-xs ${badge[r.status]}`}>{label[r.status]}</span></td>
                <td className="px-3 py-2"><Link href={`/dashboard/admin/tver-reports/${r.id}`} className="font-medium text-zinc-900 hover:text-orange-600">{r.advertiser}</Link><div className="text-xs text-zinc-400">ID {r.advertiserTverId}{r.adSeconds ? `・${r.adSeconds}秒` : ""}</div></td>
                <td className="px-3 py-2 whitespace-nowrap">{d(r.periodStart)}〜{d(r.periodEnd)}</td>
                <td className="px-3 py-2 whitespace-nowrap">{r.company || <span className="text-orange-600">未設定</span>}</td>
                <td className="px-3 py-2 text-right tabular-nums">{r.impressions.toLocaleString("ja-JP")}</td>
                <td className="px-3 py-2 text-right tabular-nums">{r.completes.toLocaleString("ja-JP")}</td>
                <td className="px-3 py-2 text-right tabular-nums text-zinc-500">{yen(r.wholesaleAmount)}</td>
                <td className="px-3 py-2 text-right tabular-nums font-medium text-zinc-900">{yen(r.sellAmount)}</td>
                <td className={`px-3 py-2 text-right tabular-nums ${r.diffPct > 3 ? "text-rose-600 font-medium" : "text-zinc-500"}`}>{r.diffPct}%</td>
                <td className="px-3 py-2 whitespace-nowrap text-xs">{r.warnings > 0 ? <span className="text-rose-600">⚠ {r.warnings}件</span> : <span className="text-emerald-600">なし</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
