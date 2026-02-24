"use client";

import { useState, useMemo, useCallback } from "react";
import { ChevronDown, ChevronRight, RotateCcw, GraduationCap, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { UNIV_STORES, UNIV_PREF_ORDER } from "@/data/univ-stores";

// ────────────────────────────────────────────────────────────────
// 価格テーブル
// ────────────────────────────────────────────────────────────────

// 印刷費：総印刷枚数で tier を決め、全量に同一単価を適用
const PRINT_TIERS: { min: number; max: number; unitPrice: number }[] = [
  { min: 100,  max: 299,      unitPrice: 1800 },
  { min: 300,  max: 399,      unitPrice:  670 },
  { min: 400,  max: 499,      unitPrice:  500 },
  { min: 500,  max: 999,      unitPrice:  430 },
  { min: 1000, max: 1499,     unitPrice:  230 },
  { min: 1500, max: 1999,     unitPrice:  175 },
  { min: 2000, max: 2999,     unitPrice:  155 },
  { min: 3000, max: 4999,     unitPrice:  130 },
  { min: 5000, max: Infinity, unitPrice:  110 },
];

function getPrintUnitPrice(totalSheets: number): number | null {
  const tier = PRINT_TIERS.find(t => totalSheets >= t.min && totalSheets <= t.max);
  return tier?.unitPrice ?? null;
}

const PLACEMENT_UNIT = 700;   // 掲載費 ¥700/枚
const SHIPPING_UNIT  = 2600;  // 発送費 ¥2,600/食堂
const DESIGN_FEE     = 150000; // デザイン制作費 ¥150,000/案

function formatYen(n: number) {
  return "¥" + Math.round(n).toLocaleString("ja-JP");
}

// ────────────────────────────────────────────────────────────────
// メインコンポーネント
// ────────────────────────────────────────────────────────────────
export function UnivCoopSimulator() {
  // 選択食堂 (no をキーにする)
  const [selectedStores, setSelectedStores] = useState<Set<number>>(new Set());
  const [openPrefs, setOpenPrefs] = useState<Set<string>>(new Set());
  const [openUnivs, setOpenUnivs] = useState<Set<string>>(new Set());

  // グローバル入力
  const [sheetsPerStore, setSheetsPerStore] = useState<number>(100);
  const [months, setMonths]                 = useState<number>(3);
  const [designCount, setDesignCount]       = useState<number>(1);
  const [addDesignFee, setAddDesignFee]     = useState<boolean>(false);

  // ── 都道府県 → 大学 → 食堂 の階層マップ ────────────────────────
  const hierarchy = useMemo(() => {
    // Map<pref, Map<"univ_campus", store[]>>
    const map = new Map<string, Map<string, typeof UNIV_STORES>>();
    for (const s of UNIV_STORES) {
      if (!map.has(s.pref)) map.set(s.pref, new Map());
      const univKey = s.campus ? `${s.univ}（${s.campus}）` : s.univ;
      if (!map.get(s.pref)!.has(univKey)) map.get(s.pref)!.set(univKey, []);
      map.get(s.pref)!.get(univKey)!.push(s);
    }
    return map;
  }, []);

  // 選択食堂のリスト（計算用）
  const selectedList = useMemo(
    () => UNIV_STORES.filter(s => selectedStores.has(s.no)),
    [selectedStores]
  );

  // min/max 外れの食堂
  const outOfRange = useMemo(
    () => selectedList.filter(s => {
      const hasMin = s.minTray > 0;
      const hasMax = s.maxTray > 0;
      return (hasMin && sheetsPerStore < s.minTray) ||
             (hasMax && sheetsPerStore > s.maxTray);
    }),
    [selectedList, sheetsPerStore]
  );

  // ── トグル ────────────────────────────────────────────────────
  const togglePref = useCallback((pref: string) => {
    setOpenPrefs(prev => { const n = new Set(prev); n.has(pref) ? n.delete(pref) : n.add(pref); return n; });
  }, []);

  const toggleUniv = useCallback((key: string) => {
    setOpenUnivs(prev => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n; });
  }, []);

  const toggleStore = useCallback((no: number) => {
    setSelectedStores(prev => { const n = new Set(prev); n.has(no) ? n.delete(no) : n.add(no); return n; });
  }, []);

  const selectUnivAll = useCallback((stores: typeof UNIV_STORES) => {
    setSelectedStores(prev => {
      const n = new Set(prev);
      stores.forEach(s => n.add(s.no));
      return n;
    });
  }, []);

  const deselectUnivAll = useCallback((stores: typeof UNIV_STORES) => {
    setSelectedStores(prev => {
      const n = new Set(prev);
      stores.forEach(s => n.delete(s.no));
      return n;
    });
  }, []);

  const clearAll = () => setSelectedStores(new Set());

  // ── 計算 ─────────────────────────────────────────────────────
  const calc = useMemo(() => {
    const storeCount  = selectedList.length;
    if (storeCount === 0) return null;

    const totalMonthlySheets = sheetsPerStore * storeCount;     // /月 合計
    const totalPrintSheets   = totalMonthlySheets * months;     // 総印刷枚数

    const placementFee = PLACEMENT_UNIT * totalMonthlySheets * months;
    const printUnit    = getPrintUnitPrice(totalPrintSheets);
    const printFee     = printUnit !== null ? printUnit * totalPrintSheets : null;
    const shippingFee  = SHIPPING_UNIT * storeCount;

    if (printFee === null) return null;

    const subtotal     = placementFee + printFee + shippingFee;
    const mgmtFee      = subtotal * 0.20;
    const clientPrice  = subtotal + mgmtFee;
    const purchasePrice = subtotal - mgmtFee;
    const designTotal  = addDesignFee ? DESIGN_FEE * designCount : 0;

    return {
      storeCount,
      totalMonthlySheets,
      totalPrintSheets,
      printUnit,
      placementFee,
      printFee,
      shippingFee,
      subtotal,
      mgmtFee,
      clientPrice,
      purchasePrice,
      designTotal,
      clientPriceWithDesign: clientPrice + designTotal,
      margin: mgmtFee * 2, // client - purchase = 40% of subtotal
    };
  }, [selectedList, sheetsPerStore, months, addDesignFee, designCount]);

  const prefList = UNIV_PREF_ORDER.filter(p => hierarchy.has(p));

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[1fr_400px] gap-5">

      {/* ── 左: 設定 + 食堂選択 ── */}
      <div className="space-y-4">

        {/* グローバル設定 */}
        <div className="bg-white rounded-xl border border-zinc-200 p-4 space-y-4">
          <p className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wide">配信設定</p>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {/* 枚数/月 */}
            <div>
              <label className="text-[11px] text-zinc-500 block mb-1">枚数 / 月（1食堂あたり）</label>
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  min={1}
                  value={sheetsPerStore}
                  onChange={e => setSheetsPerStore(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-full border border-zinc-200 rounded-lg px-2.5 py-1.5 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <span className="text-xs text-zinc-400 whitespace-nowrap">枚</span>
              </div>
            </div>

            {/* 掲載月数 */}
            <div>
              <label className="text-[11px] text-zinc-500 block mb-1">掲載月数</label>
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  min={1}
                  max={12}
                  value={months}
                  onChange={e => setMonths(Math.max(1, Math.min(12, parseInt(e.target.value) || 1)))}
                  className="w-full border border-zinc-200 rounded-lg px-2.5 py-1.5 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <span className="text-xs text-zinc-400 whitespace-nowrap">ヶ月</span>
              </div>
            </div>

            {/* デザイン案数（チェック時のみ） */}
            <div>
              <label className="text-[11px] text-zinc-500 block mb-1">デザイン制作費</label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={addDesignFee}
                  onChange={e => setAddDesignFee(e.target.checked)}
                  className="w-4 h-4 rounded accent-blue-600"
                />
                <span className="text-xs text-zinc-700">追加する</span>
              </label>
            </div>

            {addDesignFee && (
              <div>
                <label className="text-[11px] text-zinc-500 block mb-1">デザイン案数</label>
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    min={1}
                    value={designCount}
                    onChange={e => setDesignCount(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-full border border-zinc-200 rounded-lg px-2.5 py-1.5 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-xs text-zinc-400 whitespace-nowrap">案</span>
                </div>
              </div>
            )}
          </div>

          {/* min/max 警告 */}
          {outOfRange.length > 0 && (
            <div className="flex items-start gap-2 p-2.5 bg-amber-50 border border-amber-200 rounded-lg">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-[11px] font-semibold text-amber-700">
                  {outOfRange.length}食堂で枚数が推奨範囲外です
                </p>
                <p className="text-[10px] text-amber-600 mt-0.5">
                  {outOfRange.slice(0, 3).map(s =>
                    `${s.univ}・${s.store}（推奨${s.minTray}〜${s.maxTray}枚）`
                  ).join(" / ")}
                  {outOfRange.length > 3 && ` 他${outOfRange.length - 3}件`}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* 食堂選択アコーディオン */}
        <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-zinc-100 flex items-center justify-between gap-2">
            <div>
              <p className="text-[11px] font-semibold text-zinc-700">食堂選択</p>
              <p className="text-[11px] text-zinc-400 mt-0.5">
                <span className={cn("font-semibold", selectedStores.size > 0 ? "text-blue-600" : "text-zinc-500")}>
                  {selectedStores.size}食堂
                </span>{" "}
                選択中 / 全370食堂
              </p>
            </div>
            <button
              onClick={clearAll}
              title="選択をリセット"
              className="p-1.5 rounded-md bg-zinc-100 text-zinc-600 hover:bg-zinc-200 transition-colors"
            >
              <RotateCcw className="w-3 h-3" />
            </button>
          </div>

          <div className="max-h-[600px] overflow-y-auto divide-y divide-zinc-50">
            {prefList.map(pref => {
              const univMap = hierarchy.get(pref)!;
              const prefTotal = [...univMap.values()].reduce((s, v) => s + v.length, 0);
              const prefSelected = [...univMap.values()].reduce(
                (s, stores) => s + stores.filter(st => selectedStores.has(st.no)).length, 0
              );
              const isPrefOpen = openPrefs.has(pref);

              return (
                <div key={pref}>
                  {/* 都道府県行 */}
                  <button
                    className={cn(
                      "w-full flex items-center gap-2 px-4 py-2.5 text-left transition-colors",
                      prefSelected > 0 ? "bg-blue-50/40" : "hover:bg-zinc-50"
                    )}
                    onClick={() => togglePref(pref)}
                  >
                    {isPrefOpen
                      ? <ChevronDown  className="w-3.5 h-3.5 text-zinc-400 flex-shrink-0" />
                      : <ChevronRight className="w-3.5 h-3.5 text-zinc-400 flex-shrink-0" />
                    }
                    <span className={cn(
                      "text-xs font-semibold",
                      prefSelected > 0 ? "text-blue-700" : "text-zinc-700"
                    )}>
                      {pref}
                    </span>
                    <span className="text-[11px] text-zinc-400 ml-auto">
                      {prefSelected > 0 && (
                        <span className="text-blue-600 font-semibold mr-1">{prefSelected}/</span>
                      )}
                      {prefTotal}食堂
                    </span>
                  </button>

                  {isPrefOpen && (
                    <div className="divide-y divide-zinc-50">
                      {[...univMap.entries()].map(([univKey, stores]) => {
                        const univSelected = stores.filter(s => selectedStores.has(s.no)).length;
                        const isUnivOpen = openUnivs.has(univKey);
                        const allSelected = univSelected === stores.length;

                        return (
                          <div key={univKey} className="bg-zinc-50/30">
                            {/* 大学行 */}
                            <div className="flex items-center gap-2 pl-8 pr-4 py-2 hover:bg-zinc-50 transition-colors">
                              <button
                                className="flex items-center gap-1.5 flex-1 text-left min-w-0"
                                onClick={() => toggleUniv(univKey)}
                              >
                                {isUnivOpen
                                  ? <ChevronDown  className="w-3 h-3 text-zinc-400 flex-shrink-0" />
                                  : <ChevronRight className="w-3 h-3 text-zinc-400 flex-shrink-0" />
                                }
                                <span className={cn(
                                  "text-xs font-medium truncate",
                                  univSelected > 0 ? "text-zinc-900" : "text-zinc-600"
                                )}>
                                  {univKey}
                                </span>
                                {univSelected > 0 && (
                                  <span className="text-[10px] text-blue-600 font-semibold ml-1 flex-shrink-0">
                                    {univSelected}/{stores.length}
                                  </span>
                                )}
                              </button>
                              <button
                                onClick={() => allSelected ? deselectUnivAll(stores) : selectUnivAll(stores)}
                                className={cn(
                                  "px-2 py-0.5 text-[10px] font-medium rounded border transition-colors flex-shrink-0",
                                  allSelected
                                    ? "bg-blue-600 text-white border-blue-600"
                                    : "bg-white text-zinc-600 border-zinc-200 hover:border-zinc-400"
                                )}
                              >
                                {allSelected ? "解除" : "全選択"}
                              </button>
                            </div>

                            {/* 食堂リスト */}
                            {isUnivOpen && (
                              <div className="pl-12 pr-4 pb-2 space-y-0.5">
                                {stores.map(st => {
                                  const isSelected = selectedStores.has(st.no);
                                  const hasRange = st.minTray > 0 || st.maxTray > 0;
                                  const outRange = isSelected && (
                                    (st.minTray > 0 && sheetsPerStore < st.minTray) ||
                                    (st.maxTray > 0 && sheetsPerStore > st.maxTray)
                                  );

                                  return (
                                    <label
                                      key={st.no}
                                      className={cn(
                                        "flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer transition-colors",
                                        isSelected ? "bg-blue-50" : "hover:bg-zinc-50"
                                      )}
                                    >
                                      <input
                                        type="checkbox"
                                        checked={isSelected}
                                        onChange={() => toggleStore(st.no)}
                                        className="w-3.5 h-3.5 rounded accent-blue-600 flex-shrink-0"
                                      />
                                      <span className={cn(
                                        "text-xs flex-1 truncate",
                                        isSelected ? "text-zinc-900 font-medium" : "text-zinc-600"
                                      )}>
                                        {st.store}
                                      </span>
                                      {hasRange && (
                                        <span className={cn(
                                          "text-[10px] flex-shrink-0",
                                          outRange ? "text-amber-500 font-semibold" : "text-zinc-400"
                                        )}>
                                          {st.minTray > 0 && st.maxTray > 0
                                            ? `${st.minTray}〜${st.maxTray}枚`
                                            : st.maxTray > 0 ? `〜${st.maxTray}枚` : `${st.minTray}枚〜`}
                                        </span>
                                      )}
                                      {outRange && (
                                        <AlertTriangle className="w-3 h-3 text-amber-400 flex-shrink-0" />
                                      )}
                                    </label>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
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

        {selectedStores.size === 0 ? (
          <div className="bg-white rounded-xl border border-zinc-200 p-10 text-center">
            <GraduationCap className="w-10 h-10 text-zinc-200 mx-auto mb-3" />
            <p className="text-sm font-medium text-zinc-400">食堂を選択してください</p>
            <p className="text-xs text-zinc-400 mt-1">最低100枚の印刷から発注可能です</p>
          </div>

        ) : calc === null ? (
          <div className="bg-amber-50 rounded-xl border border-amber-200 p-6 text-center">
            <p className="text-sm font-semibold text-amber-700">印刷枚数が最低100枚未満です</p>
            <p className="text-xs text-amber-600 mt-1.5">
              総印刷枚数 = 枚数/月 × 食堂数 × 月数 を100枚以上にしてください
            </p>
          </div>

        ) : (
          <>
            {/* 入力サマリー */}
            <div className="bg-white rounded-xl border border-zinc-200 p-4">
              <div className="grid grid-cols-3 gap-3 text-center">
                <div>
                  <p className="text-[10px] text-zinc-400">選択食堂</p>
                  <p className="text-xl font-bold text-zinc-900">{calc.storeCount}</p>
                  <p className="text-[10px] text-zinc-400">食堂</p>
                </div>
                <div>
                  <p className="text-[10px] text-zinc-400">枚数 / 月</p>
                  <p className="text-xl font-bold text-zinc-900">{calc.totalMonthlySheets.toLocaleString()}</p>
                  <p className="text-[10px] text-zinc-400">枚（合計）</p>
                </div>
                <div>
                  <p className="text-[10px] text-zinc-400">総印刷枚数</p>
                  <p className="text-xl font-bold text-blue-600">{calc.totalPrintSheets.toLocaleString()}</p>
                  <p className="text-[10px] text-zinc-400">枚（{months}ヶ月分）</p>
                </div>
              </div>
            </div>

            {/* 費用内訳 */}
            <div className="bg-white rounded-xl border border-zinc-200 p-5">
              <p className="text-sm font-bold text-zinc-900 mb-4">費用内訳（定価）</p>
              <div className="space-y-1">
                <ResultRow
                  label={`掲載費（¥700 × ${calc.totalMonthlySheets.toLocaleString()}枚 × ${months}ヶ月）`}
                  value={formatYen(calc.placementFee)}
                />
                <ResultRow
                  label={
                    <>
                      印刷費
                      <span className="ml-1.5 text-[10px] bg-blue-50 text-blue-600 border border-blue-100 px-1.5 py-0.5 rounded">
                        ¥{calc.printUnit?.toLocaleString()}/枚
                      </span>
                      <span className="ml-1 text-[10px] text-zinc-400">× {calc.totalPrintSheets.toLocaleString()}枚</span>
                    </>
                  }
                  value={formatYen(calc.printFee)}
                />
                <ResultRow
                  label={`発送費（¥2,600 × ${calc.storeCount}食堂）`}
                  value={formatYen(calc.shippingFee)}
                />

                {addDesignFee && (
                  <ResultRow
                    label={`デザイン制作費（¥150,000 × ${designCount}案）`}
                    value={formatYen(calc.designTotal)}
                    note="オプション"
                  />
                )}

                <div className="pt-2 border-t border-zinc-200 mt-1">
                  <div className="flex items-center justify-between py-1">
                    <span className="text-xs font-semibold text-zinc-700">
                      定価合計{addDesignFee ? "（制作費含む）" : ""}
                    </span>
                    <span className="text-xl font-bold text-zinc-900">
                      {formatYen(calc.subtotal + (addDesignFee ? calc.designTotal : 0))}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Ad-Arch 提示価格 */}
            <div className="bg-zinc-950 rounded-xl border border-zinc-800 p-5">
              <p className="text-xs font-bold text-white mb-1">Ad-Arch 提示価格</p>
              <p className="text-[11px] text-zinc-500 mb-4">
                運用管理費 = 定価 × 20%
                {addDesignFee && " ／ デザイン制作費は別途加算"}
              </p>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between py-1.5 border-b border-zinc-800">
                  <span className="text-xs text-zinc-400">運用管理費（+20%）</span>
                  <span className="text-sm font-semibold text-zinc-300">{formatYen(calc.mgmtFee)}</span>
                </div>
                <div className="flex items-center justify-between py-1.5 border-b border-zinc-800">
                  <div>
                    <span className="text-xs text-white font-semibold">クライアント提示額</span>
                    {addDesignFee && (
                      <span className="text-[10px] text-zinc-400 ml-1">（制作費含む）</span>
                    )}
                  </div>
                  <span className="text-lg font-bold text-white">
                    {formatYen(calc.clientPriceWithDesign)}
                  </span>
                </div>
                <div className="flex items-center justify-between py-1.5 border-b border-zinc-800">
                  <span className="text-xs text-zinc-400">仕入れ額（参考・−20%）</span>
                  <span className="text-sm font-semibold text-zinc-300">{formatYen(calc.purchasePrice)}</span>
                </div>
                <div className="flex items-center justify-between pt-2">
                  <span className="text-xs font-semibold text-zinc-300">差益</span>
                  <span className="text-xl font-bold text-emerald-400">{formatYen(calc.margin)}</span>
                </div>
              </div>
            </div>

            {/* 印刷費ティア表 */}
            <div className="bg-white rounded-xl border border-zinc-200 p-4">
              <p className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wide mb-3">
                印刷費ティア（総印刷枚数）
              </p>
              <div className="space-y-1">
                {PRINT_TIERS.map(tier => {
                  const isCurrent =
                    calc.totalPrintSheets >= tier.min &&
                    (tier.max === Infinity ? true : calc.totalPrintSheets <= tier.max);
                  const label =
                    tier.max === Infinity
                      ? `${tier.min.toLocaleString()}枚〜`
                      : `${tier.min.toLocaleString()}〜${tier.max.toLocaleString()}枚`;
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
                      <span className="font-semibold">¥{tier.unitPrice.toLocaleString()}/枚</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── サブコンポーネント ─────────────────────────────────────────────
function ResultRow({
  label,
  value,
  note,
}: {
  label: React.ReactNode;
  value: string;
  note?: string;
}) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-zinc-100">
      <span className="text-xs text-zinc-500 flex items-center gap-1 flex-wrap">
        {label}
        {note && (
          <span className="text-[10px] bg-zinc-100 text-zinc-400 px-1.5 py-0.5 rounded">{note}</span>
        )}
      </span>
      <span className="text-sm font-semibold text-zinc-900 ml-2 flex-shrink-0">{value}</span>
    </div>
  );
}
