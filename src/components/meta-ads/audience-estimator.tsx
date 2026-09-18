"use client";

// Meta広告の想定費用（対象人数と日額の目安）— /dashboard/meta-ads と見積書で使う
//   onApply を渡すと「見積書に入れる」ボタンが出る（媒体費＋運用手数料の2行）

import { useMemo, useState, useTransition } from "react";
import { Loader2, Calculator } from "lucide-react";
import { estimateMetaAudience } from "@/lib/actions/meta-ads";
import { AUDIENCE_PRESETS } from "@/lib/meta-ads/audience-presets";
import { PREFECTURES, SELECTABLE_MUNICIPALITIES } from "@/data/tver-municipalities";
import { planForCodes } from "@/lib/tver/plan";

type Result = Awaited<ReturnType<typeof estimateMetaAudience>>;
export type MetaEstimateLine = { name: string; spec: string; quantity: number; unit: string; unitPrice: number };

const cls = "w-full px-2.5 py-1.5 text-sm bg-white border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-300";
const yen = (n: number) => n.toLocaleString("ja-JP");
/** TVerの想定視聴者数（OSのTVer料金と同じ推計: 全国4,470万×県の人口比×市の人口シェア） */
const tverViewers = (code: string) => planForCodes([code])?.viewers ?? 0;
const man = (n: number) => (n >= 10_000 ? `約${(Math.round(n / 1_000) / 10).toLocaleString("ja-JP")}万人` : `約${yen(Math.round(n / 100) * 100)}人`);
const GROUPS = [...new Set(AUDIENCE_PRESETS.map((p) => p.group).filter(Boolean))];

export function AudienceEstimator({ onApply }: { onApply?: (lines: MetaEstimateLine[]) => void }) {
  const [f, setF] = useState({ prefCode: "", cityCode: "", radiusKm: 10, ageMin: 25, ageMax: 65, preset: "none", dailyBudgetJpy: 0, days: 7, feePct: 20 });
  const [res, setRes] = useState<Result | null>(null);
  const [pending, start] = useTransition();
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setF((p) => ({ ...p, [k]: e.target.type === "number" ? Number(e.target.value) : e.target.value }));

  // 市区町村はTVerの配信エリアの一覧から（人口の多い順）。各市にTVerの想定視聴者数を添える
  const cities = useMemo(
    () => SELECTABLE_MUNICIPALITIES.filter((m) => m.prefCode === f.prefCode && m.population > 0).sort((a, b) => b.population - a.population).map((m) => ({ ...m, viewers: tverViewers(m.code) })),
    [f.prefCode],
  );
  const city = cities.find((m) => m.code === f.cityCode) ?? null;
  const prefName = PREFECTURES.find((p) => p.code === f.prefCode)?.name ?? "";

  const run = () => {
    if (!city) return setRes({ ok: false, note: "市区町村を選んでください" });
    start(async () => setRes(await estimateMetaAudience({ prefecture: prefName, city: city.name, radiusKm: f.radiusKm, ageMin: f.ageMin, ageMax: f.ageMax, preset: f.preset, dailyBudgetJpy: f.dailyBudgetJpy })));
  };

  const ok = res && res.ok ? res : null;
  // 見積書に入れる日額＝入れた日額（無ければ目安の真ん中を100円単位で）
  const daily = ok ? f.dailyBudgetJpy || Math.round((ok.numbers.dailyMin + ok.numbers.dailyMax) / 2 / 100) * 100 : 0;
  const media = daily * Math.max(1, f.days);
  const fee = Math.round((media * Math.max(0, f.feePct)) / 100);

  return (
    // 見積書のフォームの中に置くので、Enterで見積書が送信されないようにする（Enter＝計算）
    <div className="space-y-3" onKeyDown={(e) => { if (e.key === "Enter" && (e.target as HTMLElement).tagName === "INPUT") { e.preventDefault(); run(); } }}>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <label className="text-[11px] text-zinc-500">都道府県
          <select className={cls} value={f.prefCode} onChange={(e) => { setF((p) => ({ ...p, prefCode: e.target.value, cityCode: "" })); setRes(null); }}>
            <option value="">選んでください</option>
            {PREFECTURES.map((p) => <option key={p.code} value={p.code}>{p.name}</option>)}
          </select>
        </label>
        <label className="text-[11px] text-zinc-500">市区町村（TVerのエリア・視聴者数）
          <select className={cls} value={f.cityCode} onChange={set("cityCode")}>
            <option value="">選んでください</option>
            {cities.map((m) => <option key={m.code} value={m.code}>{m.name}（TVer視聴者 {man(m.viewers)}）</option>)}
          </select>
        </label>
        <label className="text-[11px] text-zinc-500">半径（km）<input type="number" min={1} max={80} className={cls} value={f.radiusKm} onChange={set("radiusKm")} /></label>
        <label className="text-[11px] text-zinc-500">ターゲット
          <select className={cls} value={f.preset} onChange={set("preset")}>
            <option value="none">指定なし（年齢だけ）</option>
            {GROUPS.map((g) => (
              <optgroup key={g} label={g}>
                {AUDIENCE_PRESETS.filter((p) => p.group === g).map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
              </optgroup>
            ))}
          </select>
        </label>
        <label className="text-[11px] text-zinc-500">年齢（下）<input type="number" min={18} max={65} className={cls} value={f.ageMin} onChange={set("ageMin")} /></label>
        <label className="text-[11px] text-zinc-500">年齢（上）<input type="number" min={18} max={65} className={cls} value={f.ageMax} onChange={set("ageMax")} /></label>
        <label className="text-[11px] text-zinc-500">考えている日額（円・任意）<input type="number" min={0} step={100} className={cls} value={f.dailyBudgetJpy || ""} onChange={set("dailyBudgetJpy")} placeholder="300" /></label>
        <div className="flex items-end">
          <button type="button" onClick={run} disabled={pending} className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 text-sm font-semibold text-white bg-orange-600 rounded-lg hover:bg-orange-700 disabled:opacity-50">
            {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Calculator className="w-4 h-4" />}計算する
          </button>
        </div>
      </div>

      {res && !res.ok && <p className="text-sm text-rose-700">{res.note}</p>}
      {ok && (
        <div className="bg-orange-50/60 border border-orange-200 rounded-lg p-3 space-y-1.5 text-sm text-zinc-800">
          <p className="text-xs text-zinc-500">{ok.area}{f.preset !== "none" ? `（${ok.presetLabel}）` : ""}</p>
          {city && <p>TVerの想定視聴者：<b>{city.name} {man(city.viewers)}</b>（TVerの市町村プランで届けられる人の母数・推計）</p>}
          <p>Metaの対象：<b>{ok.audienceMonthly}</b>（半径{f.radiusKm}kmの円で数えるので、市の境界とは少しずれます）</p>
          <p>日額の目安：<b>{yen(ok.numbers.dailyMin)}〜{yen(ok.numbers.dailyMax)}円</b>（目安・税抜）{"yourBudget" in ok && ok.yourBudget ? <span className="block text-[13px] text-orange-800">→ {ok.yourBudget}</span> : null}</p>
          {ok.tooSmall && <p className="text-[13px] text-rose-700">{ok.tooSmall}</p>}
          <p className="text-[11px] text-zinc-500">{ok.howCalculated}</p>

          {onApply && (
            <div className="pt-2 mt-2 border-t border-orange-200 flex flex-wrap items-end gap-2">
              <label className="text-[11px] text-zinc-500 w-24">配信日数<input type="number" min={1} max={90} className={cls} value={f.days} onChange={set("days")} /></label>
              <label className="text-[11px] text-zinc-500 w-28">運用手数料（%）<input type="number" min={0} max={100} className={cls} value={f.feePct} onChange={set("feePct")} /></label>
              <p className="text-[12px] text-zinc-600 flex-1 min-w-[12rem]">媒体費 日額{yen(daily)}円×{f.days}日＝{yen(media)}円／運用手数料 {f.feePct}%＝{yen(fee)}円</p>
              <button
                type="button"
                onClick={() => {
                  const area = `${ok.area}${f.preset !== "none" ? `・${ok.presetLabel}` : ""}`;
                  const lines: MetaEstimateLine[] = [
                    { name: "Meta広告 媒体費（Facebook／Instagram 地域限定）", spec: `${area}／日額${yen(daily)}円×${f.days}日／対象 ${ok.audienceMonthly}`, quantity: Math.max(1, f.days), unit: "日", unitPrice: daily },
                  ];
                  if (f.feePct > 0) lines.push({ name: "Meta広告 運用手数料", spec: `媒体費の${f.feePct}%（設定・配信管理・結果のご報告）`, quantity: 1, unit: "式", unitPrice: fee });
                  onApply(lines);
                }}
                className="px-3 py-1.5 text-sm font-semibold text-orange-700 border border-orange-300 bg-white rounded-lg hover:bg-orange-50"
              >
                見積書に入れる
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
