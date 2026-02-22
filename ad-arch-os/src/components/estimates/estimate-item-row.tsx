"use client";

import { useState, useRef, useEffect } from "react";
import { Trash2 } from "lucide-react";

export type TemplateOption = {
  id: string;
  category: string;
  name: string;
  unitPrice: number;
  unit: string;
  spec: string | null;
  costPrice: number | null;
};

export type ItemState = {
  _key: string;
  name: string;
  spec: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  costPrice: number | null;
  templateId: string | null;
};

interface Props {
  item: ItemState;
  templates: TemplateOption[];
  showCost: boolean;
  onChange: (updated: ItemState) => void;
  onRemove: () => void;
  isOnly: boolean;
}

const cellCls =
  "px-2 py-1.5 text-sm border border-zinc-200 rounded focus:outline-none focus:ring-2 " +
  "focus:ring-blue-400 focus:border-transparent bg-white text-zinc-800 w-full";

export function EstimationItemRow({ item, templates, showCost, onChange, onRemove, isOnly }: Props) {
  const [query, setQuery] = useState(item.name);
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLTableRowElement>(null);

  const amount = Math.round(item.quantity * item.unitPrice);
  const costTotal = item.costPrice !== null ? Math.round(item.quantity * item.costPrice) : null;
  const grossProfit = costTotal !== null ? amount - costTotal : null;
  const profitRate = amount > 0 && grossProfit !== null ? (grossProfit / amount) * 100 : null;

  // 外部クリックで候補を閉じる
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const filtered = query.trim()
    ? templates.filter(
        (t) =>
          t.name.includes(query) ||
          t.category.includes(query)
      )
    : templates;

  function selectTemplate(t: TemplateOption) {
    setQuery(t.name);
    setOpen(false);
    onChange({
      ...item,
      name: t.name,
      unitPrice: t.unitPrice,
      unit: t.unit,
      spec: t.spec ?? "",
      costPrice: t.costPrice,
      templateId: t.id,
    });
  }

  function handleNameChange(v: string) {
    setQuery(v);
    setOpen(true);
    onChange({ ...item, name: v, templateId: null });
  }

  return (
    <tr ref={wrapRef} className="border-b border-zinc-100 hover:bg-zinc-50/50">
      {/* 品目名 + オートコンプリート */}
      <td className="px-2 py-2 min-w-[180px] relative">
        <input
          value={query}
          onChange={(e) => handleNameChange(e.target.value)}
          onFocus={() => setOpen(true)}
          placeholder="例: プロデューサー費"
          className={cellCls}
          required
        />
        {open && filtered.length > 0 && (
          <ul className="absolute z-50 left-2 top-full mt-0.5 w-64 bg-white border border-zinc-200 rounded-lg shadow-lg overflow-hidden text-xs">
            {filtered.map((t) => (
              <li
                key={t.id}
                onMouseDown={() => selectTemplate(t)}
                className="px-3 py-2 hover:bg-blue-50 cursor-pointer border-b border-zinc-100 last:border-0"
              >
                <span className="text-[10px] text-zinc-400 mr-1">[{t.category}]</span>
                <span className="font-medium text-zinc-800">{t.name}</span>
                <span className="ml-2 text-zinc-500">¥{t.unitPrice.toLocaleString()}/{t.unit}</span>
              </li>
            ))}
          </ul>
        )}
      </td>

      {/* 仕様 */}
      <td className="px-2 py-2 min-w-[140px]">
        <input
          value={item.spec}
          onChange={(e) => onChange({ ...item, spec: e.target.value })}
          placeholder="仕様・備考"
          className={cellCls}
        />
      </td>

      {/* 数量 */}
      <td className="px-2 py-2 w-16">
        <input
          type="number"
          min={1}
          value={item.quantity}
          onChange={(e) => onChange({ ...item, quantity: Math.max(1, parseInt(e.target.value) || 1) })}
          className={`${cellCls} text-right`}
        />
      </td>

      {/* 単位 */}
      <td className="px-2 py-2 w-16">
        <input
          value={item.unit}
          onChange={(e) => onChange({ ...item, unit: e.target.value })}
          placeholder="日"
          className={cellCls}
        />
      </td>

      {/* 単価 */}
      <td className="px-2 py-2 w-28">
        <input
          type="number"
          min={0}
          value={item.unitPrice}
          onChange={(e) => onChange({ ...item, unitPrice: parseInt(e.target.value) || 0 })}
          className={`${cellCls} text-right tabular-nums`}
        />
      </td>

      {/* 金額（自動計算） */}
      <td className="px-2 py-2 w-28 text-right text-sm font-semibold text-zinc-800 tabular-nums">
        ¥{amount.toLocaleString()}
      </td>

      {/* 原価 + 粗利（スタッフ用） */}
      {showCost && (
        <>
          <td className="px-2 py-2 w-28">
            <input
              type="number"
              min={0}
              value={item.costPrice ?? ""}
              onChange={(e) =>
                onChange({
                  ...item,
                  costPrice: e.target.value === "" ? null : parseInt(e.target.value) || 0,
                })
              }
              placeholder="原価"
              className={`${cellCls} text-right tabular-nums`}
            />
          </td>
          <td className="px-2 py-2 w-24 text-right text-xs tabular-nums">
            {grossProfit !== null ? (
              <span className={grossProfit >= 0 ? "text-emerald-600 font-semibold" : "text-red-600 font-semibold"}>
                ¥{grossProfit.toLocaleString()}
                {profitRate !== null && (
                  <span className="ml-1 text-[10px] text-zinc-400">({profitRate.toFixed(0)}%)</span>
                )}
              </span>
            ) : (
              <span className="text-zinc-300">—</span>
            )}
          </td>
        </>
      )}

      {/* 削除ボタン */}
      <td className="px-2 py-2 w-10">
        <button
          type="button"
          onClick={onRemove}
          disabled={isOnly}
          className="flex items-center justify-center w-7 h-7 rounded text-zinc-400 hover:text-red-500 hover:bg-red-50 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </td>
    </tr>
  );
}
