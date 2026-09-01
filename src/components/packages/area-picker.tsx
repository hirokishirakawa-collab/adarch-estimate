"use client";

// 県・市の選択 → URL の ?pref= ?city= を書き換えてサーバー側で再計算（他のクエリは保つ）
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { Loader2 } from "lucide-react";
import type { AreaMuni } from "@/lib/packages/tver-area";

const sel = "px-3 py-2 text-sm bg-white border border-zinc-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#F19834]/40";

export function AreaPicker({ pref, prefs, city, munis }: { pref: string; prefs: string[]; city: string | null; munis: AreaMuni[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [pending, start] = useTransition();

  function go(nextPref: string, nextCity: string | null) {
    const q = new URLSearchParams(sp.toString());
    q.set("pref", nextPref);
    if (nextCity) q.set("city", nextCity);
    else q.delete("city");
    start(() => router.replace(`${pathname}?${q.toString()}`, { scroll: false }));
  }

  return (
    <>
      <label className="text-xs text-zinc-600">
        <span className="block mb-1 font-semibold">都道府県</span>
        <select value={pref} onChange={(e) => go(e.target.value, null)} className={sel}>
          {prefs.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
      </label>
      <label className="text-xs text-zinc-600">
        <span className="block mb-1 font-semibold">市区町村</span>
        <select value={city ?? ""} onChange={(e) => go(pref, e.target.value || null)} className={`${sel} min-w-[180px]`}>
          {munis.map((m) => (
            <option key={m.code} value={m.code}>{m.name}（{Math.round(m.population / 10000)}万人）</option>
          ))}
        </select>
      </label>
      {pending && <Loader2 className="w-4 h-4 animate-spin text-zinc-400 mb-2" />}
    </>
  );
}
