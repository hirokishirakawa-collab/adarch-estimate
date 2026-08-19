"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { replyAsPartner, markGroupRepliesRead } from "@/lib/actions/group-support";

export interface ThreadMessage {
  id: string;
  type: "CEO_COMMENT" | "PARTNER_REPLY";
  content: string;
  actorName: string | null;
  createdAt: string;
}

interface Props {
  messages: ThreadMessage[];
  unreadCount: number;
}

export function GroupThreadCard({ messages, unreadCount }: Props) {
  const [state, formAction, isPending] = useActionState(replyAsPartner, null);
  const [open, setOpen] = useState(unreadCount > 0);
  const formRef = useRef<HTMLFormElement>(null);

  // 画面に出た時点で既読にする（バッジを残さない）
  useEffect(() => {
    if (unreadCount > 0) markGroupRepliesRead();
  }, [unreadCount]);

  useEffect(() => {
    if (state?.success) formRef.current?.reset();
  }, [state?.success]);

  const fmt = (iso: string) =>
    new Date(iso).toLocaleString("ja-JP", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Asia/Tokyo",
    });

  return (
    <div className="rounded-xl border border-zinc-200 bg-white px-5 py-4 space-y-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 w-full text-left"
      >
        <h2 className="text-sm font-bold text-zinc-900">本部とのやり取り</h2>
        {unreadCount > 0 && (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-blue-600 text-white text-[10px] font-semibold">
            新着 {unreadCount}
          </span>
        )}
        <span className="ml-auto text-xs text-zinc-400">
          {open ? "閉じる" : "開く"}
        </span>
      </button>

      {open && (
        <>
          <div className="space-y-2">
            {messages.map((m) => {
              const fromHq = m.type === "CEO_COMMENT";
              return (
                <div
                  key={m.id}
                  className={`rounded-lg px-3 py-2 text-xs ${
                    fromHq
                      ? "bg-blue-50 border border-blue-100"
                      : "bg-zinc-50 border border-zinc-100"
                  }`}
                >
                  <div className="flex items-center gap-1.5 mb-1">
                    <span
                      className={`text-[10px] font-semibold ${
                        fromHq ? "text-blue-700" : "text-zinc-500"
                      }`}
                    >
                      {fromHq ? `本部${m.actorName ? `・${m.actorName}` : ""}` : m.actorName ?? "自社"}
                    </span>
                    <span className="text-[10px] text-zinc-400">
                      {fmt(m.createdAt)}
                    </span>
                  </div>
                  <p className="text-zinc-700 whitespace-pre-wrap">{m.content}</p>
                </div>
              );
            })}
          </div>

          <form ref={formRef} action={formAction} className="space-y-2">
            <textarea
              name="content"
              rows={2}
              required
              className="w-full rounded-md border border-zinc-200 bg-white px-2.5 py-1.5 text-xs text-zinc-700 placeholder:text-zinc-400 focus:border-blue-500 focus:outline-none resize-none"
              placeholder="本部への返信を書く..."
            />
            {state?.error && <p className="text-xs text-red-500">{state.error}</p>}
            {state?.success && (
              <p className="text-xs text-emerald-600">送信しました</p>
            )}
            <button
              type="submit"
              disabled={isPending}
              className="px-3 py-1.5 rounded-md bg-zinc-900 text-white text-xs font-medium hover:bg-zinc-700 disabled:opacity-50 transition-colors"
            >
              {isPending ? "送信中..." : "返信する"}
            </button>
          </form>
        </>
      )}
    </div>
  );
}
