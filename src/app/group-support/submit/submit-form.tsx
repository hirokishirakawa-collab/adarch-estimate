"use client";

import { useActionState } from "react";
import { submitWeeklyShare, submitConsult, type SubmitState } from "./actions";
import { HQ_REQUEST_OPTIONS } from "@/lib/constants/group-support";

// v2（2026-09-10〜）: 未連携の代表向け＝2問だけ（声かけ数＋本部に頼みたいこと）
// AI連携（MCP）の代表は Claude / ChatGPT に「週次を出して」で提出できる（このフォームは使わなくてよい）
const hqRequestOptions = HQ_REQUEST_OPTIONS;

const selectClass =
  "w-full px-3 py-2.5 text-sm bg-white border border-zinc-200 rounded-lg " +
  "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent " +
  "transition-colors appearance-none";

const inputClass =
  "px-3 py-2.5 text-sm bg-white border border-zinc-200 rounded-lg " +
  "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent " +
  "placeholder:text-zinc-400 transition-colors";

const textareaClass =
  "w-full px-3 py-2.5 text-sm bg-white border border-zinc-200 rounded-lg " +
  "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent " +
  "placeholder:text-zinc-400 transition-colors resize-none";

export function SubmitForm({
  chatSpaceId,
  companyName,
  consultMode = false,
}: {
  chatSpaceId: string;
  companyName: string;
  consultMode?: boolean;
}) {
  if (consultMode) {
    return <ConsultForm chatSpaceId={chatSpaceId} companyName={companyName} />;
  }

  return <WeeklyShareForm chatSpaceId={chatSpaceId} companyName={companyName} />;
}

function WeeklyShareForm({
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
          今週の営業をシェア
        </h2>
        <p className="text-xs text-zinc-500">{companyName}</p>
      </div>

      {state?.error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-600">
          {state.error}
        </div>
      )}

      {/* Q1. 声をかけた先の件数 */}
      <div className="space-y-1.5">
        <label className="block text-sm font-medium text-zinc-700">
          Q1. 今週、新しく声をかけた先は何件ですか？
          <span className="ml-1 text-red-500 text-xs">必須</span>
        </label>
        <p className="text-xs text-zinc-500">メール・訪問・紹介・電話を合わせた件数。0でもOKです</p>
        <div className="flex items-center gap-2">
          <input
            type="number"
            name="outreachCount"
            inputMode="numeric"
            min={0}
            max={999}
            step={1}
            required
            placeholder="0"
            className={inputClass + " w-28 text-center text-lg font-semibold"}
          />
          <span className="text-sm text-zinc-600">件</span>
        </div>
      </div>

      {/* Q2. 本部に頼みたいこと */}
      <div className="space-y-1.5">
        <label className="block text-sm font-medium text-zinc-700">
          Q2. 本部に頼みたいことはありますか？
          <span className="ml-1 text-red-500 text-xs">必須</span>
        </label>
        <p className="text-xs text-zinc-500">提案書・見積・文面はOSのAIでできます。本部にしかできないことを選んでください</p>
        <select name="hqRequest" required className={selectClass} defaultValue="">
          <option value="" disabled>
            選んでください
          </option>
          {hqRequestOptions.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <textarea
          name="hqNote"
          rows={2}
          placeholder="一言あれば（相手先・業種・いつまで、など。任意）"
          className={textareaClass}
        />
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

function ConsultForm({
  chatSpaceId,
  companyName,
}: {
  chatSpaceId: string;
  companyName: string;
}) {
  const [state, formAction, isPending] = useActionState<SubmitState, FormData>(
    submitConsult,
    null
  );

  if (state?.success) {
    return (
      <div className="text-center space-y-4 py-8">
        <div className="text-5xl">🙌</div>
        <h2 className="text-xl font-bold text-zinc-800">
          受け付けました！
        </h2>
        <p className="text-sm text-zinc-500">
          サポート事務局に届きました。
          <br />
          おって、このスペースでご連絡します。
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
          ちょっと相談する
        </h2>
        <p className="text-xs text-zinc-500">{companyName}</p>
      </div>

      {state?.error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-600">
          {state.error}
        </div>
      )}

      <div className="space-y-1.5">
        <label className="block text-sm font-medium text-zinc-700">
          相談したいこと
          <span className="ml-1 text-red-500 text-xs">必須</span>
        </label>
        <textarea
          name="content"
          required
          rows={5}
          placeholder="お困りごと・聞いてみたいこと、なんでもどうぞ。週次のシェアは不要です。"
          className={textareaClass}
        />
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="w-full py-3 text-sm font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
      >
        {isPending ? "送信中..." : "相談を送る"}
      </button>
    </form>
  );
}
