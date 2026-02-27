"use client";

import { useState, useMemo } from "react";
import { RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";

// ================================================================
// 型定義・定数
// ================================================================

type FH = "none" | "full" | "half";
type SecondAds = "none" | "plus_full" | "plus_half" | "full" | "half";
type Slot = "none" | "full" | "half";

interface AreaDef {
  id: string;
  label: string;
  prefectures: string;
  hasHalf: boolean;
  p2nd: { full: number; half: number };
  p3rd: { full: number; half: number };
  i2nd: { full: number; half: number };
  i3rd: { full: number; half: number };
}

const AREAS: AreaDef[] = [
  { id: "tokyo",     label: "東京",   prefectures: "東京都（23区）",                   hasHalf: true,  p2nd: { full: 7_300_000, half: 3_650_000 }, p3rd: { full: 3_200_000, half: 1_600_000 }, i2nd: { full: 1_320_000, half: 660_000   }, i3rd: { full: 970_000,  half: 485_000 } },
  { id: "kanto",     label: "関東",   prefectures: "神奈川県・埼玉県・千葉県",           hasHalf: false, p2nd: { full: 3_600_000, half: 0 },         p3rd: { full: 1_200_000, half: 0 },         i2nd: { full: 900_000,  half: 0 },          i3rd: { full: 485_000,  half: 0 } },
  { id: "kansai",    label: "関西",   prefectures: "大阪府・京都府・兵庫県",             hasHalf: false, p2nd: { full: 3_600_000, half: 0 },         p3rd: { full: 1_300_000, half: 0 },         i2nd: { full: 900_000,  half: 0 },          i3rd: { full: 520_000,  half: 0 } },
  { id: "tokai",     label: "東海",   prefectures: "愛知県・岐阜県・三重県",             hasHalf: false, p2nd: { full: 1_320_000, half: 0 },         p3rd: { full: 560_000,  half: 0 },          i2nd: { full: 330_000,  half: 0 },          i3rd: { full: 224_000,  half: 0 } },
  { id: "kyushu",    label: "九州",   prefectures: "福岡県",                           hasHalf: false, p2nd: { full: 920_000,  half: 0 },          p3rd: { full: 390_000,  half: 0 },          i2nd: { full: 230_000,  half: 0 },          i3rd: { full: 154_000,  half: 0 } },
  { id: "hokkaido",  label: "北海道", prefectures: "北海道",                           hasHalf: false, p2nd: { full: 640_000,  half: 0 },          p3rd: { full: 450_000,  half: 0 },          i2nd: { full: 160_000,  half: 0 },          i3rd: { full: 180_000,  half: 0 } },
  { id: "hiroshima", label: "広島",   prefectures: "広島県",                           hasHalf: false, p2nd: { full: 200_000,  half: 0 },          p3rd: { full: 120_000,  half: 0 },          i2nd: { full: 50_000,   half: 0 },          i3rd: { full: 48_000,   half: 0 } },
  { id: "okinawa",   label: "沖縄",   prefectures: "沖縄県",                           hasHalf: false, p2nd: { full: 240_000,  half: 0 },          p3rd: { full: 200_000,  half: 0 },          i2nd: { full: 60_000,   half: 0 },          i3rd: { full: 80_000,   half: 0 } },
];

interface TargetDef {
  id: string;
  label: string;
  category: string;
  pricePerWeek: number;
  impressionsPerWeek: number;
}

const TARGETING: TargetDef[] = [
  { id: "male",   label: "男性",           category: "性別",     pricePerWeek: 1_000_000, impressionsPerWeek: 200_000 },
  { id: "female", label: "女性",           category: "性別",     pricePerWeek: 800_000,   impressionsPerWeek: 160_000 },
  { id: "age20",  label: "20代（20-29歳）", category: "年代",     pricePerWeek: 500_000,   impressionsPerWeek: 100_000 },
  { id: "age30",  label: "30代（30-39歳）", category: "年代",     pricePerWeek: 450_000,   impressionsPerWeek: 90_000  },
  { id: "age40",  label: "40代（40-49歳）", category: "年代",     pricePerWeek: 400_000,   impressionsPerWeek: 80_000  },
  { id: "age50",  label: "50代以上",        category: "年代",     pricePerWeek: 400_000,   impressionsPerWeek: 80_000  },
  { id: "ride1",  label: "当該週1回目",     category: "乗車回数", pricePerWeek: 1_400_000, impressionsPerWeek: 280_000 },
  { id: "ride2",  label: "当該週2回目以降", category: "乗車回数", pricePerWeek: 1_400_000, impressionsPerWeek: 280_000 },
  { id: "m20",    label: "男性20代",        category: "性別×年代", pricePerWeek: 500_000,  impressionsPerWeek: 50_000  },
  { id: "m30",    label: "男性30代",        category: "性別×年代", pricePerWeek: 500_000,  impressionsPerWeek: 50_000  },
  { id: "m40",    label: "男性40代",        category: "性別×年代", pricePerWeek: 400_000,  impressionsPerWeek: 40_000  },
  { id: "m50",    label: "男性50代以上",    category: "性別×年代", pricePerWeek: 400_000,  impressionsPerWeek: 40_000  },
  { id: "f20",    label: "女性20代",        category: "性別×年代", pricePerWeek: 500_000,  impressionsPerWeek: 50_000  },
  { id: "f30",    label: "女性30代",        category: "性別×年代", pricePerWeek: 400_000,  impressionsPerWeek: 40_000  },
  { id: "f40",    label: "女性40代",        category: "性別×年代", pricePerWeek: 300_000,  impressionsPerWeek: 30_000  },
  { id: "f50",    label: "女性50代以上",    category: "性別×年代", pricePerWeek: 300_000,  impressionsPerWeek: 30_000  },
];

// ================================================================
// ユーティリティ
// ================================================================

function fmt(n: number): string {
  const m = n / 10_000;
  if (m >= 10_000) return (m / 10_000).toFixed(1) + "億円";
  if (m >= 1) return (m % 1 === 0 ? m.toFixed(0) : m.toFixed(1)) + "万円";
  return n.toLocaleString("ja-JP") + "円";
}

function fmtImp(n: number): string {
  const m = n / 10_000;
  if (m >= 10_000) return (m / 10_000).toFixed(1) + "億回";
  if (m >= 1) return (m % 1 === 0 ? m.toFixed(0) : m.toFixed(1)) + "万回";
  return n.toLocaleString("ja-JP") + "回";
}

// ================================================================
// サブコンポーネント: FH選択ボタン群
// ================================================================

function SlotButtons({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { val: string; text: string; sub?: string }[];
}) {
  return (
    <div className="flex items-start gap-2">
      <span className="text-xs text-zinc-600 w-28 flex-shrink-0 pt-1.5">{label}</span>
      <div className="flex gap-1 flex-wrap">
        {options.map((opt) => (
          <button
            key={opt.val}
            onClick={() => onChange(opt.val)}
            className={cn(
              "px-2.5 py-1.5 rounded-lg border text-[11px] transition-colors text-center min-w-[48px]",
              value === opt.val
                ? "bg-zinc-800 text-white border-zinc-800"
                : "border-zinc-200 text-zinc-600 hover:bg-zinc-50"
            )}
          >
            <div className="font-semibold">{opt.text}</div>
            {opt.sub && <div className="text-[9px] opacity-70">{opt.sub}</div>}
          </button>
        ))}
      </div>
    </div>
  );
}

// ================================================================
// メインコンポーネント
// ================================================================

export function TaxiAdsSimulator() {
  // 掲載週数
  const [weeks, setWeeks] = useState(4);
  const [targetingWeeks, setTargetingWeeks] = useState(4);

  // 全国メニュー - 広告枠
  const [firstAds, setFirstAds] = useState<FH>("none");
  const [secondAds, setSecondAds] = useState<SecondAds>("none");
  const [thirdAds, setThirdAds] = useState<FH>("none");
  const [seatbelt, setSeatbelt] = useState(false);

  // 全国メニュー - コンテンツ枠
  const [secondContents, setSecondContents] = useState<FH>("none");
  const [thirdContents, setThirdContents] = useState<FH>("none");

  // エリア指定
  type AreaSel = { s2: Slot; s3: Slot };
  const [areaSel, setAreaSel] = useState<Record<string, AreaSel>>({});

  // Targeting Ads
  const [targeting, setTargeting] = useState<Set<string>>(new Set());

  // オプション
  const [sampling, setSampling] = useState(false);
  const [research, setResearch] = useState(false);

  // ----------------------------------------------------------------
  // ヘルパー
  // ----------------------------------------------------------------

  const handleFirstAdsChange = (v: FH) => {
    setFirstAds(v);
    if (v === "none" && (secondAds === "plus_full" || secondAds === "plus_half")) {
      setSecondAds("none");
    }
  };

  const updateAreaSel = (areaId: string, key: "s2" | "s3", val: Slot) => {
    setAreaSel((prev) => {
      const curr = prev[areaId] ?? { s2: "none", s3: "none" };
      const next = { ...curr, [key]: val };
      if (next.s2 === "none" && next.s3 === "none") {
        const { [areaId]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [areaId]: next };
    });
  };

  const toggleTargeting = (id: string) => {
    setTargeting((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const reset = () => {
    setWeeks(4);
    setTargetingWeeks(4);
    setFirstAds("none");
    setSecondAds("none");
    setThirdAds("none");
    setSeatbelt(false);
    setSecondContents("none");
    setThirdContents("none");
    setAreaSel({});
    setTargeting(new Set());
    setSampling(false);
    setResearch(false);
  };

  // 2nd Adsオプション（1stあり/なしで変化）
  const secondAdsOptions = useMemo((): { val: SecondAds; text: string; sub: string }[] => {
    const base: { val: SecondAds; text: string; sub: string }[] = [
      { val: "none", text: "なし", sub: "" },
    ];
    if (firstAds !== "none") {
      base.push(
        { val: "plus_full", text: "+[FULL]", sub: "+200万/週" },
        { val: "plus_half", text: "+[HALF]", sub: "+100万/週" },
      );
    }
    base.push(
      { val: "full",  text: "[FULL]単独",  sub: "1,200万/週" },
      { val: "half",  text: "[HALF]単独",  sub: "600万/週" },
    );
    return base;
  }, [firstAds]);

  // セグメントをカテゴリごとにグループ化
  const targetingByCategory = useMemo(() => {
    const map = new Map<string, TargetDef[]>();
    for (const t of TARGETING) {
      if (!map.has(t.category)) map.set(t.category, []);
      map.get(t.category)!.push(t);
    }
    return map;
  }, []);

  // ----------------------------------------------------------------
  // 計算
  // ----------------------------------------------------------------

  const calc = useMemo(() => {
    type Row = { label: string; unitPrice: number; w: number; total: number; impressions: number };
    const rows: Row[] = [];

    const add = (label: string, unitPrice: number, w: number, impressions: number) =>
      rows.push({ label, unitPrice, w, total: unitPrice * w, impressions: impressions * w });

    // 全国 広告枠
    if (firstAds !== "none") {
      const p = firstAds === "full" ? 18_000_000 : 9_000_000;
      const i = firstAds === "full" ? 5_600_000  : 2_800_000;
      add(`1st Ads [${firstAds.toUpperCase()}]`, p, weeks, i);
    }
    if (secondAds !== "none") {
      const map: Record<SecondAds, { label: string; p: number; i: number } | undefined> = {
        none:      undefined,
        plus_full: { label: "2nd Ads +[FULL]（1stとのセット）", p: 2_000_000,  i: 5_000_000 },
        plus_half: { label: "2nd Ads +[HALF]（1stとのセット）", p: 1_000_000,  i: 2_500_000 },
        full:      { label: "2nd Ads [FULL]（単独）",            p: 12_000_000, i: 3_800_000 },
        half:      { label: "2nd Ads [HALF]（単独）",            p: 6_000_000,  i: 1_900_000 },
      };
      const m = map[secondAds];
      if (m) add(m.label, m.p, weeks, m.i);
    }
    if (thirdAds !== "none") {
      const p = thirdAds === "full" ? 6_000_000 : 3_000_000;
      const i = thirdAds === "full" ? 1_800_000 : 900_000;
      add(`3rd Ads [${thirdAds.toUpperCase()}]`, p, weeks, i);
    }
    if (seatbelt) {
      add("シートベルト着用アナウンス", 2_000_000, weeks, 5_600_000);
    }

    // 全国 コンテンツ枠
    if (secondContents !== "none") {
      const p = secondContents === "full" ? 7_200_000 : 3_600_000;
      const i = secondContents === "full" ? 3_800_000 : 1_900_000;
      add(`2nd Contents [${secondContents.toUpperCase()}]`, p, weeks, i);
    }
    if (thirdContents !== "none") {
      const p = thirdContents === "full" ? 3_600_000 : 1_800_000;
      const i = thirdContents === "full" ? 2_100_000 : 1_050_000;
      add(`3rd Contents [${thirdContents.toUpperCase()}]`, p, weeks, i);
    }

    // エリア指定
    for (const area of AREAS) {
      const sel = areaSel[area.id];
      if (!sel) continue;
      if (sel.s2 !== "none") {
        add(`${area.label} 2nd Ads [${sel.s2.toUpperCase()}]`, area.p2nd[sel.s2], weeks, area.i2nd[sel.s2]);
      }
      if (sel.s3 !== "none") {
        add(`${area.label} 3rd Ads [${sel.s3.toUpperCase()}]`, area.p3rd[sel.s3], weeks, area.i3rd[sel.s3]);
      }
    }

    // Targeting Ads
    for (const seg of TARGETING) {
      if (targeting.has(seg.id)) {
        add(`Targeting: ${seg.label}`, seg.pricePerWeek, targetingWeeks, seg.impressionsPerWeek);
      }
    }

    // オプション
    if (sampling) add("車内サンプリング（10,000個）", 600_000, 1, 0);
    if (research) add("マーケティングリサーチ",       600_000, 1, 0);

    const mediaCost        = rows.reduce((s, r) => s + r.total, 0);
    const totalImpressions = rows.reduce((s, r) => s + r.impressions, 0);

    return { rows, mediaCost, totalImpressions };
  }, [weeks, targetingWeeks, firstAds, secondAds, thirdAds, seatbelt,
      secondContents, thirdContents, areaSel, targeting, sampling, research]);

  // ================================================================
  // レンダリング
  // ================================================================

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[1fr_380px] gap-4 items-start">

      {/* ===== 左: 設定パネル ===== */}
      <div className="space-y-4">

        {/* 掲載週数 */}
        <div className="bg-white rounded-xl border border-zinc-200 p-4 space-y-3">
          <p className="text-xs font-bold text-zinc-700">掲載週数（全国・エリア指定メニュー共通）</p>
          <div className="flex items-center gap-3">
            <input
              type="range" min={1} max={13} step={1}
              value={weeks}
              onChange={(e) => setWeeks(Number(e.target.value))}
              className="flex-1 accent-zinc-700"
            />
            <div className="flex items-center gap-1">
              <input
                type="number" min={1} max={52}
                value={weeks}
                onChange={(e) => setWeeks(Math.max(1, Number(e.target.value)))}
                className="w-14 px-2 py-1 text-sm font-bold text-center border border-zinc-200 rounded-lg outline-none focus:border-blue-400"
              />
              <span className="text-xs text-zinc-500">週</span>
            </div>
          </div>
          <div className="flex justify-between text-[10px] text-zinc-400">
            <span>1週</span><span>4週（1ヶ月）</span><span>13週（1クォーター）</span>
          </div>
        </div>

        {/* 全国メニュー - 広告枠 */}
        <div className="bg-white rounded-xl border border-zinc-200 p-4 space-y-3">
          <div>
            <p className="text-xs font-bold text-zinc-700">全国メニュー — 広告枠</p>
            <p className="text-[11px] text-zinc-400 mt-0.5">約71,000台（FULL）・約35,500台（HALF）</p>
          </div>
          <div className="space-y-2.5">
            <SlotButtons
              label="1st Ads"
              value={firstAds}
              onChange={(v) => handleFirstAdsChange(v as FH)}
              options={[
                { val: "none", text: "なし",   sub: "" },
                { val: "full", text: "[FULL]", sub: "1,800万/週" },
                { val: "half", text: "[HALF]", sub: "900万/週" },
              ]}
            />
            <SlotButtons
              label="2nd Ads"
              value={secondAds}
              onChange={(v) => setSecondAds(v as SecondAds)}
              options={secondAdsOptions}
            />
            {firstAds !== "none" && (
              <p className="text-[10px] text-blue-500 pl-[7.5rem]">
                ※ 1stとのセット追加オプションが利用可能です
              </p>
            )}
            <SlotButtons
              label="3rd Ads"
              value={thirdAds}
              onChange={(v) => setThirdAds(v as FH)}
              options={[
                { val: "none", text: "なし",   sub: "" },
                { val: "full", text: "[FULL]", sub: "600万/週" },
                { val: "half", text: "[HALF]", sub: "300万/週" },
              ]}
            />
            <label className="flex items-center gap-2 cursor-pointer pl-0.5">
              <input
                type="checkbox" checked={seatbelt}
                onChange={(e) => setSeatbelt(e.target.checked)}
                className="w-4 h-4 accent-zinc-700"
              />
              <span className="text-xs text-zinc-600">シートベルト着用アナウンス</span>
              <span className="text-[10px] text-zinc-400">200万/週・5,600,000回</span>
            </label>
          </div>
        </div>

        {/* 全国メニュー - コンテンツ枠 */}
        <div className="bg-white rounded-xl border border-zinc-200 p-4 space-y-3">
          <div>
            <p className="text-xs font-bold text-zinc-700">全国メニュー — コンテンツ枠</p>
            <p className="text-[11px] text-zinc-400 mt-0.5">約71,000台（FULL）・約35,500台（HALF）</p>
          </div>
          <div className="space-y-2.5">
            <SlotButtons
              label="2nd Contents"
              value={secondContents}
              onChange={(v) => setSecondContents(v as FH)}
              options={[
                { val: "none", text: "なし",   sub: "" },
                { val: "full", text: "[FULL]", sub: "720万/週" },
                { val: "half", text: "[HALF]", sub: "360万/週" },
              ]}
            />
            <SlotButtons
              label="3rd Contents"
              value={thirdContents}
              onChange={(v) => setThirdContents(v as FH)}
              options={[
                { val: "none", text: "なし",   sub: "" },
                { val: "full", text: "[FULL]", sub: "360万/週" },
                { val: "half", text: "[HALF]", sub: "180万/週" },
              ]}
            />
          </div>
        </div>

        {/* エリア指定メニュー */}
        <div className="bg-white rounded-xl border border-zinc-200 p-4 space-y-3">
          <div>
            <p className="text-xs font-bold text-zinc-700">エリア指定メニュー</p>
            <p className="text-[11px] text-zinc-400 mt-0.5">広告枠のみ（コンテンツ枠なし）</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-zinc-100">
                  <th className="text-left py-1.5 pr-4 text-[11px] font-semibold text-zinc-500">エリア</th>
                  <th className="text-center py-1.5 px-2 text-[11px] font-semibold text-zinc-500">2nd Ads</th>
                  <th className="text-center py-1.5 px-2 text-[11px] font-semibold text-zinc-500">3rd Ads</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-50">
                {AREAS.map((area) => {
                  const sel = areaSel[area.id] ?? { s2: "none" as Slot, s3: "none" as Slot };
                  const isActive = sel.s2 !== "none" || sel.s3 !== "none";
                  return (
                    <tr key={area.id} className={cn("transition-colors", isActive && "bg-blue-50/40")}>
                      <td className="py-2 pr-4 whitespace-nowrap">
                        <div className="font-semibold text-zinc-700">{area.label}</div>
                        <div className="text-[10px] text-zinc-400 mt-0.5">{area.prefectures}</div>
                      </td>
                      <td className="py-2 px-2">
                        <div className="flex gap-1 justify-center">
                          {(["none", "full", ...(area.hasHalf ? ["half"] : [])] as Slot[]).map((v) => (
                            <button
                              key={v}
                              onClick={() => updateAreaSel(area.id, "s2", v)}
                              className={cn(
                                "px-2 py-1 rounded border text-[10px] transition-colors text-center",
                                sel.s2 === v
                                  ? "bg-zinc-800 text-white border-zinc-800"
                                  : "border-zinc-200 text-zinc-500 hover:bg-zinc-50"
                              )}
                            >
                              {v === "none" ? (
                                "—"
                              ) : (
                                <>
                                  <div className="font-semibold">{v.toUpperCase()}</div>
                                  <div className="text-[9px] opacity-70">{fmt(area.p2nd[v])}</div>
                                </>
                              )}
                            </button>
                          ))}
                        </div>
                        {sel.s2 !== "none" && (
                          <p className="text-[9px] text-zinc-400 text-center mt-0.5">
                            {fmtImp(area.i2nd[sel.s2])}/週
                          </p>
                        )}
                      </td>
                      <td className="py-2 px-2">
                        <div className="flex gap-1 justify-center">
                          {(["none", "full", ...(area.hasHalf ? ["half"] : [])] as Slot[]).map((v) => (
                            <button
                              key={v}
                              onClick={() => updateAreaSel(area.id, "s3", v)}
                              className={cn(
                                "px-2 py-1 rounded border text-[10px] transition-colors text-center",
                                sel.s3 === v
                                  ? "bg-zinc-800 text-white border-zinc-800"
                                  : "border-zinc-200 text-zinc-500 hover:bg-zinc-50"
                              )}
                            >
                              {v === "none" ? (
                                "—"
                              ) : (
                                <>
                                  <div className="font-semibold">{v.toUpperCase()}</div>
                                  <div className="text-[9px] opacity-70">{fmt(area.p3rd[v])}</div>
                                </>
                              )}
                            </button>
                          ))}
                        </div>
                        {sel.s3 !== "none" && (
                          <p className="text-[9px] text-zinc-400 text-center mt-0.5">
                            {fmtImp(area.i3rd[sel.s3])}/週
                          </p>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Targeting Ads */}
        <div className="bg-white rounded-xl border border-zinc-200 p-4 space-y-3">
          <div>
            <p className="text-xs font-bold text-zinc-700">Targeting Ads（GOアプリ）</p>
            <p className="text-[11px] text-zinc-400 mt-0.5">GOアプリ乗車・GO Pay決済ユーザー限定 / 最低出稿100万円 / 1週間単位</p>
          </div>

          {/* Targeting専用週数 */}
          <div className="flex items-center gap-3">
            <span className="text-[11px] text-zinc-500 w-20 flex-shrink-0">掲載週数</span>
            <input
              type="range" min={1} max={13} step={1}
              value={targetingWeeks}
              onChange={(e) => setTargetingWeeks(Number(e.target.value))}
              className="flex-1 accent-zinc-700"
            />
            <div className="flex items-center gap-1">
              <input
                type="number" min={1} max={52}
                value={targetingWeeks}
                onChange={(e) => setTargetingWeeks(Math.max(1, Number(e.target.value)))}
                className="w-12 px-2 py-1 text-xs text-center border border-zinc-200 rounded outline-none focus:border-blue-400"
              />
              <span className="text-[11px] text-zinc-500">週</span>
            </div>
          </div>

          {/* セグメント */}
          {Array.from(targetingByCategory.entries()).map(([cat, segs]) => (
            <div key={cat}>
              <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">{cat}</p>
              <div className="flex flex-wrap gap-1.5">
                {segs.map((seg) => (
                  <label
                    key={seg.id}
                    className={cn(
                      "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs cursor-pointer transition-colors",
                      targeting.has(seg.id)
                        ? "bg-zinc-800 text-white border-zinc-800"
                        : "border-zinc-200 text-zinc-600 hover:bg-zinc-50"
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={targeting.has(seg.id)}
                      onChange={() => toggleTargeting(seg.id)}
                      className="sr-only"
                    />
                    <span>{seg.label}</span>
                    <span className={cn("text-[9px]", targeting.has(seg.id) ? "opacity-70" : "text-zinc-400")}>
                      {fmt(seg.pricePerWeek)}/週
                    </span>
                  </label>
                ))}
              </div>
            </div>
          ))}

          {targeting.size > 0 && (
            <button
              onClick={() => setTargeting(new Set())}
              className="text-[11px] text-zinc-400 hover:text-red-500 transition-colors"
            >
              選択解除
            </button>
          )}
        </div>

        {/* オプションメニュー */}
        <div className="bg-white rounded-xl border border-zinc-200 p-4">
          <p className="text-xs font-bold text-zinc-700 mb-2.5">オプションメニュー</p>
          <div className="space-y-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox" checked={sampling}
                onChange={(e) => setSampling(e.target.checked)}
                className="w-4 h-4 accent-zinc-700"
              />
              <span className="text-xs text-zinc-600">タクシー車内サンプリング</span>
              <span className="text-[10px] text-zinc-400">60万円（10,000個・2週間）</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox" checked={research}
                onChange={(e) => setResearch(e.target.checked)}
                className="w-4 h-4 accent-zinc-700"
              />
              <span className="text-xs text-zinc-600">マーケティングリサーチ</span>
              <span className="text-[10px] text-zinc-400">60万円</span>
            </label>
          </div>
        </div>
      </div>

      {/* ===== 右: 結果パネル ===== */}
      <div className="xl:sticky xl:top-6">
        <div className="bg-zinc-900 rounded-xl p-4 space-y-3 text-white">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-zinc-300">見積もり結果</p>
            <button
              onClick={reset}
              className="flex items-center gap-1 text-[11px] text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              <RotateCcw className="w-3 h-3" />
              リセット
            </button>
          </div>

          {calc.rows.length === 0 ? (
            <p className="text-[11px] text-zinc-600 text-center py-8">
              ← メニューを選択すると費用が表示されます
            </p>
          ) : (
            <>
              {/* 内訳 */}
              <div className="bg-zinc-800 rounded-lg overflow-hidden text-[11px]">
                {calc.rows.map((row, i) => (
                  <div
                    key={i}
                    className="flex items-start justify-between px-3 py-2 border-b border-zinc-700 last:border-0 gap-2"
                  >
                    <div className="text-zinc-400 min-w-0 flex-1">
                      <div className="truncate">{row.label}</div>
                      {row.w > 1 && (
                        <div className="text-zinc-600 text-[9px]">
                          {fmt(row.unitPrice)} × {row.w}週
                        </div>
                      )}
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="text-zinc-200 font-semibold tabular-nums">{fmt(row.total)}</div>
                      {row.impressions > 0 && (
                        <div className="text-zinc-600 text-[9px] tabular-nums">{fmtImp(row.impressions)}</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* 総合計 */}
              <div className="bg-zinc-700/50 rounded-lg px-3 py-3 space-y-1.5">
                <div className="flex items-end justify-between">
                  <span className="text-xs text-zinc-300 font-bold">合計（税抜）</span>
                  <span className="text-xl font-bold text-yellow-300 tabular-nums">{fmt(calc.mediaCost)}</span>
                </div>
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-zinc-500">想定インプレッション合計</span>
                  <span className="text-emerald-400 font-semibold tabular-nums">{fmtImp(calc.totalImpressions)}</span>
                </div>
              </div>

              <p className="text-[10px] text-zinc-600 text-center">
                ※ 価格はすべてグロス税抜。インプレッション数は目安値です。
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
