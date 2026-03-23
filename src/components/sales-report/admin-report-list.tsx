"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, Download } from "lucide-react";

type Report = {
  id: string;
  amount: { toString(): string };
  targetMonth: Date;
  memo: string | null;
  projectName: string | null;
  staffName: string | null;
  currentProjects: number | null;
  nextMonthProjects: number | null;
  supportRequest: string | null;
  createdAt: Date;
  createdBy: { name: string | null; email: string };
};

interface Props {
  reports: Report[];
}

const PAGE_SIZE = 30;

function fmtAmount(a: { toString(): string }): string {
  return `¥${Number(a).toLocaleString("ja-JP")}`;
}

function fmtMonth(d: Date): string {
  return new Intl.DateTimeFormat("ja-JP", { year: "numeric", month: "long" }).format(new Date(d));
}

function fmtDate(d: Date): string {
  return new Intl.DateTimeFormat("ja-JP", { year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(d));
}

function statusBadge(status: string | null) {
  if (!status) return null;
  const colors: Record<string, string> = {
    "順調に稼働中": "bg-green-50 text-green-700 border-green-200",
    "案件を探している": "bg-yellow-50 text-yellow-700 border-yellow-200",
    "別業務で多忙": "bg-blue-50 text-blue-700 border-blue-200",
    "体制を見直し中": "bg-orange-50 text-orange-700 border-orange-200",
    "その他": "bg-zinc-50 text-zinc-600 border-zinc-200",
  };
  return (
    <span className={`inline-block px-2 py-0.5 text-[10px] font-medium border rounded-full ${colors[status] ?? colors["その他"]}`}>
      {status}
    </span>
  );
}

function supportBadge(req: string | null) {
  if (!req || req === "特になし") return null;
  return (
    <span className="inline-block px-2 py-0.5 text-[10px] font-medium bg-red-50 text-red-700 border border-red-200 rounded-full">
      {req}
    </span>
  );
}

function exportCsv(reports: Report[]) {
  const header = ["報告者", "計上月", "状況", "売上（税抜）", "今月案件数", "来月見込み", "関連プロジェクト", "本部相談", "補足", "報告日"];
  const rows = reports.map((r) => [
    r.createdBy.name ?? r.createdBy.email,
    fmtMonth(r.targetMonth),
    r.staffName ?? "",
    String(Number(r.amount)),
    r.currentProjects != null ? String(r.currentProjects) : "",
    r.nextMonthProjects != null ? String(r.nextMonthProjects) : "",
    r.projectName ?? "",
    r.supportRequest ?? "",
    (r.memo ?? "").replace(/"/g, '""'),
    fmtDate(r.createdAt),
  ]);
  const csv = [header, ...rows]
    .map((row) => row.map((v) => `"${v}"`).join(","))
    .join("\r\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `全員月次報告_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function AdminReportList({ reports }: Props) {
  const [page, setPage] = useState(1);
  const [filterMonth, setFilterMonth] = useState("");

  const filtered = filterMonth
    ? reports.filter((r) => {
        const d = new Date(r.targetMonth);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}` === filterMonth;
      })
    : reports;

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const slice = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const months = Array.from(
    new Set(reports.map((r) => {
      const d = new Date(r.targetMonth);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    }))
  ).sort().reverse();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <select
            value={filterMonth}
            onChange={(e) => { setFilterMonth(e.target.value); setPage(1); }}
            className="text-xs border border-zinc-200 rounded-lg px-3 py-1.5 bg-white text-zinc-700"
          >
            <option value="">全期間</option>
            {months.map((m) => (
              <option key={m} value={m}>{m.replace("-", "年") + "月"}</option>
            ))}
          </select>
          <span className="text-xs text-zinc-400">{filtered.length} 件</span>
        </div>
        {filtered.length > 0 && (
          <button
            onClick={() => exportCsv(filtered)}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium
                       bg-white border border-zinc-200 text-zinc-600 rounded-lg
                       hover:bg-zinc-50 transition-colors"
          >
            <Download className="w-3 h-3" />
            CSV書き出し
          </button>
        )}
      </div>

      <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-zinc-50 border-b border-zinc-100">
                {["報告者", "計上月", "状況", "金額（税抜）", "案件数", "来月見込", "プロジェクト", "本部相談", "補足", "報告日"].map((label, i) => (
                  <th
                    key={i}
                    className={`px-3 py-2.5 text-[10px] font-semibold text-zinc-500
                                uppercase tracking-wider whitespace-nowrap ${i === 3 ? "text-right" : "text-left"}`}
                  >
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-50">
              {slice.map((r) => (
                <tr key={r.id} className="hover:bg-zinc-50/50 transition-colors">
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    <span className="text-xs font-semibold text-zinc-800">
                      {r.createdBy.name ?? r.createdBy.email.split("@")[0]}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap text-xs text-zinc-700">
                    {fmtMonth(r.targetMonth)}
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    {statusBadge(r.staffName)}
                  </td>
                  <td className="px-3 py-2.5 text-right whitespace-nowrap">
                    <span className="text-sm font-bold text-zinc-900">{fmtAmount(r.amount)}</span>
                  </td>
                  <td className="px-3 py-2.5 text-center text-xs text-zinc-600">
                    {r.currentProjects ?? "—"}
                  </td>
                  <td className="px-3 py-2.5 text-center text-xs text-zinc-600">
                    {r.nextMonthProjects ?? "—"}
                  </td>
                  <td className="px-3 py-2.5 max-w-[160px]">
                    <span className="text-xs text-zinc-600 truncate block">{r.projectName ?? "—"}</span>
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    {supportBadge(r.supportRequest)}
                  </td>
                  <td className="px-3 py-2.5 max-w-[200px]">
                    <p className="text-xs text-zinc-500 line-clamp-2 leading-snug">{r.memo ?? "—"}</p>
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap text-[11px] text-zinc-400">
                    {fmtDate(r.createdAt)}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-4 py-12 text-center text-sm text-zinc-400">
                    報告がありません
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-xs text-zinc-500">
          <span>{filtered.length} 件中 {(page - 1) * PAGE_SIZE + 1}〜{Math.min(page * PAGE_SIZE, filtered.length)} 件</span>
          <div className="flex items-center gap-1">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="p-1 rounded hover:bg-zinc-100 disabled:opacity-30">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-2">{page} / {totalPages}</span>
            <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="p-1 rounded hover:bg-zinc-100 disabled:opacity-30">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
