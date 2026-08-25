"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { submitPublicLineForm } from "@/lib/actions/line";
import type { FormField } from "@/lib/line/service";

const inputCls =
  "w-full px-3 py-2.5 text-base border border-zinc-300 rounded-lg bg-white text-zinc-900 " +
  "focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-emerald-500";

export function PublicLineForm({ token, code, fields }: { token: string; code: string; fields: FormField[] }) {
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function submit(fd: FormData) {
    const answers: Record<string, string | string[]> = {};
    for (const f of fields) {
      if (f.type === "checkbox") answers[f.key] = fd.getAll(f.key).map(String);
      else answers[f.key] = String(fd.get(f.key) ?? "");
    }
    startTransition(async () => {
      const r = await submitPublicLineForm(token, code, answers);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setError(null);
      setDone(r.thankYou ?? "ご回答ありがとうございました。");
    });
  }

  if (done) {
    return (
      <div className="mt-6 bg-white rounded-xl border border-emerald-200 p-5">
        <p className="text-sm text-zinc-800 whitespace-pre-wrap">{done}</p>
        <p className="text-xs text-zinc-400 mt-3">この画面は閉じて大丈夫です。</p>
      </div>
    );
  }

  return (
    <form action={submit} className="mt-5 space-y-4">
      {fields.map((f) => (
        <div key={f.key}>
          <label className="block text-sm font-bold text-zinc-800 mb-1">
            {f.label}
            {f.required && <span className="text-red-500 ml-1">*</span>}
          </label>
          {f.type === "textarea" ? (
            <textarea name={f.key} rows={4} required={f.required} className={inputCls} />
          ) : f.type === "select" ? (
            <select name={f.key} required={f.required} className={inputCls} defaultValue="">
              <option value="" disabled>選択してください</option>
              {(f.options ?? []).map((o) => (
                <option key={o} value={o}>{o}</option>
              ))}
            </select>
          ) : f.type === "checkbox" ? (
            <div className="space-y-1.5">
              {(f.options ?? []).map((o) => (
                <label key={o} className="flex items-center gap-2 text-sm text-zinc-800">
                  <input type="checkbox" name={f.key} value={o} className="w-4 h-4" />
                  {o}
                </label>
              ))}
            </div>
          ) : (
            <input name={f.key} type={f.type === "date" ? "date" : f.type === "tel" ? "tel" : f.type === "email" ? "email" : "text"} required={f.required} className={inputCls} />
          )}
        </div>
      ))}
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button type="submit" disabled={isPending} className="w-full flex items-center justify-center gap-2 py-3 bg-emerald-600 text-white text-sm font-bold rounded-lg disabled:opacity-50">
        {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
        送信する
      </button>
    </form>
  );
}
