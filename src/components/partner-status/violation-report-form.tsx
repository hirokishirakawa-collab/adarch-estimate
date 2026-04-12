"use client";

import { useState, useCallback } from "react";
import {
  Loader2,
  CheckCircle2,
  AlertCircle,
  Plus,
  X,
  Send,
} from "lucide-react";

// ------------------------------------------------------------------
// コンポーネント
// ------------------------------------------------------------------

export function ViolationReportForm() {
  const [targetDescription, setTargetDescription] = useState("");
  const [content, setContent] = useState("");
  const [evidenceUrls, setEvidenceUrls] = useState<string[]>([""]);
  const [isAnonymous, setIsAnonymous] = useState(true);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const addUrl = () => setEvidenceUrls((prev) => [...prev, ""]);

  const removeUrl = (index: number) => {
    setEvidenceUrls((prev) => prev.filter((_, i) => i !== index));
  };

  const updateUrl = (index: number, value: string) => {
    setEvidenceUrls((prev) =>
      prev.map((url, i) => (i === index ? value : url))
    );
  };

  const handleSubmit = useCallback(async () => {
    if (!targetDescription.trim() || !content.trim()) {
      setError("対象の説明と詳細内容は必須です");
      return;
    }

    setIsPending(true);
    setError(null);
    setSuccess(false);

    try {
      const filteredUrls = evidenceUrls.filter((u) => u.trim() !== "");

      const res = await fetch("/api/violation-reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetDescription: targetDescription.trim(),
          content: content.trim(),
          evidenceUrls: filteredUrls,
          isAnonymous,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "エラーが発生しました");
      }

      setSuccess(true);
      setTargetDescription("");
      setContent("");
      setEvidenceUrls([""]);
      setIsAnonymous(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "エラーが発生しました");
    } finally {
      setIsPending(false);
    }
  }, [targetDescription, content, evidenceUrls, isAnonymous]);

  if (success) {
    return (
      <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-5 py-6 text-center">
        <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-3" />
        <p className="text-base font-bold text-emerald-800 mb-1">
          通報を受け付けました
        </p>
        <p className="text-sm text-emerald-600 mb-4">
          本部にて確認し、対応いたします。ご協力ありがとうございます。
        </p>
        <button
          type="button"
          onClick={() => setSuccess(false)}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-emerald-600 text-white rounded-lg hover:bg-emerald-500 transition-colors"
        >
          別の通報をする
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* 対象の説明 */}
      <div className="bg-white border border-zinc-200 rounded-xl px-5 py-4">
        <label className="block text-xs font-semibold text-zinc-700 mb-1.5">
          対象の説明 <span className="text-red-500">*</span>
        </label>
        <p className="text-[11px] text-zinc-400 mb-2">
          通報対象の人物・企業・行為について、特定できる範囲でお書きください
        </p>
        <textarea
          value={targetDescription}
          onChange={(e) => setTargetDescription(e.target.value)}
          rows={3}
          required
          placeholder="例: X上で「○○」と名乗る人物が当社ブランドを無断使用している"
          className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-700 placeholder:text-zinc-400 focus:border-blue-500 focus:outline-none resize-none"
        />
      </div>

      {/* 詳細内容 */}
      <div className="bg-white border border-zinc-200 rounded-xl px-5 py-4">
        <label className="block text-xs font-semibold text-zinc-700 mb-1.5">
          詳細内容 <span className="text-red-500">*</span>
        </label>
        <p className="text-[11px] text-zinc-400 mb-2">
          発見した経緯、具体的な違反行為の内容を詳しくお書きください
        </p>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={5}
          required
          placeholder="例: 2026年4月10日頃、SNS上で当社の加盟企業を名乗り..."
          className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-700 placeholder:text-zinc-400 focus:border-blue-500 focus:outline-none resize-none"
        />
      </div>

      {/* 証拠URL */}
      <div className="bg-white border border-zinc-200 rounded-xl px-5 py-4">
        <label className="block text-xs font-semibold text-zinc-700 mb-1.5">
          証拠URL（任意）
        </label>
        <p className="text-[11px] text-zinc-400 mb-2">
          スクリーンショットや関連ページのURLがあれば追加してください
        </p>
        <div className="space-y-2">
          {evidenceUrls.map((url, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                type="url"
                value={url}
                onChange={(e) => updateUrl(i, e.target.value)}
                placeholder="https://..."
                className="flex-1 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-700 placeholder:text-zinc-400 focus:border-blue-500 focus:outline-none"
              />
              {evidenceUrls.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeUrl(i)}
                  className="p-1.5 text-zinc-400 hover:text-red-500 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
          <button
            type="button"
            onClick={addUrl}
            className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-500 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            URLを追加
          </button>
        </div>
      </div>

      {/* 匿名通報チェックボックス */}
      <div className="bg-white border border-zinc-200 rounded-xl px-5 py-4">
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={isAnonymous}
            onChange={(e) => setIsAnonymous(e.target.checked)}
            className="w-4 h-4 rounded border-zinc-300 text-blue-600 focus:ring-blue-500"
          />
          <div>
            <span className="text-sm font-medium text-zinc-800">
              匿名で通報する
            </span>
            <p className="text-[11px] text-zinc-400 mt-0.5">
              チェックを外すと、通報者としてあなたの企業名が本部に通知されます
            </p>
          </div>
        </label>
      </div>

      {/* エラー表示 */}
      {error && (
        <div className="flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-200 rounded-xl">
          <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
          <span className="text-sm text-red-700">{error}</span>
        </div>
      )}

      {/* 送信ボタン */}
      <div>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={isPending}
          className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium bg-zinc-800 text-white rounded-xl hover:bg-zinc-700 disabled:opacity-50 transition-colors"
        >
          {isPending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Send className="w-4 h-4" />
          )}
          通報を送信
        </button>
      </div>
    </div>
  );
}
