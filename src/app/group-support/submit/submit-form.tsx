"use client";

import { useActionState } from "react";
import { submitWeeklyShare, type SubmitState } from "./actions";

const q1Options = [
  { value: "いい感じ", label: "いい感じ 👍" },
  { value: "ちょっと苦戦中", label: "ちょっと苦戦中 💪" },
  { value: "手が止まっている", label: "手が止まっている 🤔" },
];

const q5Options = [
  { value: "今は大丈夫", label: "今は大丈夫 😊" },
  { value: "あると助かる", label: "あると助かる 🙏" },
  { value: "できれば早めに欲しい", label: "できれば早めに欲しい 🆘" },
];

const selectClass =
  "w-full px-3 py-2.5 text-sm bg-white border border-zinc-200 rounded-lg " +
  "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent " +
  "transition-colors appearance-none";

const textareaClass =
  "w-full px-3 py-2.5 text-sm bg-white border border-zinc-200 rounded-lg " +
  "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent " +
  "placeholder:text-zinc-400 transition-colors resize-none";

export function SubmitForm({
  chatSpaceId,
  companyName,
}: {
  chatSpaceId: string;
  companyName: string;
}) {
  const [state, formAction, isPending] = useActionState<SubmitState, FormData>(
    submitWeeklyShare,
    null
  );

  if (state?.success) {
    return (
      <div className="text-center space-y-4 py-8">
        <div className="text-5xl">🎉</div>
        <h2 className="text-xl font-bold text-zinc-800">
          シェアありがとうございます！
        </h2>
        <p className="text-sm text-zinc-500">
          {state.companyName} さんの今週の共有を受け付けました。
          <br />
          何かあればいつでもスペースでお気軽にどうぞ！
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="chatSpaceId" value={chatSpaceId} />

      <div className="text-center space-y-1">
        <p className="text-xs text-zinc-400">サポート事務局</p>
        <h2 className="text-lg font-bold text-zinc-800">
          今週の様子をシェア
        </h2>
        <p className="text-xs text-zinc-500">{companyName}</p>
      </div>

      {state?.error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-600">
          {state.error}
        </div>
      )}

      {/* Q1 */}
      <div className="space-y-1.5">
        <label className="block text-sm font-medium text-zinc-700">
          Q1. 今週の調子はいかがですか？
          <span className="ml-1 text-red-500 text-xs">必須</span>
        </label>
        <select name="q1" required className={selectClass} defaultValue="">
          <option value="" disabled>
            選択してください
          </option>
          {q1Options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      {/* Q2 */}
      <div className="space-y-1.5">
        <label className="block text-sm font-medium text-zinc-700">
          Q2. 先週やったこと
          <span className="ml-1 text-red-500 text-xs">必須</span>
        </label>
        <textarea
          name="q2"
          required
          rows={3}
          placeholder="箇条書きでOKです"
          className={textareaClass}
        />
      </div>

      {/* Q3 */}
      <div className="space-y-1.5">
        <label className="block text-sm font-medium text-zinc-700">
          Q3. 来週やること
          <span className="ml-1 text-red-500 text-xs">必須</span>
        </label>
        <textarea
          name="q3"
          required
          rows={3}
          placeholder="予定していることを教えてください"
          className={textareaClass}
        />
      </div>

      {/* Q4 */}
      <div className="space-y-1.5">
        <label className="block text-sm font-medium text-zinc-700">
          Q4. 共有・相談したいこと
          <span className="ml-1 text-red-500 text-xs">必須</span>
        </label>
        <textarea
          name="q4"
          required
          rows={3}
          placeholder="なければ「特になし」でOKです"
          className={textareaClass}
        />
      </div>

      {/* Q5 */}
      <div className="space-y-1.5">
        <label className="block text-sm font-medium text-zinc-700">
          Q5. 本部からのサポートは必要ですか？
          <span className="ml-1 text-red-500 text-xs">必須</span>
        </label>
        <select name="q5" required className={selectClass} defaultValue="">
          <option value="" disabled>
            選択してください
          </option>
          {q5Options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="w-full py-3 text-sm font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
      >
        {isPending ? "送信中..." : "シェアする"}
      </button>
    </form>
  );
}
