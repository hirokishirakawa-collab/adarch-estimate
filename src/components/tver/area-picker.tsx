"use client";

// 商圏（市区町村）の複数選択。レポート全体／広告グループ別の両方で使う共通部品
//   ・チェックで複数選択（人口は合算）
//   ・TVer管理画面の「地域」からコピーした文字列を貼ると一括で選べる
//   ・選択は checkbox の name/value でそのまま form に乗る

import { useMemo, useRef, useState } from "react";
import { matchAreaKeysFromText } from "@/lib/tver/report-area";

export type AreaOption = { key: string; label: string; population: number };

const num = (n: number) => n.toLocaleString("ja-JP");

export function AreaPicker({
  name,
  options,
  initial,
  touchedName,
}: {
  name: string;
  options: AreaOption[];
  initial: string[];
  /** 指定すると「触ったかどうか」を hidden で送る（未操作なら保存側で商圏を変えない） */
  touchedName?: string;
}) {
  const [sel, setSel] = useState<Set<string>>(new Set(initial));
  const [q, setQ] = useState("");
  const [touched, setTouched] = useState(false);
  const [paste, setPaste] = useState("");
  const [pasteMsg, setPasteMsg] = useState<{ ok: string; ng: string[] } | null>(null);
  const pasteRef = useRef<HTMLTextAreaElement>(null);

  const shown = useMemo(() => (q ? options.filter((o) => o.label.includes(q)) : options), [options, q]);
  const selected = useMemo(() => options.filter((o) => sel.has(o.key)), [options, sel]);
  const total = selected.reduce((a, o) => a + o.population, 0);

  const change = (fn: (s: Set<string>) => Set<string>) => {
    setTouched(true);
    setSel((s) => fn(new Set(s)));
  };

  const applyPaste = (text = paste) => {
    const r = matchAreaKeysFromText(options, text);
    if (r.keys.length === 0) {
      setPasteMsg({ ok: "", ng: r.unmatched.length ? r.unmatched : ["市区町村名が見つかりませんでした"] });
      return;
    }
    setTouched(true);
    setSel(new Set(r.keys)); // 貼り付け＝置き換え（TVerの地域欄をそのまま写す）
    setPasteMsg({ ok: `${r.keys.length}件を選びました`, ng: r.unmatched });
    setPaste("");
  };

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-2 w-full">
      {touchedName && <input type="hidden" name={touchedName} value={touched ? "1" : ""} />}

      {/* 貼り付けで一括選択 */}
      <div className="flex items-start gap-2 mb-2">
        <textarea
          ref={pasteRef}
          value={paste}
          onChange={(e) => setPaste(e.target.value)}
          onPaste={(e) => {
            const t = e.clipboardData.getData("text");
            if (!t.trim()) return;
            e.preventDefault();
            setPaste(t);
            applyPaste(t); // 貼った時点で反映（ボタンは貼り直し・手入力用）
          }}
          rows={2}
          placeholder="TVerの「地域」をコピーしてここに貼り付け（例: 山口県 宇部市 ✕ 山口県 萩市 ✕ …）＝貼った時点で反映します"
          className="flex-1 rounded-md border border-zinc-300 px-2 py-1 text-xs bg-white resize-y"
        />
        <button
          type="button"
          onClick={() => applyPaste()}
          disabled={!paste.trim()}
          className="px-2.5 py-1.5 rounded-md bg-zinc-900 text-white text-xs whitespace-nowrap disabled:opacity-40"
        >
          貼り付けから選ぶ
        </button>
      </div>
      {pasteMsg && (
        <div className="mb-2 text-[11px]">
          {pasteMsg.ok && <span className="text-emerald-700">✓ {pasteMsg.ok}（今の選択を置き換えました）</span>}
          {pasteMsg.ng.length > 0 && (
            <span className="text-orange-700 ml-2">一致しなかった語: {pasteMsg.ng.slice(0, 12).join(" / ")}{pasteMsg.ng.length > 12 ? ` ほか${pasteMsg.ng.length - 12}件` : ""}</span>
          )}
        </div>
      )}

      {/* 選択中 */}
      <div className="flex items-center gap-2 mb-1 flex-wrap">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="市区町村名で絞る" className="w-56 rounded-md border border-zinc-300 px-2 py-1 text-xs bg-white" />
        <span className="text-[11px] text-zinc-600 whitespace-nowrap">{sel.size}件・{num(total)}人</span>
        {sel.size > 0 && <button type="button" onClick={() => change(() => new Set())} className="text-[11px] text-zinc-500 underline">選択を解除</button>}
      </div>
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {selected.map((o) => (
            <button
              key={o.key}
              type="button"
              onClick={() => change((s) => { s.delete(o.key); return s; })}
              className="inline-flex items-center gap-1 rounded-md bg-zinc-100 hover:bg-zinc-200 px-1.5 py-0.5 text-[11px] text-zinc-700"
              title="外す"
            >
              {o.label}<span className="text-zinc-400">✕</span>
            </button>
          ))}
        </div>
      )}

      {/* チェック一覧 */}
      <div className="max-h-48 overflow-y-auto grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-3 gap-y-0.5">
        {shown.map((o) => (
          <label key={o.key} className="flex items-center gap-2 text-xs text-zinc-800 px-1 py-0.5 rounded hover:bg-zinc-50 cursor-pointer">
            <input
              type="checkbox"
              name={name}
              value={o.key}
              checked={sel.has(o.key)}
              onChange={() => change((s) => { if (s.has(o.key)) s.delete(o.key); else s.add(o.key); return s; })}
            />
            <span className="flex-1">{o.label}</span>
            <span className="text-zinc-400 tabular-nums">{num(o.population)}</span>
          </label>
        ))}
        {shown.length === 0 && <span className="text-xs text-zinc-400 col-span-full py-1">該当なし</span>}
      </div>
    </div>
  );
}
