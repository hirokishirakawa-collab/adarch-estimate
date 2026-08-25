"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { OUTREACH_RESULT_OPTIONS, getOutreachResultOption } from "@/lib/constants/outreach-result";
import { recordOutreachResultBulk } from "@/lib/actions/outreach-result";
import { OutreachResultBar } from "@/components/leads/outreach-result-bar";
import { cn } from "@/lib/utils";

export interface AwaitingRow {
  id: string;
  name: string;
  meta: string;
  websiteUrl: string | null;
  /** 送付からの経過日数 */
  days: number;
  appeal: string;
  sentDate: string;
  staff: string;
  outreachResult: string | null;
  resultDate: string;
}

interface Props {
  rows: AwaitingRow[];
  /** 返事待ちタブのときだけチェック→一括を出す */
  bulk: boolean;
}

// 経過日数の見た目。放置が長いほど強い色にして、上から手を打てるようにする
function elapsedClass(days: number): string {
  if (days >= 14) return "bg-rose-50 text-rose-700 border-rose-200";
  if (days >= 7) return "bg-amber-50 text-amber-700 border-amber-200";
  return "bg-zinc-50 text-zinc-500 border-zinc-200";
}

// ---------------------------------------------------------------
// 返事待ち一覧。行のチェック → 上のバーで結果を1つ押す → 選んだ分にまとめて記録。
// 1件ずつのボタン列（OutreachResultBar）はそのまま残す。
// ---------------------------------------------------------------
export function AwaitingTable({ rows, bulk }: Props) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, startTransition] = useTransition();
  const [notice, setNotice] = useState<string | null>(null);

  const allChecked = rows.length > 0 && selected.size === rows.length;

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected(allChecked ? new Set() : new Set(rows.map((r) => r.id)));
  }

  function selectStale(minDays: number) {
    setSelected(new Set(rows.filter((r) => r.days >= minDays).map((r) => r.id)));
  }

  function applyBulk(value: string) {
    if (pending || selected.size === 0) return;
    const opt = getOutreachResultOption(value);
    if (!opt) return;
    if (!confirm(`選択した${selected.size}件を「${opt.label}」で記録します。よろしいですか？`)) return;
    startTransition(async () => {
      const res = await recordOutreachResultBulk(Array.from(selected), value);
      if (res.error) {
        alert(res.error);
        return;
      }
      const parts = [`${res.done}件を「${opt.label}」で記録しました`];
      if (res.skipped > 0) parts.push(`${res.skipped}件は対象外`);
      if (res.failed > 0) parts.push(`${res.failed}件は失敗`);
      setNotice(parts.join("／"));
      setSelected(new Set());
      router.refresh();
    });
  }

  const staleCount = rows.filter((r) => r.days >= 7).length;

  return (
    <div>
      {/* ===== 一括バー（返事待ちタブ・選択中のみ） ===== */}
      {bulk && selected.size > 0 && (
        <div className="bg-blue-50 border-b border-blue-100 px-4 py-2.5 flex items-center justify-between gap-3 flex-wrap">
          <p className="text-sm font-medium text-blue-700">
            {selected.size}件選択中
            <button
              type="button"
              onClick={() => setSelected(new Set())}
              className="ml-2 text-xs text-blue-500 hover:text-blue-700 underline"
            >
              選択解除
            </button>
          </p>
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs font-medium text-zinc-500 mr-0.5">まとめて結果：</span>
            {OUTREACH_RESULT_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                disabled={pending}
                onClick={() => applyBulk(opt.value)}
                title={`選択した${selected.size}件を「${opt.label}」で記録`}
                className={cn(
                  "text-xs px-2.5 py-1 font-bold border rounded transition-colors whitespace-nowrap bg-white",
                  "disabled:opacity-40 disabled:cursor-not-allowed",
                  opt.className,
                )}
              >
                {opt.icon}
                {opt.label}
              </button>
            ))}
            {pending && <span className="text-[10px] text-zinc-400 ml-1">保存中…</span>}
          </div>
        </div>
      )}

      {/* ===== 選択の近道（返事待ちタブ・未選択のとき） ===== */}
      {bulk && selected.size === 0 && rows.length > 0 && (
        <div className="px-4 py-2 border-b border-zinc-100 flex items-center gap-3 flex-wrap text-[11px] text-zinc-500">
          <span>チェックを入れると、まとめて結果を入れられます。</span>
          {staleCount > 0 && (
            <button
              type="button"
              onClick={() => selectStale(7)}
              className="font-bold text-amber-700 hover:underline"
            >
              7日以上そのままの{staleCount}件を選ぶ
            </button>
          )}
          {notice && <span className="text-emerald-700 font-medium ml-auto">{notice}</span>}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 border-b border-zinc-200">
            <tr className="text-[11px] font-bold text-zinc-500">
              {bulk && (
                <th className="px-3 py-2.5 w-10">
                  <input
                    type="checkbox"
                    checked={allChecked}
                    onChange={toggleAll}
                    className="rounded border-zinc-300"
                    aria-label="表示中をすべて選択"
                  />
                </th>
              )}
              <th className="px-3 py-2.5 text-center whitespace-nowrap">経過</th>
              <th className="px-3 py-2.5 text-left">会社</th>
              <th className="px-3 py-2.5 text-left whitespace-nowrap">訴求</th>
              <th className="px-3 py-2.5 text-center whitespace-nowrap">送付</th>
              <th className="px-3 py-2.5 text-left whitespace-nowrap">送った人</th>
              <th className="px-3 py-2.5 text-left">結果</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {rows.map((row) => {
              const done = getOutreachResultOption(row.outreachResult);
              const checked = selected.has(row.id);
              return (
                <tr
                  key={row.id}
                  className={cn("hover:bg-zinc-50/60 align-top", checked && "bg-blue-50/40")}
                >
                  {bulk && (
                    <td className="px-3 py-3">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggle(row.id)}
                        className="rounded border-zinc-300"
                        aria-label={`${row.name}を選択`}
                      />
                    </td>
                  )}
                  <td className="px-3 py-3 text-center">
                    <span
                      className={`inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-bold border whitespace-nowrap ${elapsedClass(row.days)}`}
                    >
                      {row.days}日
                    </span>
                  </td>
                  <td className="px-3 py-3">
                    <div className="font-bold text-zinc-900">{row.name}</div>
                    <div className="text-[11px] text-zinc-500 mt-0.5">{row.meta || "—"}</div>
                    {row.websiteUrl && (
                      <a
                        href={row.websiteUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[11px] font-medium text-blue-600 hover:underline mt-0.5"
                      >
                        <ExternalLink className="w-3 h-3" />
                        サイト
                      </a>
                    )}
                  </td>
                  <td className="px-3 py-3 text-xs text-zinc-600 whitespace-nowrap">{row.appeal || "—"}</td>
                  <td className="px-3 py-3 text-center text-xs text-zinc-600 whitespace-nowrap">{row.sentDate}</td>
                  <td className="px-3 py-3 text-xs text-zinc-600 whitespace-nowrap">{row.staff}</td>
                  <td className="px-3 py-3">
                    <OutreachResultBar leadId={row.id} result={row.outreachResult} showLabel={false} />
                    {done && (
                      <p className="text-[10px] text-zinc-400 mt-1">
                        {row.resultDate} に記録／もう一度押すと取り消し
                      </p>
                    )}
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
