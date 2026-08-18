"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import {
  BILLED_BY_LABEL,
  calcInclTax,
  sumByBilledBy,
  sumExclTax,
  type BilledBy,
} from "@/lib/constants/sales-report";

/** フォーム内で扱う明細行（金額は入力途中を許すため文字列で保持） */
export interface ItemRow {
  key: string;
  billedBy: BilledBy;
  clientName: string;
  projectName: string;
  amountExclTax: string;
  memo: string;
}

export interface ItemDefault {
  billedBy: BilledBy;
  clientName: string;
  projectName: string;
  amountExclTax: number;
  memo: string | null;
}

interface Props {
  /** 編集時の初期値 */
  defaultItems?: ItemDefault[];
}

let keySeq = 0;
function newRow(billedBy: BilledBy = "SELF"): ItemRow {
  keySeq += 1;
  return {
    key: `row-${keySeq}`,
    billedBy,
    clientName: "",
    projectName: "",
    amountExclTax: "",
    memo: "",
  };
}

function fmt(n: number): string {
  return `¥${n.toLocaleString("ja-JP")}`;
}

/** 数値化（空・不正は 0 扱い。表示用の集計にのみ使う） */
function num(v: string): number {
  const n = Number(v.replace(/,/g, "").trim());
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

export function RevenueItemEditor({ defaultItems }: Props) {
  const [rows, setRows] = useState<ItemRow[]>(() => {
    if (defaultItems && defaultItems.length > 0) {
      return defaultItems.map((d) => {
        keySeq += 1;
        return {
          key: `row-${keySeq}`,
          billedBy: d.billedBy,
          clientName: d.clientName,
          projectName: d.projectName,
          amountExclTax: String(d.amountExclTax),
          memo: d.memo ?? "",
        };
      });
    }
    return [newRow("SELF")];
  });

  function update(key: string, patch: Partial<ItemRow>) {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  function addRow(billedBy: BilledBy) {
    setRows((prev) => [...prev, newRow(billedBy)]);
  }

  function removeRow(key: string) {
    setRows((prev) => (prev.length === 1 ? [newRow(prev[0].billedBy)] : prev.filter((r) => r.key !== key)));
  }

  // ── 集計（税抜ベース。税込は 10% 自動計算）──
  const asInput = rows.map((r) => ({
    billedBy: r.billedBy,
    clientName: r.clientName,
    projectName: r.projectName,
    amountExclTax: num(r.amountExclTax),
    memo: r.memo,
  }));
  const selfTotal = sumByBilledBy(asInput, "SELF");
  const hqTotal = sumByBilledBy(asInput, "HQ");
  const total = sumExclTax(asInput);
  // 税は行ごとに丸めて保存するため、税込合計も行の積み上げで出す
  const totalInclTax = asInput.reduce((sum, i) => sum + calcInclTax(i.amountExclTax), 0);

  // サーバーアクションへは JSON 1本で渡す
  const payload = JSON.stringify(
    rows.map((r) => ({
      billedBy: r.billedBy,
      clientName: r.clientName.trim(),
      projectName: r.projectName.trim(),
      amountExclTax: r.amountExclTax.replace(/,/g, "").trim(),
      memo: r.memo.trim(),
    }))
  );

  return (
    <div className="space-y-3">
      <input type="hidden" name="items" value={payload} />

      <div className="space-y-3">
        {rows.map((row, i) => {
          const excl = num(row.amountExclTax);
          const incl = calcInclTax(excl);
          const isHq = row.billedBy === "HQ";

          return (
            <div
              key={row.key}
              className={`rounded-xl border p-4 space-y-3 ${
                isHq ? "border-violet-200 bg-violet-50/40" : "border-zinc-200 bg-white"
              }`}
            >
              {/* 行ヘッダー: 請求元 + 削除 */}
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-semibold text-zinc-400 tabular-nums">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <div className="inline-flex rounded-lg border border-zinc-200 bg-white overflow-hidden">
                    {(["SELF", "HQ"] as BilledBy[]).map((b) => (
                      <button
                        key={b}
                        type="button"
                        onClick={() => update(row.key, { billedBy: b })}
                        className={`px-3 py-1 text-[11px] font-medium transition-colors ${
                          row.billedBy === b
                            ? b === "HQ"
                              ? "bg-violet-600 text-white"
                              : "bg-blue-600 text-white"
                            : "text-zinc-500 hover:bg-zinc-50"
                        }`}
                      >
                        {BILLED_BY_LABEL[b]}
                      </button>
                    ))}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => removeRow(row.key)}
                  className="inline-flex items-center gap-1 px-2 py-1 text-[11px] text-zinc-400
                             hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                >
                  <Trash2 className="w-3 h-3" />
                  削除
                </button>
              </div>

              {/* クライアント名 / 案件名 */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-zinc-600 mb-1">
                    クライアント名<span className="text-red-500 ml-0.5">*</span>
                  </label>
                  <input
                    type="text"
                    value={row.clientName}
                    onChange={(e) => update(row.key, { clientName: e.target.value })}
                    placeholder="例: ○○株式会社"
                    maxLength={200}
                    className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg
                               focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-400
                               bg-white text-zinc-900"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-zinc-600 mb-1">
                    案件名<span className="text-red-500 ml-0.5">*</span>
                  </label>
                  <input
                    type="text"
                    value={row.projectName}
                    onChange={(e) => update(row.key, { projectName: e.target.value })}
                    placeholder="例: 会社紹介動画 制作"
                    maxLength={200}
                    className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg
                               focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-400
                               bg-white text-zinc-900"
                  />
                </div>
              </div>

              {/* 金額（税抜入力 → 税込自動計算） */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-zinc-600 mb-1">
                    価格（税抜）<span className="text-red-500 ml-0.5">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 text-sm">¥</span>
                    <input
                      type="number"
                      min={0}
                      step={1}
                      value={row.amountExclTax}
                      onChange={(e) => update(row.key, { amountExclTax: e.target.value })}
                      placeholder="0"
                      className="w-full pl-7 pr-3 py-2 text-sm border border-zinc-200 rounded-lg
                                 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-400
                                 bg-white text-zinc-900"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-zinc-600 mb-1">
                    価格（税込・自動計算）
                  </label>
                  <div className="w-full px-3 py-2 text-sm border border-zinc-100 rounded-lg
                                  bg-zinc-50 text-zinc-700 tabular-nums">
                    {fmt(incl)}
                    <span className="ml-2 text-[11px] text-zinc-400">消費税 {fmt(incl - excl)}</span>
                  </div>
                </div>
              </div>

              {/* 備考 */}
              <div>
                <label className="block text-[11px] font-semibold text-zinc-600 mb-1">備考</label>
                <input
                  type="text"
                  value={row.memo}
                  onChange={(e) => update(row.key, { memo: e.target.value })}
                  placeholder="例: 媒体費込み / 分割請求の1回目 など"
                  maxLength={1000}
                  className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg
                             focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-400
                             bg-white text-zinc-900"
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* 行追加 */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => addRow("SELF")}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium
                     border border-blue-200 text-blue-700 bg-blue-50 rounded-lg
                     hover:bg-blue-100 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          自分で請求した案件を追加
        </button>
        <button
          type="button"
          onClick={() => addRow("HQ")}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium
                     border border-violet-200 text-violet-700 bg-violet-50 rounded-lg
                     hover:bg-violet-100 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          本部から請求した案件を追加
        </button>
      </div>

      {/* 合計 */}
      <div className="rounded-xl border border-zinc-200 bg-zinc-50/60 px-5 py-4 space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="text-zinc-500">自分で請求（税抜）</span>
          <span className="font-semibold text-blue-700 tabular-nums">{fmt(selfTotal)}</span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-zinc-500">本部から請求（税抜）</span>
          <span className="font-semibold text-violet-700 tabular-nums">{fmt(hqTotal)}</span>
        </div>
        <div className="pt-2 border-t border-zinc-200 flex items-center justify-between">
          <span className="text-xs font-semibold text-zinc-600">今月の売上合計</span>
          <div className="text-right">
            <p className="text-xl font-bold text-zinc-900 tabular-nums leading-tight">
              {fmt(total)}
              <span className="text-[11px] font-normal text-zinc-400 ml-1">税抜</span>
            </p>
            <p className="text-[11px] text-zinc-500 tabular-nums">
              税込 {fmt(totalInclTax)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
