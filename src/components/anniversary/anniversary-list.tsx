"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ExcludeLeadButton } from "@/components/anniversary/exclude-lead-button";

/** 周年ファインダーの1行分。サーバー側で計算・整形済みの素の値だけを受け取る。 */
export interface AnniversaryRow {
  id: string;
  name: string;
  area: string | null;
  industry: string | null;
  employeeCount: number | null;
  foundedYear: number;
  foundedMonth: number | null;
  foundedRaw: string | null;
  foundedSourceUrl: string | null;
  pressReleaseUrl: string | null;
  websiteUrl: string | null;
  phone: string | null;
  email: string | null;
  /** メール取得を試した時刻。値があって email が null なら「探したが記載なし」 */
  emailCheckedAt: string | null;
  address: string | null;
  isAnnivSignal: boolean;
  /** 画面に出す周年の表記（例「2026年10月に50周年」） */
  annivLabel: string;
  annivYears: number;
  annivOnYear: number;
  annivOnMonth: number | null;
  isMilestone: boolean;
}

// 見出しはリード管理のCSVインポートがそのまま読める名前に揃えている
// （会社名／電話番号／WebサイトURL／エリア）。名前を変えると取り込みで落ちる。
const CSV_COLUMNS: { header: string; pick: (r: AnniversaryRow) => string | number | null }[] = [
  { header: "会社名", pick: (r) => r.name },
  { header: "周年", pick: (r) => `${r.annivYears}周年` },
  { header: "迎える年", pick: (r) => r.annivOnYear },
  { header: "迎える月", pick: (r) => r.annivOnMonth },
  { header: "節目", pick: (r) => (r.isMilestone ? "◎" : "○") },
  { header: "エリア", pick: (r) => r.area },
  { header: "住所", pick: (r) => r.address },
  { header: "業種", pick: (r) => r.industry },
  { header: "従業員数", pick: (r) => r.employeeCount },
  { header: "電話番号", pick: (r) => r.phone },
  { header: "メール", pick: (r) => r.email },
  { header: "WebサイトURL", pick: (r) => r.websiteUrl },
  { header: "設立年", pick: (r) => r.foundedYear },
  { header: "設立月", pick: (r) => r.foundedMonth },
  { header: "設立の原文", pick: (r) => r.foundedRaw },
  { header: "出典URL", pick: (r) => r.foundedSourceUrl },
  { header: "リリースURL", pick: (r) => r.pressReleaseUrl },
  { header: "周年を自社発信中", pick: (r) => (r.isAnnivSignal ? "はい" : "") },
];

function csvCell(v: string | number | null): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** 選んだ行をCSVにしてダウンロード。Excelで文字化けしないようBOM付きUTF-8。 */
function downloadCsv(rows: AnniversaryRow[]) {
  const lines = [
    CSV_COLUMNS.map((c) => csvCell(c.header)).join(","),
    ...rows.map((r) => CSV_COLUMNS.map((c) => csvCell(c.pick(r))).join(",")),
  ];
  const blob = new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const d = new Date();
  const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  const a = document.createElement("a");
  a.href = url;
  a.download = `周年リスト_${stamp}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function AnniversaryList({ rows }: { rows: AnniversaryRow[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const allIds = useMemo(() => rows.map((r) => r.id), [rows]);
  const allChecked = rows.length > 0 && allIds.every((id) => selected.has(id));
  const count = selected.size;

  // アウトリーチ（メール送付）に進める会社と、メールアドレスが未取得の会社を仕分ける
  const selectedRows = rows.filter((r) => selected.has(r.id));
  const emailIds = selectedRows.filter((r) => r.email).map((r) => r.id);
  const missingRows = selectedRows.filter((r) => !r.email);
  const notCheckedCount = missingRows.filter((r) => !r.emailCheckedAt).length;
  const checkedNoneCount = missingRows.length - notCheckedCount;

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

  function exportSelected() {
    const picked = rows.filter((r) => selected.has(r.id));
    if (picked.length === 0) return;
    downloadCsv(picked);
  }

  return (
    <div className="space-y-3">
      {/* ── 選択バー */}
      {/* アウトリーチ（メール送付）はメールアドレスがある会社しか対象にできない。
          未取得が混ざっていたら黙って落とさず、選択バーの下に警告を出す。 */}
      <div className="sticky top-0 z-10 rounded-xl border border-zinc-200 bg-white/95 backdrop-blur">
      <div className="flex flex-wrap items-center gap-3 px-4 py-2.5">
        <label className="flex items-center gap-2 text-xs text-zinc-700">
          <input
            type="checkbox"
            checked={allChecked}
            onChange={toggleAll}
            className="h-4 w-4 rounded border-zinc-300"
          />
          表示中の全件を選ぶ（{rows.length}件）
        </label>
        <span className="text-xs text-zinc-500">選択中 {count}件</span>
        <div className="ml-auto flex items-center gap-2">
          {count > 0 && (
            <button
              type="button"
              onClick={() => setSelected(new Set())}
              className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs text-zinc-600 hover:bg-zinc-50"
            >
              選択を解除
            </button>
          )}
          {/* 営業フォームへ（選択した会社をアウトリーチに投入） */}
          <button
            type="button"
            onClick={() =>
              router.push(`/dashboard/leads/outreach?ids=${Array.from(selected).join(",")}`)
            }
            disabled={count === 0}
            className="rounded-lg bg-[#1F3A5F] px-4 py-1.5 text-xs font-bold text-white hover:bg-[#16304f] disabled:opacity-40 disabled:cursor-not-allowed"
          >
            営業フォームへ{count > 0 ? `（${count}件）` : ""}
          </button>
          {/* メール送付（メールアドレスがある選択リードだけをアウトリーチに投入） */}
          <button
            type="button"
            onClick={() =>
              router.push(`/dashboard/leads/outreach?ids=${emailIds.join(",")}`)
            }
            disabled={emailIds.length === 0}
            title={
              emailIds.length === 0
                ? "選択中にメールアドレスのある会社がありません"
                : "メールアドレスのある会社をアウトリーチ画面に送ります。件名・本文入りのメール下書きをそのまま開けます"
            }
            className="rounded-lg bg-blue-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            メール送付へ{emailIds.length > 0 ? `（${emailIds.length}件）` : ""}
          </button>
          <button
            type="button"
            onClick={exportSelected}
            disabled={count === 0}
            className="rounded-lg bg-zinc-900 px-4 py-1.5 text-xs font-medium text-white hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            CSV書き出し{count > 0 ? `（${count}件）` : ""}
          </button>
        </div>
      </div>

      {/* アウトリーチ前の警告（メールアドレスが無い会社が選択に含まれるときだけ出す） */}
      {missingRows.length > 0 && (
        <div className="px-4 pb-2.5">
          <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2">
            <span className="text-amber-600 text-sm leading-none mt-0.5">⚠</span>
            <div className="text-xs text-amber-900 leading-relaxed">
              {emailIds.length === 0 ? (
                <p className="font-bold">
                  選択した{count}件はすべてメールアドレスが未取得です。このままではアウトリーチ（メール送付）に進めません。
                </p>
              ) : (
                <p className="font-bold">
                  選択{count}件のうち{missingRows.length}件はメールアドレスが未取得です。このままメール送付へ進むと、メールがある{emailIds.length}件だけが対象になります。
                </p>
              )}
              <p className="mt-1">
                <Link href="/dashboard/leads/list" className="font-bold underline underline-offset-2">リード管理</Link>
                で該当の会社を選び「メールを取得」を押したうえで、各行のメール欄にアドレスが入っているかご確認ください。
                {checkedNoneCount > 0 && (
                  <>
                    {" "}
                    未取得{missingRows.length}件の内訳は、未取得{notCheckedCount}件／取得済みだがサイトに記載なし{checkedNoneCount}件です（記載なしの会社はフォームまたは電話でのご連絡になります）。
                  </>
                )}
              </p>
            </div>
          </div>
        </div>
      )}
      </div>

      {/* ── 一覧 */}
      <ul className="space-y-3">
        {rows.map((r) => {
          const checked = selected.has(r.id);
          return (
            <li
              key={r.id}
              className={`rounded-xl border bg-white p-4 transition-colors ${
                checked ? "border-zinc-900 ring-1 ring-zinc-900/10" : "border-zinc-200 hover:border-zinc-300"
              }`}
            >
              <div className="flex flex-wrap items-start gap-3">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggle(r.id)}
                  aria-label={`${r.name} を選ぶ`}
                  className="mt-1 h-4 w-4 shrink-0 rounded border-zinc-300"
                />
                <span
                  className={`shrink-0 rounded-lg px-2 py-1 text-xs font-bold ${
                    r.isMilestone ? "bg-rose-600 text-white" : "bg-zinc-100 text-zinc-600"
                  }`}
                >
                  {r.isMilestone ? "◎ 節目" : "○"}
                </span>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-zinc-900 truncate">{r.name}</p>
                    <span className="rounded-md bg-rose-50 px-2 py-0.5 text-xs font-semibold text-rose-700">
                      {r.annivLabel}
                    </span>
                    {r.isAnnivSignal && (
                      <span className="rounded-md bg-amber-50 px-2 py-0.5 text-xs text-amber-700">
                        周年を自社発信中
                      </span>
                    )}
                  </div>

                  <p className="mt-1 text-xs text-zinc-500">
                    {[r.area, r.industry, r.employeeCount ? `従業員${r.employeeCount}名` : null]
                      .filter(Boolean)
                      .join(" / ") || "—"}
                  </p>

                  <p className="mt-1 text-xs text-zinc-600">
                    設立: {r.foundedYear}年
                    {r.foundedMonth ? `${r.foundedMonth}月` : "（月は記載なし）"}
                    {r.foundedRaw && <span className="text-zinc-400">　原文「{r.foundedRaw}」</span>}
                  </p>
                </div>

                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  {r.foundedSourceUrl && (
                    <a
                      href={r.foundedSourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs text-zinc-600 hover:bg-zinc-50"
                    >
                      出典を見る
                    </a>
                  )}
                  {r.pressReleaseUrl && r.pressReleaseUrl !== r.foundedSourceUrl && (
                    <a
                      href={r.pressReleaseUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs text-zinc-600 hover:bg-zinc-50"
                    >
                      リリース
                    </a>
                  )}
                  <Link
                    href={`/dashboard/leads/list?q=${encodeURIComponent(r.name)}`}
                    className="rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-800"
                  >
                    リードを開く
                  </Link>
                  <ExcludeLeadButton leadId={r.id} leadName={r.name} />
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
