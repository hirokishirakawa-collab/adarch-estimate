"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { ExternalLink, MapPin, Search, X } from "lucide-react";
import type { ClientRow } from "@/lib/clients/query";
import { RATING_BANDS, REGIONS, SIZE_BANDS } from "@/lib/clients/normalize";

const ClientsMap = dynamic(() => import("./clients-map").then((m) => m.ClientsMap), {
  ssr: false,
  loading: () => <div className="h-[520px] rounded-xl border border-zinc-200 bg-zinc-50 animate-pulse" />,
});

// ---------------------------------------------------------------
// 絞り込みの状態
// ---------------------------------------------------------------
interface Filters {
  scope: "proven" | "all";
  region: string;
  prefecture: string;
  industry: string;
  size: string;
  rating: string;
  branch: string;
  worksOnly: boolean;
  q: string;
}

const EMPTY: Filters = { scope: "all", region: "", prefecture: "", industry: "", size: "", rating: "", branch: "", worksOnly: false, q: "" };

type SortKey = "latest" | "rating" | "works" | "reviews" | "name" | "size";
const SORTS: { value: SortKey; label: string }[] = [
  { value: "latest", label: "実績が新しい順（2026年分が先頭）" },
  { value: "works", label: "実績が多い順" },
  { value: "rating", label: "口コミ★が高い順" },
  { value: "reviews", label: "口コミ件数が多い順" },
  { value: "size", label: "会社が大きい順" },
  { value: "name", label: "社名順" },
];

function countBy<T>(rows: T[], key: (r: T) => string): { label: string; n: number }[] {
  const m = new Map<string, number>();
  for (const r of rows) m.set(key(r), (m.get(key(r)) ?? 0) + 1);
  return [...m.entries()].map(([label, n]) => ({ label, n }));
}

// ---------------------------------------------------------------
// 小さい横バーの一覧（1系列・単色・クリックで絞り込み）
// ---------------------------------------------------------------
function BarList({
  title,
  items,
  active,
  onPick,
  order,
  max = 6,
}: {
  title: string;
  items: { label: string; n: number }[];
  active: string;
  onPick: (label: string) => void;
  order?: readonly string[];
  max?: number;
}) {
  const sorted = order
    ? [...items].sort((a, b) => order.indexOf(a.label) - order.indexOf(b.label))
    : [...items].sort((a, b) => b.n - a.n);
  const shown = sorted.filter((i) => i.n > 0).slice(0, max);
  const top = Math.max(1, ...shown.map((i) => i.n));
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4">
      <p className="text-xs font-semibold text-zinc-700 mb-2">{title}</p>
      <div className="space-y-1.5">
        {shown.length === 0 && <p className="text-xs text-zinc-400">データなし</p>}
        {shown.map((i) => {
          const isActive = active === i.label;
          return (
            <button
              key={i.label}
              type="button"
              onClick={() => onPick(isActive ? "" : i.label)}
              className={`group w-full text-left ${isActive ? "" : "hover:opacity-90"}`}
              title={`${i.label}: ${i.n}社`}
            >
              <div className="flex items-center justify-between text-[11px] leading-4">
                <span className={`truncate ${isActive ? "font-bold text-orange-700" : "text-zinc-600"}`}>{i.label}</span>
                <span className="ml-2 tabular-nums text-zinc-500">{i.n}</span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-zinc-100 mt-0.5 overflow-hidden">
                <div
                  className={`h-full rounded-full ${isActive ? "bg-orange-600" : "bg-orange-400 group-hover:bg-orange-500"}`}
                  style={{ width: `${Math.max(4, (i.n / top) * 100)}%` }}
                />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Stars({ rating }: { rating: number }) {
  const full = Math.round(rating);
  return (
    <span className="text-amber-500 tracking-tight" aria-hidden>
      {"★".repeat(full)}
      <span className="text-zinc-300">{"★".repeat(5 - full)}</span>
    </span>
  );
}

function photoUrl(r: ClientRow): string | null {
  const thumb = r.works.find((w) => w.thumbnail)?.thumbnail;
  if (thumb) return thumb;
  if (r.hasPhoto) return `/api/clients/photo/${r.id}`;
  return null;
}

/** 写真が無い会社のタイル色（社名から決めるので毎回同じ色） */
function tileColor(name: string): string {
  const palette = ["from-orange-200 to-amber-100", "from-sky-200 to-cyan-100", "from-emerald-200 to-lime-100", "from-violet-200 to-fuchsia-100", "from-rose-200 to-pink-100", "from-teal-200 to-emerald-100"];
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return palette[h % palette.length];
}

function Photo({ r, className }: { r: ClientRow; className: string }) {
  const url = photoUrl(r);
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt="" loading="lazy" className={`${className} object-cover`} />;
  }
  return (
    <div className={`${className} bg-gradient-to-br ${tileColor(r.name)} flex items-center justify-center`}>
      <span className="text-3xl font-black text-white/90 drop-shadow-sm select-none">{r.name.replace(/^(株式会社|有限会社|合同会社)/, "").slice(0, 1)}</span>
    </div>
  );
}

// ---------------------------------------------------------------
// 本体
// ---------------------------------------------------------------
export function ClientsExplorer({ rows, isAdmin }: { rows: ClientRow[]; isAdmin: boolean }) {
  const [f, setF] = useState<Filters>(EMPTY);
  const [sort, setSort] = useState<SortKey>("latest");
  const [view, setView] = useState<"grid" | "map">("grid");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const set = <K extends keyof Filters>(k: K, v: Filters[K]) => setF((p) => ({ ...p, [k]: v }));

  const scoped = useMemo(() => rows.filter((r) => (f.scope === "proven" ? r.proven : true)), [rows, f.scope]);

  const filtered = useMemo(() => {
    const q = f.q.trim().toLowerCase();
    return scoped.filter((r) => {
      if (f.region && r.region !== f.region) return false;
      if (f.prefecture && r.prefecture !== f.prefecture) return false;
      if (f.industry && r.industryGroup !== f.industry) return false;
      if (f.size && r.sizeBand !== f.size) return false;
      if (f.rating && r.ratingBand !== f.rating) return false;
      if (f.branch && r.branchName !== f.branch) return false;
      if (f.worksOnly && !r.works.some((w) => w.thumbnail)) return false;
      if (q && !`${r.name} ${r.industry ?? ""} ${r.prefecture ?? ""} ${r.placeAddress ?? ""}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [scoped, f]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    const cmp: Record<SortKey, (a: ClientRow, b: ClientRow) => number> = {
      // 最新の実績年 → 実績本数 → 口コミ。実績の無い会社は後ろ
      latest: (a, b) => (b.latestYear ?? 0) - (a.latestYear ?? 0) || b.works.length - a.works.length || (b.rating ?? 0) - (a.rating ?? 0),
      works: (a, b) => b.works.length - a.works.length || (b.rating ?? 0) - (a.rating ?? 0),
      rating: (a, b) => (b.rating ?? -1) - (a.rating ?? -1) || (b.ratingCount ?? 0) - (a.ratingCount ?? 0),
      reviews: (a, b) => (b.ratingCount ?? 0) - (a.ratingCount ?? 0),
      size: (a, b) => (b.employeeCount ?? -1) - (a.employeeCount ?? -1),
      name: (a, b) => a.name.localeCompare(b.name, "ja"),
    };
    return arr.sort(cmp[sort]);
  }, [filtered, sort]);

  // ---- 傾向（絞り込み後の集合で計算する＝地域を選べばその地域の傾向になる）
  const stats = useMemo(() => {
    const rated = filtered.filter((r) => r.rating != null && r.ratingCount);
    const avg = rated.length ? rated.reduce((s, r) => s + (r.rating ?? 0), 0) / rated.length : null;
    const works = filtered.reduce((s, r) => s + r.works.length, 0);
    const prefs = new Set(filtered.map((r) => r.prefecture).filter(Boolean));
    const withPhoto = filtered.filter((r) => photoUrl(r)).length;
    const withProfile = filtered.filter((r) => r.employeeCount != null || r.capital || r.representativeName).length;
    return { total: filtered.length, rated: rated.length, avg, works, prefs: prefs.size, withPhoto, withProfile };
  }, [filtered]);

  const byRegion = useMemo(() => countBy(filtered, (r) => r.region), [filtered]);
  const byIndustry = useMemo(() => countBy(filtered, (r) => r.industryGroup), [filtered]);
  const bySize = useMemo(() => countBy(filtered.filter((r) => r.sizeBand !== "不明"), (r) => r.sizeBand), [filtered]);
  const byRating = useMemo(() => countBy(filtered, (r) => r.ratingBand), [filtered]);
  const byYear = useMemo(() => {
    const m = new Map<number, number>();
    for (const r of filtered) for (const w of r.works) m.set(w.year, (m.get(w.year) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => a[0] - b[0]).map(([y, n]) => ({ label: String(y), n }));
  }, [filtered]);
  const byBranch = useMemo(() => countBy(filtered, (r) => r.branchName), [filtered]);

  // ---- 一言の傾向（上位だけ・数字は出す）
  const insights = useMemo(() => {
    const out: string[] = [];
    const n = filtered.length;
    if (n === 0) return out;
    const topR = [...byRegion].sort((a, b) => b.n - a.n).filter((x) => x.label !== "不明").slice(0, 2);
    if (topR.length) out.push(`地域は ${topR.map((x) => `${x.label} ${Math.round((x.n / n) * 100)}%`).join("・")} に集中`);
    const topI = [...byIndustry].sort((a, b) => b.n - a.n).filter((x) => !["未設定", "その他"].includes(x.label)).slice(0, 2);
    if (topI.length) out.push(`業種は ${topI.map((x) => `${x.label} ${x.n}社`).join("・")} が多い`);
    const good = filtered.filter((r) => (r.rating ?? 0) >= 4.0 && r.ratingCount).length;
    if (stats.rated > 0) out.push(`口コミがある ${stats.rated}社のうち ★4.0以上が ${Math.round((good / stats.rated) * 100)}%`);
    const sizes = filtered.filter((r) => r.employeeCount != null);
    if (sizes.length > 0) {
      const med = [...sizes].sort((a, b) => (a.employeeCount ?? 0) - (b.employeeCount ?? 0))[Math.floor(sizes.length / 2)];
      out.push(`従業員数が分かる ${sizes.length}社の中央値は ${med.employeeCount?.toLocaleString("ja-JP")}名`);
    }
    return out;
  }, [filtered, byRegion, byIndustry, stats.rated]);

  const selected = useMemo(() => rows.find((r) => r.id === selectedId) ?? null, [rows, selectedId]);
  const onSelect = useCallback((id: string) => setSelectedId(id), []);

  useEffect(() => {
    if (!selectedId) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setSelectedId(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedId]);

  const prefOptions = useMemo(() => {
    const prefs = new Set(scoped.map((r) => r.prefecture).filter((p): p is string => !!p));
    const regionPrefs = f.region ? REGIONS.find((r) => r.name === f.region)?.prefs ?? [] : null;
    return [...prefs].filter((p) => !regionPrefs || regionPrefs.includes(p)).sort();
  }, [scoped, f.region]);

  const selectClass = "rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-xs text-zinc-800 focus:border-zinc-400 focus:outline-none";
  const activeCount = [f.region, f.prefecture, f.industry, f.size, f.rating, f.branch, f.q].filter(Boolean).length + (f.worksOnly ? 1 : 0);
  const unchecked = rows.filter((r) => !r.placeChecked).length;

  return (
    <div className="px-4 sm:px-6 py-6 space-y-5 max-w-screen-2xl mx-auto w-full">
      {/* ── ヘッダー */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="w-9 h-9 bg-orange-50 rounded-xl flex items-center justify-center">
          <span className="text-lg">🏙️</span>
        </div>
        <div className="min-w-0">
          <h2 className="text-lg font-bold text-zinc-900">取引先マップ</h2>
          <p className="text-xs text-zinc-500 mt-0.5">
            グループ全体の取引先・制作実績あり企業を、地域・口コミ・会社の規模から眺めて傾向をつかむ画面です。<br />★は <span className="font-semibold">Google マップの口コミ評価</span>（件数つき）、写真は制作実績のサムネイルか Google マップの写真です。新しく登録した顧客は自動で追加されます
          </p>
        </div>
        <div className="ml-auto flex items-center gap-1 rounded-lg bg-zinc-100 p-1 text-xs">
          <button type="button" onClick={() => set("scope", "proven")} className={`rounded-md px-3 py-1.5 font-medium ${f.scope === "proven" ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500"}`}>
            実績あり {rows.filter((r) => r.proven).length}
          </button>
          <button type="button" onClick={() => set("scope", "all")} className={`rounded-md px-3 py-1.5 font-medium ${f.scope === "all" ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500"}`}>
            見込みも含む {rows.length}
          </button>
        </div>
      </div>

      {isAdmin && unchecked > 0 && (
        <p className="text-[11px] text-zinc-500">
          口コミ・写真が未取得の会社が {unchecked}社あります（毎日の自動取り込みで順に埋まります）
        </p>
      )}

      {/* ── 数字 */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: "会社数", value: stats.total.toLocaleString("ja-JP"), sub: "社" },
          { label: "都道府県", value: String(stats.prefs), sub: "地域" },
          { label: "制作実績", value: stats.works.toLocaleString("ja-JP"), sub: "本" },
          { label: "口コミ平均", value: stats.avg != null ? stats.avg.toFixed(2) : "–", sub: stats.rated ? `★・${stats.rated}社` : "口コミなし" },
          { label: "社内構成が分かる", value: String(stats.withProfile), sub: "社" },
          { label: "写真あり", value: String(stats.withPhoto), sub: "社" },
        ].map((t) => (
          <div key={t.label} className="rounded-xl border border-zinc-200 bg-white px-4 py-3">
            <p className="text-[11px] text-zinc-500">{t.label}</p>
            <p className="mt-0.5 text-2xl font-bold text-zinc-900 tabular-nums leading-tight">
              {t.value} <span className="text-xs font-medium text-zinc-500">{t.sub}</span>
            </p>
          </div>
        ))}
      </div>

      {insights.length > 0 && (
        <div className="rounded-xl border border-orange-200 bg-orange-50/60 px-4 py-3 text-xs text-orange-900 leading-relaxed">
          <p className="font-semibold">いま表示している {stats.total}社の傾向</p>
          <ul className="mt-1 list-disc pl-4 space-y-0.5">
            {insights.map((s) => <li key={s}>{s}</li>)}
          </ul>
        </div>
      )}

      {/* ── 傾向グラフ（クリックで絞り込み） */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        <BarList title="地域" items={byRegion} active={f.region} onPick={(v) => setF((p) => ({ ...p, region: v, prefecture: "" }))} order={[...REGIONS.map((r) => r.name), "不明"]} max={9} />
        <BarList title="業種" items={byIndustry} active={f.industry} onPick={(v) => set("industry", v)} max={8} />
        <BarList title="会社の規模（従業員数）" items={bySize} active={f.size} onPick={(v) => set("size", v)} order={SIZE_BANDS} />
        <BarList title="Google マップの口コミ★" items={byRating} active={f.rating} onPick={(v) => set("rating", v)} order={[...RATING_BANDS, "口コミなし"]} />
        <BarList title="制作実績の年" items={byYear} active="" onPick={() => {}} order={byYear.map((y) => y.label)} max={12} />
        <BarList title="担当拠点" items={byBranch} active={f.branch} onPick={(v) => set("branch", v)} max={8} />
      </div>

      {/* ── 絞り込みバー */}
      <div className="rounded-xl border border-zinc-200 bg-white px-3 py-2.5 flex flex-wrap items-center gap-2">
        <label className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400" />
          <input
            value={f.q}
            onChange={(e) => set("q", e.target.value)}
            placeholder="社名・業種・住所で検索"
            className="w-56 rounded-lg border border-zinc-200 bg-white pl-7 pr-2 py-1.5 text-xs text-zinc-800 focus:border-zinc-400 focus:outline-none"
          />
        </label>
        <select value={f.region} onChange={(e) => setF((p) => ({ ...p, region: e.target.value, prefecture: "" }))} className={selectClass}>
          <option value="">地域: すべて</option>
          {REGIONS.map((r) => <option key={r.name} value={r.name}>{r.name}</option>)}
        </select>
        <select value={f.prefecture} onChange={(e) => set("prefecture", e.target.value)} className={selectClass}>
          <option value="">都道府県: すべて</option>
          {prefOptions.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <select value={f.industry} onChange={(e) => set("industry", e.target.value)} className={selectClass}>
          <option value="">業種: すべて</option>
          {[...byIndustry].sort((a, b) => b.n - a.n).map((i) => <option key={i.label} value={i.label}>{i.label}</option>)}
        </select>
        <select value={f.size} onChange={(e) => set("size", e.target.value)} className={selectClass}>
          <option value="">規模: すべて</option>
          {SIZE_BANDS.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={f.rating} onChange={(e) => set("rating", e.target.value)} className={selectClass}>
          <option value="">Google口コミ: すべて</option>
          {[...RATING_BANDS, "口コミなし"].map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <label className="flex items-center gap-1.5 text-xs text-zinc-600">
          <input type="checkbox" checked={f.worksOnly} onChange={(e) => set("worksOnly", e.target.checked)} className="h-3.5 w-3.5 rounded border-zinc-300" />
          写真つき実績がある会社だけ
        </label>
        {activeCount > 0 && (
          <button type="button" onClick={() => setF((p) => ({ ...EMPTY, scope: p.scope }))} className="text-xs text-zinc-500 hover:text-zinc-800 inline-flex items-center gap-1">
            <X className="w-3 h-3" /> 絞り込みを解除
          </button>
        )}
        <div className="ml-auto flex items-center gap-2">
          <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)} className={selectClass}>
            {SORTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
          <div className="flex items-center rounded-lg bg-zinc-100 p-0.5 text-xs">
            <button type="button" onClick={() => setView("grid")} className={`rounded-md px-2.5 py-1 ${view === "grid" ? "bg-white shadow-sm text-zinc-900" : "text-zinc-500"}`}>カード</button>
            <button type="button" onClick={() => setView("map")} className={`rounded-md px-2.5 py-1 ${view === "map" ? "bg-white shadow-sm text-zinc-900" : "text-zinc-500"}`}>地図</button>
          </div>
        </div>
      </div>

      <p className="text-xs text-zinc-500">{sorted.length}社</p>

      {/* ── 地図 */}
      {view === "map" && <ClientsMap rows={sorted} onSelect={onSelect} />}

      {/* ── カード */}
      {view === "grid" && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5 gap-4">
          {sorted.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => setSelectedId(r.id)}
              className="group text-left rounded-2xl border border-zinc-200 bg-white overflow-hidden shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all"
            >
              <div className="relative aspect-[4/3] bg-zinc-100 overflow-hidden">
                <Photo r={r} className="w-full h-full group-hover:scale-[1.03] transition-transform duration-300" />
                {r.works.length > 0 && (
                  <span className="absolute left-2 top-2 rounded-full bg-black/65 text-white text-[10px] font-semibold px-2 py-0.5 backdrop-blur">
                    実績 {r.works.length}本{r.latestYear ? `・最新 ${r.latestYear}` : ""}
                  </span>
                )}
                {!r.proven && (
                  <span className="absolute right-2 top-2 rounded-full bg-white/90 text-zinc-600 text-[10px] font-medium px-2 py-0.5">見込み</span>
                )}
                {r.isArchive && (
                  <span className="absolute right-2 top-2 rounded-full bg-white/90 text-zinc-500 text-[10px] font-medium px-2 py-0.5 border border-dashed border-zinc-300" title="旧サイト・Driveの実績から起こした会社。業種・所在地などは未整備">実績アーカイブ・未整備</span>
                )}
              </div>
              <div className="p-3 space-y-1.5">
                <p className="text-sm font-bold text-zinc-900 leading-snug line-clamp-2">{r.name}</p>
                <div className="flex items-center gap-1.5 text-xs">
                  {r.rating != null && r.ratingCount ? (
                    <>
                      <Stars rating={r.rating} />
                      <span className="font-semibold text-zinc-800 tabular-nums">{r.rating.toFixed(1)}</span>
                      <span className="text-zinc-400 tabular-nums">({r.ratingCount})</span>
                      <span className="text-[10px] text-zinc-400">Google マップ</span>
                    </>
                  ) : (
                    <span className="text-zinc-400">口コミなし</span>
                  )}
                </div>
                <div className="flex flex-wrap gap-1">
                  <span className="rounded-full bg-orange-50 text-orange-700 text-[10px] px-2 py-0.5">{r.industryGroup}</span>
                  {r.prefecture && (
                    <span className="rounded-full bg-zinc-100 text-zinc-600 text-[10px] px-2 py-0.5 inline-flex items-center gap-0.5">
                      <MapPin className="w-2.5 h-2.5" />{r.prefecture}
                    </span>
                  )}
                  {r.employeeCount != null && (
                    <span className="rounded-full bg-zinc-100 text-zinc-600 text-[10px] px-2 py-0.5">{r.employeeCount.toLocaleString("ja-JP")}名</span>
                  )}
                </div>
                <p className="text-[10px] text-zinc-400">{r.branchName}</p>
              </div>
            </button>
          ))}
          {sorted.length === 0 && (
            <div className="col-span-full rounded-xl border border-dashed border-zinc-200 py-16 text-center text-sm text-zinc-400">
              条件に合う会社がありません
            </div>
          )}
        </div>
      )}

      {/* ── 詳細パネル */}
      {selected && <DetailPanel r={selected} onClose={() => setSelectedId(null)} />}
    </div>
  );
}

// ---------------------------------------------------------------
// 詳細パネル（右からのスライド）
// ---------------------------------------------------------------
function Row({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
  return (
    <div className="flex items-start gap-3 py-1.5 border-b border-zinc-100 last:border-0">
      <span className="w-20 shrink-0 text-[11px] text-zinc-500 pt-0.5">{label}</span>
      <span className="text-sm text-zinc-800 min-w-0 break-words">
        {value}
        {hint && <span className="block text-[10px] text-zinc-400 mt-0.5">{hint}</span>}
      </span>
    </div>
  );
}

function DetailPanel({ r, onClose }: { r: ClientRow; onClose: () => void }) {
  const statusLabel = r.status === "ACTIVE" ? "取引中" : r.status === "INACTIVE" ? "休眠" : "見込み";
  const profileNote = !r.profileChecked
    ? "まだ調べていません（自動取り込み待ち）"
    : r.employeeCount == null && !r.capital && !r.representativeName && !r.foundedYear
      ? "会社サイトに記載が見つかりませんでした"
      : null;
  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/30" onClick={onClose} aria-hidden />
      <aside className="fixed right-0 top-0 z-50 h-full w-full sm:w-[540px] bg-white shadow-2xl overflow-y-auto">
        <div className="relative aspect-[16/9] bg-zinc-100">
          <Photo r={r} className="w-full h-full" />
          <button type="button" onClick={onClose} className="absolute right-3 top-3 rounded-full bg-white/90 p-1.5 text-zinc-700 hover:bg-white" aria-label="閉じる">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-5 space-y-5">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className={`rounded-full text-[10px] px-2 py-0.5 ${r.status === "ACTIVE" ? "bg-emerald-50 text-emerald-700" : "bg-zinc-100 text-zinc-600"}`}>{statusLabel}</span>
              {r.isArchive && (
                <span className="rounded-full text-[10px] px-2 py-0.5 bg-zinc-50 text-zinc-500 border border-dashed border-zinc-300">実績アーカイブ・データ未整備（顧客管理には出ません）</span>
              )}
              <span className="rounded-full bg-orange-50 text-orange-700 text-[10px] px-2 py-0.5">{r.industryGroup}</span>
              <span className="text-[10px] text-zinc-400">{r.branchName}</span>
            </div>
            <h3 className="mt-2 text-xl font-bold text-zinc-900 leading-snug">{r.name}</h3>
            <div className="mt-1 flex items-center gap-2 text-sm">
              {r.rating != null && r.ratingCount ? (
                <>
                  <Stars rating={r.rating} />
                  <span className="font-bold text-zinc-900 tabular-nums">{r.rating.toFixed(1)}</span>
                  <span className="text-zinc-500 tabular-nums">Google マップの口コミ {r.ratingCount}件</span>
                </>
              ) : (
                <span className="text-zinc-400 text-xs">{r.placeChecked ? "Google マップに口コミがありません" : "Google マップの口コミはまだ調べていません"}</span>
              )}
            </div>
            <div className="mt-2 flex flex-wrap gap-2 text-xs">
              {r.website && (
                <a href={r.website} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-md border border-zinc-200 px-2 py-1 text-zinc-700 hover:bg-zinc-50">
                  <ExternalLink className="w-3 h-3" /> サイト
                </a>
              )}
              {r.mapsUrl && (
                <a href={r.mapsUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-md border border-zinc-200 px-2 py-1 text-zinc-700 hover:bg-zinc-50">
                  <MapPin className="w-3 h-3" /> Google マップ
                </a>
              )}
              {r.canOpen && !r.isArchive && (
                <Link href={`/dashboard/customers/${r.id}`} className="inline-flex items-center gap-1 rounded-md bg-zinc-900 px-2 py-1 text-white hover:bg-zinc-800">
                  顧客管理で開く
                </Link>
              )}
            </div>
          </div>

          {r.placeSummary && (
            <div className="rounded-xl bg-amber-50/70 border border-amber-100 px-3 py-2.5 text-xs text-amber-900 leading-relaxed">
              <p className="font-semibold mb-0.5">Google マップの口コミ要約（Google が自動生成した文）</p>
              {r.placeSummary}
            </div>
          )}

          <section>
            <p className="text-xs font-semibold text-zinc-700 mb-1">所在地・業種</p>
            <Row label="所在地" value={r.placeAddress ?? r.prefecture ?? "不明"} hint={r.placeName && r.placeName !== r.name ? `Google 上の名称: ${r.placeName}` : undefined} />
            <Row label="業種" value={r.industry ?? "未設定"} />
            <Row label="地域" value={r.region} />
          </section>

          <section>
            <p className="text-xs font-semibold text-zinc-700 mb-1">社内構成</p>
            {profileNote ? (
              <p className="text-xs text-zinc-400 py-1">{profileNote}</p>
            ) : (
              <>
                <Row label="従業員数" value={r.employeeCount != null ? `${r.employeeCount.toLocaleString("ja-JP")}名` : "記載なし"} />
                <Row label="資本金" value={r.capital ?? "記載なし"} />
                <Row label="代表者" value={r.representativeName ?? "記載なし"} />
                <Row label="設立" value={r.foundedYear ? `${r.foundedYear}年` : "記載なし"} hint={r.foundedRaw ? `原文: ${r.foundedRaw}` : undefined} />
                {r.profileSourceUrl && (
                  <p className="mt-1 text-[10px] text-zinc-400">
                    出典: {r.profileSource === "gbiz" ? "gBizINFO（経産省）" : "会社サイト"}{" "}
                    <a href={r.profileSourceUrl} target="_blank" rel="noopener noreferrer" className="underline hover:text-zinc-600">{r.profileSourceUrl}</a>
                    。自動で読み取った値なので、客先で使う前に原文を確認してください
                  </p>
                )}
              </>
            )}
          </section>

          <section>
            <p className="text-xs font-semibold text-zinc-700 mb-2">制作実績 {r.works.length > 0 && <span className="text-zinc-400 font-normal">{r.works.length}本</span>}</p>
            {r.works.length === 0 ? (
              <p className="text-xs text-zinc-400">
                実績の記録はありません{r.projectCount > 0 ? `（OSのプロジェクトは ${r.projectCount}件）` : ""}
              </p>
            ) : (
              <>
                {r.works.some((w) => w.thumbnail) && (
                  <div className="grid grid-cols-2 gap-2">
                    {r.works.filter((w) => w.thumbnail).map((w) => (
                      <figure key={w.id} className="rounded-lg overflow-hidden border border-zinc-200 bg-white">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={w.thumbnail!} alt="" loading="lazy" className="w-full aspect-video object-cover" />
                        <figcaption className="px-2 py-1.5">
                          <p className="text-[11px] font-medium text-zinc-800 leading-snug line-clamp-2">{w.titleJp ?? w.title}</p>
                          <p className="text-[10px] text-zinc-400 mt-0.5">{w.year}・{w.category}</p>
                        </figcaption>
                      </figure>
                    ))}
                  </div>
                )}
                {r.works.some((w) => w.source === "drive") && (
                  <ul className="mt-2 divide-y divide-zinc-100 rounded-lg border border-zinc-200">
                    {r.works.filter((w) => w.source === "drive").map((w) => (
                      <li key={w.id} className="flex items-center gap-2 px-2.5 py-1.5 text-xs">
                        <span className="rounded bg-zinc-100 text-zinc-500 text-[10px] px-1.5 py-0.5 shrink-0">Drive</span>
                        <span className="min-w-0 flex-1 truncate text-zinc-800" title={w.title}>{w.title}</span>
                        <span className="text-[10px] text-zinc-400 shrink-0" title="年はDriveフォルダの最終更新年（制作年とは限りません）">{w.year}・{w.category}{w.fileCount != null ? `・${w.fileCount}件` : ""}</span>
                        {w.driveUrl && (
                          <a href={w.driveUrl} target="_blank" rel="noopener noreferrer" className="shrink-0 text-zinc-500 hover:text-zinc-900" title="Driveで開く">
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </section>
        </div>
      </aside>
    </>
  );
}
