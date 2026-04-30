"use client";

import { useState, useCallback } from "react";
import {
  AlertTriangle,
  Activity,
  Pause,
  Loader2,
  CheckCircle2,
} from "lucide-react";

interface Props {
  companyName: string;
  year: number;
  month: number;
}

export function ForcedInactiveModal({ companyName, year, month }: Props) {
  const [choice, setChoice] = useState<"ACTIVE" | "INACTIVE" | null>(null);
  const [note, setNote] = useState("");
  const [reactivateReason, setReactivateReason] = useState("");
  const [isPending, setIsPending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = useCallback(async () => {
    if (!choice) return;
    if (choice === "INACTIVE" && !note.trim()) {
      setError("休止を継続する場合は理由を入力してください");
      return;
    }
    if (choice === "ACTIVE" && !reactivateReason.trim()) {
      setError("復帰の理由を入力してください");
      return;
    }

    setIsPending(true);
    setError(null);

    try {
      const res = await fetch("/api/partner-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: choice,
          note: choice === "INACTIVE" ? note : undefined,
          reactivate: choice === "ACTIVE" ? true : undefined,
          reactivateReason: choice === "ACTIVE" ? reactivateReason.trim() : undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "エラーが発生しました");
      }

      setDone(true);
      // 2秒後にリロードして状態を反映
      setTimeout(() => window.location.reload(), 2000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "エラーが発生しました");
    } finally {
      setIsPending(false);
    }
  }, [choice, note, reactivateReason]);

  if (done) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
        <div className="bg-white rounded-2xl shadow-xl px-8 py-6 max-w-md w-full mx-4 text-center">
          <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
          <p className="text-lg font-bold text-zinc-900">
            ステータスを更新しました
          </p>
          <p className="text-sm text-zinc-500 mt-1">ページを更新しています...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full mx-4 overflow-hidden">
        {/* ヘッダー */}
        <div className="bg-amber-50 border-b border-amber-200 px-6 py-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center flex-shrink-0">
            <AlertTriangle className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <p className="text-sm font-bold text-amber-900">
              稼働ステータスが「活動休止中」に変更されました
            </p>
            <p className="text-xs text-amber-600 mt-0.5">
              {companyName} — {year}年{month}月
            </p>
          </div>
        </div>

        {/* 本文 */}
        <div className="px-6 py-5 space-y-4">
          <p className="text-sm text-zinc-700 leading-relaxed">
            前月の週報・月次報告・営業商談等の報告が確認できなかったため、ステータスが自動的に「活動休止中」に変更されました。
          </p>

          <p className="text-sm text-zinc-700 font-semibold">
            以下のいずれかを選択してください。
          </p>

          {/* 選択肢 */}
          <div className="space-y-3">
            <button
              type="button"
              onClick={() => { setChoice("ACTIVE"); setError(null); }}
              className={`w-full text-left rounded-xl border-2 p-4 transition-all ${
                choice === "ACTIVE"
                  ? "border-emerald-500 bg-emerald-50 ring-2 ring-emerald-200"
                  : "border-zinc-200 bg-white hover:border-emerald-300"
              }`}
            >
              <div className="flex items-center gap-3">
                <Activity className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                <div>
                  <p className="text-sm font-bold text-zinc-900">稼働を再開する</p>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    「稼働中」に戻ります。今月から報告を開始してください。
                  </p>
                </div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => { setChoice("INACTIVE"); setError(null); }}
              className={`w-full text-left rounded-xl border-2 p-4 transition-all ${
                choice === "INACTIVE"
                  ? "border-amber-500 bg-amber-50 ring-2 ring-amber-200"
                  : "border-zinc-200 bg-white hover:border-amber-300"
              }`}
            >
              <div className="flex items-center gap-3">
                <Pause className="w-5 h-5 text-amber-600 flex-shrink-0" />
                <div>
                  <p className="text-sm font-bold text-zinc-900">休止を継続する</p>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    理由を記入してください。3ヶ月超で契約解除の検討対象となります。
                  </p>
                </div>
              </div>
            </button>
          </div>

          {/* 復帰理由入力 */}
          {choice === "ACTIVE" && (
            <div>
              <label className="block text-xs font-semibold text-zinc-700 mb-1.5">
                復帰の理由（必須）
              </label>
              <textarea
                value={reactivateReason}
                onChange={(e) => setReactivateReason(e.target.value)}
                rows={3}
                placeholder="例: 自社案件が落ち着いたため、今月からグループ活動を再開します"
                className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-700 placeholder:text-zinc-400 focus:border-emerald-500 focus:outline-none resize-none"
              />
            </div>
          )}

          {/* 休止理由入力 */}
          {choice === "INACTIVE" && (
            <div>
              <label className="block text-xs font-semibold text-zinc-700 mb-1.5">
                休止の理由（必須）
              </label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
                placeholder="例: 自社案件対応中のため一時休止 / 体調不良のため"
                className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-700 placeholder:text-zinc-400 focus:border-blue-500 focus:outline-none resize-none"
              />
            </div>
          )}

          {/* エラー */}
          {error && (
            <p className="text-xs text-red-600 font-medium">{error}</p>
          )}
        </div>

        {/* フッター */}
        <div className="px-6 py-4 bg-zinc-50 border-t border-zinc-100 flex justify-end gap-3">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!choice || isPending}
            className={`inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium rounded-xl transition-colors disabled:opacity-50 ${
              choice === "ACTIVE"
                ? "bg-emerald-600 text-white hover:bg-emerald-500"
                : choice === "INACTIVE"
                  ? "bg-amber-600 text-white hover:bg-amber-500"
                  : "bg-zinc-300 text-zinc-500 cursor-not-allowed"
            }`}
          >
            {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
            {choice === "ACTIVE" ? "稼働を再開する" : choice === "INACTIVE" ? "休止を継続する" : "選択してください"}
          </button>
        </div>
      </div>
    </div>
  );
}
