"use client";
// ==============================================================
// グループオフィス 常駐エージェント（全ダッシュボード画面に見えない形で常駐）
//   ・15秒ごとに beat → 在席を灯し、自分宛の「ひとこと」「呼びかけ」を受け取る
//   ・ひとこと → トースト（返す）／呼びかけ → トースト（入る／いま無理）
//   ・スレッド（右下）と 5分の音声パネル をここから出す
//   主役は「一緒に動いている感じ」。会話は短く、長くなるなら予約へ流す。
// ==============================================================

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Mic, X, Send } from "lucide-react";
import { setOfficeState, useOfficeState, openOfficeThread } from "@/lib/office/store";
import { CallPanel, type CallSession, type CallEndReason } from "./call-panel";

const BEAT_MS = 15_000;
const THREAD_POLL_MS = 6_000;

interface KnockDTO {
  id: string;
  kind: "TEXT" | "CALL";
  fromId: string;
  toId: string;
  fromName: string;
  message: string;
  createdAt: string;
  readAt: string | null;
  expiresAt: string | null;
  acceptedAt: string | null;
  declinedAt: string | null;
  endedAt: string | null;
}
interface Peer {
  id: string;
  name: string;
  initials: string;
  company: string;
  pref: string;
  isHq: boolean;
  image: string | null;
  inCall: boolean;
  lastSeenAt: string | null;
}
interface BeatRes {
  me: { id: string; isHq: boolean };
  online: number;
  inbox: KnockDTO[];
  voice: boolean;
  callMinutes: number;
  bookingUrl: string;
}
interface CallRes {
  call: { room: string; url: string; token: string; expiresAt: string; peerName: string; peerId: string; peerIsHq: boolean };
}

function hhmm(iso: string) {
  return new Date(iso).toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" });
}

export function OfficeAgent() {
  const office = useOfficeState();
  const [thread, setThread] = useState<{ userId: string; prefill?: string } | null>(null);
  const [call, setCall] = useState<CallSession | null>(null);
  const [ended, setEnded] = useState<{ peerName: string; peerId: string; peerIsHq: boolean } | null>(null);

  const callRef = useRef<CallSession | null>(null);
  callRef.current = call;
  const threadRef = useRef<string | null>(null);
  threadRef.current = thread?.userId ?? null;
  const seen = useRef<Set<string>>(new Set());
  const stopped = useRef(false); // 401/403 が返ったら止める（デモ・停止中）

  // ---------- 呼びかけの終了（1か所に集約） ----------
  const endCall = useCallback((reason: CallEndReason) => {
    const c = callRef.current;
    if (!c) return;
    setCall(null);
    fetch(`/api/office/call/${c.room}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "end" }),
    }).catch(() => {});
    if (reason === "expired") {
      setEnded({ peerName: c.peerName, peerId: c.peerId, peerIsHq: c.peerIsHq });
    } else if (reason === "noanswer") {
      toast("いま離席のようです。ひとことを残しておきましょう", { duration: 5000 });
      openOfficeThread(c.peerId);
    } else if (reason === "error") {
      toast.error("音声に繋がりませんでした（マイクの許可をご確認ください）");
    }
  }, []);

  // ---------- 呼びかけに入る／断る ----------
  const accept = useCallback(async (k: KnockDTO, toastId: string | number) => {
    toast.dismiss(toastId);
    try {
      const r = await fetch(`/api/office/call/${k.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "accept" }),
      });
      const d = (await r.json()) as CallRes & { error?: string };
      if (!r.ok) throw new Error(d.error ?? "入れませんでした");
      setEnded(null);
      setCall({ ...d.call, role: "callee" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "入れませんでした");
    }
  }, []);
  const decline = useCallback((k: KnockDTO, toastId: string | number) => {
    toast.dismiss(toastId);
    fetch(`/api/office/call/${k.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "decline" }),
    }).catch(() => {});
  }, []);

  // ---------- beat ----------
  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;
    const beat = async () => {
      if (stopped.current) return;
      try {
        const r = await fetch("/api/office/beat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ room: callRef.current?.room ?? null }),
          cache: "no-store",
        });
        if (r.status === 401 || r.status === 403) {
          stopped.current = true;
          if (timer) clearInterval(timer);
          return;
        }
        if (!r.ok) return;
        const d = (await r.json()) as BeatRes;
        setOfficeState({
          ready: true,
          meId: d.me.id,
          isHq: d.me.isHq,
          online: d.online,
          voice: d.voice,
          callMinutes: d.callMinutes,
          bookingUrl: d.bookingUrl,
        });
        for (const k of d.inbox) {
          if (seen.current.has(k.id)) continue;
          seen.current.add(k.id);
          if (k.kind === "TEXT") {
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
          } else {
            if (callRef.current) continue; // 通話中は鳴らさない（サーバーも弾く）
            const ttl = Math.max(5_000, Math.min(60_000, Date.parse(k.expiresAt ?? "") - Date.now()));
            toast.custom(
              (id) => (
                <div className="w-[340px] max-w-[calc(100vw-2rem)] rounded-xl border border-emerald-200 bg-white shadow-lg p-3.5">
                  <p className="text-[11px] text-emerald-700 flex items-center gap-1.5">
                    <Mic className="w-3.5 h-3.5" />
                    {k.fromName} さんが声をかけています
                  </p>
                  <p className="mt-1 text-[12.5px] text-zinc-700">いま話せますか？（{d.callMinutes}分で切れます）</p>
                  <div className="mt-2.5 flex gap-2">
                    <button
                      type="button"
                      onClick={() => accept(k, id)}
                      className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-[12px] hover:bg-emerald-500"
                    >
                      入る
                    </button>
                    <button
                      type="button"
                      onClick={() => decline(k, id)}
                      className="px-3 py-1.5 rounded-lg text-[12px] text-zinc-600 border border-zinc-200 hover:bg-zinc-50"
                    >
                      いま無理
                    </button>
                  </div>
                </div>
              ),
              { duration: ttl },
            );
          }
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
  }, [accept, decline]);

  // ---------- スレッドを開く合図（地図・通知・パネルから） ----------
  useEffect(() => {
    const h = (e: Event) => {
      const d = (e as CustomEvent<{ userId: string; prefill?: string }>).detail;
      if (!d?.userId) return;
      setEnded(null);
      setThread({ userId: d.userId, prefill: d.prefill });
    };
    window.addEventListener("office:open", h);
    return () => window.removeEventListener("office:open", h);
  }, []);

  // ---------- 通話を始める（スレッドから） ----------
  const startCall = useCallback(async (peer: Peer) => {
    try {
      const r = await fetch("/api/office/call", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toId: peer.id }),
      });
      const d = (await r.json()) as CallRes & { error?: string };
      if (!r.ok) throw new Error(d.error ?? "開けませんでした");
      setEnded(null);
      setCall({ ...d.call, role: "caller" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "開けませんでした");
    }
  }, []);

  if (!office.ready) return null;

  return (
    <>
      {thread && !call && (
        <ThreadPanel
          key={thread.userId}
          userId={thread.userId}
          prefill={thread.prefill}
          canCall={office.voice && !call}
          callMinutes={office.callMinutes}
          onCall={startCall}
          onClose={() => setThread(null)}
        />
      )}
      {call && <CallPanel call={call} onEnd={endCall} />}
      {ended && !call && (
        <div className="fixed bottom-4 right-4 z-[70] w-[320px] max-w-[calc(100vw-2rem)] rounded-2xl border border-zinc-200 bg-white shadow-2xl p-4">
          <p className="text-[13px] font-semibold text-zinc-900">{office.callMinutes}分経ちました</p>
          <p className="mt-1 text-[12px] text-zinc-600 leading-relaxed">
            お互い忙しい社長どうし、ここまでで一区切りです。続きは時間を決めて話しましょう。
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {ended.peerIsHq && office.bookingUrl ? (
              <a
                href={office.bookingUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1.5 rounded-lg bg-zinc-900 text-white text-[12px] hover:bg-zinc-700"
              >
                本部との時間を予約する ↗
              </a>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setEnded(null);
                  openOfficeThread(ended.peerId, "続きを話したいです。ご都合のよい日時をいくつか教えてください。");
                }}
                className="px-3 py-1.5 rounded-lg bg-zinc-900 text-white text-[12px] hover:bg-zinc-700"
              >
                日時をひとことで送る
              </button>
            )}
            <button
              type="button"
              onClick={() => setEnded(null)}
              className="px-3 py-1.5 rounded-lg text-[12px] text-zinc-500 hover:bg-zinc-100"
            >
              閉じる
            </button>
          </div>
        </div>
      )}
    </>
  );
}

// ==============================================================
// ひとことスレッド（右下）
// ==============================================================
function ThreadPanel({
  userId,
  prefill,
  canCall,
  callMinutes,
  onCall,
  onClose,
}: {
  userId: string;
  prefill?: string;
  canCall: boolean;
  callMinutes: number;
  onCall: (peer: Peer) => void;
  onClose: () => void;
}) {
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

  const online = !!peer?.lastSeenAt && Date.now() - Date.parse(peer.lastSeenAt) < 45_000;

  return (
    <div className="fixed bottom-4 right-4 z-[60] w-[340px] max-w-[calc(100vw-2rem)] rounded-2xl border border-zinc-200 bg-white shadow-2xl flex flex-col max-h-[70vh]">
      <div className="flex items-center gap-2.5 px-3.5 py-2.5 border-b border-zinc-100">
        <span className="relative w-8 h-8 rounded-full bg-zinc-900 text-white text-[11px] font-bold flex items-center justify-center shrink-0">
          {peer?.initials ?? "…"}
          <span
            className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white ${online ? "bg-emerald-500" : "bg-zinc-300"}`}
          />
        </span>
        <div className="min-w-0">
          <p className="text-[13px] font-semibold text-zinc-900 truncate">{peer?.name ?? "読み込み中…"}</p>
          <p className="text-[10.5px] text-zinc-500 truncate">
            {peer ? `${peer.company || "—"}・${peer.pref}${online ? "・いま動いています" : "・離席中"}` : ""}
          </p>
        </div>
        <div className="ml-auto flex items-center gap-1">
          {canCall && peer && (
            <button
              type="button"
              disabled={!online || peer.inCall}
              onClick={() => onCall(peer)}
              title={online ? (peer.inCall ? "別の方と話し中" : `${callMinutes}分だけ音声で話す`) : "離席中は開けません"}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11.5px] bg-emerald-600 text-white hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Mic className="w-3.5 h-3.5" />
              いま話せる（{callMinutes}分）
            </button>
          )}
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg text-zinc-400 hover:bg-zinc-100" aria-label="閉じる">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div ref={listRef} className="flex-1 overflow-y-auto px-3.5 py-3 space-y-2 min-h-[140px]">
        {err && <p className="text-[12px] text-rose-600">{err}</p>}
        {!err && items.length === 0 && (
          <p className="text-[11.5px] text-zinc-400 leading-relaxed">
            まだやり取りはありません。ひとことで大丈夫です（「岐阜の件、あとで5分いいですか」など）。
          </p>
        )}
        {items.map((k) => {
          const mine = k.fromId === office.meId;
          const isCall = k.kind === "CALL";
          const callNote = isCall
            ? k.declinedAt
              ? "（いま無理でした）"
              : k.endedAt || (k.expiresAt && Date.parse(k.expiresAt) < Date.now())
                ? k.acceptedAt
                  ? "（話しました）"
                  : "（繋がりませんでした）"
                : ""
            : "";
          return (
            <div key={k.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[85%] rounded-2xl px-3 py-1.5 text-[12.5px] leading-relaxed whitespace-pre-wrap break-words ${
                  isCall
                    ? "bg-emerald-50 text-emerald-800 border border-emerald-100"
                    : mine
                      ? "bg-zinc-900 text-white"
                      : "bg-zinc-100 text-zinc-900"
                }`}
              >
                {k.message}
                {callNote && <span className="opacity-70"> {callNote}</span>}
                <span className={`block text-[9.5px] mt-0.5 ${mine && !isCall ? "text-zinc-400" : "text-zinc-400"}`}>{hhmm(k.createdAt)}</span>
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
          className="flex-1 resize-none rounded-lg border border-zinc-200 px-3 py-2 text-[13px] text-zinc-900 outline-none focus:border-zinc-400 max-h-24"
        />
        <button
          type="button"
          onClick={send}
          disabled={!text.trim() || sending}
          className="p-2 rounded-lg bg-zinc-900 text-white hover:bg-zinc-700 disabled:opacity-40"
          aria-label="送る"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
