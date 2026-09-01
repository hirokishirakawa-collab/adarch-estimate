"use client";
// ---------------------------------------------------------------
// アドアーチ・サイネージ プレイヤー（PWA）
//   1. トークン → なければ /pair で仮登録しペアリングコードを表示
//   2. manifest?since=版 を pollSec ごとに取得（=ハートビート）。版が変われば素材を Cache API へ差分取り込み
//   3. 再生は常にキャッシュ(blob)から＝回線断でも止まらない。取り込み完了後、ループ境界で新版へ切替
//   4. スケジュール（曜日/時刻/期間）は端末側で判定。該当なしは条件なしの「標準」
//   5. ウォッチドッグ: 素材が進まない/例外 → 次へ or リロード。再生ログは束ねて送信
// ---------------------------------------------------------------
import { useCallback, useEffect, useRef, useState } from "react";

const APP_VERSION = "1.0.0";
const LS_TOKEN = "signage:token";
const LS_MANIFEST_PREFIX = "signage:manifest:"; // 端末トークンごとに保存（別端末の保存内容と版番号が衝突しないように）
const CACHE_NAME = "signage-assets-v1";
const PAIR_POLL_MS = 10_000;
const LOG_FLUSH_MS = 60_000;
const STALL_GRACE_SEC = 15;
const HARD_WATCHDOG_MS = 10 * 60_000;

type Item = {
  id: string; assetId: string; type: "image" | "video"; url: string; durationSec: number;
  checksum: string; size: number; name: string; startDate: string | null; endDate: string | null;
  fullscreen?: boolean; // L字を外して全画面
};
type Schedule = {
  id: string; name: string; playlistId: string; daysOfWeek: number[];
  startTime: string | null; endTime: string | null; startDate: string | null; endDate: string | null; priority: number;
};
type Manifest = {
  version: number; device: { id: string; name: string; orientation: "LANDSCAPE" | "PORTRAIT"; pollSec: number };
  schedules: Schedule[]; playlists: Record<string, Item[]>;
  frame?: { enabled: boolean; sideUrl: string | null; ticker: string[] } | null; // L字配信（帯）
};
type PlayLog = { assetId: string; playedAt: string; durationSec: number };

function loadJson<T>(key: string): T | null { try { const v = localStorage.getItem(key); return v ? (JSON.parse(v) as T) : null; } catch { return null; } }
function saveJson(key: string, v: unknown) { try { localStorage.setItem(key, JSON.stringify(v)); } catch {} }

function hhmmToMin(s: string | null): number | null { if (!s) return null; const m = /^(\d{1,2}):(\d{2})$/.exec(s); return m ? +m[1] * 60 + +m[2] : null; }

/** 今この瞬間に流すべきスケジュールを選ぶ */
function pickSchedule(m: Manifest, now: Date): Schedule | null {
  const dow = now.getDay();
  const min = now.getHours() * 60 + now.getMinutes();
  const t = now.getTime();
  const ok = (s: Schedule) => {
    if (s.startDate && t < Date.parse(s.startDate)) return false;
    if (s.endDate && t > Date.parse(s.endDate)) return false;
    if (s.daysOfWeek.length > 0 && !s.daysOfWeek.includes(dow)) return false;
    const a = hhmmToMin(s.startTime), b = hhmmToMin(s.endTime);
    if (a !== null && b !== null) { if (a <= b ? !(min >= a && min < b) : !(min >= a || min < b)) return false; }
    else if (a !== null && min < a) return false;
    else if (b !== null && min >= b) return false;
    return true;
  };
  const list = [...m.schedules].sort((x, y) => y.priority - x.priority);
  return list.find(ok) ?? null;
}

function activeItems(m: Manifest, s: Schedule | null, now: Date): Item[] {
  if (!s) return [];
  const t = now.getTime();
  return (m.playlists[s.playlistId] ?? []).filter((it) =>
    !(it.startDate && t < Date.parse(it.startDate)) && !(it.endDate && t > Date.parse(it.endDate)));
}

export function SignagePlayer({ initialToken, debug }: { initialToken: string | null; debug: boolean }) {
  const [token, setToken] = useState<string | null>(null);
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [manifest, setManifest] = useState<Manifest | null>(null);
  const [current, setCurrent] = useState<{ item: Item; src: string } | null>(null);
  const [status, setStatus] = useState<string>("起動中");
  const [progress, setProgress] = useState<string | null>(null);
  const [sideSrc, setSideSrc] = useState<string | null>(null); // L字サイド帯の画像（キャッシュ→blob）

  const manifestRef = useRef<Manifest | null>(null);
  const pendingRef = useRef<Manifest | null>(null); // 取り込み済み・ループ境界で切替待ち
  const indexRef = useRef(0);
  const logsRef = useRef<PlayLog[]>([]);
  const lastAdvanceRef = useRef(Date.now());
  const stallTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const downloadedAtRef = useRef<string | null>(null);
  const playingAssetRef = useRef<string | null>(null); // タイマーを作り直さずに再生中素材を参照する

  // ---- トークン決定 ----
  useEffect(() => {
    const t = initialToken || localStorage.getItem(LS_TOKEN);
    if (t) { localStorage.setItem(LS_TOKEN, t); setToken(t); return; }
    (async () => {
      try {
        const r = await fetch("/api/signage/d/pair", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ label: navigator.userAgent.slice(0, 60) }) });
        const j = await r.json();
        if (j.token) { localStorage.setItem(LS_TOKEN, j.token); setToken(j.token); setPairingCode(j.pairingCode ?? null); }
        else setStatus("登録に失敗しました。再起動してください");
      } catch { setStatus("サーバーに接続できません"); setTimeout(() => location.reload(), 30_000); }
    })();
  }, [initialToken]);

  // ---- 保存済みマニフェストで即再生（オフライン起動） ----
  useEffect(() => {
    if (!token) return;
    const saved = loadJson<Manifest>(LS_MANIFEST_PREFIX + token);
    if (saved) { manifestRef.current = saved; setManifest(saved); }
  }, [token]);

  // ---- 素材の差分取り込み ----
  const ingest = useCallback(async (m: Manifest) => {
    const cache = await caches.open(CACHE_NAME);
    const wanted = new Map<string, { url: string; name: string }>();
    for (const items of Object.values(m.playlists)) for (const it of items) wanted.set(it.url, it);
    if (m.frame?.enabled && m.frame.sideUrl) wanted.set(m.frame.sideUrl, { url: m.frame.sideUrl, name: "サイド帯画像" });
    const keys = await cache.keys();
    const have = new Set(keys.map((k) => k.url));
    const missing = [...wanted.values()].filter((it) => !have.has(it.url));
    let done = 0;
    for (const it of missing) {
      setProgress(`素材を取り込み中 ${done + 1}/${missing.length}: ${it.name}`);
      const res = await fetch(it.url, { cache: "no-store" });
      if (!res.ok) throw new Error(`download failed ${res.status} ${it.name}`);
      await cache.put(it.url, res);
      done++;
    }
    for (const k of keys) if (!wanted.has(k.url)) await cache.delete(k);
    setProgress(null);
    if (missing.length > 0) downloadedAtRef.current = new Date().toISOString();
  }, []);

  // ---- マニフェスト取得（=ハートビート） ----
  useEffect(() => {
    if (!token) return;
    let stop = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const tick = async () => {
      if (stop) return;
      let next = PAIR_POLL_MS;
      try {
        const since = manifestRef.current?.version ?? pendingRef.current?.version ?? 0;
        const r = await fetch(`/api/signage/d/${token}/manifest?since=${since}`, { cache: "no-store" });
        if (r.status === 404) { localStorage.removeItem(LS_TOKEN); setStatus("端末登録が見つかりません。再起動します"); setTimeout(() => location.reload(), 5000); return; }
        const j = await r.json();
        if (j.status === "unpaired") { setPairingCode(j.pairingCode ?? null); setStatus("ペアリング待ち"); }
        else if (j.status === "unchanged") { next = (j.pollSec ?? 60) * 1000; setPairingCode(null); }
        else if (j.status === "ok") {
          setPairingCode(null);
          const m = j as Manifest;
          next = (m.device.pollSec ?? 60) * 1000;
          await ingest(m);
          saveJson(LS_MANIFEST_PREFIX + token, m);
          if (!manifestRef.current) { manifestRef.current = m; setManifest(m); }
          else pendingRef.current = m; // ループ境界で切替
        }
      } catch (e) {
        setStatus(`オフライン（保存済みの内容で再生中）`);
        if (debug) console.warn("[signage] manifest error", e);
        next = 30_000;
      }
      timer = setTimeout(tick, next);
    };
    tick();
    return () => { stop = true; if (timer) clearTimeout(timer); };
  }, [token, ingest, debug]);

  // ---- ハートビート（5分）＋ログ送信（1分） ----
  useEffect(() => {
    if (!token) return;
    const hb = setInterval(async () => {
      try {
        const est = (await navigator.storage?.estimate?.()) ?? {};
        await fetch(`/api/signage/d/${token}/heartbeat`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            appVersion: APP_VERSION,
            storageUsedMb: est.usage ? est.usage / 1048576 : undefined,
            storageTotalMb: est.quota ? est.quota / 1048576 : undefined,
            playingAssetId: playingAssetRef.current,
            downloadedAt: downloadedAtRef.current,
          }),
        });
      } catch {}
    }, 5 * 60_000);
    const fl = setInterval(async () => {
      if (logsRef.current.length === 0) return;
      const batch = logsRef.current.splice(0, 500);
      try {
        const r = await fetch(`/api/signage/d/${token}/logs`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ logs: batch }) });
        if (!r.ok) logsRef.current.unshift(...batch);
      } catch { logsRef.current.unshift(...batch); }
    }, LOG_FLUSH_MS);
    return () => { clearInterval(hb); clearInterval(fl); };
  }, [token]);

  // ---- 再生ループ ----
  const advance = useCallback(async () => {
    if (stallTimerRef.current) { clearTimeout(stallTimerRef.current); stallTimerRef.current = null; }
    lastAdvanceRef.current = Date.now();
    // ループ境界で新版へ
    if (pendingRef.current && indexRef.current === 0) { manifestRef.current = pendingRef.current; pendingRef.current = null; setManifest(manifestRef.current); }
    const m = manifestRef.current;
    if (!m) return;
    const now = new Date();
    const items = activeItems(m, pickSchedule(m, now), now);
    if (items.length === 0) { setCurrent(null); setStatus("放映する内容がありません"); stallTimerRef.current = setTimeout(advance, 10_000); return; }
    if (indexRef.current >= items.length) indexRef.current = 0;
    const item = items[indexRef.current];
    indexRef.current = (indexRef.current + 1) % items.length;
    if (indexRef.current === 0 && pendingRef.current) { /* 次の advance で切替 */ }

    try {
      const cache = await caches.open(CACHE_NAME);
      const res = await cache.match(item.url);
      if (!res) { // 未取得 → その場で取りに行き、失敗なら飛ばす
        const r = await fetch(item.url, { cache: "no-store" });
        if (!r.ok) throw new Error("fetch failed");
        await cache.put(item.url, r.clone());
      }
      const blob = await (await cache.match(item.url))!.blob();
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
      const src = URL.createObjectURL(blob);
      objectUrlRef.current = src;
      setCurrent({ item, src });
      playingAssetRef.current = item.assetId;
      setStatus("");
      const startedAt = new Date().toISOString();
      const expect = item.type === "image" ? item.durationSec : (item.durationSec || 120);
      const onDone = () => { logsRef.current.push({ assetId: item.assetId, playedAt: startedAt, durationSec: expect }); advance(); };
      if (item.type === "image") stallTimerRef.current = setTimeout(onDone, Math.max(1, item.durationSec) * 1000);
      else stallTimerRef.current = setTimeout(onDone, (expect + STALL_GRACE_SEC) * 1000); // onended が来なければここで進む
    } catch (e) {
      if (debug) console.warn("[signage] play error", e);
      stallTimerRef.current = setTimeout(advance, 1000);
    }
  }, [debug]);

  useEffect(() => { if (manifest && !current) advance(); }, [manifest, current, advance]);

  // L字サイド帯の画像をキャッシュから blob URL にして保持
  useEffect(() => {
    const url = manifest?.frame?.enabled ? manifest.frame.sideUrl : null;
    let revoked: string | null = null;
    (async () => {
      if (!url) { setSideSrc(null); return; }
      try {
        const cache = await caches.open(CACHE_NAME);
        let res = await cache.match(url);
        if (!res) { const r = await fetch(url, { cache: "no-store" }); if (r.ok) { await cache.put(url, r.clone()); res = r; } }
        if (!res) { setSideSrc(null); return; }
        const src = URL.createObjectURL(await res.blob());
        revoked = src;
        setSideSrc(src);
      } catch { setSideSrc(null); }
    })();
    return () => { if (revoked) URL.revokeObjectURL(revoked); };
  }, [manifest]);

  // 動画は明示的に play() を呼ぶ（autoplay 属性だけでは端末によって始まらない）
  useEffect(() => {
    if (current?.item.type !== "video") return;
    const v = videoRef.current;
    if (!v) return;
    v.muted = true;
    v.defaultMuted = true;
    const tryPlay = () => v.play().catch((e) => { if (debug) console.warn("[signage] play() rejected", e); });
    tryPlay();
    const onCanPlay = () => tryPlay();
    v.addEventListener("canplay", onCanPlay);
    return () => v.removeEventListener("canplay", onCanPlay);
  }, [current, debug]);

  // ---- ハードウォッチドッグ＋例外リロード ----
  useEffect(() => {
    const wd = setInterval(() => { if (manifestRef.current && Date.now() - lastAdvanceRef.current > HARD_WATCHDOG_MS) location.reload(); }, 60_000);
    // 共通レイアウトのSW登録失敗など、再生と無関係な例外ではリロードしない
    const isPlayerFatal = (msg: string) => !/ServiceWorker|sw\.js|ResizeObserver|HMR/i.test(msg);
    const onErr = (ev: ErrorEvent | PromiseRejectionEvent) => {
      const msg = "message" in ev ? String(ev.message) : String((ev as PromiseRejectionEvent).reason ?? "");
      if (!isPlayerFatal(msg)) return;
      if (debug) console.warn("[signage] fatal, reloading in 5s:", msg);
      setTimeout(() => location.reload(), 5000);
    };
    window.addEventListener("error", onErr);
    window.addEventListener("unhandledrejection", onErr);
    return () => { clearInterval(wd); window.removeEventListener("error", onErr); window.removeEventListener("unhandledrejection", onErr); };
  }, [debug]);

  // ---- 全画面（クリック/タップで） ----
  const goFullscreen = () => { document.documentElement.requestFullscreen?.().catch(() => {}); };

  const portrait = manifest?.device.orientation === "PORTRAIT";
  const rotate: React.CSSProperties = portrait
    ? { width: "100vh", height: "100vw", transform: "rotate(90deg) translateY(-100%)", transformOrigin: "top left" }
    : { width: "100vw", height: "100vh" };

  // L字（帯）: 帯が有効で、今の枠が「全画面」指定でないときだけ
  const frame = manifest?.frame?.enabled ? manifest.frame : null;
  const frameOn = !!frame && !!current && !current.item.fullscreen;
  const tickerText = frame && frame.ticker.length > 0 ? frame.ticker.join("　　◆　　") : "";
  // 帯の寸法（短辺基準）: サイド帯=幅22%・下帯=高さ9%
  const sideW = frameOn && frame?.sideUrl ? "22%" : "0%";
  const tickerH = frameOn && tickerText ? "9%" : "0%";

  const media = current && (
    current.item.type === "image" ? (
      // eslint-disable-next-line @next/next/no-img-element -- blob URL（Cache API）を表示するため next/image は使えない
      <img key={current.item.id + current.src} src={current.src} alt="" style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }} />
    ) : (
      <video key={current.item.id + current.src} ref={videoRef} src={current.src} autoPlay muted playsInline preload="auto"
        onEnded={() => { if (stallTimerRef.current) clearTimeout(stallTimerRef.current); logsRef.current.push({ assetId: current.item.assetId, playedAt: new Date(Date.now() - (videoRef.current?.duration ?? 0) * 1000).toISOString(), durationSec: Math.round(videoRef.current?.duration ?? current.item.durationSec) }); advance(); }}
        onError={() => advance()}
        style={{ width: "100%", height: "100%", objectFit: "contain", display: "block", background: "#000" }} />
    )
  );

  return (
    <div onClick={goFullscreen} style={{ position: "fixed", inset: 0, background: "#000", overflow: "hidden", cursor: "none", fontFamily: "system-ui, sans-serif" }}>
      <style>{`@keyframes signage-ticker { from { transform: translateX(0); } to { transform: translateX(-50%); } }`}</style>
      <div style={{ position: "absolute", top: 0, left: 0, ...rotate, display: "flex", flexDirection: "column" }}>
        <div style={{ flex: 1, minHeight: 0, display: "flex" }}>
          <div style={{ flex: 1, minWidth: 0, background: "#000" }}>{media}</div>
          {frameOn && frame?.sideUrl && (
            <div style={{ width: sideW, flexShrink: 0, background: "#111", overflow: "hidden" }}>
              {/* eslint-disable-next-line @next/next/no-img-element -- blob URL */}
              {sideSrc && <img src={sideSrc} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />}
            </div>
          )}
        </div>
        {frameOn && tickerText && (
          <div style={{ height: tickerH, flexShrink: 0, background: "#F19834", color: "#111", display: "flex", alignItems: "center", overflow: "hidden", whiteSpace: "nowrap" }}>
            <div style={{ display: "inline-block", fontSize: "min(4.2vh, 3vw)", fontWeight: 700, letterSpacing: "0.04em", animation: `signage-ticker ${Math.max(20, tickerText.length * 0.6)}s linear infinite`, paddingLeft: "0" }}>
              <span style={{ paddingRight: "8vw" }}>{tickerText}</span><span style={{ paddingRight: "8vw" }}>{tickerText}</span>
            </div>
          </div>
        )}
      </div>

      {pairingCode && (
        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "#fff", background: "#0f172a" }}>
          <div style={{ fontSize: "2.5vw", letterSpacing: "0.1em", opacity: 0.8 }}>AD ARCH SIGNAGE</div>
          <div style={{ fontSize: "3vw", marginTop: "3vh" }}>ペアリングコード</div>
          <div style={{ fontSize: "14vw", fontWeight: 700, letterSpacing: "0.15em", fontVariantNumeric: "tabular-nums" }}>{pairingCode}</div>
          <div style={{ fontSize: "2vw", opacity: 0.7, marginTop: "2vh" }}>OSの「サイネージ → 端末を追加」でこの番号を入力してください</div>
        </div>
      )}

      {!pairingCode && !current && (
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", color: "#94a3b8", fontSize: "2.5vw" }}>
          {progress ?? status ?? ""}
        </div>
      )}

      {(debug || progress) && (
        <div style={{ position: "absolute", left: 12, bottom: 12, color: "#fff", background: "rgba(0,0,0,.55)", padding: "6px 10px", borderRadius: 6, fontSize: 14 }}>
          {manifest ? `${manifest.device.name} v${manifest.version}` : "—"} ／ {progress ?? status} ／ {current?.item.name ?? ""} ／ player {APP_VERSION}
        </div>
      )}
    </div>
  );
}
