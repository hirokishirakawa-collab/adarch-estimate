"use client";

// ==============================================================
// グループ稼働ライブボード（管制室ビュー）
//   ・20秒ごとに /api/live/feed をポーリング
//   ・日本地図（都道府県ドット）＝直近の動きがある県が光る
//   ・右にイベントティッカー、上に今日／7日のカウンタ
//   ・このページだけ意図的にダーク1トーン（管制室）。金額は一切出ない
// ==============================================================

import { useEffect, useRef, useState } from "react";

interface LiveEvent {
  at: string;
  kind: string;
  actor: string;
  prefs: string[];
  text: string;
  ref?: { kind: string; id: string };
}
interface LiveDetail {
  title: string;
  subtitle?: string;
  actor: string;
  rows: { label: string; value: string }[];
  timeline?: { at: string; text: string }[];
  href?: string;
  hrefLabel?: string;
}
interface Counts {
  approach: number;
  deal: number;
  won: number;
  hq: number;
}
interface Feed {
  events: LiveEvent[];
  counts: { today: Counts; week: Counts };
  prefHeat: Record<string, number>;
  generatedAt: string;
}

// 都道府県庁所在地の座標（緯度, 経度）。地図はこのドットだけで描く
const PREF_POS: Record<string, [number, number]> = {
  北海道: [43.06, 141.35], 青森: [40.82, 140.74], 岩手: [39.7, 141.15],
  宮城: [38.27, 140.87], 秋田: [39.72, 140.1], 山形: [38.24, 140.36],
  福島: [37.75, 140.47], 茨城: [36.34, 140.45], 栃木: [36.57, 139.88],
  群馬: [36.39, 139.06], 埼玉: [35.86, 139.65], 千葉: [35.61, 140.12],
  東京: [35.69, 139.69], 神奈川: [35.45, 139.64], 新潟: [37.9, 139.02],
  富山: [36.7, 137.21], 石川: [36.59, 136.63], 福井: [36.07, 136.22],
  山梨: [35.66, 138.57], 長野: [36.65, 138.18], 岐阜: [35.39, 136.72],
  静岡: [34.98, 138.38], 愛知: [35.18, 136.91], 三重: [34.73, 136.51],
  滋賀: [35.0, 135.87], 京都: [35.02, 135.76], 大阪: [34.69, 135.52],
  兵庫: [34.69, 135.18], 奈良: [34.69, 135.83], 和歌山: [34.23, 135.17],
  鳥取: [35.5, 134.24], 島根: [35.47, 133.05], 岡山: [34.66, 133.93],
  広島: [34.4, 132.46], 山口: [34.19, 131.47], 徳島: [34.07, 134.56],
  香川: [34.34, 134.04], 愛媛: [33.84, 132.77], 高知: [33.56, 133.53],
  福岡: [33.61, 130.42], 佐賀: [33.25, 130.3], 長崎: [32.74, 129.87],
  熊本: [32.79, 130.74], 大分: [33.24, 131.61], 宮崎: [31.91, 131.42],
  鹿児島: [31.56, 130.56],
};
// 沖縄はインセット（左下の枠内）
const OKINAWA_XY: [number, number] = [52, 330];

function project(lat: number, lng: number): [number, number] {
  const x = ((lng - 129.2) / (146 - 129.2)) * 340 + 30;
  const y = ((45.8 - lat) / (45.8 - 30.8)) * 340 + 22;
  return [x, y];
}

const KIND_META: Record<string, { label: string; cls: string }> = {
  sent: { label: "送付", cls: "text-sky-300 border-sky-500/30 bg-sky-500/10" },
  deal: { label: "商談", cls: "text-indigo-300 border-indigo-500/30 bg-indigo-500/10" },
  won: { label: "受注", cls: "text-emerald-300 border-emerald-500/30 bg-emerald-500/10" },
  log: { label: "活動", cls: "text-sky-300 border-sky-500/30 bg-sky-500/10" },
  move: { label: "動き", cls: "text-sky-300 border-sky-500/30 bg-sky-500/10" },
  lead: { label: "資料請求", cls: "text-amber-300 border-amber-500/30 bg-amber-500/10" },
  booking: { label: "面談予約", cls: "text-amber-300 border-amber-500/30 bg-amber-500/10" },
  joined: { label: "新規加盟", cls: "text-emerald-300 border-emerald-500/30 bg-emerald-500/10" },
  tender: { label: "入札○", cls: "text-violet-300 border-violet-500/30 bg-violet-500/10" },
};

function ago(iso: string): string {
  const s = Math.max(0, (Date.now() - Date.parse(iso)) / 1000);
  if (s < 60) return "たった今";
  if (s < 3600) return `${Math.floor(s / 60)}分前`;
  if (s < 86400) return `${Math.floor(s / 3600)}時間前`;
  return `${Math.floor(s / 86400)}日前`;
}

// APIが返すURLをそのまま href に入れない。詳細に載る公告URLは外部データなので、
// http(s) と自サイト内パス以外は弾く（javascript: を踏ませないため）。
function safeHref(url: string | undefined): string | undefined {
  const v = (url ?? "").trim();
  if (!v) return undefined;
  if (/^https?:\/\//i.test(v)) return v;
  if (v.startsWith("/") && !v.startsWith("//")) return v;
  return undefined;
}

export function LiveBoard({ compact = false }: { compact?: boolean } = {}) {
  const [feed, setFeed] = useState<Feed | null>(null);
  const [clock, setClock] = useState("");
  const [error, setError] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  // 押した1件のパネル。detail は ref を持つ種別だけ引きに行く
  const [picked, setPicked] = useState<LiveEvent | null>(null);
  const [detail, setDetail] = useState<LiveDetail | null>(null);
  const [detailState, setDetailState] = useState<"idle" | "loading" | "error">("idle");

  const open = (e: LiveEvent) => {
    setPicked(e);
    setDetail(null);
    if (!e.ref) {
      setDetailState("idle");
      return;
    }
    setDetailState("loading");
    fetch(`/api/live/detail?kind=${e.ref.kind}&id=${encodeURIComponent(e.ref.id)}`, {
      cache: "no-store",
    })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d: LiveDetail) => {
        setDetail(d);
        setDetailState("idle");
      })
      .catch(() => setDetailState("error"));
  };

  useEffect(() => {
    const load = async () => {
      try {
        const r = await fetch("/api/live/feed", { cache: "no-store" });
        if (!r.ok) throw new Error();
        setFeed(await r.json());
        setError(false);
      } catch {
        setError(true);
      }
    };
    load();
    timer.current = setInterval(load, 20000);
    const c = setInterval(
      () =>
        setClock(
          new Date().toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
        ),
      1000,
    );
    return () => {
      if (timer.current) clearInterval(timer.current);
      clearInterval(c);
    };
  }, []);

  const heat = feed?.prefHeat ?? {};
  const DAY = 86400000;
  const heatCls = (p: string): "hot" | "warm" | "cool" | "off" => {
    if (!(p in heat)) return "off";
    if (heat[p] < DAY) return "hot";
    if (heat[p] < 7 * DAY) return "warm";
    return "cool";
  };

  const t = feed?.counts.today;
  const w = feed?.counts.week;
  const tiles = [
    { n: t?.approach ?? 0, wn: w?.approach ?? 0, l: "アプローチ" },
    { n: t?.deal ?? 0, wn: w?.deal ?? 0, l: "商談が動いた" },
    { n: t?.won ?? 0, wn: w?.won ?? 0, l: "受注", hot: true },
    { n: t?.hq ?? 0, wn: w?.hq ?? 0, l: "本部・自動検出" },
  ];

  return (
    <div
      className={`${compact ? "p-4 sm:p-5" : "min-h-[calc(100vh-4rem)] p-5 sm:p-7"} rounded-2xl bg-[#0a0d13] text-zinc-200 relative overflow-hidden`}
    >
      {/* 背景グリッド */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(56,120,190,0.07) 1px, transparent 1px), linear-gradient(90deg, rgba(56,120,190,0.07) 1px, transparent 1px)",
          backgroundSize: "44px 44px",
        }}
      />

      {/* ヘッダー */}
      <div className="relative flex items-center gap-3 flex-wrap">
        <span className="relative flex h-2.5 w-2.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-60" />
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-sky-400" />
        </span>
        <h1 className="text-sm font-bold tracking-[0.2em] text-white">GROUP LIVE</h1>
        <span className="text-[11px] text-zinc-500">全国の代表の動きがリアルタイムで流れます</span>
        <div className="ml-auto flex items-center gap-3">
          {error && <span className="text-[11px] text-rose-400">再接続中…</span>}
          {compact ? (
            <a
              href="/dashboard/live"
              className="text-[11px] text-sky-300 hover:text-sky-200 border border-sky-500/30 bg-sky-500/10 rounded-full px-2.5 py-1"
            >
              全画面で見る →
            </a>
          ) : (
            <span className="font-mono text-[13px] text-zinc-400 tabular-nums">{clock}</span>
          )}
        </div>
      </div>

      {/* カウンタ */}
      <div
        className={`relative grid gap-3 ${compact ? "grid-cols-4 mt-4" : "grid-cols-2 sm:grid-cols-4 mt-5"}`}
      >
        {tiles.map((s) => (
          <div
            key={s.l}
            className={`rounded-xl border border-white/[0.06] bg-white/[0.03] backdrop-blur-sm ${compact ? "px-2.5 py-2" : "px-4 py-3"}`}
          >
            <div className="flex items-baseline gap-1.5">
              <span
                className={`${compact ? "text-lg" : "text-2xl"} font-bold tabular-nums ${s.hot && s.n > 0 ? "text-emerald-300" : "text-white"}`}
              >
                {s.n}
              </span>
              <span className="text-[10px] text-zinc-500">今日</span>
            </div>
            <div className={`${compact ? "text-[10px]" : "text-[11px]"} text-zinc-400 mt-0.5 truncate`}>{s.l}</div>
            {!compact && <div className="text-[10px] text-zinc-600 tabular-nums">7日間 {s.wn}</div>}
          </div>
        ))}
      </div>

      {/* 地図 + フィード */}
      <div
        className={`relative grid gap-5 items-start ${compact ? "sm:grid-cols-[minmax(220px,36%)_1fr] mt-4" : "lg:grid-cols-[minmax(320px,46%)_1fr] mt-5"}`}
      >
        {/* 日本地図（ドット） */}
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
          <svg viewBox="0 0 400 400" className="w-full h-auto" role="img" aria-label="全国の稼働マップ">
            <defs>
              <radialGradient id="glowHot">
                <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.9" />
                <stop offset="100%" stopColor="#38bdf8" stopOpacity="0" />
              </radialGradient>
            </defs>
            {/* 沖縄インセット枠 */}
            <rect x="24" y="308" width="56" height="44" rx="6" fill="none" stroke="rgba(255,255,255,0.08)" />
            {Object.entries(PREF_POS)
              .map(([name, [lat, lng]]) => ({ name, xy: project(lat, lng) }))
              .concat([{ name: "沖縄", xy: OKINAWA_XY }])
              .map(({ name, xy: [x, y] }) => {
                const h = heatCls(name);
                return (
                  <g key={name}>
                    {h === "hot" && (
                      <>
                        <circle cx={x} cy={y} r="14" fill="url(#glowHot)" />
                        <circle cx={x} cy={y} r="6" fill="none" stroke="#38bdf8" strokeOpacity="0.5">
                          <animate attributeName="r" values="5;13" dur="1.8s" repeatCount="indefinite" />
                          <animate attributeName="stroke-opacity" values="0.6;0" dur="1.8s" repeatCount="indefinite" />
                        </circle>
                      </>
                    )}
                    <circle
                      cx={x}
                      cy={y}
                      r={h === "hot" ? 4 : h === "warm" ? 3.4 : 2.4}
                      fill={
                        h === "hot"
                          ? "#7dd3fc"
                          : h === "warm"
                            ? "#38bdf8"
                            : h === "cool"
                              ? "#1e4f74"
                              : "#1c2431"
                      }
                    />
                    {h === "hot" && (
                      <text x={x + 7} y={y + 3.5} fontSize="9" fill="#bae6fd">
                        {name}
                      </text>
                    )}
                  </g>
                );
              })}
          </svg>
          <div className={`${compact ? "hidden" : "flex"} items-center gap-4 px-2 pb-1 text-[10px] text-zinc-500`}>
            <span className="flex items-center gap-1.5">
              <i className="inline-block w-2 h-2 rounded-full bg-sky-300" />24時間以内
            </span>
            <span className="flex items-center gap-1.5">
              <i className="inline-block w-2 h-2 rounded-full bg-sky-500" />7日以内
            </span>
            <span className="flex items-center gap-1.5">
              <i className="inline-block w-2 h-2 rounded-full bg-[#1e4f74]" />90日以内
            </span>
          </div>
        </div>

        {/* イベントティッカー */}
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
          <div className="px-4 py-2.5 border-b border-white/[0.06] text-[11px] tracking-[0.15em] text-zinc-500">
            ACTIVITY FEED
          </div>
          <div className={`${compact ? "max-h-[300px]" : "max-h-[560px]"} overflow-y-auto divide-y divide-white/[0.04]`}>
            {!feed && (
              <div className="px-4 py-8 text-center text-[12px] text-zinc-500">読み込み中…</div>
            )}
            {feed?.events.length === 0 && (
              <div className="px-4 py-8 text-center text-[12px] text-zinc-500">
                直近90日の動きがまだありません
              </div>
            )}
            {(compact ? feed?.events.slice(0, 14) : feed?.events)?.map((e, i) => {
              const meta = KIND_META[e.kind] ?? KIND_META.log;
              const fresh = Date.now() - Date.parse(e.at) < DAY;
              return (
                <button
                  type="button"
                  onClick={() => open(e)}
                  key={e.at + e.text + i}
                  className={`w-full text-left flex items-start gap-3 px-4 py-2.5 transition-colors
                              hover:bg-white/[0.05] focus:outline-none focus:bg-white/[0.06]
                              ${fresh ? "" : "opacity-60"}`}
                >
                  <span className="font-mono text-[10px] text-zinc-500 tabular-nums whitespace-nowrap mt-1 w-14">
                    {ago(e.at)}
                  </span>
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded border whitespace-nowrap mt-0.5 ${meta.cls}`}
                  >
                    {meta.label}
                  </span>
                  <div className="min-w-0 text-[12.5px] leading-relaxed">
                    <span className="text-zinc-400">{e.actor}</span>
                    <span className="text-zinc-600 mx-1.5">›</span>
                    <span className={e.kind === "won" || e.kind === "joined" ? "text-emerald-200" : "text-zinc-200"}>
                      {e.text}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {!compact && (
        <p className="relative mt-4 text-[10.5px] text-zinc-600">
          商談・送付台帳などから自動生成（20秒ごと更新）。金額と週次共有は表示されません。
        </p>
      )}

      {/* 詳細パネル */}
      {picked && (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-black/50"
          onClick={() => setPicked(null)}
        >
          <div
            className="w-full max-w-sm h-full overflow-y-auto bg-[#0d1119] border-l border-white/10 p-5"
            onClick={(ev) => ev.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3 mb-4">
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded border ${
                  (KIND_META[picked.kind] ?? KIND_META.log).cls
                }`}
              >
                {(KIND_META[picked.kind] ?? KIND_META.log).label}
              </span>
              <div className="flex items-center gap-3">
                <span className="text-[11px] text-zinc-500">{ago(picked.at)}</span>
                <button
                  type="button"
                  onClick={() => setPicked(null)}
                  className="text-zinc-500 hover:text-zinc-200 transition-colors text-sm leading-none"
                  aria-label="閉じる"
                >
                  ✕
                </button>
              </div>
            </div>

            <p className="text-[11px] text-zinc-500">{detail?.actor ?? picked.actor}</p>

            {detailState === "loading" && (
              <p className="mt-6 text-[12px] text-zinc-500">読み込み中…</p>
            )}

            {detailState === "error" && (
              <>
                <p className="mt-3 text-[13px] text-zinc-200 leading-relaxed">{picked.text}</p>
                <p className="mt-4 text-[11px] text-zinc-500">
                  詳細が取れませんでした（元の記録が消えている可能性があります）
                </p>
              </>
            )}

            {detailState === "idle" && !detail && (
              <p className="mt-3 text-[13px] text-zinc-200 leading-relaxed">{picked.text}</p>
            )}

            {detailState === "idle" && detail && (
              <>
                <p className="mt-1 text-[15px] font-bold text-zinc-100 leading-snug">
                  {detail.title}
                </p>
                {detail.subtitle && (
                  <p className="mt-1 text-[11.5px] text-zinc-400">{detail.subtitle}</p>
                )}

                <dl className="mt-4 space-y-2">
                  {detail.rows.map((r) => (
                    <div key={r.label} className="flex gap-3 text-[12px]">
                      <dt className="w-20 shrink-0 text-zinc-500">{r.label}</dt>
                      <dd className="text-zinc-200">{r.value}</dd>
                    </div>
                  ))}
                </dl>

                {detail.timeline && detail.timeline.length > 0 && (
                  <div className="mt-5">
                    <p className="text-[10px] tracking-[0.15em] text-zinc-500 mb-2">直近の動き</p>
                    <ul className="space-y-2">
                      {detail.timeline.map((t2, i) => (
                        <li key={i} className="flex gap-3 text-[12px]">
                          <span className="font-mono text-[10px] text-zinc-500 tabular-nums w-10 shrink-0 mt-0.5">
                            {t2.at}
                          </span>
                          <span className="text-zinc-300 leading-relaxed">{t2.text}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {safeHref(detail.href) && (
                  <a
                    href={safeHref(detail.href)}
                    target={detail.href!.startsWith("http") ? "_blank" : undefined}
                    rel={detail.href!.startsWith("http") ? "noopener noreferrer" : undefined}
                    className="mt-6 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg
                               border border-white/15 text-[12px] text-zinc-200
                               hover:bg-white/[0.06] transition-colors"
                  >
                    {detail.hrefLabel ?? "開く"} ↗
                  </a>
                )}

                <p className="mt-6 text-[10px] text-zinc-600 leading-relaxed">
                  金額はこの画面では表示しません
                </p>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
