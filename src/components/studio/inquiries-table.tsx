"use client";

// Ad Arch Studio の問い合わせ一覧（本部・拠点で共通）
//   並べ替え・一括選択・日付の列。本部＝迷惑・削除（確定前だけ）・付け替え／拠点＝一括見送り（削除はしない＝記録は本部に残す）

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { declineStudioInquiries, deleteStudioInquiries, markStudioInquiriesSpam, reassignStudioInquiry } from "@/lib/actions/studio-inquiries";

export type InquiryRow = {
  id: string;
  no: string;
  createdAt: string;
  dueAt: string;
  status: string;
  statusLabel: string;
  kindLabel: string;
  company: string;
  contact: string;
  email: string;
  phone: string | null;
  area: string;
  assignee: string;
  assignmentId: string | null;
  routeReason: string;
  overdue: boolean;
  suspectedSpam: boolean;
};

export type AssignmentOption = { id: string; label: string };

type Key = "no" | "createdAt" | "dueAt" | "status" | "kindLabel" | "company" | "area" | "assignee";
const COLS: { key: Key; label: string; adminOnly?: boolean }[] = [
  { key: "no", label: "受付番号" },
  { key: "createdAt", label: "受付日時" },
  { key: "dueAt", label: "返答期限" },
  { key: "status", label: "状態" },
  { key: "kindLabel", label: "用件" },
  { key: "company", label: "会社・担当者" },
  { key: "area", label: "場所" },
  { key: "assignee", label: "担当", adminOnly: true },
];

const badge: Record<string, string> = {
  RECEIVED: "bg-amber-50 text-amber-700",
  CONSULTING: "bg-sky-50 text-sky-700",
  CONFIRMED: "bg-emerald-50 text-emerald-700",
  DECLINED: "bg-zinc-100 text-zinc-500",
  SPAM: "bg-zinc-100 text-zinc-400",
};
const dt = (iso: string) => new Date(iso).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });

export function InquiriesTable({ rows, mode, assignments = [] }: { rows: InquiryRow[]; mode: "admin" | "branch"; assignments?: AssignmentOption[] }) {
  const [sort, setSort] = useState<{ key: Key; dir: 1 | -1 }>({ key: "createdAt", dir: -1 });
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const cols = COLS.filter((c) => mode === "admin" || !c.adminOnly);

  const sorted = useMemo(() => {
    const arr = [...rows];
    arr.sort((a, b) => String(a[sort.key] ?? "").localeCompare(String(b[sort.key] ?? ""), "ja") * sort.dir);
    return arr;
  }, [rows, sort]);

  const toggleAll = () => setSel(sel.size === rows.length ? new Set() : new Set(rows.map((r) => r.id)));
  const selected = rows.filter((r) => sel.has(r.id));
  const notConfirmed = selected.filter((r) => r.status !== "CONFIRMED").length;
  const run = (fn: () => Promise<{ error?: string; message?: string }>) =>
    start(async () => {
      const r = await fn();
      setMsg(r.error ?? r.message ?? null);
      setSel(new Set());
    });

  return (
    <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2 border-b border-zinc-100 text-xs text-zinc-500 flex-wrap">
        <span>{sel.size}件選択</span>
        {mode === "admin" ? (
          <>
            <button type="button" disabled={pending || notConfirmed === 0} className="px-2.5 py-1 rounded-md border border-zinc-200 hover:bg-zinc-50 disabled:opacity-40"
              onClick={() => confirm(`${notConfirmed}件を迷惑にします。よろしいですか？`) && run(() => markStudioInquiriesSpam([...sel]))}>
              迷惑にする（{notConfirmed}）
            </button>
            <button type="button" disabled={pending || notConfirmed === 0} className="px-2.5 py-1 rounded-md border border-rose-200 text-rose-700 hover:bg-rose-50 disabled:opacity-40"
              onClick={() => confirm(`確定前の${notConfirmed}件を削除します。元に戻せません。よろしいですか？`) && run(() => deleteStudioInquiries([...sel]))}>
              一括削除（{notConfirmed}）
            </button>
            <span className="ml-auto">確定済みは発注の記録のため削除できません</span>
          </>
        ) : (
          <>
            <button type="button" disabled={pending || selected.filter((r) => r.status === "RECEIVED" || r.status === "CONSULTING").length === 0}
              className="px-2.5 py-1 rounded-md border border-zinc-200 hover:bg-zinc-50 disabled:opacity-40"
              onClick={() => confirm("選んだ問い合わせを見送りにします。よろしいですか？") && run(() => declineStudioInquiries([...sel]))}>
              一括で見送り
            </button>
            <span className="ml-auto">問い合わせの記録は本部に残るため、拠点の一覧では削除せず「見送り」にします</span>
          </>
        )}
        {msg && <span className="text-zinc-700">{msg}</span>}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 text-xs text-zinc-500">
            <tr>
              <th className="px-3 py-2 w-8"><input type="checkbox" checked={rows.length > 0 && sel.size === rows.length} onChange={toggleAll} aria-label="すべて選択" /></th>
              {cols.map((c) => (
                <th key={c.key} className="px-3 py-2 text-left whitespace-nowrap cursor-pointer select-none" onClick={() => setSort((s) => ({ key: c.key, dir: s.key === c.key ? (s.dir === 1 ? -1 : 1) : -1 }))}>
                  {c.label}{sort.key === c.key ? (sort.dir === 1 ? " ↑" : " ↓") : ""}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 && (
              <tr><td colSpan={cols.length + 1} className="px-3 py-10 text-center text-zinc-400">問い合わせはまだありません</td></tr>
            )}
            {sorted.map((r) => (
              <tr key={r.id} className={`border-t border-zinc-100 ${r.overdue ? "bg-rose-50/70" : "hover:bg-zinc-50/60"}`}>
                <td className="px-3 py-2"><input type="checkbox" checked={sel.has(r.id)} onChange={() => setSel((s) => { const n = new Set(s); if (n.has(r.id)) n.delete(r.id); else n.add(r.id); return n; })} aria-label={`${r.no}を選択`} /></td>
                <td className="px-3 py-2 whitespace-nowrap"><Link href={`/dashboard/studio-inquiries/${r.id}`} className="font-medium text-zinc-900 hover:underline">{r.no}</Link></td>
                <td className="px-3 py-2 whitespace-nowrap text-zinc-500">{dt(r.createdAt)}</td>
                <td className={`px-3 py-2 whitespace-nowrap ${r.overdue ? "text-rose-700 font-semibold" : "text-zinc-500"}`}>{dt(r.dueAt)}{r.overdue ? "（期限切れ）" : ""}</td>
                <td className="px-3 py-2 whitespace-nowrap">
                  <span className={`px-2 py-0.5 rounded-md text-xs ${badge[r.status] ?? ""}`}>{r.statusLabel}</span>
                  {r.suspectedSpam && r.status !== "SPAM" && <span className="ml-1 text-[11px] text-zinc-400">迷惑の疑い</span>}
                </td>
                <td className="px-3 py-2 whitespace-nowrap">{r.kindLabel}</td>
                <td className="px-3 py-2"><div className="font-medium text-zinc-900">{r.company}</div><div className="text-xs text-zinc-500">{r.contact}・{r.email}{r.phone ? `・${r.phone}` : ""}</div></td>
                <td className="px-3 py-2 whitespace-nowrap">{r.area || "—"}</td>
                {mode === "admin" && (
                  <td className="px-3 py-2 whitespace-nowrap">
                    <select
                      className="border border-zinc-200 rounded-md px-1.5 py-1 text-xs bg-white"
                      value={r.assignmentId ?? ""}
                      disabled={pending || r.status === "CONFIRMED"}
                      onChange={(e) => run(() => reassignStudioInquiry(r.id, e.target.value || null))}
                      title={r.routeReason}
                    >
                      <option value="">本部</option>
                      {assignments.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
                    </select>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
