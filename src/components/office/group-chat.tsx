"use client";
// ==============================================================
// みんなのチャット（/live の右側）— 全員に見えるタイムライン
//   ・5秒ごとに新着だけ取りに行く（after=最後の時刻）
//   ・名前を押すと個別ひとこと
//   ・金額は書かない場（下に注記）
// ==============================================================

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Send, Paperclip, X, Search, ExternalLink } from "lucide-react";
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
  ref: ChatRefView | null;
  createdAt: string;
}
interface ChatRefView {
  kind: string;
  id: string | null;
  title: string;
  sub: string | null;
  href: string | null;
}
/** 送るときは {kind,id} か {kind:"url",href} だけ。題名はサーバーが取り直す */
export interface ComposeRef {
  kind: string;
  id?: string;
  href?: string;
  title: string;
  sub?: string | null;
}
const REF_LABEL: Record<string, string> = {
  deal: "商談",
  move: "動き",
  sent: "送付",
  tender: "入札○",
  customer: "顧客",
  project: "案件",
  package: "パッケージ",
  url: "OSの画面",
  booking: "面談予約",
};
function safeHref(v: string | null | undefined): string | undefined {
  const t = (v ?? "").trim();
  if (!t) return undefined;
  if (/^https?:\/\//i.test(t)) return t;
  if (t.startsWith("/") && !t.startsWith("//")) return t;
  return undefined;
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
  const [ref, setRef] = useState<ComposeRef | null>(null);
  const [picker, setPicker] = useState(false);
  // 案件別の会話（この案件に紐づく投稿だけを見る）
  const [filter, setFilter] = useState<{ kind: string; id: string; title: string } | null>(null);
  const filterRef = useRef<{ kind: string; id: string } | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
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
      const params = new URLSearchParams();
      if (lastAt.current) params.set("after", lastAt.current);
      if (filterRef.current) {
        params.set("refKind", filterRef.current.kind);
        params.set("refId", filterRef.current.id);
      }
      const q = params.toString() ? `?${params}` : "";
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

  // フィルタの切替＝一覧を取り直す
  const applyFilter = useCallback(
    (f: { kind: string; id: string; title: string } | null) => {
      filterRef.current = f ? { kind: f.kind, id: f.id } : null;
      setFilter(f);
      setItems([]);
      lastAt.current = null;
      setLoaded(false);
      stickToBottom.current = true;
      load();
    },
    [load],
  );

  // /dashboard/live?ref=deal:xxx で開かれたら、その案件の会話を出す
  useEffect(() => {
    const h = (e: Event) => {
      const d = (e as CustomEvent<{ kind: string; id: string; title: string }>).detail;
      if (d?.kind && d.id) applyFilter(d);
    };
    window.addEventListener("office:filter", h);
    return () => window.removeEventListener("office:filter", h);
  }, [applyFilter]);

  // 「チャットでこれについて聞く」（ライブフィードの詳細パネルなど）から紐づけを受け取る
  useEffect(() => {
    const h = (e: Event) => {
      const d = (e as CustomEvent<ComposeRef>).detail;
      if (!d?.kind || !d.title) return;
      setRef(d);
      setTimeout(() => inputRef.current?.focus(), 50);
    };
    window.addEventListener("office:compose", h);
    return () => window.removeEventListener("office:compose", h);
  }, []);

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
        body: JSON.stringify({
          text: t,
          ref: ref ? (ref.kind === "url" ? { kind: "url", href: ref.href } : { kind: ref.kind, id: ref.id }) : null,
        }),
      });
      const d = (await r.json()) as { item?: ChatDTO; error?: string };
      if (!r.ok || !d.item) throw new Error(d.error ?? "送れませんでした");
      stickToBottom.current = true;
      merge([d.item]);
      setText("");
      setRef(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "送れませんでした");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex flex-col">
      {filter && (
        <div className="flex items-center gap-2 px-3 py-2 border-b border-emerald-500/20 bg-emerald-500/[0.06] text-[12px]">
          <span className="text-[10px] px-1.5 py-px rounded border border-emerald-400/40 text-emerald-200">{REF_LABEL[filter.kind] ?? filter.kind}</span>
          <span className="text-emerald-50 truncate">「{filter.title}」の会話</span>
          <button
            type="button"
            onClick={() => {
              setRef({ kind: filter.kind, id: filter.id, title: filter.title });
              inputRef.current?.focus();
            }}
            className="ml-auto text-[11px] text-emerald-300 hover:underline whitespace-nowrap"
          >
            この案件について聞く
          </button>
          <button type="button" onClick={() => applyFilter(null)} className="text-[11px] text-zinc-400 hover:text-white whitespace-nowrap">
            全体へ戻る
          </button>
        </div>
      )}
      <div ref={listRef} onScroll={onScroll} className={`${maxHeightClass} overflow-y-auto px-3 py-3 space-y-3`}>
        {!loaded && <p className="px-1 py-8 text-center text-[12px] text-zinc-500">読み込み中…</p>}
        {loaded && items.length === 0 && filter && (
          <div className="px-2 py-8 text-center">
            <p className="text-[13px] text-zinc-300">この案件の会話はまだありません</p>
            <p className="mt-1 text-[11.5px] text-zinc-500 leading-relaxed">「この案件の動線は何でしたか？」のように聞くと、答えがここに残ります。</p>
          </div>
        )}
        {loaded && items.length === 0 && !filter && (
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
                {m.ref && (
                  <RefCard
                    r={m.ref}
                    onFilter={m.ref.id ? () => applyFilter({ kind: m.ref!.kind, id: m.ref!.id!, title: m.ref!.title }) : undefined}
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="border-t border-white/[0.06] p-2.5">
        {ref && (
          <div className="mb-2 flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1.5 text-[12px]">
            <span className="text-[10px] px-1.5 py-px rounded border border-emerald-400/40 text-emerald-200">{REF_LABEL[ref.kind] ?? ref.kind}</span>
            <span className="text-emerald-50 truncate">{ref.title}</span>
            {ref.sub && <span className="text-zinc-500 truncate hidden sm:inline">{ref.sub}</span>}
            <button type="button" onClick={() => setRef(null)} className="ml-auto p-1 rounded text-zinc-400 hover:text-white" aria-label="紐づけを外す">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
        <div className="flex items-end gap-2">
          <button
            type="button"
            onClick={() => setPicker(true)}
            title="OSの案件を紐づけて聞く"
            className={`p-2.5 rounded-lg border text-[12px] transition-colors ${ref ? "border-emerald-500/50 text-emerald-300" : "border-white/10 text-zinc-400 hover:text-white hover:border-white/20"}`}
            aria-label="紐づける"
          >
            <Paperclip className="w-4 h-4" />
          </button>
          <textarea
            ref={inputRef}
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
            placeholder={ref ? "この案件について聞きたいこと…" : "みんなに一言…（Enterで送る／Shift+Enterで改行）"}
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
        <p className="mt-1.5 px-0.5 text-[10px] text-zinc-600">全員に見えます。金額は書かない場所です。📎で案件を紐づけて聞けます。</p>
      </div>
      {picker && (
        <RefPicker
          onPick={(r) => {
            setRef(r);
            setPicker(false);
            setTimeout(() => inputRef.current?.focus(), 50);
          }}
          onClose={() => setPicker(false)}
        />
      )}
    </div>
  );
}

// ==============================================================
// 紐づけカード（メッセージの下）
// ==============================================================
function RefCard({ r, onFilter }: { r: ChatRefView; onFilter?: () => void }) {
  const href = safeHref(r.href);
  const external = !!href && /^https?:\/\//i.test(href);
  return (
    <div className="mt-1.5 flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1.5 max-w-md">
      <span className="text-[10px] px-1.5 py-px rounded border border-emerald-400/40 text-emerald-200 shrink-0">{REF_LABEL[r.kind] ?? r.kind}</span>
      <span className="min-w-0">
        <span className="block text-[12.5px] text-zinc-100 truncate">{r.title}</span>
        {r.sub && <span className="block text-[10.5px] text-zinc-500 truncate">{r.sub}</span>}
      </span>
      <span className="ml-auto flex items-center gap-1 shrink-0">
        {onFilter && (
          <button type="button" onClick={onFilter} title="この案件の会話だけを見る" className="px-1.5 py-1 rounded text-[10.5px] text-emerald-300 hover:bg-white/[0.08]">
            会話
          </button>
        )}
        {href && (
          <a
            href={href}
            target={external ? "_blank" : undefined}
            rel={external ? "noopener noreferrer" : undefined}
            title="開く"
            className="p-1 rounded text-zinc-400 hover:text-white hover:bg-white/[0.08]"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        )}
      </span>
    </div>
  );
}

// ==============================================================
// 紐づけ先を選ぶ（いま流れている動き／顧客・案件・商談の検索／OSの画面URL）
// ==============================================================
interface FeedEvent {
  at: string;
  kind: string;
  actor: string;
  text: string;
  ref?: { kind: string; id: string };
}
function RefPicker({ onPick, onClose }: { onPick: (r: ComposeRef) => void; onClose: () => void }) {
  const [q, setQ] = useState("");
  const [feed, setFeed] = useState<FeedEvent[]>([]);
  const [hits, setHits] = useState<ComposeRef[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    fetch("/api/live/feed", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { events?: FeedEvent[] } | null) => setFeed((d?.events ?? []).filter((e) => e.ref).slice(0, 25)))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const t = q.trim();
    if (t.length < 2) {
      setHits([]);
      return;
    }
    const url = safeHref(t);
    if (url && url.includes("/dashboard/")) {
      setHits([{ kind: "url", href: url, title: url.replace(/^https?:\/\/[^/]+/, ""), sub: "OSの画面" }]);
      return;
    }
    setSearching(true);
    const h = setTimeout(async () => {
      try {
        const r = await fetch(`/api/search?q=${encodeURIComponent(t)}`);
        const d = (await r.json()) as {
          customers?: { id: string; name: string }[];
          projects?: { id: string; title: string; status?: string }[];
          deals?: { id: string; title: string; status?: string }[];
          packages?: { id: string; name: string; category?: string }[];
        };
        setHits([
          ...(d.packages ?? []).map((x) => ({ kind: "package", id: x.id, title: x.name, sub: x.category ?? null })),
          ...(d.deals ?? []).map((x) => ({ kind: "deal", id: x.id, title: x.title, sub: x.status ?? null })),
          ...(d.customers ?? []).map((x) => ({ kind: "customer", id: x.id, title: x.name, sub: null })),
          ...(d.projects ?? []).map((x) => ({ kind: "project", id: x.id, title: x.title, sub: x.status ?? null })),
        ]);
      } catch {
        setHits([]);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(h);
  }, [q]);

  return (
    <div className="fixed inset-0 z-[65] flex items-end sm:items-center justify-center bg-black/60 p-3" onClick={onClose}>
      <div
        className="w-full max-w-lg max-h-[80vh] flex flex-col rounded-2xl border border-white/10 bg-[#0d1119] text-zinc-100 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 px-4 py-3 border-b border-white/10">
          <Paperclip className="w-4 h-4 text-emerald-300" />
          <span className="text-[13px] font-semibold">案件を紐づけて聞く</span>
          <button type="button" onClick={onClose} className="ml-auto p-1.5 rounded text-zinc-400 hover:text-white" aria-label="閉じる">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="px-4 pt-3">
          <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2">
            <Search className="w-4 h-4 text-zinc-500" />
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="顧客名・案件名・パッケージ名で探す／OSの画面URLを貼る"
              className="flex-1 bg-transparent text-[13.5px] outline-none placeholder:text-zinc-600"
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-2 py-2">
          {q.trim().length >= 2 ? (
            <>
              <p className="px-2 pt-1 pb-1.5 text-[10px] tracking-[0.15em] text-zinc-500">{searching ? "検索中…" : `検索結果 ${hits.length}`}</p>
              {hits.map((h) => (
                <PickRow key={`${h.kind}-${h.id ?? h.href}`} r={h} onPick={onPick} />
              ))}
              {!searching && hits.length === 0 && <p className="px-2 py-4 text-[12px] text-zinc-500">見つかりませんでした</p>}
            </>
          ) : (
            <>
              <p className="px-2 pt-1 pb-1.5 text-[10px] tracking-[0.15em] text-zinc-500">いま流れている動き（直近）</p>
              {feed.length === 0 && <p className="px-2 py-4 text-[12px] text-zinc-500">読み込み中…</p>}
              {feed.map((e, i) => (
                <PickRow
                  key={`${e.ref!.kind}-${e.ref!.id}-${i}`}
                  r={{ kind: e.ref!.kind, id: e.ref!.id, title: e.text, sub: e.actor }}
                  onPick={onPick}
                />
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
function PickRow({ r, onPick }: { r: ComposeRef; onPick: (r: ComposeRef) => void }) {
  return (
    <button
      type="button"
      onClick={() => onPick(r)}
      className="w-full text-left flex items-center gap-2.5 rounded-lg px-2.5 py-2.5 hover:bg-white/[0.06] active:bg-white/[0.1] transition-colors"
    >
      <span className="text-[10px] px-1.5 py-px rounded border border-emerald-400/40 text-emerald-200 shrink-0 w-12 text-center">{REF_LABEL[r.kind] ?? r.kind}</span>
      <span className="min-w-0">
        <span className="block text-[13px] text-zinc-100 truncate">{r.title}</span>
        {r.sub && <span className="block text-[10.5px] text-zinc-500 truncate">{r.sub}</span>}
      </span>
    </button>
  );
}
