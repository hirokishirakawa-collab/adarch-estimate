"use client";

import { useState, useMemo, useCallback } from "react";
import { ChevronDown, ChevronRight, RotateCcw, Store } from "lucide-react";
import { cn } from "@/lib/utils";
import { SKYLARK_STORES, SKYLARK_PREF_ORDER } from "@/data/skylark-stores";

// ────────────────────────────────────────────────────────────────
// 価格テーブル
// ────────────────────────────────────────────────────────────────

// ボリュームディスカウント（媒体費 / 1店舗 / 4週間）
const MEDIA_FEE_TIERS: { min: number; max: number; fee: number }[] = [
  { min: 100,  max: 149,      fee: 15000 },
  { min: 150,  max: 199,      fee: 14500 },
  { min: 200,  max: 249,      fee: 14000 },
  { min: 250,  max: 299,      fee: 13500 },
  { min: 300,  max: 349,      fee: 13000 },
  { min: 350,  max: 399,      fee: 12500 },
  { min: 400,  max: 449,      fee: 12000 },
  { min: 450,  max: 499,      fee: 11500 },
  { min: 500,  max: 599,      fee: 11000 },
  { min: 600,  max: 699,      fee: 10500 },
  { min: 700,  max: 799,      fee: 10000 },
  { min: 800,  max: 899,      fee:  9500 },
  { min: 900,  max: 999,      fee:  9000 },
  { min: 1000, max: 1499,     fee:  8500 },
  { min: 1500, max: 1999,     fee:  8000 },
  { min: 2000, max: Infinity, fee:  7500 },
];

function getMediaFeePerStore(count: number): number {
  const tier = MEDIA_FEE_TIERS.find(t => count >= t.min && count <= t.max);
  return tier?.fee ?? 7500;
}

// 製作費ブレークポイント（線形補間）
const STICKER_PROD_BPS = [
  { count: 100,  fee: 6725 },
  { count: 300,  fee: 3817 },
  { count: 500,  fee: 3330 },
  { count: 1000, fee: 2868 },
  { count: 2000, fee: 2694 },
];
const STAND_PROD_BPS = [
  { count: 100,  fee: 1275 },
  { count: 300,  fee:  644 },
  { count: 500,  fee:  428 },
  { count: 1000, fee:  256 },
  { count: 2000, fee:  174 },
];

function interpolateFee(count: number, bps: { count: number; fee: number }[]): number {
  if (count <= bps[0].count) return bps[0].fee;
  if (count >= bps[bps.length - 1].count) return bps[bps.length - 1].fee;
  for (let i = 0; i < bps.length - 1; i++) {
    const lo = bps[i];
    const hi = bps[i + 1];
    if (count >= lo.count && count <= hi.count) {
      const t = (count - lo.count) / (hi.count - lo.count);
      return Math.round(lo.fee + t * (hi.fee - lo.fee));
    }
  }
  return bps[0].fee;
}

// ────────────────────────────────────────────────────────────────
// ユーティリティ
// ────────────────────────────────────────────────────────────────
function formatYen(n: number) {
  return "¥" + Math.round(n).toLocaleString("ja-JP");
}

type ProductType = "sticker" | "stand" | "dmb";
type Brand = "ガスト" | "バーミヤン" | "ジョナサン";

const ALL_BRANDS: Brand[] = ["ガスト", "バーミヤン", "ジョナサン"];

const BRAND_STYLES: Record<Brand, { active: string; dot: string }> = {
  ガスト:    { active: "bg-orange-50 text-orange-700 border-orange-200", dot: "bg-orange-400" },
  バーミヤン: { active: "bg-red-50 text-red-700 border-red-200",         dot: "bg-red-400"    },
  ジョナサン: { active: "bg-blue-50 text-blue-700 border-blue-200",      dot: "bg-blue-400"   },
};

// ────────────────────────────────────────────────────────────────
// メインコンポーネント
// ────────────────────────────────────────────────────────────────
export function SkylarkSimulator() {
  const [productType, setProductType] = useState<ProductType>("sticker");
  const [selectedBrands, setSelectedBrands] = useState<Set<Brand>>(new Set(ALL_BRANDS));
  const [selectedPrefs, setSelectedPrefs] = useState<Set<string>>(new Set());
  const [openPrefs, setOpenPrefs] = useState<Set<string>>(new Set());

  // 都道府県 × ブランド別店舗数マップ
  const prefStores = useMemo(() => {
    const map = new Map<string, Record<Brand, number>>();
    for (const store of SKYLARK_STORES) {
      if (!map.has(store.pref)) {
        map.set(store.pref, { ガスト: 0, バーミヤン: 0, ジョナサン: 0 });
      }
      const entry = map.get(store.pref)!;
      entry[store.brand as Brand] = (entry[store.brand as Brand] ?? 0) + 1;
    }
    return map;
  }, []);

  // 都道府県ごとのフィルタ済み店舗数
  const filteredPrefCount = useMemo(() => {
    const map = new Map<string, number>();
    for (const [pref, byBrand] of prefStores) {
      let cnt = 0;
      for (const brand of selectedBrands) cnt += byBrand[brand] ?? 0;
      map.set(pref, cnt);
    }
    return map;
  }, [prefStores, selectedBrands]);

  // 選択中の総店舗数
  const selectedStoreCount = useMemo(() => {
    let total = 0;
    for (const pref of selectedPrefs) total += filteredPrefCount.get(pref) ?? 0;
    return total;
  }, [selectedPrefs, filteredPrefCount]);

  const prefList = SKYLARK_PREF_ORDER.filter(p => (filteredPrefCount.get(p) ?? 0) > 0);

  const togglePrefExpand = useCallback((pref: string) => {
    setOpenPrefs(prev => {
      const next = new Set(prev);
      next.has(pref) ? next.delete(pref) : next.add(pref);
      return next;
    });
  }, []);

  const togglePrefSelect = useCallback((pref: string) => {
    setSelectedPrefs(prev => {
      const next = new Set(prev);
      next.has(pref) ? next.delete(pref) : next.add(pref);
      return next;
    });
  }, []);

  const toggleBrand = (brand: Brand) => {
    setSelectedBrands(prev => {
      const next = new Set(prev);
      if (next.has(brand) && next.size === 1) return prev; // 最低1ブランド維持
      next.has(brand) ? next.delete(brand) : next.add(brand);
      return next;
    });
  };

  // 最小100店舗を満たすエリアを自動選択（店舗数が多い都道府県から順に追加）
  const autoSelectMinStores = () => {
    const sorted = [...prefList].sort(
      (a, b) => (filteredPrefCount.get(b) ?? 0) - (filteredPrefCount.get(a) ?? 0)
    );
    const next = new Set<string>();
    let total = 0;
    for (const pref of sorted) {
      if (total >= 100) break;
      next.add(pref);
      total += filteredPrefCount.get(pref) ?? 0;
    }
    setSelectedPrefs(next);
  };

  const selectAll = () => setSelectedPrefs(new Set(prefList));
  const clearAll  = () => setSelectedPrefs(new Set());

  // 計算
  const calc = useMemo(() => {
    const count = selectedStoreCount;
    if (count < 100) return null;

    if (productType === "dmb") {
      const base = 1_500_000;
      return {
        type: "dmb" as const,
        storeCount: count,
        mediaFeePerStore: null as number | null,
        prodFeePerStore:  null as number | null,
        mediaFeeTotal: base,
        prodFeeTotal:  0,
        total: base,
        clientPrice:   Math.round(base * 1.20),
        purchasePrice: Math.round(base * 0.80),
        margin: Math.round(base * 1.20) - Math.round(base * 0.80),
      };
    }

    const mediaFeePerStore = getMediaFeePerStore(count);
    const bps = productType === "sticker" ? STICKER_PROD_BPS : STAND_PROD_BPS;
    const prodFeePerStore  = interpolateFee(count, bps);
    const mediaFeeTotal    = mediaFeePerStore * count;
    const prodFeeTotal     = prodFeePerStore  * count;
    const total            = mediaFeeTotal + prodFeeTotal;

    // 媒体費のみ ±20%、製作費は定価
    const clientPrice   = Math.round(mediaFeeTotal * 1.20) + prodFeeTotal;
    const purchasePrice = Math.round(mediaFeeTotal * 0.80) + prodFeeTotal;

    return {
      type: productType,
      storeCount: count,
      mediaFeePerStore,
      prodFeePerStore,
      mediaFeeTotal,
      prodFeeTotal,
      total,
      clientPrice,
      purchasePrice,
      margin: clientPrice - purchasePrice,
    };
  }, [selectedStoreCount, productType]);

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[1fr_380px] gap-5">

      {/* ── 左: 設定パネル ── */}
      <div className="space-y-4">

        {/* 商品タイプ */}
        <div className="bg-white rounded-xl border border-zinc-200 p-4">
          <p className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wide mb-3">商品タイプ</p>
          <div className="flex gap-2 flex-wrap">
            {([
              { key: "sticker" as ProductType, label: "テーブルステッカー", note: "6ブランド" },
              { key: "stand"   as ProductType, label: "テーブルスタンド",   note: "7ブランド" },
              { key: "dmb"     as ProductType, label: "デジタルメニューブック (DMB)", note: "3ブランド" },
            ] as const).map(({ key, label, note }) => (
              <button
                key={key}
                onClick={() => setProductType(key)}
                className={cn(
                  "px-3 py-2 rounded-lg border text-xs font-medium transition-all",
                  productType === key
                    ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                    : "bg-white text-zinc-600 border-zinc-200 hover:border-zinc-400"
                )}
              >
                {label}
                <span className={cn(
                  "ml-1.5 text-[10px]",
                  productType === key ? "text-blue-200" : "text-zinc-400"
                )}>
                  {note}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* ブランドフィルター */}
        <div className="bg-white rounded-xl border border-zinc-200 p-4">
          <p className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wide mb-3">ブランド</p>
          <div className="flex gap-2 flex-wrap">
            {ALL_BRANDS.map(brand => {
              const style = BRAND_STYLES[brand];
              const active = selectedBrands.has(brand);
              return (
                <button
                  key={brand}
                  onClick={() => toggleBrand(brand)}
                  className={cn(
                    "flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all",
                    active ? style.active : "bg-zinc-50 text-zinc-400 border-zinc-200"
                  )}
                >
                  <span className={cn("w-2 h-2 rounded-full flex-shrink-0", active ? style.dot : "bg-zinc-300")} />
                  {brand}
                  <span className="text-[10px] opacity-60">
                    ({SKYLARK_STORES.filter(s => s.brand === brand).length})
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* エリア選択 */}
        <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-zinc-100 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold text-zinc-700">エリア選択</p>
              <p className="text-[11px] text-zinc-400 mt-0.5">
                {selectedPrefs.size}都道府県 /{" "}
                <span className={cn("font-semibold", selectedStoreCount >= 100 ? "text-blue-600" : "text-zinc-500")}>
                  {selectedStoreCount.toLocaleString()}店舗選択中
                </span>
              </p>
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <button
                onClick={autoSelectMinStores}
                className="px-2.5 py-1 text-[11px] font-medium rounded-md bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 transition-colors whitespace-nowrap"
              >
                100店舗を自動選択
              </button>
              <button
                onClick={selectAll}
                className="px-2.5 py-1 text-[11px] font-medium rounded-md bg-zinc-100 text-zinc-600 hover:bg-zinc-200 transition-colors"
              >
                全選択
              </button>
              <button
                onClick={clearAll}
                title="リセット"
                className="p-1.5 rounded-md bg-zinc-100 text-zinc-600 hover:bg-zinc-200 transition-colors"
              >
                <RotateCcw className="w-3 h-3" />
              </button>
            </div>
          </div>

          <div className="max-h-[480px] overflow-y-auto divide-y divide-zinc-50">
            {prefList.map(pref => {
              const storeCount = filteredPrefCount.get(pref) ?? 0;
              const isSelected = selectedPrefs.has(pref);
              const isOpen     = openPrefs.has(pref);
              const byBrand    = prefStores.get(pref) ?? ({} as Record<Brand, number>);

              return (
                <div key={pref}>
                  <div className={cn(
                    "flex items-center gap-2 px-4 py-2.5 transition-colors",
                    isSelected ? "bg-blue-50/40" : "hover:bg-zinc-50"
                  )}>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => togglePrefSelect(pref)}
                      className="w-3.5 h-3.5 rounded accent-blue-600 cursor-pointer flex-shrink-0"
                    />
                    <button
                      className="flex items-center gap-1.5 flex-1 text-left min-w-0"
                      onClick={() => togglePrefExpand(pref)}
                    >
                      {isOpen
                        ? <ChevronDown  className="w-3.5 h-3.5 text-zinc-400 flex-shrink-0" />
                        : <ChevronRight className="w-3.5 h-3.5 text-zinc-400 flex-shrink-0" />
                      }
                      <span className={cn(
                        "text-xs font-medium truncate",
                        isSelected ? "text-blue-700" : "text-zinc-700"
                      )}>
                        {pref}
                      </span>
                      <span className="text-[11px] text-zinc-400 ml-auto flex-shrink-0">
                        {storeCount}店
                      </span>
                    </button>
                  </div>

                  {isOpen && (
                    <div className="px-11 pb-2.5 flex gap-2 flex-wrap">
                      {ALL_BRANDS.filter(b => selectedBrands.has(b) && (byBrand[b] ?? 0) > 0).map(brand => (
                        <span
                          key={brand}
                          className={cn(
                            "inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium border",
                            BRAND_STYLES[brand].active
                          )}
                        >
                          <span className={cn("w-1.5 h-1.5 rounded-full", BRAND_STYLES[brand].dot)} />
                          {brand}: {byBrand[brand]}店
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── 右: 結果パネル ── */}
      <div className="space-y-4">

        {selectedStoreCount === 0 ? (
          <div className="bg-white rounded-xl border border-zinc-200 p-10 text-center">
            <Store className="w-10 h-10 text-zinc-200 mx-auto mb-3" />
            <p className="text-sm font-medium text-zinc-400">エリアを選択してください</p>
            <p className="text-xs text-zinc-400 mt-1">最低100店舗から発注可能です</p>
          </div>

        ) : selectedStoreCount < 100 ? (
          <div className="bg-amber-50 rounded-xl border border-amber-200 p-6 text-center">
            <p className="text-sm font-semibold text-amber-700">最低100店舗が必要です</p>
            <p className="text-xs text-amber-600 mt-1.5">
              現在 {selectedStoreCount}店舗 ／ あと{" "}
              <span className="font-bold">{100 - selectedStoreCount}</span> 店舗以上追加してください
            </p>
          </div>

        ) : calc ? (
          <>
            {/* 結果サマリー */}
            <div className="bg-white rounded-xl border border-zinc-200 p-5">
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm font-bold text-zinc-900">シミュレーション結果</p>
                <span className="text-[11px] bg-zinc-100 text-zinc-500 px-2.5 py-1 rounded-full">
                  {calc.storeCount.toLocaleString()}店舗 / 4週間
                </span>
              </div>

              {calc.type === "dmb" ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between py-2 border-b border-zinc-100">
                    <span className="text-xs text-zinc-500">DMB最低出稿額</span>
                    <span className="text-lg font-bold text-zinc-900">{formatYen(calc.mediaFeeTotal)}〜</span>
                  </div>
                  <p className="text-[11px] text-zinc-400 pt-1">
                    ※ 100店舗以上・4週間から発注可能。実際の金額は店舗数・エリアにより変動します。
                  </p>
                </div>
              ) : (
                <div className="space-y-1">
                  <Row label="媒体費単価（/店舗）"  value={formatYen(calc.mediaFeePerStore!)} />
                  <Row
                    label={<>製作費単価（/店舗）<span className="text-[10px] text-zinc-400 ml-1">補間値</span></>}
                    value={formatYen(calc.prodFeePerStore!)}
                  />
                  <div className="my-2 border-t border-zinc-100" />
                  <Row label="媒体費合計"    value={formatYen(calc.mediaFeeTotal)} />
                  <Row label="製作費合計"    value={formatYen(calc.prodFeeTotal)} />
                  <div className="flex items-center justify-between py-2 mt-1 border-t border-zinc-200">
                    <span className="text-xs font-bold text-zinc-800">合計（定価）</span>
                    <span className="text-xl font-bold text-zinc-900">{formatYen(calc.total)}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Ad-Arch 提示価格 */}
            <div className="bg-zinc-950 rounded-xl border border-zinc-800 p-5">
              <p className="text-xs font-bold text-white mb-1">Ad-Arch 提示価格</p>
              <p className="text-[11px] text-zinc-500 mb-4">
                媒体費に ±20% を適用 ／ 製作費は定価のまま
              </p>
              <div className="space-y-1">
                <DarkRow
                  label="クライアント提示（媒体 +20%）"
                  value={formatYen(calc.clientPrice)}
                  highlight
                />
                <DarkRow
                  label="仕入れ価格（媒体 −20%）"
                  value={formatYen(calc.purchasePrice)}
                />
                <div className="pt-2 border-t border-zinc-800 mt-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-zinc-300">差益</span>
                    <span className="text-xl font-bold text-emerald-400">{formatYen(calc.margin)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* ボリュームディスカウント表（DMB以外） */}
            {calc.type !== "dmb" && (
              <div className="bg-white rounded-xl border border-zinc-200 p-4">
                <p className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wide mb-3">
                  媒体費ボリュームディスカウント（テーブル）
                </p>
                <div className="grid grid-cols-2 gap-1">
                  {MEDIA_FEE_TIERS.map(tier => {
                    const isCurrent =
                      calc.storeCount >= tier.min &&
                      (tier.max === Infinity ? true : calc.storeCount <= tier.max);
                    const label =
                      tier.max === Infinity
                        ? `${tier.min.toLocaleString()}店〜`
                        : `${tier.min.toLocaleString()}〜${tier.max.toLocaleString()}店`;
                    return (
                      <div
                        key={tier.min}
                        className={cn(
                          "flex items-center justify-between px-2.5 py-1.5 rounded-md text-[11px]",
                          isCurrent
                            ? "bg-blue-600 text-white font-bold shadow-sm"
                            : "bg-zinc-50 text-zinc-500"
                        )}
                      >
                        <span>{label}</span>
                        <span className="font-semibold">{formatYen(tier.fee)}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        ) : null}
      </div>
    </div>
  );
}

// ── サブコンポーネント ────────────────────────────────────────────
function Row({ label, value }: { label: React.ReactNode; value: string }) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-zinc-100">
      <span className="text-xs text-zinc-500">{label}</span>
      <span className="text-sm font-semibold text-zinc-900">{value}</span>
    </div>
  );
}

function DarkRow({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-zinc-800">
      <span className="text-xs text-zinc-400">{label}</span>
      <span className={cn("text-sm font-semibold", highlight ? "text-white" : "text-zinc-300")}>
        {value}
      </span>
    </div>
  );
}
