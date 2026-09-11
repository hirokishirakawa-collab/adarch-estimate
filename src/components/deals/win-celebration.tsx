"use client";

// ==============================================================
// 受注のお祝い（2026-09-11 代表決定）
//   受注した拠点の人 → 画面の手前で紙吹雪が弾けて「おめでとうございます！」（クリックで閉じる）
//   他の代表         → OSを開いたときに上部へ小さく「◯◯が受注」＋小さな紙吹雪（数秒で消える）
//   OS画面・スマホ・AI連携のどこで受注にしても、まだ見ていない受注があれば1回だけ出す（見た印はこの端末に保存）。
//   金額は出さない。データは /api/deals/recent-wins。
// ==============================================================

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

type Win = { id: string; isMine: boolean; title: string | null; customer: string; industry: string | null; branch: string; closedAt: string };

const SEEN_KEY = "adarch.seenWins.v1";
const POLL_MS = 60_000;
const COLORS = ["#F19834", "#F19834", "#FFC857", "#FF6B6B", "#4CC9F0", "#7BD389", "#FFFFFF"];

function loadSeen(): Set<string> {
  try {
    const raw = localStorage.getItem(SEEN_KEY);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}
function saveSeen(seen: Set<string>) {
  try {
    localStorage.setItem(SEEN_KEY, JSON.stringify([...seen].slice(-200)));
  } catch {
    // 保存できない環境（プライベートウィンドウ等）はこのページを開いている間だけ覚える
  }
}

// ---- 紙吹雪 ----------------------------------------------------------------
type Origin = { x: number; y: number; angle: number; spread: number; power: number; count: number };

function fireConfetti(canvas: HTMLCanvasElement, origins: Origin[]): () => void {
  if (typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return () => {};
  const ctx = canvas.getContext("2d");
  if (!ctx) return () => {};
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const W = window.innerWidth;
  const H = window.innerHeight;
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const parts = origins.flatMap((o) =>
    Array.from({ length: o.count }, () => {
      const a = ((o.angle + (Math.random() - 0.5) * o.spread) * Math.PI) / 180;
      const v = o.power * (0.55 + Math.random() * 0.6);
      return {
        x: o.x * W, y: o.y * H, vx: Math.cos(a) * v, vy: -Math.sin(a) * v,
        rot: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 0.35,
        w: 6 + Math.random() * 6, h: 8 + Math.random() * 10,
        tilt: Math.random() * Math.PI, vt: 0.08 + Math.random() * 0.12,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        round: Math.random() < 0.25,
      };
    })
  );

  let raf = 0;
  const start = performance.now();
  const tick = (now: number) => {
    const t = now - start;
    ctx.clearRect(0, 0, W, H);
    let alive = 0;
    for (const p of parts) {
      p.vx *= 0.98;
      p.vy = p.vy * 0.98 + 0.2;
      p.x += p.vx;
      p.y += p.vy;
      p.rot += p.vr;
      p.tilt += p.vt;
      if (p.y > H + 40) continue;
      alive++;
      ctx.save();
      ctx.globalAlpha = t > 3800 ? Math.max(0, 1 - (t - 3800) / 800) : 1;
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      if (p.round) {
        ctx.beginPath();
        ctx.arc(0, 0, p.w / 2, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillRect(-p.w / 2, (-p.h / 2) * Math.abs(Math.cos(p.tilt)), p.w, p.h * Math.abs(Math.cos(p.tilt)));
      }
      ctx.restore();
    }
    if (alive > 0 && t < 4600) raf = requestAnimationFrame(tick);
    else ctx.clearRect(0, 0, W, H);
  };
  raf = requestAnimationFrame(tick);
  return () => {
    cancelAnimationFrame(raf);
    ctx.clearRect(0, 0, W, H);
  };
}

// 本人向け＝左右の下からクラッカー2発＋中央でもう1発
const BIG_BURST: Origin[] = [
  { x: 0.02, y: 1.0, angle: 62, spread: 30, power: 26, count: 90 },
  { x: 0.98, y: 1.0, angle: 118, spread: 30, power: 26, count: 90 },
  { x: 0.5, y: 0.45, angle: 90, spread: 360, power: 13, count: 70 },
];
// 他の代表向け＝上部のお知らせから小さく
const SMALL_BURST: Origin[] = [{ x: 0.5, y: 0.06, angle: 270, spread: 150, power: 9, count: 45 }];

// ---- 本体 -----------------------------------------------------------------
export function WinCelebration() {
  const pathname = usePathname();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const seenRef = useRef<Set<string> | null>(null);
  const [mine, setMine] = useState<Win[]>([]);
  const [others, setOthers] = useState<Win[]>([]);
  const [entered, setEntered] = useState(false);

  const seen = () => (seenRef.current ??= loadSeen());
  const markSeen = (ids: string[]) => {
    const s = seen();
    ids.forEach((id) => s.add(id));
    saveSeen(s);
  };

  const check = useCallback(async () => {
    try {
      const res = await fetch("/api/deals/recent-wins", { cache: "no-store" });
      if (!res.ok) return;
      const { wins } = (await res.json()) as { wins: Win[] };
      const s = seen();
      const fresh = wins.filter((w) => !s.has(w.id));
      if (fresh.length === 0) return;
      setMine((cur) => [...cur, ...fresh.filter((w) => w.isMine && !cur.some((c) => c.id === w.id))]);
      setOthers((cur) => [...cur, ...fresh.filter((w) => !w.isMine && !cur.some((c) => c.id === w.id))]);
    } catch {
      // 通信できないときは何もしない（次の確認で拾う）
    }
  }, []);

  // 開いたとき・画面を移ったとき・1分ごと（表示中のみ）・カンバンで受注にした直後
  useEffect(() => {
    check();
  }, [pathname, check]);
  useEffect(() => {
    const id = setInterval(() => document.visibilityState === "visible" && check(), POLL_MS);
    const onWon = () => check();
    window.addEventListener("adarch:deal-won", onWon);
    return () => {
      clearInterval(id);
      window.removeEventListener("adarch:deal-won", onWon);
    };
  }, [check]);

  const current = mine[0] ?? null;
  const showSmall = !current && others.length > 0;

  // 本人の受注＝パーン
  useEffect(() => {
    if (!current || !canvasRef.current) return;
    setEntered(false);
    const r = requestAnimationFrame(() => setEntered(true));
    const stop = fireConfetti(canvasRef.current, BIG_BURST);
    return () => {
      cancelAnimationFrame(r);
      stop();
    };
  }, [current?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // 他拠点の受注＝小さく・7秒で消える
  const smallKey = others.map((w) => w.id).join(",");
  useEffect(() => {
    if (!showSmall || !canvasRef.current) return;
    const stop = fireConfetti(canvasRef.current, SMALL_BURST);
    const t = setTimeout(() => closeSmall(), 7000);
    return () => {
      clearTimeout(t);
      stop();
    };
  }, [showSmall, smallKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const closeBig = () => {
    if (!current) return;
    markSeen([current.id]);
    setMine((cur) => cur.slice(1));
  };
  const closeSmall = () => {
    markSeen(others.map((w) => w.id));
    setOthers([]);
  };

  return (
    <>
      <canvas ref={canvasRef} aria-hidden className="pointer-events-none fixed inset-0 z-[10001] h-full w-full" />

      {current && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="受注おめでとうございます"
          onClick={closeBig}
          className={`fixed inset-0 z-[10000] flex items-center justify-center bg-black/45 px-4 transition-opacity duration-300 ${entered ? "opacity-100" : "opacity-0"}`}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className={`w-full max-w-sm rounded-2xl bg-white px-6 py-7 text-center shadow-2xl transition-transform duration-500 ease-[cubic-bezier(.2,1.4,.4,1)] ${entered ? "scale-100" : "scale-75"}`}
          >
            <div className="text-5xl leading-none">🎉</div>
            <p className="mt-4 text-2xl font-bold tracking-tight text-zinc-900">おめでとうございます！</p>
            <p className="mt-4 text-base font-semibold text-zinc-800">{current.customer}</p>
            {current.title && <p className="mt-1 text-sm text-zinc-600">{current.title}</p>}
            <p className="mt-2 text-sm text-zinc-500">を受注しました</p>
            <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
              <Link
                href={`/dashboard/deals/${current.id}`}
                onClick={closeBig}
                className="rounded-lg bg-[#F19834] px-4 py-2.5 text-sm font-bold text-white hover:opacity-90"
              >
                受注の決め手を残す
              </Link>
              <button type="button" onClick={closeBig} className="rounded-lg px-4 py-2.5 text-sm font-medium text-zinc-600 hover:bg-zinc-100">
                閉じる
              </button>
            </div>
          </div>
        </div>
      )}

      {showSmall && (
        <button
          type="button"
          onClick={closeSmall}
          aria-label="閉じる"
          className="fixed left-1/2 top-4 z-[10000] w-[calc(100%-32px)] max-w-md -translate-x-1/2 rounded-xl border border-orange-200 bg-white/95 px-4 py-3 text-left shadow-lg backdrop-blur"
        >
          {others.slice(0, 3).map((w) => (
            <p key={w.id} className="text-sm text-zinc-800">
              <span className="mr-1">🎉</span>
              <span className="font-bold">{w.branch}</span>が受注：{w.customer}
              {w.industry ? <span className="text-zinc-500">（{w.industry}）</span> : null}
            </p>
          ))}
          {others.length > 3 && <p className="mt-0.5 text-xs text-zinc-500">ほか{others.length - 3}件</p>}
        </button>
      )}
    </>
  );
}
