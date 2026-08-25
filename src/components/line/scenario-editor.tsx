"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Trash2, X } from "lucide-react";
import { saveLineScenario } from "@/lib/actions/line";

const inputCls =
  "w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg bg-white text-zinc-900 " +
  "focus:outline-none focus:ring-2 focus:ring-emerald-300 focus:border-emerald-400";
const labelCls = "block text-[11px] font-bold text-zinc-500 mb-1";

type Step = { delayDays: number; sendHour: number | null; text: string; addTags: string };
export type ScenarioInput = {
  id?: string;
  name: string;
  trigger: "FOLLOW" | "TAG" | "MANUAL";
  triggerTag: string | null;
  isActive: boolean;
  steps: Step[];
};

const EMPTY: ScenarioInput = {
  name: "",
  trigger: "FOLLOW",
  triggerTag: null,
  isActive: true,
  steps: [{ delayDays: 0, sendHour: null, text: "", addTags: "" }],
};

export function ScenarioEditor({
  accountId,
  initial,
  onClose,
}: {
  accountId: string;
  initial?: ScenarioInput;
  onClose?: () => void;
}) {
  const router = useRouter();
  const [s, setS] = useState<ScenarioInput>(initial ?? EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function updStep(i: number, patch: Partial<Step>) {
    setS((p) => ({ ...p, steps: p.steps.map((st, j) => (j === i ? { ...st, ...patch } : st)) }));
  }

  function submit(fd: FormData) {
    fd.set("steps", JSON.stringify(s.steps));
    startTransition(async () => {
      const res = await saveLineScenario(null, fd);
      if (res.error) {
        setError(res.error);
        return;
      }
      setError(null);
      router.refresh();
      onClose?.();
    });
  }

  return (
    <form action={submit} className="bg-white rounded-xl border border-emerald-200 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-bold text-zinc-900">{s.id ? "シナリオを編集" : "シナリオを作る"}</p>
        {onClose && (
          <button type="button" onClick={onClose} className="text-zinc-400 hover:text-zinc-700"><X className="w-4 h-4" /></button>
        )}
      </div>
      <input type="hidden" name="accountId" value={accountId} />
      {s.id && <input type="hidden" name="id" value={s.id} />}

      <div className="grid sm:grid-cols-[1fr_180px_160px_auto] gap-3 items-end">
        <div>
          <label className={labelCls}>シナリオ名</label>
          <input name="name" value={s.name} onChange={(e) => setS({ ...s, name: e.target.value })} className={inputCls} required />
        </div>
        <div>
          <label className={labelCls}>開始条件</label>
          <select name="trigger" value={s.trigger} onChange={(e) => setS({ ...s, trigger: e.target.value as ScenarioInput["trigger"] })} className={inputCls}>
            <option value="FOLLOW">友だち追加で開始</option>
            <option value="TAG">タグが付いたら開始</option>
            <option value="MANUAL">手動で開始</option>
          </select>
        </div>
        <div>
          <label className={labelCls}>開始タグ</label>
          <input name="triggerTag" value={s.triggerTag ?? ""} disabled={s.trigger !== "TAG"} onChange={(e) => setS({ ...s, triggerTag: e.target.value })} className={inputCls} placeholder="TAGのとき" />
        </div>
        <label className="text-xs text-zinc-700 flex items-center gap-1.5 pb-2">
          <input type="checkbox" name="isActive" checked={s.isActive} onChange={(e) => setS({ ...s, isActive: e.target.checked })} />
          有効
        </label>
      </div>

      <div className="space-y-2">
        {s.steps.map((st, i) => (
          <div key={i} className="border border-zinc-200 rounded-lg p-3 space-y-2 bg-zinc-50/50">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold text-zinc-700">{i + 1}通目</span>
              <span className="text-[11px] text-zinc-500">開始から</span>
              <input type="number" min={0} max={365} value={st.delayDays} onChange={(e) => updStep(i, { delayDays: Number(e.target.value) })} className="w-16 px-2 py-1 text-xs border border-zinc-200 rounded bg-white" />
              <span className="text-[11px] text-zinc-500">日後</span>
              <select
                value={st.sendHour === null ? "" : String(st.sendHour)}
                onChange={(e) => updStep(i, { sendHour: e.target.value === "" ? null : Number(e.target.value) })}
                className="px-2 py-1 text-xs border border-zinc-200 rounded bg-white"
              >
                <option value="">即時（前の条件を満たしたらすぐ）</option>
                {Array.from({ length: 24 }, (_, h) => (
                  <option key={h} value={h}>{h}:00 に送る</option>
                ))}
              </select>
              <input value={st.addTags} onChange={(e) => updStep(i, { addTags: e.target.value })} placeholder="送信時に付けるタグ（任意）" className="flex-1 min-w-40 px-2 py-1 text-xs border border-zinc-200 rounded bg-white" />
              <button type="button" onClick={() => setS((p) => ({ ...p, steps: p.steps.filter((_, j) => j !== i) }))} className="text-zinc-400 hover:text-red-600" disabled={s.steps.length === 1}>
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
            <textarea rows={4} value={st.text} onChange={(e) => updStep(i, { text: e.target.value })} className={inputCls} placeholder="本文（{name}=表示名、{link:名前}=計測リンク、{form:名前}=回答フォーム）" />
          </div>
        ))}
        <button
          type="button"
          onClick={() => setS((p) => ({ ...p, steps: [...p.steps, { delayDays: (p.steps.at(-1)?.delayDays ?? 0) + 1, sendHour: 10, text: "", addTags: "" }] }))}
          className="flex items-center gap-1 text-xs text-emerald-700 font-medium"
        >
          <Plus className="w-3.5 h-3.5" />通を足す
        </button>
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}
      <p className="text-[11px] text-zinc-400">1通目が「0日後・即時」なら、友だち追加時に返信枠（無料）で送ります。それ以外はプッシュ枠（有料）を使います。</p>
      <div className="flex justify-end">
        <button type="submit" disabled={isPending} className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white text-xs font-bold rounded-lg hover:bg-emerald-700 disabled:opacity-50">
          {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          保存
        </button>
      </div>
    </form>
  );
}

/** 一覧側：編集ボタンを押すとエディタを開く */
export function ScenarioEditToggle({ accountId, scenario }: { accountId: string; scenario: ScenarioInput }) {
  const [open, setOpen] = useState(false);
  if (open) return <ScenarioEditor accountId={accountId} initial={scenario} onClose={() => setOpen(false)} />;
  return (
    <button type="button" onClick={() => setOpen(true)} className="px-2.5 py-1 text-xs font-medium rounded-lg border border-zinc-200 text-zinc-700 hover:bg-zinc-50">
      編集
    </button>
  );
}

export function NewScenarioToggle({ accountId }: { accountId: string }) {
  const [open, setOpen] = useState(false);
  if (open) return <ScenarioEditor accountId={accountId} onClose={() => setOpen(false)} />;
  return (
    <button type="button" onClick={() => setOpen(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white text-xs font-medium rounded-lg hover:bg-emerald-700">
      <Plus className="w-3.5 h-3.5" />シナリオを作る
    </button>
  );
}
