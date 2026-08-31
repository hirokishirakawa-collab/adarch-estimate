"use client";
// サイネージ画面の共通部品（ヘッダー・顧客ピッカー・書式）
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { MonitorPlay } from "lucide-react";

export function SignageHeader({ title, desc, right }: { title: string; desc?: string; right?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 bg-orange-50 rounded-xl flex items-center justify-center">
          <MonitorPlay className="text-orange-600" style={{ width: "1.125rem", height: "1.125rem" }} />
        </div>
        <div>
          <h2 className="text-lg font-bold text-zinc-900">{title}</h2>
          {desc && <p className="text-xs text-zinc-500 mt-0.5">{desc}</p>}
        </div>
      </div>
      {right}
    </div>
  );
}

export function SignageNav({ active }: { active: "devices" | "assets" | "playlists" }) {
  const tabs = [
    { key: "devices", href: "/dashboard/signage", label: "端末・動作状況" },
    { key: "playlists", href: "/dashboard/signage/playlists", label: "プレイリスト（枠）" },
    { key: "assets", href: "/dashboard/signage/assets", label: "素材" },
  ] as const;
  return (
    <div className="flex gap-1 mb-5 border-b border-zinc-200">
      {tabs.map((t) => (
        <Link key={t.key} href={t.href}
          className={`px-3 py-2 text-sm border-b-2 -mb-px ${active === t.key ? "border-orange-500 text-orange-700 font-medium" : "border-transparent text-zinc-500 hover:text-zinc-800"}`}>
          {t.label}
        </Link>
      ))}
    </div>
  );
}

export const btn = "inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors disabled:opacity-50";
export const btnPrimary = `${btn} bg-orange-600 text-white hover:bg-orange-700`;
export const btnGhost = `${btn} bg-white border border-zinc-200 text-zinc-700 hover:bg-zinc-50`;
export const btnDanger = `${btn} bg-white border border-red-200 text-red-600 hover:bg-red-50`;
export const input = "w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-200";
export const label = "block text-xs font-medium text-zinc-600 mb-1";

export function fmtAgo(iso: string | null | undefined): string {
  if (!iso) return "未接続";
  const ms = Date.now() - Date.parse(iso);
  const m = Math.floor(ms / 60000);
  if (m < 1) return "たった今";
  if (m < 60) return `${m}分前`;
  const h = Math.floor(m / 60);
  if (h < 48) return `${h}時間前`;
  return `${Math.floor(h / 24)}日前`;
}

export function fmtBytes(n: number): string {
  if (n >= 1073741824) return `${(n / 1073741824).toFixed(2)} GB`;
  if (n >= 1048576) return `${(n / 1048576).toFixed(1)} MB`;
  return `${Math.round(n / 1024)} KB`;
}

export function fmtSec(s: number | null | undefined): string {
  if (!s) return "—";
  const m = Math.floor(s / 60), r = Math.round(s % 60);
  return m > 0 ? `${m}分${r}秒` : `${r}秒`;
}

type Cust = { id: string; name: string; industry?: string | null; prefecture?: string | null };

/** 顧客DBから検索して1件選ぶ（/api/customers?search=） */
export function CustomerPicker({ value, onChange, placeholder = "顧客名で検索" }: { value: Cust | null; onChange: (c: Cust | null) => void; placeholder?: string }) {
  const [q, setQ] = useState("");
  const [list, setList] = useState<Cust[]>([]);
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!open) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      try {
        const r = await fetch(`/api/customers?search=${encodeURIComponent(q)}&limit=15`);
        setList(r.ok ? await r.json() : []);
      } catch { setList([]); }
    }, 250);
  }, [q, open]);

  if (value) {
    return (
      <div className="flex items-center gap-2 text-sm">
        <span className="px-2 py-1 bg-zinc-100 rounded-md">{value.name}</span>
        <button type="button" className="text-xs text-zinc-500 hover:text-red-600" onClick={() => onChange(null)}>外す</button>
      </div>
    );
  }
  return (
    <div className="relative">
      <input className={input} placeholder={placeholder} value={q} onChange={(e) => setQ(e.target.value)} onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 150)} />
      {open && list.length > 0 && (
        <div className="absolute z-20 mt-1 w-full bg-white border border-zinc-200 rounded-lg shadow-lg max-h-56 overflow-auto">
          {list.map((c) => (
            <button key={c.id} type="button" className="w-full text-left px-3 py-2 text-sm hover:bg-orange-50" onMouseDown={() => { onChange(c); setQ(""); setOpen(false); }}>
              {c.name} <span className="text-xs text-zinc-400">{[c.industry, c.prefecture].filter(Boolean).join("・")}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
