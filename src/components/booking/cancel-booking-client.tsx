"use client";

import { useState } from "react";
import { CalendarX, CheckCircle2, Loader2 } from "lucide-react";

type Props = {
  token: string;
  title: string;
  startLabel: string;
  name: string;
  alreadyCancelled: boolean;
};

export function CancelBookingClient({
  token,
  title,
  startLabel,
  name,
  alreadyCancelled,
}: Props) {
  const [cancelled, setCancelled] = useState(alreadyCancelled);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cancel = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/book/cancel/${token}`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "キャンセルに失敗しました");
      setCancelled(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "キャンセルに失敗しました");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4">
      <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-8 text-center shadow-sm">
        {cancelled ? (
          <>
            <CheckCircle2 className="mx-auto mb-4 h-12 w-12 text-emerald-500" />
            <h1 className="mb-2 text-xl font-bold text-zinc-900">
              キャンセルが完了しました
            </h1>
            <p className="text-sm leading-relaxed text-zinc-600">
              ご予約のキャンセルを承りました。カレンダーの予定も削除されています。
              またのご予約をお待ちしております。
            </p>
          </>
        ) : (
          <>
            <CalendarX className="mx-auto mb-4 h-12 w-12 text-zinc-400" />
            <h1 className="mb-2 text-xl font-bold text-zinc-900">
              予約をキャンセルしますか？
            </h1>
            <div className="mb-6 rounded-lg bg-zinc-50 px-4 py-3 text-sm text-zinc-700">
              <p className="font-medium">{title}</p>
              <p className="mt-1">{startLabel}</p>
              <p className="mt-1 text-zinc-500">{name} 様</p>
            </div>
            {error && (
              <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}
            <button
              onClick={cancel}
              disabled={submitting}
              className="w-full rounded-xl bg-red-600 py-3 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-50"
            >
              {submitting ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" /> 処理中…
                </span>
              ) : (
                "この予約をキャンセルする"
              )}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
