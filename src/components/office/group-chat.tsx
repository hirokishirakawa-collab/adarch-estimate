"use client";
// ==============================================================
// みんなのチャット（/live の右側）— 全員に見えるタイムライン
//   ・5秒ごとに新着だけ取りに行く（after=最後の時刻）
//   ・名前を押すと個別ひとこと
//   ・金額は書かない場（下に注記）
// ==============================================================

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Send } from "lucide-react";
import { openOfficeThread, markChatSeen, useOfficeState } from "@/lib/office/store";
import { Avatar } from "./avatar";

const POLL_MS = 5_000;

interface ChatDTO {
  id: string;
  userId: string;
  name: string;
  initials: string;
  avatar: string | null;
  company: string;
  pref: string;
  isBot: boolean;
  text: string;
  createdAt: string;
}

function stamp(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  const t = d.toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" });
  return sameDay ? t : `${d.getMonth() + 1}/${d.getDate()} ${t}`;
}

export function GroupChat({ maxHeightClass = "max-h-[560px]" }: { maxHeightClass?: string }) {
  const office = useOfficeState();
  const [items, setItems] = useState<ChatDTO[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const lastAt = useRef<string | null>(null);
  const stickToBottom = useRef(true);

  const merge = useCallback((incoming: ChatDTO[]) => {
    if (incoming.length === 0) return;
    setItems((prev) => {
      const ids = new Set(prev.map((m) => m.id));
      const next = [...prev, ...incoming.filter((m) => !ids.has(m.id))];
      next.sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
      return next.slice(-200);
    });
    const newest = incoming[incoming.length - 1].createdAt;
    if (!lastAt.current || Date.parse(newest) > Date.parse(lastAt.current)) lastAt.current = newest;
    markChatSeen(newest);
  }, []);

  const load = useCallback(async () => {
    try {
      const q = lastAt.current ? `?after=${encodeURIComponent(lastAt.current)}` : "";
      const r = await fetch(`/api/office/chat${q}`, { cache: "no-store" });
      if (!r.ok) return;
      const d = (await r.json()) as { items: ChatDTO[] };
      merge(d.items);
      setLoaded(true);
    } catch {
      /* 次で拾う */
    }
  }, [merge]);

  useEffect(() => {
    load();
    const t = setInterval(load, POLL_MS);
    return () => clearInterval(t);
  }, [load]);

  // 一番下を見ているときだけ追従する
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    if (stickToBottom.current) el.scrollTo({ top: el.scrollHeight });
  }, [items.length]);

  const onScroll = () => {
    const el = listRef.current;
    if (!el) return;
    stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
  };

  const send = async () => {
    const t = text.trim();
    if (!t || sending) return;
    setSending(true);
    try {
      const r = await fetch("/api/office/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: t }),
      });
      const d = (await r.json()) as { item?: ChatDTO; error?: string };
      if (!r.ok || !d.item) throw new Error(d.error ?? "送れませんでした");
      stickToBottom.current = true;
      merge([d.item]);
      setText("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "送れませんでした");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex flex-col">
      <div ref={listRef} onScroll={onScroll} className={`${maxHeightClass} overflow-y-auto px-3 py-3 space-y-3`}>
        {!loaded && <p className="px-1 py-8 text-center text-[12px] text-zinc-500">読み込み中…</p>}
        {loaded && items.length === 0 && (
          <div className="px-2 py-8 text-center">
            <p className="text-[13px] text-zinc-300">まだ投稿はありません</p>
            <p className="mt-1 text-[11.5px] text-zinc-500 leading-relaxed">
              「今日は◯◯市を回っています」「TVerの相談、誰か経験ありますか」——そんな一言でいいです。誰もいない時の質問にはアーチくんが返します。
            </p>
          </div>
        )}
        {items.map((m, i) => {
          const prev = items[i - 1];
          const cont = prev && prev.userId === m.userId && Date.parse(m.createdAt) - Date.parse(prev.createdAt) < 5 * 60_000;
          const mine = m.userId === office.meId || m.isBot;
          return (
            <div key={m.id} className={`flex gap-2.5 ${cont ? "mt-1" : ""}`}>
              <div className="w-9 shrink-0">
                {!cont && (
                  <button
                    type="button"
                    disabled={mine}
                    onClick={() => openOfficeThread(m.userId)}
                    title={mine ? "自分" : `${m.name} さんに個別ひとこと`}
                    className="rounded-full disabled:cursor-default hover:ring-2 hover:ring-emerald-400 transition"
                  >
                    <Avatar src={m.avatar} initials={m.initials} size={36} />
                  </button>
                )}
              </div>
              <div className="min-w-0 flex-1">
                {!cont && (
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <button
                      type="button"
                      disabled={mine}
                      onClick={() => openOfficeThread(m.userId)}
                      className="text-[13px] font-semibold text-zinc-100 hover:underline disabled:no-underline disabled:cursor-default"
                    >
                      {m.name}
                    </button>
                    {m.isBot ? (
                      <span className="text-[9.5px] px-1.5 py-px rounded border border-indigo-400/40 text-indigo-300 bg-indigo-500/10">AI・仲間</span>
                    ) : (
                      <span className="text-[10.5px] text-zinc-500 truncate">
                        {m.company ? `${m.company}・` : ""}
                        {m.pref}
                      </span>
                    )}
                    <span className="text-[10px] text-zinc-600 tabular-nums ml-auto">{stamp(m.createdAt)}</span>
                  </div>
                )}
                <p className="text-[13.5px] text-zinc-200 leading-relaxed whitespace-pre-wrap break-words">{m.text}</p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="border-t border-white/[0.06] p-2.5">
        <div className="flex items-end gap-2">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                send();
              }
            }}
            rows={1}
            maxLength={300}
            placeholder="みんなに一言…（Enterで送る／Shift+Enterで改行）"
            className="flex-1 resize-none rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2.5 text-[14px] text-zinc-100 placeholder:text-zinc-600 outline-none focus:border-emerald-400/50 max-h-28"
          />
          <button
            type="button"
            onClick={send}
            disabled={!text.trim() || sending}
            className="p-2.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-500 disabled:opacity-40"
            aria-label="送る"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
        <p className="mt-1.5 px-0.5 text-[10px] text-zinc-600">全員に見えます。金額は書かない場所です。</p>
      </div>
    </div>
  );
}
