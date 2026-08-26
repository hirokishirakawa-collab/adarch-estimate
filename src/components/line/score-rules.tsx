"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Flame } from "lucide-react";
import { saveLineScoreRules, recalcLineScores } from "@/lib/actions/line";

const inputCls =
  "w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg bg-white text-zinc-900 " +
  "focus:outline-none focus:ring-2 focus:ring-emerald-300 focus:border-emerald-400";
const labelCls = "block text-[11px] font-bold text-zinc-500 mb-1";

export type ScoreRulesDef = {
  follow: number; message: number; postback: number; click: number; form: number; booking: number;
  tagPoints: Record<string, number>;
  thresholds: { score: number; tag: string }[];
};

export function ScoreRulesManager({ accountId, rules }: { accountId: string; rules: ScoreRulesDef }) {
  const router = useRouter();
  const [msg, setMsg] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const EVENTS: [keyof ScoreRulesDef, string][] = [
    ["follow", "友だち追加"], ["message", "メッセージ受信"], ["postback", "ボタン操作"], ["click", "リンククリック"], ["form", "フォーム回答"], ["booking", "予約"],
  ];
  return (
    <section className="bg-white rounded-xl border border-zinc-200 p-4 space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <p className="text-sm font-bold text-zinc-900 flex items-center gap-1.5"><Flame className="w-4 h-4 text-emerald-700" />行動スコアの点数表</p>
          <p className="text-[11px] text-zinc-400">行動ごとに加点し、しきい値に達したらタグを付けます（タグ→ステップ配信やメニュー切替に連動）。友だち一覧は「スコア順」で並べられます。</p>
        </div>
        <button
          type="button"
          disabled={isPending}
          onClick={() => startTransition(async () => { const r = await recalcLineScores(accountId); setMsg(r.error ?? (r.message ?? "完了")); router.refresh(); })}
          className="px-3 py-1.5 text-xs rounded-lg border border-zinc-200 hover:bg-zinc-50"
        >
          全員を再計算
        </button>
      </div>
      <form action={(fd) => startTransition(async () => { const r = await saveLineScoreRules(null, fd); setMsg(r.error ?? (r.message ?? "保存しました")); router.refresh(); })} className="space-y-3">
        <input type="hidden" name="accountId" value={accountId} />
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
          {EVENTS.map(([k, label]) => (
            <div key={k}>
              <label className={labelCls}>{label}</label>
              <input name={k} type="number" min={-100} max={100} defaultValue={rules[k] as number} className={inputCls} />
            </div>
          ))}
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>タグが付いたときの加点（1行に「タグ名: 点数」）</label>
            <textarea name="tagPoints" rows={4} defaultValue={Object.entries(rules.tagPoints).map(([k, v]) => `${k}: ${v}`).join("\n")} className={inputCls} placeholder={"面談済: 10\n資料希望: 3"} />
          </div>
          <div>
            <label className={labelCls}>しきい値で付けるタグ（1行に「点数: タグ名」）</label>
            <textarea name="thresholds" rows={4} defaultValue={rules.thresholds.map((t) => `${t.score}: ${t.tag}`).join("\n")} className={inputCls} placeholder={"20: ホット\n40: 超ホット"} />
          </div>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-zinc-500">{msg}</span>
          <button type="submit" disabled={isPending} className="flex items-center gap-1 px-4 py-2 text-xs font-bold rounded-lg bg-emerald-600 text-white disabled:opacity-50">
            {isPending && <Loader2 className="w-3 h-3 animate-spin" />}保存
          </button>
        </div>
      </form>
    </section>
  );
}
