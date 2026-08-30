"use client";

import { useActionState, useMemo, useState } from "react";
import { Loader2, Search, X } from "lucide-react";
import { PREFECTURES, SELECTABLE_MUNICIPALITIES } from "@/data/tver-municipalities";
import { AD_SECONDS_OPTIONS, INDUSTRY_SUGGESTIONS } from "@/lib/constants/tver-flyer";

interface Props {
  action: (prev: { error?: string } | null, formData: FormData) => Promise<{ error?: string }>;
  /** 依頼者の拠点に対応する都道府県コードがあれば初期選択にする */
  defaultPrefCode?: string;
}

const inputCls =
  "w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg " +
  "focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-400 bg-white text-zinc-900";

export function FlyerRequestForm({ action, defaultPrefCode }: Props) {
  const [state, formAction, isPending] = useActionState(action, null);
  const [prefCode, setPrefCode] = useState(defaultPrefCode ?? "");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const municipalities = useMemo(
    () => SELECTABLE_MUNICIPALITIES.filter((m) => m.prefCode === prefCode),
    [prefCode]
  );
  const visible = useMemo(() => {
    const q = query.trim();
    return q ? municipalities.filter((m) => m.name.includes(q)) : municipalities;
  }, [municipalities, query]);

  const selectedList = municipalities.filter((m) => selected.has(m.code));
  const selectedPop = selectedList.reduce((a, m) => a + m.population, 0);

  function toggle(code: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  }
  function changePref(code: string) {
    setPrefCode(code);
    setSelected(new Set());
    setQuery("");
  }

  return (
    <form action={formAction} className="space-y-6">
      {state?.error && (
        <div className="px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">{state.error}</div>
      )}

      {/* ── 商圏 ── */}
      <div>
        <label className="block text-xs font-semibold text-zinc-700 mb-1.5">
          商圏（都道府県 → 市区町村）<span className="text-red-500 ml-0.5">*</span>
        </label>
        <p className="text-[11px] text-zinc-500 mb-2">
          クライアントの営業圏をそのまま選んでください。複数の市町村にまたがる場合はまとめて選ぶと合算した1枚になります。
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-[180px_1fr] gap-3">
          <select value={prefCode} onChange={(e) => changePref(e.target.value)} className={inputCls}>
            <option value="">— 都道府県 —</option>
            {PREFECTURES.map((p) => (
              <option key={p.code} value={p.code}>{p.name}</option>
            ))}
          </select>
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text" value={query} onChange={(e) => setQuery(e.target.value)}
              placeholder={prefCode ? "市区町村名で絞り込み" : "先に都道府県を選択"}
              disabled={!prefCode}
              className={`${inputCls} pl-8 disabled:bg-zinc-50`}
            />
          </div>
        </div>

        {prefCode && (
          <div className="mt-3 border border-zinc-200 rounded-lg bg-zinc-50 p-3 max-h-64 overflow-y-auto">
            <div className="flex flex-wrap gap-1.5">
              {visible.map((m) => {
                const on = selected.has(m.code);
                return (
                  <button
                    type="button" key={m.code} onClick={() => toggle(m.code)}
                    className={`px-2.5 py-1 rounded-md text-[11px] border transition-colors ${
                      on
                        ? "bg-blue-50 border-blue-300 text-blue-700 font-semibold"
                        : "bg-white border-zinc-200 text-zinc-600 hover:border-zinc-300"
                    }`}
                  >
                    {m.name}
                    <span className="ml-1 text-[10px] text-zinc-400">{(m.population / 10_000).toFixed(1)}万</span>
                  </button>
                );
              })}
              {visible.length === 0 && <p className="text-xs text-zinc-400">該当する市区町村がありません</p>}
            </div>
          </div>
        )}

        {selectedList.length > 0 && (
          <div className="mt-3 flex items-center gap-2 flex-wrap">
            {selectedList.map((m) => (
              <span key={m.code} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-600 text-white text-[11px]">
                {m.name}
                <button type="button" onClick={() => toggle(m.code)} aria-label="外す"><X className="w-3 h-3" /></button>
                <input type="hidden" name="codes" value={m.code} />
              </span>
            ))}
            <span className="text-[11px] text-zinc-500">
              {selectedList.length}件・合計人口 {selectedPop.toLocaleString("ja-JP")}人
            </span>
          </div>
        )}
      </div>

      {/* ── クライアント・業種 ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold text-zinc-700 mb-1.5">クライアント名（任意）</label>
          <input type="text" name="clientName" placeholder="例: 株式会社◯◯" className={inputCls} />
          <p className="text-[11px] text-zinc-400 mt-1">入れるとチラシに「◯◯ 御中」が入ります</p>
        </div>
        <div>
          <label className="block text-xs font-semibold text-zinc-700 mb-1.5">業種（任意）</label>
          <input type="text" name="industry" list="industry-list" placeholder="例: リフォーム・建設" className={inputCls} />
          <datalist id="industry-list">
            {INDUSTRY_SUGGESTIONS.map((i) => <option key={i} value={i} />)}
          </datalist>
          <p className="text-[11px] text-zinc-400 mt-1">業種に合わせた一言を本部が入れます</p>
        </div>
      </div>

      {/* ── 秒数・予算 ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold text-zinc-700 mb-1.5">CM秒数</label>
          <select name="adSeconds" defaultValue={15} className={inputCls}>
            {AD_SECONDS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-zinc-700 mb-1.5">クライアントの予算（任意・万円）</label>
          <div className="relative">
            <input type="text" name="budgetMan" inputMode="numeric" placeholder="例: 50" className={`${inputCls} pr-10`} />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-400">万円</span>
          </div>
          <p className="text-[11px] text-zinc-400 mt-1">入れると「その予算で商圏の何%に届くか」を主役にした1枚になります</p>
        </div>
      </div>

      {/* ── メモ ── */}
      <div>
        <label className="block text-xs font-semibold text-zinc-700 mb-1.5">本部への申し送り（任意）</label>
        <textarea
          name="note" rows={3}
          placeholder="例: 来週の商談で使います／店舗が2市にまたがるので合算で／競合が地元TVでCMを流しています"
          className={`${inputCls} resize-y`}
        />
      </div>

      <div className="flex items-center justify-between pt-2">
        <p className="text-[11px] text-zinc-500">本部が数値を確認し、通常1〜2営業日で納品します。</p>
        <button
          type="submit" disabled={isPending || selected.size === 0}
          className="inline-flex items-center gap-1.5 px-5 py-2 bg-blue-600 text-white text-sm font-semibold
                     rounded-lg hover:bg-blue-700 disabled:opacity-60 transition-colors"
        >
          {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
          本部に依頼する
        </button>
      </div>
    </form>
  );
}
