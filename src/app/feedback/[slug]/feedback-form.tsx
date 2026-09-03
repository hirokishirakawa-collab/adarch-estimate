"use client";

import { useActionState } from "react";
import { submitPackageFeedback, type FeedbackState } from "./actions";
import { USABILITY_OPTIONS, USED_FOR_OPTIONS } from "./options";

const inputClass =
  "w-full px-3 py-2.5 text-sm bg-white border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent placeholder:text-zinc-400 transition-colors";

export function FeedbackForm({
  slug,
  from,
  packageName,
  defaultName,
}: {
  slug: string;
  from: string;
  packageName: string;
  defaultName: string;
}) {
  const [state, formAction, isPending] = useActionState<FeedbackState, FormData>(submitPackageFeedback, null);

  if (state?.success) {
    return (
      <div className="text-center space-y-4 py-8">
        <div className="text-5xl">🙌</div>
        <h2 className="text-xl font-bold text-zinc-800">ありがとうございます！</h2>
        <p className="text-sm text-zinc-500">
          本部に届きました。
          <br />
          いただいた内容は次のデータに反映します。
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="from" value={from} />

      <div className="text-center space-y-1">
        <p className="text-xs text-zinc-400">Ad Arch Group</p>
        <h2 className="text-lg font-bold text-zinc-800">使ってみた感想を送る</h2>
        <p className="text-xs text-zinc-500">{packageName}｜1分で終わります</p>
      </div>

      {state?.error && <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-600">{state.error}</div>}

      <div className="space-y-1.5">
        <label className="block text-sm font-medium text-zinc-700">
          お名前（拠点）<span className="ml-1 text-red-500 text-xs">必須</span>
        </label>
        <input name="senderName" required defaultValue={defaultName} placeholder="例: 宮本（京都）" className={inputClass} />
      </div>

      <div className="space-y-1.5">
        <p className="text-sm font-medium text-zinc-700">
          何に使いましたか？<span className="ml-1 text-red-500 text-xs">必須・複数可</span>
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
          {USED_FOR_OPTIONS.map((o) => (
            <label key={o} className="flex items-center gap-2 text-sm text-zinc-700 bg-zinc-50 border border-zinc-200 rounded-lg px-3 py-2 cursor-pointer hover:bg-white">
              <input type="checkbox" name="usedFor" value={o} className="accent-orange-500" />
              {o}
            </label>
          ))}
        </div>
      </div>

      <div className="space-y-1.5">
        <p className="text-sm font-medium text-zinc-700">
          使ってみてどうでしたか？<span className="ml-1 text-red-500 text-xs">必須</span>
        </p>
        <div className="grid grid-cols-2 gap-1.5">
          {USABILITY_OPTIONS.map((o) => (
            <label key={o} className="flex items-center gap-2 text-sm text-zinc-700 bg-zinc-50 border border-zinc-200 rounded-lg px-3 py-2 cursor-pointer hover:bg-white">
              <input type="radio" name="usability" value={o} required className="accent-orange-500" />
              {o}
            </label>
          ))}
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="block text-sm font-medium text-zinc-700">結果・違和感・困った点・欲しいデータ</label>
        <textarea
          name="body"
          rows={5}
          placeholder="AIに「使った結果をフィードバック用に3行にまとめて」と頼んだ3行を貼るだけでもOKです。お客様の反応があれば一言添えてください。"
          className={inputClass + " resize-none"}
        />
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="w-full py-3 text-sm font-semibold bg-[#F19834] text-white rounded-lg hover:bg-[#d9821f] active:bg-[#c4731a] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {isPending ? "送信中..." : "送る"}
      </button>
    </form>
  );
}
