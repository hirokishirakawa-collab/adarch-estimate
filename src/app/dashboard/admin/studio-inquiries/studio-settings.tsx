"use client";

// Ad Arch Studio の設定（本部）: 県の担当表／公開MCPに出すもの

import { useState, useTransition } from "react";
import { PREFECTURES } from "@/lib/constants/crm";
import { addStudioAssignment, deleteStudioAssignment, setStudioAssignmentActive, setStudioPublished } from "@/lib/actions/studio-inquiries";

type Opt = { id: string; label: string };
type Assignment = { id: string; prefecture: string; company: string; active: boolean; lastAssignedAt: string | null };
type PubType = "PACKAGE" | "KNOWLEDGE" | "WIKI" | "SPEC";

export function StudioSettings(props: {
  assignments: Assignment[];
  companies: Opt[];
  packages: Opt[];
  knowledge: Opt[];
  specs: Opt[];
  wikis: Opt[];
  published: Record<PubType, string[]>;
}) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [pref, setPref] = useState("");
  const [company, setCompany] = useState("");
  const run = (fn: () => Promise<{ error?: string; message?: string }>) =>
    start(async () => {
      const r = await fn();
      setMsg(r.error ?? r.message ?? "保存しました");
    });

  return (
    <div className="mt-8 grid gap-6 lg:grid-cols-2">
      <section className="bg-white border border-zinc-200 rounded-xl p-4">
        <h2 className="text-sm font-semibold text-zinc-900">県の担当表</h2>
        <p className="text-xs text-zinc-500 mt-1">撮影地（無ければ会社の所在地）の県で振り分けます。2社いる県は順番に回します。担当がいない県は本部の一覧に入ります。外には社名を出しません。</p>
        <div className="flex flex-wrap gap-2 mt-3 text-sm">
          <select value={pref} onChange={(e) => setPref(e.target.value)} className="border border-zinc-200 rounded-lg px-2 py-1.5 bg-white">
            <option value="">都道府県</option>
            {(PREFECTURES as readonly string[]).filter((p) => p !== "海外").map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
          <select value={company} onChange={(e) => setCompany(e.target.value)} className="border border-zinc-200 rounded-lg px-2 py-1.5 bg-white max-w-xs">
            <option value="">県本部</option>
            {props.companies.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
          <button type="button" disabled={pending || !pref || !company} className="px-3 py-1.5 rounded-lg bg-zinc-900 text-white disabled:opacity-40" onClick={() => run(() => addStudioAssignment(pref, company))}>
            追加
          </button>
        </div>
        <table className="w-full text-sm mt-3">
          <thead className="text-xs text-zinc-500">
            <tr><th className="text-left py-1">県</th><th className="text-left py-1">県本部</th><th className="text-left py-1">最後に割り当て</th><th className="py-1" /></tr>
          </thead>
          <tbody>
            {props.assignments.length === 0 && <tr><td colSpan={4} className="py-4 text-center text-zinc-400">まだ登録がありません（全件が本部の一覧に入ります）</td></tr>}
            {props.assignments.map((a) => (
              <tr key={a.id} className={`border-t border-zinc-100 ${a.active ? "" : "text-zinc-400"}`}>
                <td className="py-1.5">{a.prefecture}</td>
                <td className="py-1.5">{a.company}</td>
                <td className="py-1.5 text-xs">{a.lastAssignedAt ? new Date(a.lastAssignedAt).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "—"}</td>
                <td className="py-1.5 text-right whitespace-nowrap">
                  <button type="button" disabled={pending} className="text-xs text-zinc-600 hover:underline mr-3" onClick={() => run(() => setStudioAssignmentActive(a.id, !a.active))}>{a.active ? "止める" : "再開"}</button>
                  <button type="button" disabled={pending} className="text-xs text-rose-700 hover:underline" onClick={() => confirm(`${a.prefecture} ${a.company} を担当表から外します。よろしいですか？`) && run(() => deleteStudioAssignment(a.id))}>外す</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="bg-white border border-zinc-200 rounded-xl p-4 space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-zinc-900">公開のAI窓口に出すもの</h2>
          <p className="text-xs text-zinc-500 mt-1">印を付けたものだけが外から見えます。金額は外に出しません（本文の金額・卸・原価・ロイヤリティ等の行は自動で落とします）。媒体の入稿仕様は、媒体社の資料も選べますが、外に出るのは取り込み時に整理した「仕様の要点」だけです。</p>
        </div>
        <PickList title="アドアーチができること（稼働中のパッケージ・金額は出ません）" type="PACKAGE" options={props.packages} initial={props.published.PACKAGE} pending={pending} run={run} />
        <PickList title="制作の技術：自社の資料" type="KNOWLEDGE" options={props.knowledge} initial={props.published.KNOWLEDGE} pending={pending} run={run} />
        <PickList title="制作の技術：Wiki記事" type="WIKI" options={props.wikis} initial={props.published.WIKI} pending={pending} run={run} />
        <PickList title="媒体の入稿仕様（資料ライブラリ）" type="SPEC" options={props.specs} initial={props.published.SPEC} pending={pending} run={run} />
        {msg && <p className="text-xs text-zinc-700">{msg}</p>}
      </section>
    </div>
  );
}

function PickList(props: { title: string; type: PubType; options: Opt[]; initial: string[]; pending: boolean; run: (fn: () => Promise<{ error?: string; message?: string }>) => void }) {
  const [sel, setSel] = useState<Set<string>>(new Set(props.initial));
  const [q, setQ] = useState("");
  const shown = props.options.filter((o) => !q || o.label.includes(q));
  return (
    <div>
      <div className="flex items-center gap-2">
        <h3 className="text-xs font-semibold text-zinc-700">{props.title}</h3>
        <span className="text-xs text-zinc-400">{sel.size}件を公開</span>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="絞り込み" className="ml-auto border border-zinc-200 rounded-md px-2 py-1 text-xs w-32" />
        <button type="button" disabled={props.pending} className="px-2.5 py-1 rounded-md bg-zinc-900 text-white text-xs disabled:opacity-40" onClick={() => props.run(() => setStudioPublished(props.type, [...sel]))}>
          保存
        </button>
      </div>
      <div className="mt-2 max-h-48 overflow-y-auto border border-zinc-100 rounded-lg divide-y divide-zinc-50">
        {shown.length === 0 && <p className="text-xs text-zinc-400 p-2">選べるものがありません</p>}
        {shown.map((o) => (
          <label key={o.id} className="flex items-center gap-2 px-2 py-1 text-xs text-zinc-700">
            <input type="checkbox" checked={sel.has(o.id)} onChange={() => setSel((s) => { const n = new Set(s); if (n.has(o.id)) n.delete(o.id); else n.add(o.id); return n; })} />
            {o.label}
          </label>
        ))}
      </div>
    </div>
  );
}
