"use client";

import { useState, useTransition } from "react";
import { submitMove } from "./actions";
import { STAGE_OPTIONS, METHOD_OPTIONS, BOARD_INDUSTRIES } from "@/lib/constants/group-move";

const fieldClass =
  "w-full px-3 py-2.5 text-base bg-white border border-zinc-200 rounded-lg " +
  "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent " +
  "placeholder:text-zinc-400 transition-colors";

// ---------------------------------------------------------------
// Chat から開く「動きを出す」フォーム。
//   打つのは会社名だけ。あとは選ぶだけで終わる。
//   金額欄は作らない（GROUP LIVE / グループの動き の両方に金額は出さないため）。
// ---------------------------------------------------------------
export function MoveForm({
  chatSpaceId,
  partnerName,
}: {
  chatSpaceId: string;
  partnerName: string;
}) {
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(formData: FormData) {
    startTransition(async () => {
      const res = await submitMove(null, formData);
      if (res?.error) {
        setError(res.error);
        return;
      }
      setError(null);
      setDone((formData.get("companyName") as string) ?? "");
    });
  }

  if (done) {
    return (
      <div className="text-center py-6">
        <div className="text-4xl mb-3">✓</div>
        <p className="text-lg font-bold text-zinc-900">出しました</p>
        <p className="text-sm text-zinc-500 mt-2">
          「{done}」への動きが、グループに流れました
        </p>
        <button
          type="button"
          onClick={() => {
            setDone(null);
            setError(null);
          }}
          className="mt-6 px-4 py-2 text-sm font-medium text-blue-600 border border-blue-200
                     rounded-lg hover:bg-blue-50 transition-colors"
        >
          もう1件出す
        </button>
      </div>
    );
  }

  return (
    <>
      <div className="mb-5">
        <h1 className="text-lg font-bold text-zinc-900">動きを出す</h1>
        <p className="text-xs text-zinc-500 mt-1">
          {partnerName} さん — 打つのは会社名だけ、あとは選ぶだけです
        </p>
      </div>

      {error && (
        <div className="mb-4 px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
          {error}
        </div>
      )}

      <form action={submit} className="space-y-4">
        <input type="hidden" name="chatSpaceId" value={chatSpaceId} />

        <div>
          <label className="block text-xs font-semibold text-zinc-700 mb-1.5">
            会社名<span className="text-red-500 ml-0.5">*</span>
          </label>
          <input
            type="text"
            name="companyName"
            required
            autoFocus
            maxLength={80}
            placeholder="例: 株式会社◯◯"
            className={fieldClass}
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-zinc-700 mb-1.5">
            業界<span className="text-red-500 ml-0.5">*</span>
          </label>
          <select name="industry" required defaultValue="" className={fieldClass}>
            <option value="" disabled>選ぶ</option>
            {BOARD_INDUSTRIES.map((i) => (
              <option key={i} value={i}>{i}</option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-zinc-700 mb-1.5">
              当たり方<span className="text-red-500 ml-0.5">*</span>
            </label>
            <select name="method" required defaultValue="" className={fieldClass}>
              <option value="" disabled>選ぶ</option>
              {METHOD_OPTIONS.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-zinc-700 mb-1.5">今どこ</label>
            <select name="stage" defaultValue="APPROACHING" className={fieldClass}>
              {STAGE_OPTIONS.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-zinc-700 mb-1.5">
            ひとこと<span className="ml-1.5 text-zinc-400 font-normal">任意</span>
          </label>
          <input
            type="text"
            name="note"
            maxLength={120}
            placeholder="例: 商工会つながり。来週デモ"
            className={fieldClass}
          />
        </div>

        <button
          type="submit"
          disabled={pending}
          className="w-full py-3 bg-blue-600 text-white text-sm font-bold rounded-lg
                     hover:bg-blue-700 transition-colors disabled:opacity-50"
        >
          {pending ? "出しています…" : "出す"}
        </button>

        <p className="text-[11px] text-zinc-400 text-center leading-relaxed">
          金額は入力欄そのものがありません。<br />
          会社名は GROUP LIVE に出ます（「グループの動き」には業界だけ出ます）
        </p>
      </form>
    </>
  );
}
