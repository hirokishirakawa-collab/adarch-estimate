"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { AdBuyerRow } from "@/lib/ad-buyers/list";
import { platformOf } from "@/lib/ad-buyers/platforms";
import { getLeadStatusOption } from "@/lib/constants/leads";

type SortKey = "name" | "address" | "platforms" | "rating" | "checkedAt" | "status";

const HEADERS: { key: SortKey; label: string; className?: string }[] = [
  { key: "name", label: "店名" },
  { key: "address", label: "住所", className: "hidden md:table-cell" },
  { key: "platforms", label: "媒体" },
  { key: "rating", label: "評価", className: "text-center" },
  { key: "checkedAt", label: "確認日", className: "text-center" },
  { key: "status", label: "状態", className: "text-center" },
];

function fmtDay(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
}

function compare(a: AdBuyerRow, b: AdBuyerRow, key: SortKey): number {
  switch (key) {
    case "name": return a.name.localeCompare(b.name, "ja");
    case "address": return (a.address ?? "").localeCompare(b.address ?? "", "ja");
    case "platforms": return a.platforms.join(",").localeCompare(b.platforms.join(","));
    case "rating": return a.rating - b.rating || a.ratingCount - b.ratingCount;
    case "checkedAt": return (a.checkedAt ?? "").localeCompare(b.checkedAt ?? "");
    case "status": return a.status.localeCompare(b.status);
  }
}

/**
 * 広告出稿者ファインダーの一覧。
 * 列ヘッダでソート／全選択／一括「ファインダーから外す」（媒体タグを外すだけ・リードは消さない）。
 * 行の店名はリード管理の検索に飛ぶ（リードの詳細はそこで開く）。
 */
export function AdBuyerList({ rows }: { rows: AdBuyerRow[] }) {
  const router = useRouter();
  const [sortKey, setSortKey] = useState<SortKey>("checkedAt");
  const [dir, setDir] = useState<"asc" | "desc">("desc");
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sorted = useMemo(() => {
    const out = [...rows].sort((a, b) => compare(a, b, sortKey));
    return dir === "asc" ? out : out.reverse();
  }, [rows, sortKey, dir]);

  const allIds = useMemo(() => rows.map((r) => r.id), [rows]);
  const allChecked = rows.length > 0 && allIds.every((id) => selected.has(id));
  const count = selected.size;

  function toggleSort(key: SortKey) {
    if (key === sortKey) setDir(dir === "asc" ? "desc" : "asc");
    else {
      setSortKey(key);
      setDir(key === "name" || key === "address" ? "asc" : "desc");
    }
  }
  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function toggleAll() {
    setSelected(allChecked ? new Set() : new Set(allIds));
  }

  async function untag() {
    if (count === 0) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/ad-buyers/untag", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadIds: Array.from(selected) }),
      });
      const data = (await res.json().catch(() => null)) as { ok?: boolean; count?: number; error?: string } | null;
      if (!res.ok || !data?.ok) {
        setError(data?.error ?? "外せませんでした");
        return;
      }
      setSelected(new Set());
      setConfirming(false);
      router.refresh();
    } catch {
      setError("通信に失敗しました");
    } finally {
      setBusy(false);
    }
  }

  const idsParam = Array.from(selected).join(",");

  return (
    <div className="space-y-3">
      {/* ── 選択バー */}
      <div className="sticky top-0 z-10 rounded-xl border border-zinc-200 bg-white/95 backdrop-blur">
        <div className="flex flex-wrap items-center gap-3 px-4 py-2.5">
          <label className="flex items-center gap-2 text-xs text-zinc-700">
            <input type="checkbox" checked={allChecked} onChange={toggleAll} className="h-4 w-4 rounded border-zinc-300" />
            表示中の全件を選ぶ（{rows.length}件）
          </label>
          <span className="text-xs text-zinc-500">選択中 {count}件</span>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            {count > 0 && (
              <button type="button" onClick={() => setSelected(new Set())} className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs text-zinc-600 hover:bg-zinc-50">
                選択を解除
              </button>
            )}
            <button
              type="button"
              onClick={() => router.push(`/dashboard/leads/outreach?ids=${idsParam}`)}
              disabled={count === 0}
              className="rounded-lg bg-[#1F3A5F] px-4 py-1.5 text-xs font-bold text-white hover:bg-[#16304f] disabled:opacity-40 disabled:cursor-not-allowed"
            >
              営業フォームへ{count > 0 ? `（${count}件）` : ""}
            </button>
            <button
              type="button"
              onClick={() => router.push(`/dashboard/leads/dm?ids=${idsParam}`)}
              disabled={count === 0}
              className="rounded-lg bg-zinc-900 px-4 py-1.5 text-xs font-bold text-white hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              郵送DMへ{count > 0 ? `（${count}件）` : ""}
            </button>
            <button
              type="button"
              onClick={() => setConfirming(true)}
              disabled={count === 0 || busy}
              title="媒体タグを外して、この一覧から消します。リード自体はリード管理に残ります"
              className="rounded-lg border border-rose-200 px-4 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              ファインダーから外す{count > 0 ? `（${count}件）` : ""}
            </button>
          </div>
        </div>
        {confirming && (
          <div className="px-4 pb-2.5">
            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-rose-200 bg-rose-50/60 px-3 py-2 text-xs text-zinc-700">
              <span>
                選択した <span className="font-bold">{count}件</span> の媒体タグを外して、この一覧から消します。リード自体は残り、次に同じ店が見つかっても戻しません。
              </span>
              <div className="ml-auto flex items-center gap-2">
                <button type="button" onClick={untag} disabled={busy} className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-rose-700 disabled:opacity-50">
                  {busy ? "外しています…" : "外す"}
                </button>
                <button type="button" onClick={() => setConfirming(false)} disabled={busy} className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs text-zinc-600 hover:bg-zinc-50">
                  やめる
                </button>
              </div>
            </div>
          </div>
        )}
        {error && <p className="px-4 pb-2 text-xs text-rose-700">{error}</p>}
      </div>

      {/* ── 一覧 */}
      <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-200 bg-zinc-50">
              <th className="px-3 py-2.5 w-10">
                <input type="checkbox" checked={allChecked} onChange={toggleAll} aria-label="全選択" className="h-4 w-4 rounded border-zinc-300" />
              </th>
              {HEADERS.map((h) => (
                <th key={h.key} className={`px-3 py-2.5 text-left text-xs font-medium text-zinc-500 ${h.className ?? ""}`}>
                  <button type="button" onClick={() => toggleSort(h.key)} className="inline-flex items-center gap-1 hover:text-zinc-900">
                    {h.label}
                    {sortKey === h.key && <span className="text-[10px]">{dir === "asc" ? "▲" : "▼"}</span>}
                  </button>
                </th>
              ))}
              <th className="px-3 py-2.5 text-left text-xs font-medium text-zinc-500">根拠</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => {
              const checked = selected.has(r.id);
              const st = getLeadStatusOption(r.status);
              return (
                <tr key={r.id} className={`border-b border-zinc-100 last:border-0 ${checked ? "bg-orange-50/40" : "hover:bg-zinc-50/60"}`}>
                  <td className="px-3 py-2.5 text-center">
                    <input type="checkbox" checked={checked} onChange={() => toggle(r.id)} aria-label={`${r.name} を選ぶ`} className="h-4 w-4 rounded border-zinc-300" />
                  </td>
                  <td className="px-3 py-2.5">
                    <Link href={`/dashboard/leads/list?q=${encodeURIComponent(r.name)}`} className="font-medium text-zinc-900 hover:underline underline-offset-2">
                      {r.name}
                    </Link>
                    <div className="text-[11px] text-zinc-400 md:hidden">{r.address ?? "—"}</div>
                    <div className="text-[11px] text-zinc-400">
                      {[r.industry, r.assignee ? `担当: ${r.assignee}` : null].filter(Boolean).join(" / ")}
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-xs text-zinc-600 hidden md:table-cell max-w-[280px] truncate" title={r.address ?? ""}>{r.address ?? "—"}</td>
                  <td className="px-3 py-2.5">
                    <div className="flex flex-wrap gap-1">
                      {r.platforms.map((k) => {
                        const pl = platformOf(k);
                        const high = pl?.paidConfidence === "high";
                        return (
                          <span
                            key={k}
                            title={`${pl?.label ?? k}（確度: ${high ? "高" : "中"}）`}
                            className={`inline-flex items-center rounded px-1.5 py-0.5 text-[11px] font-semibold border whitespace-nowrap ${high ? "bg-orange-50 text-orange-700 border-orange-200" : "bg-zinc-50 text-zinc-600 border-zinc-200"}`}
                          >
                            {pl?.short ?? k}
                          </span>
                        );
                      })}
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-center text-xs text-zinc-700 whitespace-nowrap">
                    {r.rating > 0 ? `★${r.rating.toFixed(1)}` : "—"}
                    {r.ratingCount > 0 && <span className="text-zinc-400"> ({r.ratingCount})</span>}
                  </td>
                  <td className="px-3 py-2.5 text-center text-xs text-zinc-600 whitespace-nowrap">{fmtDay(r.checkedAt)}</td>
                  <td className="px-3 py-2.5 text-center">
                    <span className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium border whitespace-nowrap ${st.className}`}>
                      {st.icon} {st.label}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    <div className="flex items-center gap-1.5">
                      {r.evidenceUrl && (
                        <a href={r.evidenceUrl} target="_blank" rel="noopener noreferrer" className="rounded-lg border border-zinc-200 px-2 py-1 text-[11px] text-zinc-600 hover:bg-zinc-50">
                          掲載ページ
                        </a>
                      )}
                      {r.websiteUrl && r.websiteUrl !== r.evidenceUrl && (
                        <a href={r.websiteUrl} target="_blank" rel="noopener noreferrer" className="rounded-lg border border-zinc-200 px-2 py-1 text-[11px] text-zinc-600 hover:bg-zinc-50">
                          自社サイト
                        </a>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
