"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AD_BUYER_COUNT_OPTIONS, BEAUTY_PRESETS, platformOf } from "@/lib/ad-buyers/platforms";
import type { ScanResult } from "@/lib/ad-buyers/scan";

/**
 * 広告出稿者ファインダーの「探す」フォーム。
 * POST /api/ad-buyers/scan を叩き、結果件数（見つけた／掲載あり／保存・更新）を出す。
 * 終わったら一覧を同じ県・市に絞ってリフレッシュする。
 */
export function AdBuyerSearchForm({ prefectures, defaultPrefecture, defaultCity }: { prefectures: readonly string[]; defaultPrefecture?: string; defaultCity?: string }) {
  const router = useRouter();
  const [prefecture, setPrefecture] = useState(defaultPrefecture ?? "");
  const [city, setCity] = useState(defaultCity ?? "");
  const [preset, setPreset] = useState<string>(BEAUTY_PRESETS[0]);
  const [free, setFree] = useState("");
  const [count, setCount] = useState<number>(AD_BUYER_COUNT_OPTIONS[0]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ScanResult | null>(null);

  const industry = preset === "__free" ? free.trim() : preset;
  const inputClass = "w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-zinc-400 focus:outline-none";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!prefecture || !industry) {
      setError("県と業種を選んでください");
      return;
    }
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/ad-buyers/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prefecture, city: city.trim(), industry, count }),
      });
      const data = (await res.json().catch(() => null)) as (ScanResult & { error?: string }) | null;
      if (!res.ok || !data) {
        setError(data?.error ?? `探索に失敗しました（${res.status}）`);
        return;
      }
      setResult(data);
      if (data.blocked) {
        setError(data.reason ?? "未送付のリードが多いため、新規の保存は止まっています");
        return;
      }
      const qs = new URLSearchParams();
      if (prefecture) qs.set("pref", prefecture);
      if (city.trim()) qs.set("city", city.trim());
      router.push(`/dashboard/ad-buyer-finder?${qs.toString()}`);
      router.refresh();
    } catch {
      setError("通信に失敗しました。もう一度お試しください");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="rounded-xl border border-orange-200 bg-orange-50/40 p-4">
      <p className="text-xs font-semibold text-zinc-900 mb-2">探す（Google の店舗情報から取り、有料媒体の掲載を確認できた店だけ保存します）</p>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <label className="block">
          <span className="text-xs font-medium text-zinc-600">都道府県</span>
          <select value={prefecture} onChange={(e) => setPrefecture(e.target.value)} className={`mt-1 ${inputClass}`} required>
            <option value="">選ぶ</option>
            {prefectures.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-xs font-medium text-zinc-600">市区町村</span>
          <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="例: 高松市" className={`mt-1 ${inputClass}`} />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-zinc-600">業種（美容系プリセット）</span>
          <select value={preset} onChange={(e) => setPreset(e.target.value)} className={`mt-1 ${inputClass}`}>
            {BEAUTY_PRESETS.map((b) => (
              <option key={b} value={b}>{b}</option>
            ))}
            <option value="__free">自由入力</option>
          </select>
        </label>
        <label className="block">
          <span className="text-xs font-medium text-zinc-600">自由入力（業種）</span>
          <input value={free} onChange={(e) => { setFree(e.target.value); if (e.target.value) setPreset("__free"); }} placeholder="例: 居酒屋" className={`mt-1 ${inputClass}`} />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-zinc-600">件数</span>
          <select value={count} onChange={(e) => setCount(Number(e.target.value))} className={`mt-1 ${inputClass}`}>
            {AD_BUYER_COUNT_OPTIONS.map((c) => (
              <option key={c} value={c}>{c}件</option>
            ))}
          </select>
        </label>
        <div className="flex items-end">
          <button type="submit" disabled={busy} className="w-full rounded-lg bg-orange-500 px-4 py-2 text-sm font-bold text-white hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed">
            {busy ? "探しています…（最大1分）" : "探す"}
          </button>
        </div>
      </div>

      {error && <p className="mt-3 text-xs text-rose-700">{error}</p>}

      {result && !result.blocked && (
        <div className="mt-3 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-700">
          <p>
            見つけた <span className="font-bold text-zinc-900">{result.found}</span> 件 ／ 掲載あり{" "}
            <span className="font-bold text-orange-600">{result.matched}</span> 件 ／ 保存 {result.saved}・更新 {result.updated}
            {result.excluded > 0 && `・外した店 ${result.excluded}`}
            <span className="text-zinc-400">（自社サイトを見た件数 {result.fetched}）</span>
          </p>
          <p className="mt-0.5 text-zinc-500">{result.note}</p>
          {result.items.length > 0 && (
            <ul className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-0.5">
              {result.items.slice(0, 12).map((it) => (
                <li key={it.leadId} className="truncate">
                  <span className="font-medium text-zinc-800">{it.name}</span>
                  <span className="text-zinc-400"> — {it.platforms.map((k) => platformOf(k)?.short ?? k).join("・")}</span>
                </li>
              ))}
              {result.items.length > 12 && <li className="text-zinc-400">…ほか {result.items.length - 12} 件（下の一覧に出ています）</li>}
            </ul>
          )}
        </div>
      )}
    </form>
  );
}
