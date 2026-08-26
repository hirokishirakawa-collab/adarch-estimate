"use client";

import { useMemo, useState, useTransition } from "react";
import { submitMoves, type BulkMoveResult } from "./actions";
import { buildMovesPrompt, parseMovesJson } from "@/lib/group-moves/ai-import";
import { getMethodLabel, getStage } from "@/lib/constants/group-move";

// ---------------------------------------------------------------
// 「AIに書かせて貼る」タブ。
//   OSを使わずに営業している代表向け。
//   ① 指示文をコピー → ② Gemini/ChatGPT/Claude に自分の記録と一緒に渡す
//   → ③ 返ってきたJSONを貼る → ④ 確認表を見て「まとめて出す」
//   検査はクライアントとサーバーで同じ parseMovesJson を使う。
// ---------------------------------------------------------------
export function PasteForm({ chatSpaceId }: { chatSpaceId: string }) {
  const [text, setText] = useState("");
  const [copied, setCopied] = useState(false);
  const [result, setResult] = useState<BulkMoveResult | null>(null);
  const [pending, startTransition] = useTransition();

  const prompt = useMemo(() => buildMovesPrompt(), []);
  const parsed = useMemo(() => (text.trim() ? parseMovesJson(text) : null), [text]);

  async function copyPrompt() {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // クリップボードが使えない環境では下のテキストを手で選べるようにしてある
    }
  }

  function submit() {
    startTransition(async () => {
      const res = await submitMoves(chatSpaceId, text);
      setResult(res);
      if (res.ok) setText("");
    });
  }

  if (result?.ok) {
    return (
      <div className="text-center py-6">
        <div className="text-4xl mb-3">✓</div>
        <p className="text-lg font-bold text-zinc-900">{result.imported}件 出しました</p>
        <p className="text-sm text-zinc-500 mt-2">グループに流れました</p>
        {result.skipped.length > 0 && (
          <div className="mt-4 text-left bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 max-h-32 overflow-y-auto">
            <p className="text-xs font-semibold text-amber-800 mb-1">出さなかった行</p>
            {result.skipped.map((s, i) => (
              <p key={i} className="text-xs text-amber-700">
                {s.company}：{s.reason}
              </p>
            ))}
          </div>
        )}
        <button
          type="button"
          onClick={() => setResult(null)}
          className="mt-6 px-4 py-2 text-sm font-medium text-blue-600 border border-blue-200
                     rounded-lg hover:bg-blue-50 transition-colors"
        >
          続けて貼る
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* ① 指示文 */}
      <div className="bg-zinc-50 border border-zinc-200 rounded-lg p-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-semibold text-zinc-700">
            ① この指示文をコピーして、Gemini / ChatGPT / Claude に自分の営業記録と一緒に渡す
          </p>
          <button
            type="button"
            onClick={copyPrompt}
            className="shrink-0 px-3 py-1.5 text-xs font-bold text-white bg-zinc-800 rounded-lg hover:bg-zinc-700 transition-colors"
          >
            {copied ? "コピーしました" : "指示文をコピー"}
          </button>
        </div>
        <details className="mt-2">
          <summary className="text-[11px] text-zinc-500 cursor-pointer select-none">指示文の中身を見る</summary>
          <pre className="mt-2 text-[11px] leading-relaxed text-zinc-600 whitespace-pre-wrap break-words max-h-40 overflow-y-auto">
            {prompt}
          </pre>
        </details>
        <p className="text-[11px] text-zinc-500 mt-2 leading-relaxed">
          渡すものは、送ったメールの一覧・管理している表・手元のメモなど何でも構いません。
          AIが会社ごとに「業界・当たり方・今どこ・日付」を整えて返します。
        </p>
      </div>

      {/* ② 貼る */}
      <div>
        <label className="block text-xs font-semibold text-zinc-700 mb-1.5">
          ② AIが返したものを、そのままここに貼る
        </label>
        <textarea
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setResult(null);
          }}
          rows={7}
          placeholder={'{ "records": [ { "company": "株式会社◯◯", ... } ] }'}
          className="w-full px-3 py-2.5 text-xs font-mono bg-white border border-zinc-200 rounded-lg
                     focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                     placeholder:text-zinc-400"
        />
      </div>

      {/* ③ 確認 */}
      {parsed?.fatal && (
        <div className="px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
          {parsed.fatal}
        </div>
      )}
      {result && !result.ok && (
        <div className="px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
          {result.error}
        </div>
      )}
      {parsed && !parsed.fatal && (
        <div>
          <p className="text-xs font-semibold text-zinc-700 mb-1.5">
            ③ 確認 — {parsed.rows.length}件を出します
            {parsed.errors.length > 0 && (
              <span className="ml-2 text-amber-700 font-normal">（{parsed.errors.length}件は出しません）</span>
            )}
          </p>
          <div className="border border-zinc-200 rounded-lg overflow-hidden max-h-56 overflow-y-auto">
            <table className="w-full text-[11px]">
              <thead className="bg-zinc-50 text-zinc-500 sticky top-0">
                <tr>
                  <th className="text-left px-2 py-1.5 font-semibold">会社</th>
                  <th className="text-left px-2 py-1.5 font-semibold">業界</th>
                  <th className="text-left px-2 py-1.5 font-semibold">当たり方</th>
                  <th className="text-left px-2 py-1.5 font-semibold">今どこ</th>
                  <th className="text-left px-2 py-1.5 font-semibold">日付</th>
                </tr>
              </thead>
              <tbody>
                {parsed.rows.map((r, i) => (
                  <tr key={i} className="border-t border-zinc-100">
                    <td className="px-2 py-1.5 text-zinc-900 font-medium truncate max-w-[9rem]">{r.company}</td>
                    <td className="px-2 py-1.5 text-zinc-600">{r.industry}</td>
                    <td className="px-2 py-1.5 text-zinc-600">{getMethodLabel(r.method)}</td>
                    <td className="px-2 py-1.5">
                      <span className={`inline-block px-1.5 py-0.5 rounded border ${getStage(r.stage).className}`}>
                        {getStage(r.stage).label}
                      </span>
                    </td>
                    <td className="px-2 py-1.5 text-zinc-500 whitespace-nowrap">{r.date ?? "今日"}</td>
                  </tr>
                ))}
                {parsed.errors.map((e, i) => (
                  <tr key={`e${i}`} className="border-t border-zinc-100 bg-amber-50/60">
                    <td className="px-2 py-1.5 text-amber-800 truncate max-w-[9rem]">{e.company || `${e.index + 1}行目`}</td>
                    <td className="px-2 py-1.5 text-amber-700" colSpan={4}>{e.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={submit}
        disabled={pending || !parsed || !!parsed.fatal || parsed.rows.length === 0}
        className="w-full py-3 bg-blue-600 text-white text-sm font-bold rounded-lg
                   hover:bg-blue-700 transition-colors disabled:opacity-50"
      >
        {pending ? "出しています…" : parsed && !parsed.fatal ? `${parsed.rows.length}件をまとめて出す` : "まとめて出す"}
      </button>

      <p className="text-[11px] text-zinc-400 text-center leading-relaxed">
        金額は項目そのものがありません。<br />
        会社名は GROUP LIVE に出ます（「グループの動き」には業界だけ出ます）
      </p>
    </div>
  );
}
