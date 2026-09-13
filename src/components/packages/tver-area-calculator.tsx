// ==============================================================
// エリア別の目安（サーバーコンポーネント）
//   県と市を選ぶ → ①市町村プランの3プラン（申込ページと同じ額）ごとに「到達人数・住民の何%・TVer視聴者の何%」
//   選択は URL（?pref=&city=）に載せ、ページを再描画する（公開ページでもOS内でも同じ）
// ==============================================================

import { estimateArea, monthlyGuideText, resolveArea } from "@/lib/packages/tver-area";
import { TVER_ESTIMATE_NOTE, fmtMan } from "@/lib/tver/plan";
import { AreaPicker } from "./area-picker";

export function TverAreaCalculator({
  pref,
  city,
  fallbackPref,
  compact = false,
}: {
  pref?: string | null;
  city?: string | null;
  fallbackPref?: string | null;
  /** OS内の詳細画面用（余白を詰める） */
  compact?: boolean;
}) {
  const area = resolveArea({ pref, city, fallbackPref });
  const est = area.city ? estimateArea(area.pref, area.city) : null;
  const muni = area.munis.find((m) => m.code === area.city);

  return (
    <div className={compact ? "" : "rounded-2xl border border-zinc-200 p-5 sm:p-6"}>
      <div className="flex flex-wrap items-end gap-3">
        <AreaPicker pref={area.pref} prefs={area.prefs} city={area.city} munis={area.munis} />
      </div>

      {est && muni ? (
        <div className="mt-4">
          <p className="text-sm text-zinc-700">
            <b>{est.plan.areaLabel}</b>　人口 {fmtMan(est.plan.population)}／TVerを見ている人（推計）{fmtMan(est.plan.viewers)}
          </p>
          <p className="text-xs text-zinc-600 mt-1">
            {monthlyGuideText(est)}　／　契約期間{est.minMonths}ヶ月以上{est.small ? "（人口5万人未満のエリア）" : ""}
          </p>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm min-w-[640px]">
              <thead>
                <tr className="text-[11px] text-zinc-500 border-b border-zinc-200">
                  <th className="text-left py-2 font-semibold">プラン</th>
                  <th className="text-right py-2 font-semibold">月額（税抜）</th>
                  <th className="text-right py-2 font-semibold">月の再生数（目安）</th>
                  <th className="text-right py-2 font-semibold">月に届く人数（目安）</th>
                  <th className="text-right py-2 font-semibold">住民の</th>
                  <th className="text-right py-2 font-semibold">TVer視聴者の</th>
                </tr>
              </thead>
              <tbody>
                {est.tiers.map((t) => (
                  <tr key={t.key} className={`border-b border-zinc-100 ${t.recommended ? "bg-[#FFF6EA]" : ""} ${t.custom ? "text-zinc-400" : ""}`}>
                    <td className="py-2.5">
                      <span className="font-semibold">{t.name}</span>
                      {t.mergedWith.length > 0 && <span className="ml-1 text-[10.5px] text-zinc-500">（{t.mergedWith.join("・")}と同額）</span>}
                      {t.recommended && <span className="ml-2 text-[10px] font-bold text-[#B8651A] bg-white border border-[#F19834] rounded px-1.5 py-0.5 align-middle">おすすめ</span>}
                      <span className="block text-[10.5px] text-zinc-500">住民の{t.perResidents}人に1人へ</span>
                    </td>
                    <td className="py-2.5 text-right tabular-nums font-bold">
                      ¥{t.monthly.toLocaleString("ja-JP")}
                      {t.floored && <span className="block text-[10.5px] font-normal text-zinc-500">最低料金</span>}
                      {t.custom && <span className="block text-[10.5px] font-normal text-zinc-500">大規模展開（個別見積）</span>}
                    </td>
                    <td className="py-2.5 text-right tabular-nums text-zinc-600">{fmtMan(t.impressions).replace("人", "回")}</td>
                    <td className="py-2.5 text-right tabular-nums">{fmtMan(t.reach)}</td>
                    <td className="py-2.5 text-right tabular-nums">{t.pctResidents.toFixed(t.pctResidents < 10 ? 1 : 0)}%</td>
                    <td className="py-2.5 text-right tabular-nums">{t.pctViewers.toFixed(0)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-[11px] text-zinc-500 mt-2 leading-relaxed">
            市町村プラン（15秒・1エリア・初回登録費と管理費なし）の額です。月の再生数＝月額÷再生単価（15秒 ¥{est.unitPrice}）、届く人数＝再生数÷月の平均視聴回数（当社の実配信の実測 {est.freq}回）。
            月額30万円以上・2エリア以上・週次報告のご希望は「大規模展開」として個別にお見積りします。
            視聴者数は TVer月間利用者（全国4,470万人）を県・市の人口比で推計した値です。{TVER_ESTIMATE_NOTE}
          </p>
        </div>
      ) : (
        <p className="text-sm text-zinc-500 mt-3">市区町村を選ぶと目安が出ます。</p>
      )}
    </div>
  );
}
