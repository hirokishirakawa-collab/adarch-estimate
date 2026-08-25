"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

type Res = { error?: string; ok?: boolean } & Record<string, unknown>;

const base = "px-2.5 py-1 text-xs font-medium rounded-lg border transition-colors disabled:opacity-50";

/** 二段階確認つきの実行ボタン（ブラウザのダイアログは使わない） */
export function ConfirmButton({
  label,
  confirmLabel = "本当に実行",
  action,
  danger = false,
}: {
  label: string;
  confirmLabel?: string;
  action: () => Promise<Res>;
  danger?: boolean;
}) {
  const router = useRouter();
  const [arm, setArm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function run() {
    startTransition(async () => {
      const res = await action();
      if (res.error) setError(res.error);
      else {
        setError(null);
        setArm(false);
        router.refresh();
      }
    });
  }

  return (
    <span className="inline-flex items-center gap-1.5">
      {arm ? (
        <>
          <button
            type="button"
            onClick={run}
            disabled={isPending}
            className={`${base} ${danger ? "bg-red-600 border-red-600 text-white hover:bg-red-700" : "bg-emerald-600 border-emerald-600 text-white"}`}
          >
            {isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : confirmLabel}
          </button>
          <button type="button" onClick={() => setArm(false)} className={`${base} border-zinc-200 text-zinc-600`}>
            やめる
          </button>
        </>
      ) : (
        <button
          type="button"
          onClick={() => setArm(true)}
          className={`${base} ${danger ? "border-red-200 text-red-600 hover:bg-red-50" : "border-zinc-200 text-zinc-700 hover:bg-zinc-50"}`}
        >
          {label}
        </button>
      )}
      {error && <span className="text-[11px] text-red-600">{error}</span>}
    </span>
  );
}

/** 確認なしの実行ボタン（結果メッセージを横に出す） */
export function ActionButton({
  label,
  action,
  successText,
}: {
  label: string;
  action: () => Promise<Res>;
  successText?: string;
}) {
  const router = useRouter();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  function run() {
    startTransition(async () => {
      const res = await action();
      if (res.error) setMsg({ ok: false, text: res.error });
      else {
        setMsg({ ok: true, text: typeof res.message === "string" ? res.message : (successText ?? "完了") });
        router.refresh();
      }
    });
  }

  return (
    <span className="inline-flex items-center gap-1.5">
      <button type="button" onClick={run} disabled={isPending} className={`${base} border-zinc-200 text-zinc-700 hover:bg-zinc-50`}>
        {isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : label}
      </button>
      {msg && <span className={`text-[11px] ${msg.ok ? "text-emerald-700" : "text-red-600"}`}>{msg.text}</span>}
    </span>
  );
}
