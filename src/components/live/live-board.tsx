"use client";

// GROUP LIVE: real feed updates drive the map and anonymous AI animations.
// Authorization and chat writes are unchanged. The API supplies calendar-day summaries.
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { Cpu, ExternalLink, X } from "lucide-react";
import { openOfficeThread } from "@/lib/office/store";
import { GroupChat } from "@/components/office/group-chat";
import { Avatar } from "@/components/office/avatar";
import { MAP_POINTS } from "./map-points";
import { aiKey, eventCopy, eventKey, eventOutcome, newKeys, periodLabel, type LiveEvent } from "./live-view";
import styles from "./live-board.module.css";

interface LiveDetail {
  title: string;
  subtitle?: string;
  actor: string;
  rows: { label: string; value: string }[];
  timeline?: { at: string; text: string }[];
  href?: string;
  hrefLabel?: string;
}
interface Counts { approach: number; deal: number; won: number; hq: number }
interface Feed {
  events: LiveEvent[];
  ai?: { at: string; text: string }[];
  counts: { today: Counts; week: Counts; recent3days?: Counts };
  periods?: { recent3days: { from: string; to: string } };
  prefHeat: Record<string, number>;
  generatedAt: string;
}
interface OfficeUser {
  id: string; name: string; initials: string; avatar: string | null;
  company: string; pref: string; isHq: boolean;
}
interface Who { meId: string; users: OfficeUser[] }

const KIND_LABEL: Record<string, string> = {
  sent: "送付", deal: "商談", won: "受注", log: "活動", move: "動き",
  booking: "面談予約", tender: "入札○", lead: "リード", tver: "TVer", customer: "顧客登録",
  tool: "営業ツール", ad: "広告", auto: "自動検知", visit: "お客様", mail: "メール反応",
};
const DAY = 86_400_000;
const POLL_MS = 20_000;
const CHAT_REF = /^(deal|customer|project|move|sent|tender|package|lead):(.+)$/;

function ago(iso: string): string {
  const seconds = Math.max(0, (Date.now() - Date.parse(iso)) / 1000);
  if (!Number.isFinite(seconds)) return "—";
  if (seconds < 60) return "たった今";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}分前`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}時間前`;
  return `${Math.floor(seconds / 86400)}日前`;
}
function safeHref(url?: string): string | undefined {
  const value = (url ?? "").trim();
  if (/^https?:\/\//i.test(value)) return value;
  if (value.startsWith("/") && !value.startsWith("//")) return value;
  return undefined;
}

export function LiveBoard({ compact = false }: { compact?: boolean } = {}) {
  const [feed, setFeed] = useState<Feed | null>(null);
  const [who, setWho] = useState<Who | null>(null);
  const [clock, setClock] = useState("");
  const [error, setError] = useState(false);
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [freshEvents, setFreshEvents] = useState<Set<string>>(new Set());
  const [freshAi, setFreshAi] = useState<Set<string>>(new Set());
  const [showAllAi, setShowAllAi] = useState(false);
  const seenEvents = useRef<Set<string> | null>(null);
  const seenAi = useRef<Set<string> | null>(null);
  const [picked, setPicked] = useState<LiveEvent | null>(null);
  const [detail, setDetail] = useState<LiveDetail | null>(null);
  const [detailState, setDetailState] = useState<"idle" | "loading" | "error">("idle");
  const detailRequest = useRef<AbortController | null>(null);
  const detailSequence = useRef(0);
  const drawerRef = useRef<HTMLDivElement>(null);
  const chatRef = useRef<HTMLElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const uid = useId().replace(/:/g, "");

  const close = useCallback(() => {
    detailSequence.current += 1;
    detailRequest.current?.abort();
    setPicked(null);
    openerRef.current?.focus();
  }, []);

  const open = (event: LiveEvent) => {
    detailSequence.current += 1;
    const sequence = detailSequence.current;
    detailRequest.current?.abort();
    openerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setActiveKey(eventKey(event));
    setPicked(event);
    setDetail(null);
    if (!event.ref) { setDetailState("idle"); return; }
    const controller = new AbortController();
    detailRequest.current = controller;
    setDetailState("loading");
    fetch(`/api/live/detail?kind=${encodeURIComponent(event.ref.kind)}&id=${encodeURIComponent(event.ref.id)}`, { cache: "no-store", signal: controller.signal })
      .then((response) => response.ok ? response.json() : Promise.reject(new Error("detail")))
      .then((value: LiveDetail) => {
        if (sequence !== detailSequence.current) return;
        setDetail(value); setDetailState("idle");
      })
      .catch(() => {
        if (!controller.signal.aborted && sequence === detailSequence.current) setDetailState("error");
      });
  };

  useEffect(() => {
    let disposed = false;
    let loading = false;
    const controller = new AbortController();
    const load = async () => {
      if (loading) return;
      loading = true;
      const presence = fetch("/api/office/who", { cache: "no-store", signal: controller.signal })
        .then((response) => response.ok ? response.json() : null)
        .then((value: Who | null) => { if (!disposed && value) setWho(value); })
        .catch(() => {});
      try {
        const response = await fetch("/api/live/feed", { cache: "no-store", signal: controller.signal });
        if (!response.ok) throw new Error("feed");
        const value = await response.json() as Feed;
        if (disposed) return;
        const keys = value.events.map(eventKey);
        const aiKeys = (value.ai ?? []).map(aiKey);
        const incoming = newKeys(seenEvents.current, keys);
        setFreshEvents(incoming);
        setFreshAi(newKeys(seenAi.current, aiKeys));
        // Remember already observed records across temporary omissions in an API snapshot.
        seenEvents.current = new Set([...(seenEvents.current ?? []), ...keys]);
        seenAi.current = new Set([...(seenAi.current ?? []), ...aiKeys]);
        setActiveKey((previous) => incoming.values().next().value ?? (previous && keys.includes(previous) ? previous : keys[0] ?? null));
        setFeed(value); setError(false);
      } catch {
        if (!disposed) setError(true);
      } finally {
        await presence;
        loading = false;
      }
    };
    void load();
    const poll = setInterval(() => void load(), POLL_MS);
    const tick = () => setClock(new Date().toLocaleTimeString("ja-JP", { timeZone: "Asia/Tokyo", hour: "2-digit", minute: "2-digit", second: "2-digit" }));
    const timer = setInterval(tick, 1000);
    return () => { disposed = true; controller.abort(); clearInterval(poll); clearInterval(timer); };
  }, []);

  useEffect(() => () => { detailSequence.current += 1; detailRequest.current?.abort(); }, []);

  // GroupChat stays mounted, so compose/filter events work from both dashboard sizes.
  useEffect(() => {
    if (compact) return;
    const params = new URLSearchParams(window.location.search);
    const withId = params.get("with");
    if (withId) openOfficeThread(withId);
    const match = CHAT_REF.exec(params.get("ref") ?? "");
    if (!match) return;
    let disposed = false;
    const given = (params.get("t") ?? "").trim().slice(0, 80);
    const apply = (title: string) => {
      if (disposed) return;
      window.dispatchEvent(new CustomEvent("office:filter", { detail: { kind: match[1], id: match[2], title } }));
      chatRef.current?.scrollIntoView({ block: "nearest" });
    };
    fetch(`/api/office/chat?refKind=${match[1]}&refId=${encodeURIComponent(match[2])}`, { cache: "no-store" })
      .then((response) => response.ok ? response.json() : null)
      .then((value: { items?: { ref?: { title: string } | null }[] } | null) => apply(given || value?.items?.find((item) => item.ref)?.ref?.title || "この案件"))
      .catch(() => apply(given || "この案件"));
    return () => { disposed = true; };
  }, [compact]);

  useEffect(() => {
    if (!picked) return;
    const drawer = drawerRef.current;
    drawer?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); close(); }
      if (event.key !== "Tab" || !drawer) return;
      const focusable = Array.from(drawer.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], input, textarea, [tabindex="0"]'));
      const first = focusable[0], last = focusable[focusable.length - 1];
      if (!first) { event.preventDefault(); return; }
      if (event.shiftKey && (document.activeElement === first || document.activeElement === drawer)) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", keydown);
    return () => document.removeEventListener("keydown", keydown);
  }, [picked, close]);

  const active = feed?.events.find((event) => eventKey(event) === activeKey) ?? feed?.events[0];
  const activeOutcome = eventOutcome(active);
  const selectedPrefs = new Set(active?.prefs ?? []);
  const animatedPrefs = new Set((feed?.events ?? []).filter((event) => freshEvents.has(eventKey(event))).flatMap((event) => event.prefs));
  const heat = feed?.prefHeat ?? {};
  const placed = useMemo(() => {
    const groups: Record<string, OfficeUser[]> = {};
    for (const user of who?.users ?? []) (groups[user.pref] ??= []).push(user);
    return Object.entries(groups).flatMap(([pref, users]) => {
      const point = MAP_POINTS[pref] ?? MAP_POINTS["東京"];
      return users.map((user, index) => ({ user, x: point[0] + (index - (users.length - 1) / 2) * 29, y: point[1] - 20 }));
    });
  }, [who]);
  const stats: { key: keyof Counts; label: string }[] = [
    { key: "approach", label: "アプローチ" }, { key: "deal", label: "動いた商談" },
    { key: "won", label: "受注" }, { key: "hq", label: "本部・自動検出" },
  ];
  const askAboutPicked = () => {
    if (!picked?.ref) return;
    const ref = { kind: picked.ref.kind, id: picked.ref.id, title: detail?.title ?? picked.text, sub: detail?.subtitle ?? detail?.actor ?? picked.actor };
    close();
    chatRef.current?.scrollIntoView({ block: "nearest" });
    window.dispatchEvent(new CustomEvent("office:compose", { detail: ref }));
  };

  return (
    <section className={`${styles.board} ${compact ? styles.compact : ""}`} aria-label="GROUP LIVE">
      <header className={styles.header}>
        <div><p className={styles.eyebrow}>GROUP NETWORK</p><h1 className={styles.title}>GROUP LIVE</h1><p className={styles.subtitle}>全国の動きと、AIの稼働がここに集まる。</p></div>
        <div className={styles.headerTools}>
          <span className={`${styles.status} ${error ? styles.error : ""}`} role="status"><span className={styles.statusDot} />{error ? "接続を確認中" : feed ? "自動更新" : "接続中"}</span>
          {compact ? <a className={styles.fullLink} href="/dashboard/live">全画面で見る ↗</a> : <span className={styles.clock}>{clock || "—"} JST</span>}
        </div>
      </header>
      <div className={styles.statsHeading}><h2>直近3日間</h2><span>{periodLabel(feed?.periods?.recent3days)}</span></div>
      <div className={styles.stats}>
        {stats.map(({ key, label }) => <div className={`${styles.stat} ${key === "won" ? styles.statWon : ""}`} key={key}><p className={styles.statLabel}>{label}</p><p className={styles.statValue}>{feed?.counts.recent3days ? feed.counts.recent3days[key].toLocaleString("ja-JP") : "—"}<small>件</small></p><p className={styles.statToday}>うち今日 <strong>{feed ? feed.counts.today[key].toLocaleString("ja-JP") : "—"}</strong>件</p></div>)}
      </div>
      <div className={styles.main}>
        <section className={`${styles.mapPanel} ${activeOutcome?.tone === "won" ? styles.mapWon : activeOutcome ? styles.mapPositive : ""}`} aria-label="全国の活動マップ">
          <div className={styles.panelHead}><h2>ACTIVITY MAP</h2><small>JAPAN</small></div>
          <svg className={styles.map} viewBox="0 0 513 380" role="img" aria-label="沖縄を含む47都道府県の活動マップ。沖縄は拡大表示し、活動ログに連動して拠点が光ります">
            <image href="/live/japan-map.svg" x="0" y="0" width="513" height="380" />
            <g aria-label="沖縄県の拡大図">
              <path d="M28,205H198L230,173" fill="none" stroke="#3d4958" strokeWidth=".75" />
              <text x="36" y="74" fill="#d4dce6" fontSize="14" fontWeight="500">沖縄</text>
              <text x="75" y="74" className={styles.mapSmall}>拡大図</text>
            </g>
            {Object.entries(MAP_POINTS).map(([name, [x, y]]) => {
              const age = heat[name];
              const selected = selectedPrefs.has(name);
              const hot = age !== undefined && age < DAY;
              const warm = age !== undefined && age < 7 * DAY;
              return <g key={name}>
                {selected && <><circle cx={x} cy={y} r="21" className={styles.halo} /><circle cx={x} cy={y} r="10" className={styles.ring} /></>}
                {animatedPrefs.has(name) && <circle key={`${name}-${[...freshEvents].join()}`} cx={x} cy={y} r="7" className={`${styles.ring} ${styles.pulse}`} />}
                <circle cx={x} cy={y} r={selected ? 3.8 : hot ? 3.2 : 2.1} className={selected ? styles.nodeSelected : hot ? styles.nodeHot : warm ? styles.nodeWarm : styles.nodeOff} />
                {selected && <text x={x + 12} y={y + 4} className={styles.mapLabel}>{name}</text>}
              </g>;
            })}
            <defs>{placed.map(({ user, x, y }) => <clipPath key={user.id} id={`${uid}-${user.id}`}><circle cx={x} cy={y} r="11" /></clipPath>)}</defs>
            {placed.map(({ user, x, y }) => <g key={user.id}
              role={user.id === who?.meId ? undefined : "button"}
              tabIndex={user.id === who?.meId ? undefined : 0}
              aria-label={`${user.name} — ${user.id === who?.meId ? "自分" : "個別にひとこと"}`}
              style={{ cursor: user.id === who?.meId ? "default" : "pointer" }}
              onClick={() => { if (user.id !== who?.meId) openOfficeThread(user.id); }}
              onKeyDown={(event) => { if (user.id !== who?.meId && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); openOfficeThread(user.id); } }}>
              <circle cx={x} cy={y} r="19" fill="transparent" />
              <circle cx={x} cy={y} r="13" fill="#0c121a" stroke="#97acbf" strokeWidth="1.2" />
              {user.avatar ? <image href={user.avatar} x={x - 11} y={y - 11} width="22" height="22" clipPath={`url(#${uid}-${user.id})`} preserveAspectRatio="xMidYMid slice" /> : <text x={x} y={y + 3} textAnchor="middle" fill="#cfdbea" fontSize="8">{user.initials}</text>}
            </g>)}
          </svg>
          <div className={styles.mapSelection} aria-live="polite">{active ? <><strong>{active.actor}</strong><span>{active.text}</span></> : <span>{error ? "接続を確認しています" : feed ? "まだ活動の記録はありません" : "活動を読み込み中…"}</span>}</div>
          <div className={styles.mapFoot}><span>明るい点：24時間以内の動き</span><a href="https://github.com/dataofjapan/land" target="_blank" rel="noopener noreferrer">地図出典</a></div>
          {who && <div className={styles.presence}><p className={styles.presenceTitle}>いま OS を開いている {who.users.length}人</p><div className={styles.presenceUsers}>{who.users.map((user) => <button key={user.id} type="button" className={styles.person} disabled={user.id === who.meId} onClick={() => openOfficeThread(user.id)} title={user.id === who.meId ? "自分" : `${user.company}・${user.pref} — 個別にひとこと`}><Avatar src={user.avatar} initials={user.initials} size={24} /><span>{user.name}</span></button>)}</div></div>}
        </section>
        <section className={styles.feedPanel} aria-label="仲間の活動ログ"><div className={styles.panelHead}><h2>ACTIVITY FEED</h2><small>直近の動き</small></div><div className={styles.feedList}>
          {!feed && <p className={styles.empty}>{error ? "接続を確認しています。自動で再試行します。" : "活動を読み込み中…"}</p>}
          {feed?.events.length === 0 && <p className={styles.empty}>直近90日の動きがまだありません</p>}
          {(compact ? feed?.events.slice(0, 14) : feed?.events)?.map((event) => {
            const key = eventKey(event), copy = eventCopy(event.text), fresh = freshEvents.has(key), outcome = eventOutcome(event);
            return <button key={key} type="button" className={`${styles.event} ${key === eventKey(active ?? event) ? styles.eventActive : ""} ${fresh ? styles.eventNew : ""} ${outcome?.tone === "won" ? styles.eventWon : outcome ? styles.eventPositive : ""}`} onClick={() => open(event)} aria-label={`${event.actor}：${event.text}。詳細を見る`}><div className={styles.eventMeta}><strong>{event.actor}</strong><span className={`${styles.kind} ${outcome ? styles.resultBadge : ""}`}>{outcome?.label ?? KIND_LABEL[event.kind] ?? "活動"}</span>{fresh && <span className={styles.newBadge}>新着</span>}<time className={styles.eventTime} dateTime={event.at}>{ago(event.at)}</time></div><p className={styles.eventText}>{copy.client && <strong>{copy.client}</strong>}<span>{copy.action}</span></p></button>;
          })}
        </div></section>
      </div>
      <section className={styles.ai} aria-label="匿名のAI稼働ログ"><div className={styles.aiHeading}><Cpu aria-hidden="true" /><h2>AI ACTIVITY FEED</h2><small>匿名 · グループ全体</small></div>
        <div className={styles.aiGrid}>{(feed?.ai ?? []).slice(0, showAllAi ? compact ? 6 : 24 : 3).map((item) => <div key={aiKey(item)} className={`${styles.aiLog} ${freshAi.has(aiKey(item)) ? styles.aiNew : ""}`}><time dateTime={item.at}>{ago(item.at)}</time><p>{item.text}</p></div>)}</div>
        {feed && !feed.ai?.length && <p className={styles.empty}>AIの動きが記録されると、ここに表示されます</p>}
        {!feed && <p className={styles.empty}>{error ? "接続を確認しています" : "AIの動きを読み込み中…"}</p>}
        {(feed?.ai?.length ?? 0) > 3 && <button type="button" className={styles.aiMore} onClick={() => setShowAllAi((value) => !value)} aria-expanded={showAllAi}>{showAllAi ? "閉じる" : "以前のAIの動きも見る"}</button>}
      </section>
      <section className={styles.chat} ref={chatRef} aria-label="みんなのチャット"><div className={styles.chatHeading}><h2>みんなのチャット</h2><p>動きの詳細から、その案件を添えて聞けます</p></div><div className={styles.chatSurface}><GroupChat maxHeightClass={compact ? "max-h-[230px]" : "max-h-[420px]"} dense /></div></section>
      <footer className={styles.footer}><span>20秒ごとに自動更新 · AIの動きは匿名です</span><span>{error && feed ? "表示中の記録：" : "最終更新："}<time>{feed ? new Date(feed.generatedAt).toLocaleTimeString("ja-JP", { timeZone: "Asia/Tokyo", hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "—"}</time></span></footer>
      {picked && <div className={styles.detailOverlay} onClick={close}><div className={styles.detail} ref={drawerRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby={`${uid}-detail-title`} onClick={(event) => event.stopPropagation()}>
        <div className={styles.detailHead}><span className={styles.kind}>{KIND_LABEL[picked.kind] ?? "活動"}</span><time className={styles.eventTime}>{ago(picked.at)}</time><button type="button" className={styles.close} onClick={close} aria-label="詳細を閉じる"><X size={18} /></button></div>
        <p className={styles.detailSub}>{detail?.actor ?? picked.actor}</p><h2 id={`${uid}-detail-title`} className={styles.detailTitle}>{detail?.title ?? picked.text}</h2>
        {detailState === "loading" && <p className={styles.detailSub}>詳細を読み込み中…</p>}
        {detailState === "error" && <p className={styles.detailSub}>詳細を取得できませんでした。</p>}
        {detail && <>{detail.subtitle && <p className={styles.detailSub}>{detail.subtitle}</p>}<dl className={styles.detailRows}>{detail.rows.map((row) => <div key={row.label}><dt>{row.label}</dt><dd>{row.value}</dd></div>)}</dl>{detail.timeline && detail.timeline.length > 0 && <ul className={styles.detailTimeline}>{detail.timeline.map((item, index) => <li key={`${item.at}-${index}`}><time>{item.at}</time><span>{item.text}</span></li>)}</ul>}</>}
        <div className={styles.detailActions}>{picked.ref && <button type="button" className={styles.ask} onClick={askAboutPicked}>チャットでこれについて聞く</button>}{safeHref(detail?.href) && <a className={styles.detailLink} href={safeHref(detail?.href)} target={detail?.href?.startsWith("http") ? "_blank" : undefined} rel={detail?.href?.startsWith("http") ? "noopener noreferrer" : undefined}>{detail?.hrefLabel ?? "開く"} <ExternalLink size={12} className="inline" /></a>}</div><p className={styles.detailNote}>金額はこの画面では表示しません</p>
      </div></div>}
    </section>
  );
}
