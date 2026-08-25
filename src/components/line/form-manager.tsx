"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Trash2, ClipboardList } from "lucide-react";
import { saveLineForm, deleteLineForm } from "@/lib/actions/line";

const inputCls =
  "w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg bg-white text-zinc-900 " +
  "focus:outline-none focus:ring-2 focus:ring-emerald-300 focus:border-emerald-400";
const smallCls = "px-2 py-1 text-xs border border-zinc-200 rounded bg-white";

type Field = { key: string; label: string; type: string; required: boolean; options: string };
export type FormDef = {
  id: string;
  title: string;
  code: string;
  description: string | null;
  thankYouText: string | null;
  addTags: string[];
  isActive: boolean;
  responseCount: number;
  fields: { key: string; label: string; type: string; required: boolean; options?: string[] }[];
};

const TYPES = [
  ["text", "1行テキスト"],
  ["textarea", "複数行テキスト"],
  ["select", "選択（1つ）"],
  ["checkbox", "チェック（複数）"],
  ["date", "日付"],
  ["tel", "電話番号"],
  ["email", "メール"],
];

function FormEditor({ accountId, initial, tagNames, onClose }: { accountId: string; initial?: FormDef; tagNames: string[]; onClose: () => void }) {
  const router = useRouter();
  const [fields, setFields] = useState<Field[]>(
    initial?.fields.map((f) => ({ key: f.key, label: f.label, type: f.type, required: f.required, options: (f.options ?? []).join(", ") })) ?? [
      { key: "company", label: "会社名", type: "text", required: true, options: "" },
      { key: "name", label: "お名前", type: "text", required: true, options: "" },
    ],
  );
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function upd(i: number, patch: Partial<Field>) {
    setFields((p) => p.map((f, j) => (j === i ? { ...f, ...patch } : f)));
  }
  function submit(fd: FormData) {
    fd.set(
      "fields",
      JSON.stringify(
        fields.map((f, i) => ({
          key: (f.key || `q${i + 1}`).replace(/[^\w-]/g, "_"),
          label: f.label,
          type: f.type,
          required: f.required,
          options: f.options.split(/[,、]/).map((o) => o.trim()).filter(Boolean),
        })),
      ),
    );
    startTransition(async () => {
      const r = await saveLineForm(null, fd);
      if (r.error) {
        setError(r.error);
        return;
      }
      router.refresh();
      onClose();
    });
  }

  return (
    <form action={submit} className="border border-emerald-200 rounded-lg p-3 space-y-3">
      <input type="hidden" name="accountId" value={accountId} />
      {initial && <input type="hidden" name="id" value={initial.id} />}
      <div className="grid sm:grid-cols-2 gap-2">
        <input name="title" defaultValue={initial?.title ?? ""} placeholder="タイトル（例: ヒアリングシート）" className={inputCls} required />
        <input name="code" defaultValue={initial?.code ?? ""} placeholder="本文で使う名前（例: ヒアリング → {form:ヒアリング}）" className={inputCls} required />
      </div>
      <textarea name="description" rows={2} defaultValue={initial?.description ?? ""} placeholder="冒頭の説明（任意）" className={inputCls} />
      <div className="space-y-2">
        <p className="text-[11px] font-bold text-zinc-500">項目</p>
        {fields.map((f, i) => (
          <div key={i} className="flex items-center gap-2 flex-wrap bg-zinc-50/60 border border-zinc-200 rounded-lg p-2">
            <input value={f.label} onChange={(e) => upd(i, { label: e.target.value })} placeholder="項目名" className={`${smallCls} w-40`} />
            <select value={f.type} onChange={(e) => upd(i, { type: e.target.value })} className={smallCls}>
              {TYPES.map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
            {(f.type === "select" || f.type === "checkbox") && (
              <input value={f.options} onChange={(e) => upd(i, { options: e.target.value })} placeholder="選択肢（カンマ区切り）" className={`${smallCls} flex-1 min-w-40`} />
            )}
            <label className="text-[11px] text-zinc-600 flex items-center gap-1">
              <input type="checkbox" checked={f.required} onChange={(e) => upd(i, { required: e.target.checked })} />必須
            </label>
            <button type="button" onClick={() => setFields((p) => p.filter((_, j) => j !== i))} className="text-zinc-400 hover:text-red-600 ml-auto" disabled={fields.length === 1}>
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
        <button type="button" onClick={() => setFields((p) => [...p, { key: `q${p.length + 1}`, label: "", type: "text", required: false, options: "" }])} className="flex items-center gap-1 text-xs text-emerald-700 font-medium">
          <Plus className="w-3.5 h-3.5" />項目を足す
        </button>
      </div>
      <div className="grid sm:grid-cols-2 gap-2">
        <textarea name="thankYouText" rows={3} defaultValue={initial?.thankYouText ?? ""} placeholder="回答後にLINEへ送るお礼（任意・{name}可）" className={inputCls} />
        <div className="space-y-2">
          <input name="addTags" defaultValue={initial?.addTags.join(", ") ?? ""} placeholder="回答したら付けるタグ（カンマ区切り・任意）" className={inputCls} list="line-tag-names-form" />
          <datalist id="line-tag-names-form">{tagNames.map((t) => <option key={t} value={t} />)}</datalist>
          <label className="text-xs text-zinc-700 flex items-center gap-1.5">
            <input type="checkbox" name="isActive" value="on" defaultChecked={initial?.isActive ?? true} />
            受付中
          </label>
        </div>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onClose} className="px-3 py-1.5 text-xs rounded-lg border border-zinc-200">やめる</button>
        <button type="submit" disabled={isPending} className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold rounded-lg bg-emerald-600 text-white disabled:opacity-50">
          {isPending && <Loader2 className="w-3 h-3 animate-spin" />}保存
        </button>
      </div>
    </form>
  );
}

export function FormManager({ accountId, forms, tagNames }: { accountId: string; forms: FormDef[]; tagNames: string[] }) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <section className="bg-white rounded-xl border border-zinc-200 p-4 space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <p className="text-sm font-bold text-zinc-900 flex items-center gap-1.5"><ClipboardList className="w-4 h-4 text-emerald-700" />回答フォーム</p>
          <p className="text-[11px] text-zinc-400">
            本文に <code className="bg-zinc-100 rounded px-1">{"{form:名前}"}</code> と書くと相手ごとのURLに置き換わり、LINE内でそのまま開けます。誰の回答かは自動で紐づき、チャットと友だち画面に残ります。
          </p>
        </div>
        {!adding && (
          <button type="button" onClick={() => setAdding(true)} className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg bg-emerald-600 text-white hover:bg-emerald-700">
            <Plus className="w-3.5 h-3.5" />フォームを作る
          </button>
        )}
      </div>
      {adding && <FormEditor accountId={accountId} tagNames={tagNames} onClose={() => setAdding(false)} />}
      {forms.length === 0 ? (
        <p className="text-xs text-zinc-400">まだフォームはありません。</p>
      ) : (
        <ul className="divide-y divide-zinc-100">
          {forms.map((f) =>
            editing === f.id ? (
              <li key={f.id} className="py-2"><FormEditor accountId={accountId} initial={f} tagNames={tagNames} onClose={() => setEditing(null)} /></li>
            ) : (
              <li key={f.id} className="py-2 flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-zinc-800">
                    {f.title} <code className="ml-1 text-[10px] bg-zinc-100 rounded px-1 font-normal">{`{form:${f.code}}`}</code>
                    <span className={`ml-2 text-[10px] rounded px-1 ${f.isActive ? "bg-emerald-50 text-emerald-700" : "bg-zinc-100 text-zinc-500"}`}>{f.isActive ? "受付中" : "停止"}</span>
                  </p>
                  <p className="text-[11px] text-zinc-500">{f.fields.map((x) => x.label).join(" / ")}</p>
                </div>
                <span className="text-[11px] text-zinc-600 tabular-nums shrink-0">回答 {f.responseCount}件</span>
                <span className="flex items-center gap-1.5 shrink-0">
                  <button type="button" onClick={() => setEditing(f.id)} className="text-[11px] text-zinc-500 hover:text-zinc-900">編集</button>
                  <button type="button" disabled={isPending} onClick={() => startTransition(async () => { await deleteLineForm(accountId, f.id); router.refresh(); })} className="text-[11px] text-zinc-400 hover:text-red-600">削除</button>
                </span>
              </li>
            ),
          )}
        </ul>
      )}
    </section>
  );
}
