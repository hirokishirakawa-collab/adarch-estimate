"use client";
// ==============================================================
// グループオフィス 常駐エージェント（全ダッシュボード画面に見えない形で常駐）
//   ・15秒ごとに beat → 在席を灯し、自分宛の「ひとこと」を受け取る
//   ・ひとこと → トースト（返す／あとで）
//   ・個別ひとことのスレッド（右下）をここから出す
//   主役は「一緒に動いている感じ」。全員のチャットは /live にある
// ==============================================================

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { X, Send } from "lucide-react";
import { setOfficeState, useOfficeState, openOfficeThread, chatSeenAt } from "@/lib/office/store";
import { Avatar } from "./avatar";

const BEAT_MS = 15_000;
const THREAD_POLL_MS = 6_000;
const ONLINE_MS = 45_000;

interface KnockDTO {
  id: string;
  fromId: string;
  toId: string;
  fromName: string;
  message: string;
  createdAt: string;
  readAt: string | null;
}
interface Peer {
  id: string;
  name: string;
  initials: string;
  avatar: string | null;
  company: string;
  pref: string;
  isHq: boolean;
  lastSeenAt: string | null;
}
interface BeatRes {
  me: { id: string; isHq: boolean };
  online: number;
  faces: { id: string; avatar: string | null; initials: string; name: string }[];
  inbox: KnockDTO[];
  latestChatAt: string | null;
  latestChatBy: string | null;
}

function hhmm(iso: string) {
  return new Date(iso).toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" });
}

export function OfficeAgent() {
  const office = useOfficeState();
  const [thread, setThread] = useState<{ userId: string; prefill?: string } | null>(null);
  const threadRef = useRef<string | null>(null);
  useEffect(() => {
    threadRef.current = thread?.userId ?? null;
  }, [thread]);
  const seen = useRef<Set<string>>(new Set());
  const stopped = useRef(false); // 401/403 が返ったら止める（デモ・停止中）

  // ---------- beat ----------
  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;
    const beat = async () => {
      if (stopped.current) return;
      try {
        const r = await fetch("/api/office/beat", { method: "POST", cache: "no-store" });
        if (r.status === 401 || r.status === 403) {
          stopped.current = true;
          if (timer) clearInterval(timer);
          return;
        }
        if (!r.ok) return;
        const d = (await r.json()) as BeatRes;
        const seenAt = chatSeenAt();
        const unreadChat =
          !!d.latestChatAt &&
          d.latestChatBy !== d.me.id &&
          (!seenAt || Date.parse(d.latestChatAt) > Date.parse(seenAt));
        setOfficeState({
          ready: true,
          meId: d.me.id,
          isHq: d.me.isHq,
          online: d.online,
          faces: d.faces,
          latestChatAt: d.latestChatAt,
          unreadChat,
        });
        for (const k of d.inbox) {
          if (seen.current.has(k.id)) continue;
          seen.current.add(k.id);
          // そのスレッドを開いているなら、パネル側が拾う
          if (threadRef.current === k.fromId) continue;
          toast.custom(
            (id) => (
              <div className="w-[340px] max-w-[calc(100vw-2rem)] rounded-xl border border-zinc-200 bg-white shadow-lg p-3.5">
                <p className="text-[11px] text-zinc-500">{k.fromName} さんからひとこと</p>
                <p className="mt-1 text-[13px] text-zinc-900 leading-relaxed whitespace-pre-wrap break-words">{k.message}</p>
                <div className="mt-2.5 flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      toast.dismiss(id);
                      openOfficeThread(k.fromId);
                    }}
                    className="px-3 py-1.5 rounded-lg bg-zinc-900 text-white text-[12px] hover:bg-zinc-700"
                  >
                    返す
                  </button>
                  <button
                    type="button"
                    onClick={() => toast.dismiss(id)}
                    className="px-3 py-1.5 rounded-lg text-[12px] text-zinc-500 hover:bg-zinc-100"
                  >
                    あとで
                  </button>
                </div>
              </div>
            ),
            { duration: 20_000 },
          );
        }
      } catch {
        /* 次の beat で拾う */
      }
    };
    beat();
    timer = setInterval(beat, BEAT_MS);
    const onVis = () => {
      if (document.visibilityState === "visible") beat();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      if (timer) clearInterval(timer);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  // ---------- スレッドを開く合図（地図・通知・チャットから） ----------
  useEffect(() => {
    const h = (e: Event) => {
      const d = (e as CustomEvent<{ userId: string; prefill?: string }>).detail;
      if (!d?.userId) return;
      setThread({ userId: d.userId, prefill: d.prefill });
    };
    window.addEventListener("office:open", h);
    return () => window.removeEventListener("office:open", h);
  }, []);

  if (!office.ready) return null;
  if (!thread) return null;
  return <ThreadPanel key={thread.userId} userId={thread.userId} prefill={thread.prefill} onClose={() => setThread(null)} />;
}

// ==============================================================
// 個別ひとことスレッド（右下）
// ==============================================================
function ThreadPanel({ userId, prefill, onClose }: { userId: string; prefill?: string; onClose: () => void }) {
  const [peer, setPeer] = useState<Peer | null>(null);
  const [items, setItems] = useState<KnockDTO[]>([]);
  const [text, setText] = useState(prefill ?? "");
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const office = useOfficeState();

  const load = useCallback(async () => {
    try {
      const r = await fetch(`/api/office/thread?userId=${encodeURIComponent(userId)}`, { cache: "no-store" });
      if (!r.ok) {
        setErr("相手が見つかりません");
        return;
      }
      const d = (await r.json()) as { peer: Peer; items: KnockDTO[] };
      setPeer(d.peer);
      setItems(d.items);
      setErr(null);
    } catch {
      /* 次で拾う */
    }
  }, [userId]);

  useEffect(() => {
    load();
    const t = setInterval(load, THREAD_POLL_MS);
    return () => clearInterval(t);
  }, [load]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [items.length]);

  const send = async () => {
    const m = text.trim();
    if (!m || sending) return;
    setSending(true);
    try {
      const r = await fetch("/api/office/knock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toId: userId, message: m }),
      });
      const d = (await r.json()) as { item?: KnockDTO; error?: string };
      if (!r.ok || !d.item) throw new Error(d.error ?? "送れませんでした");
      setItems((prev) => [...prev, d.item!]);
      setText("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "送れませんでした");
    } finally {
      setSending(false);
    }
  };

  const online = !!peer?.lastSeenAt && Date.now() - Date.parse(peer.lastSeenAt) < ONLINE_MS;

  return (
    <div className="fixed bottom-4 right-4 z-[60] w-[360px] max-w-[calc(100vw-2rem)] rounded-2xl border border-zinc-200 bg-white shadow-2xl flex flex-col max-h-[70vh]">
      <div className="flex items-center gap-3 px-3.5 py-3 border-b border-zinc-100">
        <span className="relative shrink-0">
          <Avatar src={peer?.avatar ?? null} initials={peer?.initials ?? "…"} size={40} />
          <span
            className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${online ? "bg-emerald-500" : "bg-zinc-300"}`}
          />
        </span>
        <div className="min-w-0">
          <p className="text-[14px] font-semibold text-zinc-900 truncate">{peer?.name ?? "読み込み中…"}</p>
          <p className="text-[11px] text-zinc-500 truncate">
            {peer ? `${peer.company || "—"}・${peer.pref}${online ? "・いま動いています" : "・離席中（通知で届きます）"}` : ""}
          </p>
        </div>
        <button type="button" onClick={onClose} className="ml-auto p-2 rounded-lg text-zinc-400 hover:bg-zinc-100" aria-label="閉じる">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div ref={listRef} className="flex-1 overflow-y-auto px-3.5 py-3 space-y-2 min-h-[160px]">
        {err && <p className="text-[12px] text-rose-600">{err}</p>}
        {!err && items.length === 0 && (
          <p className="text-[12px] text-zinc-400 leading-relaxed">
            まだやり取りはありません。ひとことで大丈夫です（「岐阜の件、あとで少しいいですか」など）。
          </p>
        )}
        {items.map((k) => {
          const mine = k.fromId === office.meId;
          return (
            <div key={k.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-[13px] leading-relaxed whitespace-pre-wrap break-words ${
                  mine ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-900"
                }`}
              >
                {k.message}
                <span className="block text-[10px] mt-0.5 text-zinc-400">{hhmm(k.createdAt)}</span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="border-t border-zinc-100 p-2.5 flex items-end gap-2">
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
          placeholder="ひとこと…（Enterで送る）"
          className="flex-1 resize-none rounded-lg border border-zinc-200 px-3 py-2.5 text-[14px] text-zinc-900 outline-none focus:border-zinc-400 max-h-24"
        />
        <button
          type="button"
          onClick={send}
          disabled={!text.trim() || sending}
          className="p-2.5 rounded-lg bg-zinc-900 text-white hover:bg-zinc-700 disabled:opacity-40"
          aria-label="送る"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
