"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Zap } from "lucide-react";
import { saveLineKeywordRule, deleteLineKeywordRule, toggleLineKeywordRule } from "@/lib/actions/line";

const inputCls =
  "w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg bg-white text-zinc-900 " +
  "focus:outline-none focus:ring-2 focus:ring-emerald-300 focus:border-emerald-400";

export type KeywordRule = { id: string; keyword: string; addTags: string[]; replyText: string | null; isActive: boolean; hitCount: number };

function RuleForm({ accountId, initial, tagNames, onClose }: { accountId: string; initial?: KeywordRule; tagNames: string[]; onClose: () => void }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  function submit(fd: FormData) {
    startTransition(async () => {
      const r = await saveLineKeywordRule(null, fd);
      if (r.error) {
        setError(r.error);
        return;
      }
      router.refresh();
      onClose();
    });
  }
  return (
    <form action={submit} className="border border-emerald-200 rounded-lg p-3 space-y-2">
      <input type="hidden" name="accountId" value={accountId} />
      {initial && <input type="hidden" name="id" value={initial.id} />}
      <div className="grid sm:grid-cols-2 gap-2">
        <input name="keyword" defaultValue={initial?.keyword ?? ""} placeholder="キーワード（例: 資料）" className={inputCls} required />
        <input name="addTags" defaultValue={initial?.addTags.join(", ") ?? ""} placeholder="付けるタグ（カンマ区切り・任意）" className={inputCls} list="line-tag-names" />
        <datalist id="line-tag-names">{tagNames.map((t) => <option key={t} value={t} />)}</datalist>
      </div>
      <textarea name="replyText" rows={3} defaultValue={initial?.replyText ?? ""} placeholder="一致したときの返信（任意・{name}で相手の名前）" className={inputCls} />
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

export function KeywordRuleManager({ accountId, rules, tagNames }: { accountId: string; rules: KeywordRule[]; tagNames: string[] }) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <section className="bg-white rounded-xl border border-zinc-200 p-4 space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <p className="text-sm font-bold text-zinc-900 flex items-center gap-1.5"><Zap className="w-4 h-4 text-emerald-700" />キーワードで自動タグ・自動返信</p>
          <p className="text-[11px] text-zinc-400">相手のメッセージにキーワードが含まれていたら、タグを付けて（任意で）返信します。返信は無料枠です。</p>
        </div>
        {!adding && (
          <button type="button" onClick={() => setAdding(true)} className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg bg-emerald-600 text-white hover:bg-emerald-700">
            <Plus className="w-3.5 h-3.5" />ルールを追加
          </button>
        )}
      </div>
      {adding && <RuleForm accountId={accountId} tagNames={tagNames} onClose={() => setAdding(false)} />}
      {rules.length === 0 ? (
        <p className="text-xs text-zinc-400">まだルールはありません。</p>
      ) : (
        <ul className="divide-y divide-zinc-100">
          {rules.map((r) =>
            editing === r.id ? (
              <li key={r.id} className="py-2"><RuleForm accountId={accountId} initial={r} tagNames={tagNames} onClose={() => setEditing(null)} /></li>
            ) : (
              <li key={r.id} className="py-2 flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-zinc-800">
                    「{r.keyword}」
                    <span className={`ml-2 text-[10px] rounded px-1 ${r.isActive ? "bg-emerald-50 text-emerald-700" : "bg-zinc-100 text-zinc-500"}`}>{r.isActive ? "有効" : "停止"}</span>
                    <span className="ml-2 text-[10px] text-zinc-400">{r.hitCount}回</span>
                  </p>
                  <p className="text-[11px] text-zinc-500">
                    {r.addTags.length ? `タグ: ${r.addTags.join(", ")}` : "タグなし"}
                    {r.replyText ? ` ・ 返信: ${r.replyText.slice(0, 40)}${r.replyText.length > 40 ? "…" : ""}` : ""}
                  </p>
                </div>
                <span className="flex items-center gap-1.5 shrink-0">
                  <button type="button" disabled={isPending} onClick={() => startTransition(async () => { await toggleLineKeywordRule(accountId, r.id, !r.isActive); router.refresh(); })} className="text-[11px] text-zinc-500 hover:text-zinc-900">{r.isActive ? "停止" : "有効化"}</button>
                  <button type="button" onClick={() => setEditing(r.id)} className="text-[11px] text-zinc-500 hover:text-zinc-900">編集</button>
                  <button type="button" disabled={isPending} onClick={() => startTransition(async () => { await deleteLineKeywordRule(accountId, r.id); router.refresh(); })} className="text-[11px] text-zinc-400 hover:text-red-600">削除</button>
                </span>
              </li>
            ),
          )}
        </ul>
      )}
    </section>
  );
}
