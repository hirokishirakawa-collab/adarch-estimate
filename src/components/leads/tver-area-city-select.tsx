"use client";

// ==============================================================
// 市区町村（TVer配信エリア）セレクト — リード獲得AIの3フォーム共用
//   自由入力だった市区町村を、TVer広告の配信エリア指定と同じ市区町村マスター
//   （src/data/tver-municipalities・小口申込 /order/tver と同じ正本）からの選択にする。
//   狙い＝リードを取る市と、TVerを売る市を最初から揃える（主力は市単位・2026-08-10）。
//   ・政令市は「○○市（全区）」を先頭に置く。送る値は検索に使う地名（「札幌市」）
//   ・人口順。人口を添えて「どの市が大きいか」を選びながら見られるようにする
//   ・都道府県が未選択のときは無効。任意項目なので空も可
// ==============================================================

import { useMemo } from "react";
import { municipalitiesOf } from "@/lib/packages/tver-area";

const fmtPop = (n: number) => (n >= 10_000 ? `${Math.round(n / 10_000)}万人` : `${n.toLocaleString()}人`);

export function TverAreaCitySelect({
  prefecture,
  value,
  onChange,
  name = "city",
  focusClass = "focus:ring-blue-500",
}: {
  prefecture: string;
  value: string;
  onChange: (v: string) => void;
  name?: string;
  focusClass?: string;
}) {
  const options = useMemo(() => {
    if (!prefecture) return [];
    return municipalitiesOf(prefecture).map((m) => ({
      // 「○○市（全区）」は検索語として「○○市」を送る
      value: m.code.startsWith("group:") ? m.code.slice("group:".length) : m.name,
      label: `${m.name}（${fmtPop(m.population)}）`,
    }));
  }, [prefecture]);

  return (
    <div>
      <label className="block text-xs font-medium text-zinc-700 mb-1">
        市区町村（TVer配信エリア・任意）
      </label>
      <select
        name={name}
        value={value}
        disabled={!prefecture}
        onChange={(e) => onChange(e.target.value)}
        className={`w-full h-9 px-3 rounded-md border border-zinc-300 bg-white text-sm focus:outline-none focus:ring-2 ${focusClass} disabled:bg-zinc-50 disabled:text-zinc-400`}
      >
        <option value="">{prefecture ? "県全体（絞らない）" : "先に都道府県を選択"}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <p className="mt-1 text-[11px] text-zinc-500">TVer広告のエリア指定と同じ区分です。人口順</p>
    </div>
  );
}
