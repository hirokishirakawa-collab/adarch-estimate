"use client";

import { Fragment, useState } from "react";
import { ChevronDown, ChevronLeft, ChevronRight, Download } from "lucide-react";
import { BILLED_BY_LABEL, type BilledBy } from "@/lib/constants/sales-report";

type Item = {
  id: string;
  billedBy: BilledBy;
  clientName: string;
  projectName: string;
  amountExclTax: { toString(): string };
  amountInclTax: { toString(): string };
  memo: string | null;
};

type Report = {
  id: string;
  amount: { toString(): string };
  selfAmount: { toString(): string };
  hqAmount: { toString(): string };
  targetMonth: Date;
  memo: string | null;
  projectName: string | null;
  staffName: string | null;
  currentProjects: number | null;
  nextMonthProjects: number | null;
  supportRequest: string | null;
  createdAt: Date;
  createdBy: { name: string | null; email: string };
  items: Item[];
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

/** 請求元の区分がついていない旧データぶん（amount − self − hq） */
function unclassified(r: Report): number {
  return Math.max(0, Number(r.amount) - Number(r.selfAmount) - Number(r.hqAmount));
}

function billedBadge(billedBy: BilledBy) {
  const cls =
    billedBy === "HQ"
      ? "bg-violet-50 text-violet-700 border-violet-200"
      : "bg-blue-50 text-blue-700 border-blue-200";
  return (
    <span className={`inline-block px-2 py-0.5 text-[10px] font-medium border rounded-full whitespace-nowrap ${cls}`}>
      {BILLED_BY_LABEL[billedBy]}
    </span>
  );
}

function downloadCsv(header: string[], rows: string[][], filename: string) {
  const csv = [header, ...rows]
    .map((row) => row.map((v) => `"${v}"`).join(","))
    .join("\r\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** 報告1件 = 1行のサマリーCSV */
function exportCsv(reports: Report[]) {
  const header = ["報告者", "計上月", "状況", "売上（税抜）", "うち自分で請求", "うち本部から請求", "今月案件数", "来月見込み", "関連プロジェクト", "本部相談", "補足", "報告日"];
  const rows = reports.map((r) => [
    r.createdBy.name ?? r.createdBy.email,
    fmtMonth(r.targetMonth),
    r.staffName ?? "",
    String(Number(r.amount)),
    String(Number(r.selfAmount)),
    String(Number(r.hqAmount)),
    r.currentProjects != null ? String(r.currentProjects) : "",
    r.nextMonthProjects != null ? String(r.nextMonthProjects) : "",
    r.projectName ?? "",
    r.supportRequest ?? "",
    (r.memo ?? "").replace(/"/g, '""'),
    fmtDate(r.createdAt),
  ]);
  downloadCsv(header, rows, `全員月次報告_${new Date().toISOString().slice(0, 10)}.csv`);
}

/** 明細1行 = 1行の案件別CSV（本部の経理・ロイヤリティ照合用） */
function exportItemsCsv(reports: Report[]) {
  const header = ["報告者", "計上月", "請求元", "クライアント名", "案件名", "金額（税抜）", "金額（税込）", "備考", "報告日"];
  const rows: string[][] = [];
  for (const r of reports) {
    const who = r.createdBy.name ?? r.createdBy.email;
    const month = fmtMonth(r.targetMonth);
    const created = fmtDate(r.createdAt);
    if (r.items.length === 0) {
      // 明細なし（0円報告 / 明細機能の導入前データ）は1行だけ出す
      rows.push([who, month, "", "", r.projectName ?? "", String(Number(r.amount)), "", (r.memo ?? "").replace(/"/g, '""'), created]);
      continue;
    }
    for (const it of r.items) {
      rows.push([
        who,
        month,
        BILLED_BY_LABEL[it.billedBy],
        it.clientName,
        it.projectName,
        String(Number(it.amountExclTax)),
        String(Number(it.amountInclTax)),
        (it.memo ?? "").replace(/"/g, '""'),
        created,
      ]);
    }
  }
  downloadCsv(header, rows, `全員月次報告_案件別_${new Date().toISOString().slice(0, 10)}.csv`);
}

export function AdminReportList({ reports }: Props) {
  const [page, setPage] = useState(1);
  const [filterMonth, setFilterMonth] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

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
          <div className="flex items-center gap-2">
            <button
              onClick={() => exportCsv(filtered)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium
                         bg-white border border-zinc-200 text-zinc-600 rounded-lg
                         hover:bg-zinc-50 transition-colors"
            >
              <Download className="w-3 h-3" />
              報告CSV
            </button>
            <button
              onClick={() => exportItemsCsv(filtered)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium
                         bg-white border border-zinc-200 text-zinc-600 rounded-lg
                         hover:bg-zinc-50 transition-colors"
            >
              <Download className="w-3 h-3" />
              案件別CSV
            </button>
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-zinc-50 border-b border-zinc-100">
                {["報告者", "計上月", "状況", "自分で請求", "本部から請求", "合計（税抜）", "案件数", "来月見込", "プロジェクト", "本部相談", "報告日"].map((label, i) => (
                  <th
                    key={i}
                    className={`px-3 py-2.5 text-[10px] font-semibold text-zinc-500
                                uppercase tracking-wider whitespace-nowrap ${i >= 3 && i <= 5 ? "text-right" : "text-left"}`}
                  >
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-50">
              {slice.map((r) => {
                const isExpanded = expandedId === r.id;
                return (
                  <Fragment key={r.id}>
                    <tr
                      className="hover:bg-zinc-50/50 transition-colors cursor-pointer"
                      onClick={() => setExpandedId(isExpanded ? null : r.id)}
                    >
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <span className="text-xs font-semibold text-zinc-800 inline-flex items-center gap-1">
                          <ChevronDown className={`w-3 h-3 text-zinc-400 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
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
                        <span className="text-xs font-semibold text-blue-700 tabular-nums">{fmtAmount(r.selfAmount)}</span>
                      </td>
                      <td className="px-3 py-2.5 text-right whitespace-nowrap">
                        <span className="text-xs font-semibold text-violet-700 tabular-nums">{fmtAmount(r.hqAmount)}</span>
                      </td>
                      <td className="px-3 py-2.5 text-right whitespace-nowrap">
                        <span className="text-sm font-bold text-zinc-900 tabular-nums">{fmtAmount(r.amount)}</span>
                        {unclassified(r) > 0 && (
                          <p className="text-[10px] text-zinc-400">区分なし {fmtAmount(unclassified(r))}</p>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-center text-xs text-zinc-600">
                        {r.currentProjects ?? "—"}
                      </td>
                      <td className="px-3 py-2.5 text-center text-xs text-zinc-600">
                        {r.nextMonthProjects ?? "—"}
                      </td>
                      <td className="px-3 py-2.5 max-w-[160px]">
                        <span className="text-xs text-zinc-600 truncate block">{r.projectName ?? "—"}</span>
                        {r.items.length > 0 && (
                          <span className="text-[10px] text-zinc-400">{r.items.length}件の明細</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        {supportBadge(r.supportRequest)}
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap text-[11px] text-zinc-400">
                        {fmtDate(r.createdAt)}
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr>
                        <td colSpan={11} className="bg-zinc-50/80 px-6 py-4 border-b border-zinc-100">
                          <div className="grid grid-cols-2 gap-x-8 gap-y-3 text-xs">
                            <div>
                              <span className="font-semibold text-zinc-500">報告者</span>
                              <p className="mt-0.5 text-zinc-800">{r.createdBy.name ?? "—"} ({r.createdBy.email})</p>
                            </div>
                            <div>
                              <span className="font-semibold text-zinc-500">計上月</span>
                              <p className="mt-0.5 text-zinc-800">{fmtMonth(r.targetMonth)}</p>
                            </div>
                            <div>
                              <span className="font-semibold text-zinc-500">状況</span>
                              <p className="mt-0.5">{statusBadge(r.staffName) ?? "—"}</p>
                            </div>
                            <div>
                              <span className="font-semibold text-zinc-500">金額（税抜）</span>
                              <p className="mt-0.5 text-zinc-800 font-bold">{fmtAmount(r.amount)}</p>
                              <p className="mt-0.5 text-[11px] text-zinc-500">
                                自分で請求 <span className="text-blue-700 font-semibold">{fmtAmount(r.selfAmount)}</span>
                                {" ／ "}
                                本部から請求 <span className="text-violet-700 font-semibold">{fmtAmount(r.hqAmount)}</span>
                                {unclassified(r) > 0 && <> ／ 区分なし {fmtAmount(unclassified(r))}</>}
                              </p>
                            </div>
                            <div>
                              <span className="font-semibold text-zinc-500">今月案件数</span>
                              <p className="mt-0.5 text-zinc-800">{r.currentProjects ?? "—"}</p>
                            </div>
                            <div>
                              <span className="font-semibold text-zinc-500">来月見込み</span>
                              <p className="mt-0.5 text-zinc-800">{r.nextMonthProjects ?? "—"}</p>
                            </div>
                            {/* 売上明細（案件ごと） */}
                            <div className="col-span-2">
                              <span className="font-semibold text-zinc-500">売上明細</span>
                              {r.items.length === 0 ? (
                                <p className="mt-1 text-zinc-400">
                                  明細なし{r.projectName ? `（関連プロジェクト: ${r.projectName}）` : ""}
                                </p>
                              ) : (
                                <table className="mt-2 w-full">
                                  <thead>
                                    <tr className="text-[10px] text-zinc-400 uppercase tracking-wider">
                                      <th className="text-left pb-1 font-semibold">請求元</th>
                                      <th className="text-left pb-1 font-semibold">クライアント名</th>
                                      <th className="text-left pb-1 font-semibold">案件名</th>
                                      <th className="text-right pb-1 font-semibold">税抜</th>
                                      <th className="text-right pb-1 font-semibold">税込</th>
                                      <th className="text-left pb-1 pl-4 font-semibold">備考</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-zinc-200/60">
                                    {r.items.map((it) => (
                                      <tr key={it.id}>
                                        <td className="py-1.5 pr-3 whitespace-nowrap">{billedBadge(it.billedBy)}</td>
                                        <td className="py-1.5 pr-3 text-zinc-800">{it.clientName}</td>
                                        <td className="py-1.5 pr-3 text-zinc-700">{it.projectName}</td>
                                        <td className="py-1.5 text-right font-semibold text-zinc-900 tabular-nums whitespace-nowrap">
                                          {fmtAmount(it.amountExclTax)}
                                        </td>
                                        <td className="py-1.5 text-right text-zinc-500 tabular-nums whitespace-nowrap">
                                          {fmtAmount(it.amountInclTax)}
                                        </td>
                                        <td className="py-1.5 pl-4 text-zinc-500">{it.memo ?? "—"}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              )}
                            </div>
                            <div className="col-span-2">
                              <span className="font-semibold text-zinc-500">本部相談</span>
                              <p className="mt-0.5">{supportBadge(r.supportRequest) ?? <span className="text-zinc-800">特になし</span>}</p>
                            </div>
                            <div className="col-span-2">
                              <span className="font-semibold text-zinc-500">補足</span>
                              <p className="mt-0.5 text-zinc-800 whitespace-pre-wrap leading-relaxed">{r.memo ?? "—"}</p>
                            </div>
                            <div>
                              <span className="font-semibold text-zinc-500">報告日</span>
                              <p className="mt-0.5 text-zinc-800">{fmtDate(r.createdAt)}</p>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={11} className="px-4 py-12 text-center text-sm text-zinc-400">
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
