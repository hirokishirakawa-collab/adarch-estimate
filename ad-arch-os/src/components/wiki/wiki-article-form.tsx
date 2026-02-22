"use client";

import { useActionState, useState } from "react";
import { WikiArticleContent } from "./wiki-article-content";

interface Props {
  action: (prev: { error?: string } | null, formData: FormData) => Promise<{ error?: string }>;
  defaultTitle?: string;
  defaultBody?: string;
  submitLabel?: string;
}

export function WikiArticleForm({
  action,
  defaultTitle = "",
  defaultBody = "",
  submitLabel = "保存",
}: Props) {
  const [state, formAction, pending] = useActionState(action, null);
  const [tab, setTab] = useState<"write" | "preview">("write");
  const [body, setBody] = useState(defaultBody);

  return (
    <form action={formAction} className="space-y-4">
      {state?.error && (
        <div className="px-3 py-2 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg">
          {state.error}
        </div>
      )}

      {/* タイトル */}
      <div>
        <label className="block text-xs font-medium text-zinc-700 mb-1">
          タイトル <span className="text-red-500">*</span>
        </label>
        <input
          name="title"
          type="text"
          defaultValue={defaultTitle}
          placeholder="記事タイトルを入力"
          required
          className="w-full text-sm border border-zinc-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500"
        />
      </div>

      {/* 本文エリア（タブ切り替え） */}
      <div>
        <div className="flex items-center gap-1 mb-2">
          <button
            type="button"
            onClick={() => setTab("write")}
            className={`px-3 py-1 text-xs font-medium rounded-t-lg border ${
              tab === "write"
                ? "border-zinc-300 border-b-white bg-white text-zinc-800"
                : "border-transparent text-zinc-500 hover:text-zinc-700"
            }`}
          >
            編集
          </button>
          <button
            type="button"
            onClick={() => setTab("preview")}
            className={`px-3 py-1 text-xs font-medium rounded-t-lg border ${
              tab === "preview"
                ? "border-zinc-300 border-b-white bg-white text-zinc-800"
                : "border-transparent text-zinc-500 hover:text-zinc-700"
            }`}
          >
            プレビュー
          </button>
        </div>

        {tab === "write" ? (
          <textarea
            name="body"
            rows={20}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="# 見出し&#10;&#10;本文をMarkdownで入力してください。&#10;&#10;## 小見出し&#10;&#10;- リスト項目1&#10;- リスト項目2"
            required
            className="w-full text-sm font-mono border border-zinc-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500 resize-y"
          />
        ) : (
          <>
            {/* hidden input で body を送信 */}
            <input type="hidden" name="body" value={body} />
            <div className="min-h-[400px] border border-zinc-200 rounded-lg px-4 py-4 bg-white">
              {body ? (
                <WikiArticleContent body={body} />
              ) : (
                <p className="text-sm text-zinc-400 italic">本文がありません</p>
              )}
            </div>
          </>
        )}
      </div>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={pending}
          className="px-4 py-2 bg-teal-600 text-white text-sm font-medium rounded-lg hover:bg-teal-700 disabled:opacity-50 transition-colors"
        >
          {pending ? "保存中..." : submitLabel}
        </button>
      </div>
    </form>
  );
}
