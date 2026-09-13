"use client";

// ==============================================================
// TVer広告シミュレーター（代表者向け）
//   計算はすべて lib/tver/plan.ts の料金ルール（2026-09-13 代表決定）
//   ・①市町村プラン: 1エリア・15秒・月額30万未満・週次報告なし → 手数料0円（初回登録費・管理費なし）・値引きなし
//   ・②大規模展開: 上のどれかを外れたら → 設計・考査費¥150,000（初回）＋運用管理費 max(20%, ¥50,000)／月
//     手数料に入力欄は置かない。値引きは再生単価だけ（下限＝卸値×2）。②の判定は値引き前の月額で行う
//   ・再生数の目安は常に 月額÷基準単価（値引き単価では割らない）。届く人数＝再生数÷実測F
// ==============================================================

import { useState, useMemo, useCallback } from "react";
import { ChevronDown, ChevronRight, Search, X, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { SELECTABLE_MUNICIPALITIES, PREFECTURES } from "@/data/tver-municipalities";
import { SimulatorPDFButton } from "@/components/simulator/simulator-pdf-button";
import {
  CITY_PLAN_RATES, CUSTOM_DESIGN_FEE, CUSTOM_MONTHLY_FROM, CUSTOM_OPS_MIN, CUSTOM_OPS_RATE, CUSTOM_SECONDS, FREQ, TVER_ESTIMATE_NOTE, UNIT_PRICE, UNIT_PRICE_FLOOR,
  type AdSeconds, cityPlanMonthly, cityPlanTerms, clampUnitPrice, classifyTverPlan, countAreas, estimateDelivery, planForCodes, tverFees,
} from "@/lib/tver/plan";

const TAX_RATE = 0.1;
const PLAN_NAME: Record<string, string> = { light: "ライト", standard: "スタンダード", full: "フル" };
/** 設計・考査費を付けない理由（チェックを外したとき画面とPDFに必ず出す） */
const REPEAT_ADVERTISER = "2回目以降の広告主（同じ広告主で過去に設計・考査済み）";

// ----------------------------------------------------------------
// ユーティリティ
// ----------------------------------------------------------------
function formatYen(n: number) {
  return "¥" + Math.round(n).toLocaleString("ja-JP");
}
function formatCount(n: number) {
  if (n >= 10000) return (n / 10000).toFixed(1) + "万";
  return n.toLocaleString("ja-JP");
}

// ----------------------------------------------------------------
// エリア選択コンポーネント
// ----------------------------------------------------------------
function AreaSelector({
  selected,
  onToggle,
  onTogglePref,
  searchQuery,
  onSearchChange,
}: {
  selected: Set<string>;
  onToggle: (code: string) => void;
  onTogglePref: (prefCode: string, checked: boolean) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
}) {
  const [openPrefs, setOpenPrefs] = useState<Set<string>>(new Set());

  const togglePref = useCallback((prefCode: string) => {
    setOpenPrefs((prev) => {
      const next = new Set(prev);
      next.has(prefCode) ? next.delete(prefCode) : next.add(prefCode);
      return next;
    });
  }, []);

  // 検索フィルタ
  const filtered = useMemo(() => {
    if (!searchQuery) return SELECTABLE_MUNICIPALITIES;
    const q = searchQuery.toLowerCase();
    return SELECTABLE_MUNICIPALITIES.filter(
      (m) => m.name.includes(q) || m.prefName.includes(q)
    );
  }, [searchQuery]);

  // 都道府県ごとにグループ化
  const grouped = useMemo(() => {
    const map = new Map<string, typeof SELECTABLE_MUNICIPALITIES>();
    for (const m of filtered) {
      if (!map.has(m.prefCode)) map.set(m.prefCode, []);
      map.get(m.prefCode)!.push(m);
    }
    return map;
  }, [filtered]);

  const isSearching = searchQuery.length > 0;

  return (
    <div className="flex flex-col h-full">
      {/* 検索 */}
      <div className="relative mb-2">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="市区町村・都道府県を検索..."
          className="w-full pl-8 pr-8 py-1.5 text-xs border border-zinc-200 rounded-lg outline-none focus:border-blue-400 bg-white"
        />
        {searchQuery && (
          <button
            onClick={() => onSearchChange("")}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* アコーディオンリスト */}
      <div className="flex-1 overflow-y-auto border border-zinc-200 rounded-lg bg-white text-xs">
        {PREFECTURES.filter((p) => grouped.has(p.code)).map((pref) => {
          const items = grouped.get(pref.code)!;
          const isOpen = isSearching || openPrefs.has(pref.code);
          const allChecked = items.every((m) => selected.has(m.code));
          const someChecked = items.some((m) => selected.has(m.code));
          const selectedCount = items.filter((m) => selected.has(m.code)).length;

          return (
            <div key={pref.code} className="border-b border-zinc-100 last:border-0">
              {/* 都道府県ヘッダー */}
              <div className="flex items-center gap-2 px-3 py-2 hover:bg-zinc-50 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={allChecked}
                  ref={(el) => { if (el) el.indeterminate = someChecked && !allChecked; }}
                  onChange={(e) => onTogglePref(pref.code, e.target.checked)}
                  onClick={(e) => e.stopPropagation()}
                  className="w-3.5 h-3.5 rounded accent-blue-500 flex-shrink-0"
                />
                <button
                  className="flex-1 flex items-center justify-between"
                  onClick={() => togglePref(pref.code)}
                >
                  <span className="font-semibold text-zinc-700">{pref.name}</span>
                  <div className="flex items-center gap-1.5">
                    {selectedCount > 0 && (
                      <span className="px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-600 text-[10px] font-bold">
                        {selectedCount}/{items.length}
                      </span>
                    )}
                    {isOpen ? (
                      <ChevronDown className="w-3.5 h-3.5 text-zinc-400" />
                    ) : (
                      <ChevronRight className="w-3.5 h-3.5 text-zinc-400" />
                    )}
                  </div>
                </button>
              </div>

              {/* 市区町村リスト */}
              {isOpen && (
                <div className="pl-6 bg-zinc-50/50">
                  {items.map((m) => (
                    <label
                      key={m.code}
                      className="flex items-center gap-2 px-3 py-1.5 hover:bg-zinc-100 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={selected.has(m.code)}
                        onChange={() => onToggle(m.code)}
                        className="w-3.5 h-3.5 rounded accent-blue-500 flex-shrink-0"
                      />
                      <span className="flex-1 text-zinc-700">{m.name}</span>
                      <span className="text-zinc-400 text-[10px]">
                        {formatCount(m.population)}人
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          );
        })}
        {grouped.size === 0 && (
          <div className="py-8 text-center text-zinc-400">
            「{searchQuery}」に一致するエリアがありません
          </div>
        )}
      </div>
    </div>
  );
}

// ----------------------------------------------------------------
// メインコンポーネント
// ----------------------------------------------------------------
export function TVerSimulator({ initialBudget }: { initialBudget?: number } = {}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [seconds, setSeconds] = useState<AdSeconds>(15);
  const [inputMode, setInputMode] = useState<"budget" | "plays">("budget");
  const [budget, setBudget] = useState<number>(initialBudget ?? 100_000);
  const [plays, setPlays] = useState<number>(30_000);
  const [weeklyReport, setWeeklyReport] = useState(false);
  const [isFirst, setIsFirst] = useState(true);
  const [unitInput, setUnitInput] = useState<string>(""); // ②の値引き単価（空＝基準単価）

  const codes = useMemo(() => [...selected], [selected]);
  const plan = useMemo(() => (codes.length ? planForCodes(codes, seconds) : null), [codes, seconds]);
  const areaCount = useMemo(() => countAreas(codes), [codes]);
  const listUnit = UNIT_PRICE[seconds];

  const calc = useMemo(() => {
    // 値引き前の月額で①②を判定する
    const monthlyAtList = inputMode === "budget" ? Math.max(0, budget) : Math.max(0, plays) * listUnit;
    const { kind, reasons } = classifyTverPlan({ monthly: monthlyAtList, areaCount, weeklyReport, seconds });
    const discount = kind === "custom" && unitInput.trim() !== "" ? clampUnitPrice(Number(unitInput), seconds) : null;
    const unit = discount ? discount.price : listUnit;
    let monthly = inputMode === "budget" ? Math.max(0, budget) : Math.round(Math.max(0, plays) * unit);
    // ①は人口2段の最低料金を下回らない
    const terms = plan ? cityPlanTerms(plan.population) : null;
    const belowFloor = kind === "city" && !!terms && monthly < terms.floor;
    if (belowFloor && terms) monthly = terms.floor;
    const est = estimateDelivery(monthly, { seconds, viewers: plan?.viewers, population: plan?.population });
    const fees = tverFees(kind, monthly, isFirst);
    const monthlyTotal = monthly + fees.opsFeeMonthly;
    return { kind, reasons, unit, discount, monthly, belowFloor, terms, est, fees, monthlyTotal, firstTotal: monthlyTotal + fees.designFee };
  }, [inputMode, budget, plays, listUnit, areaCount, weeklyReport, seconds, unitInput, plan, isFirst]);

  // ①の3プラン（1エリアのときの参考）
  const cityPlans = useMemo(() => {
    if (!plan || areaCount !== 1) return [];
    return CITY_PLAN_RATES.map((r) => ({ key: r.key, perResidents: r.perResidents, ...cityPlanMonthly(plan.population, r.perResidents) }));
  }, [plan, areaCount]);

  const toggleMuni = useCallback((code: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(code) ? next.delete(code) : next.add(code);
      return next;
    });
  }, []);

  const togglePref = useCallback((prefCode: string, checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const m of SELECTABLE_MUNICIPALITIES) {
        if (m.prefCode === prefCode) {
          checked ? next.add(m.code) : next.delete(m.code);
        }
      }
      return next;
    });
  }, []);

  const resetAll = () => {
    setSelected(new Set());
    setSeconds(15);
    setInputMode("budget");
    setBudget(100_000);
    setPlays(30_000);
    setWeeklyReport(false);
    setIsFirst(true);
    setUnitInput("");
  };

  const isCustom = calc.kind === "custom";
  const pctViewers = calc.est.pctViewers ?? 0;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-4">

      {/* ========== 左: エリア選択 ========== */}
      <div className="bg-white rounded-xl border border-zinc-200 p-4 flex flex-col gap-3 min-h-0">
        <div className="flex items-center justify-between flex-shrink-0">
          <p className="text-xs font-bold text-zinc-700">
            配信エリア選択
            {selected.size > 0 && (
              <span className="ml-2 text-blue-600">{areaCount}エリア（{selected.size}市区町村）/ 人口 {formatCount(plan?.population ?? 0)}人</span>
            )}
          </p>
          {selected.size > 0 && (
            <button
              onClick={() => setSelected(new Set())}
              className="text-[11px] text-zinc-400 hover:text-red-500 transition-colors"
            >
              選択解除
            </button>
          )}
        </div>
        <p className="text-[10px] text-zinc-400">政令市の区は、同じ市の中なら何区選んでも1エリアとして数えます</p>
        <div className="flex-1" style={{ minHeight: 480 }}>
          <AreaSelector
            selected={selected}
            onToggle={toggleMuni}
            onTogglePref={togglePref}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
          />
        </div>
      </div>

      {/* ========== 右: シミュレーションパネル ========== */}
      <div className="flex flex-col gap-4">

        {/* 秒数・報告 */}
        <div className="bg-white rounded-xl border border-zinc-200 p-4 space-y-3">
          <p className="text-xs font-bold text-zinc-700">広告の秒数</p>
          <div className="grid grid-cols-3 gap-1.5">
            {CUSTOM_SECONDS.map((sec) => (
              <button
                key={sec}
                onClick={() => { setSeconds(sec); setUnitInput(""); }}
                className={cn(
                  "py-2 rounded-lg border text-xs font-semibold transition-colors",
                  seconds === sec ? "bg-red-500 border-red-500 text-white" : "border-zinc-200 text-zinc-600 hover:border-zinc-300 hover:bg-zinc-50"
                )}
              >
                <div>{sec}秒</div>
                <div className="text-[10px] font-normal opacity-70">{sec === 15 ? "標準" : "大規模展開のみ"}</div>
              </button>
            ))}
          </div>
          <p className="text-[11px] font-semibold text-zinc-600">
            再生単価（基準）: {seconds}秒 ¥{listUnit}<span className="font-normal text-zinc-400"> / 1再生・税抜</span>
          </p>
          <label className="flex items-center gap-2 cursor-pointer text-[11px] text-zinc-600">
            <input type="checkbox" checked={weeklyReport} onChange={(e) => setWeeklyReport(e.target.checked)} className="w-3.5 h-3.5 accent-red-500" />
            週次の報告を希望する（大規模展開になります）
          </label>
        </div>

        {/* 月額・再生数 */}
        <div className="bg-white rounded-xl border border-zinc-200 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <p className="text-xs font-bold text-zinc-700">月額</p>
            <div className="flex rounded-lg border border-zinc-200 overflow-hidden text-[11px]">
              {(["budget", "plays"] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setInputMode(mode)}
                  className={cn("px-2.5 py-1 transition-colors", inputMode === mode ? "bg-zinc-800 text-white" : "text-zinc-500 hover:bg-zinc-50")}
                >
                  {mode === "budget" ? "月額から" : "再生数から"}
                </button>
              ))}
            </div>
          </div>

          {inputMode === "budget" ? (
            <div className="space-y-1.5">
              <label className="text-[11px] text-zinc-500">月の媒体費（税抜）</label>
              <div className="flex items-center gap-2">
                <span className="text-zinc-400 text-xs">¥</span>
                <input
                  type="number"
                  value={budget}
                  min={0}
                  step={10000}
                  onChange={(e) => setBudget(Number(e.target.value))}
                  className="flex-1 px-3 py-1.5 text-xs border border-zinc-200 rounded-lg outline-none focus:border-blue-400"
                />
              </div>
              <input type="range" min={30000} max={5000000} step={10000} value={budget} onChange={(e) => setBudget(Number(e.target.value))} className="w-full accent-red-500" />
              <div className="flex justify-between text-[10px] text-zinc-400">
                <span>¥30,000</span><span>¥500万</span>
              </div>
            </div>
          ) : (
            <div className="space-y-1.5">
              <label className="text-[11px] text-zinc-500">月に出したい再生数（月額の計算に使います）</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={plays}
                  min={0}
                  step={1000}
                  onChange={(e) => setPlays(Number(e.target.value))}
                  className="flex-1 px-3 py-1.5 text-xs border border-zinc-200 rounded-lg outline-none focus:border-blue-400"
                />
                <span className="text-zinc-400 text-[11px]">回</span>
              </div>
              <input type="range" min={5000} max={1000000} step={5000} value={plays} onChange={(e) => setPlays(Number(e.target.value))} className="w-full accent-red-500" />
              <div className="flex justify-between text-[10px] text-zinc-400">
                <span>5,000回</span><span>100万回</span>
              </div>
            </div>
          )}

          {/* ②だけ: 値引き単価（手数料には入力欄を置かない） */}
          {isCustom && (
            <div className="space-y-1 pt-2 border-t border-zinc-100">
              <label className="text-[11px] text-zinc-500">再生単価の値引き（大規模展開のみ・{seconds}秒）</label>
              <div className="flex items-center gap-2">
                <span className="text-zinc-400 text-xs">¥</span>
                <input
                  type="number"
                  value={unitInput}
                  placeholder={String(listUnit)}
                  min={UNIT_PRICE_FLOOR[seconds]}
                  max={listUnit}
                  step={0.1}
                  onChange={(e) => setUnitInput(e.target.value)}
                  onBlur={() => { if (unitInput.trim() !== "") setUnitInput(String(clampUnitPrice(Number(unitInput), seconds).price)); }}
                  className="w-24 px-3 py-1.5 text-xs border border-zinc-200 rounded-lg outline-none focus:border-blue-400"
                />
                <span className="text-[11px] text-zinc-400">/ 1再生</span>
              </div>
              {calc.discount?.atFloor ? (
                <p className="text-[11px] font-semibold text-red-600">この単価より下げられません（{seconds}秒の下限 ¥{UNIT_PRICE_FLOOR[seconds]}）</p>
              ) : (
                <p className="text-[10px] text-zinc-400">下げられるのは再生単価だけ（下限 ¥{UNIT_PRICE_FLOOR[seconds]}）。手数料は値引きできません。「再生数から」で月額を出すときに使います</p>
              )}
            </div>
          )}
        </div>

        {/* ========== 結果 ========== */}
        <div className="bg-zinc-900 rounded-xl p-4 space-y-3 text-white">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-zinc-300">シミュレーション結果</p>
            <div className="flex items-center gap-2">
              {selected.size > 0 && plan && (
                <SimulatorPDFButton
                  simulatorName="TVer広告"
                  totalAmount={calc.firstTotal}
                  conditions={[
                    `${plan.areaLabel}（${areaCount}エリア）/ 人口 ${formatCount(plan.population)}人`,
                    `${isCustom ? "大規模展開（オーダー）" : "市町村プラン"}・${seconds}秒`,
                    `月の媒体費 ${formatYen(calc.monthly)}（税抜）${calc.terms && !isCustom ? `・契約期間${calc.terms.minMonths}ヶ月以上` : ""}`,
                    ...(isCustom
                      ? [
                          `運用管理費 ${formatYen(calc.fees.opsFeeMonthly)}／月（媒体費の${Math.round(CUSTOM_OPS_RATE * 100)}%・最低${formatYen(CUSTOM_OPS_MIN)}）`,
                          calc.fees.designFee ? `設計・考査費 ${formatYen(calc.fees.designFee)}（初回のみ）` : `設計・考査費 なし：${REPEAT_ADVERTISER}`,
                          ...(calc.discount ? [`再生単価 ¥${calc.unit}（${seconds}秒）`] : []),
                        ]
                      : ["初回登録費・管理費なし"]),
                    `月の再生数の目安 約${Math.round(calc.est.impressions).toLocaleString("ja-JP")}回`,
                    `ご提示金額＝初月（媒体費${isCustom ? "＋運用管理費" : ""}${calc.fees.designFee ? "＋設計・考査費" : ""}）`,
                  ]}
                  notes={`${TVER_ESTIMATE_NOTE}\n本見積は概算であり、正式な発注時に詳細なお見積もりを改めてご提出いたします。`}
                  reach={{
                    tverAudience: Math.round(plan.viewers),
                    reachPotential: Math.round(calc.est.reach),
                    fillRate: Math.round(pctViewers),
                    totalPop: plan.population,
                    plays: Math.round(calc.est.impressions),
                    frequency: FREQ,
                  }}
                />
              )}
              <button onClick={resetAll} className="flex items-center gap-1 text-[11px] text-zinc-500 hover:text-zinc-300 transition-colors">
                <RotateCcw className="w-3 h-3" />
                リセット
              </button>
            </div>
          </div>

          {selected.size === 0 && (
            <p className="text-[11px] text-zinc-500 text-center py-2">← エリアを選択すると計算されます</p>
          )}

          {selected.size > 0 && plan && (
            <>
              {/* プランの判定 */}
              <div className={cn("rounded-lg p-3 space-y-1", isCustom ? "bg-zinc-800 border border-amber-400/40" : "bg-zinc-800 border border-emerald-400/40")}>
                <p className="text-[10px] text-zinc-400 tracking-wider">プラン</p>
                <p className={cn("text-sm font-bold", isCustom ? "text-amber-300" : "text-emerald-300")}>
                  {isCustom ? "② 大規模展開（オーダー）" : "① 市町村プラン"}
                </p>
                <p className="text-[11px] text-zinc-400">
                  {isCustom
                    ? `理由: ${calc.reasons.join("・")}。複数エリア・差し替え可・週1報告`
                    : "1エリア・15秒・途中変更なし・配信終了後に結果報告。初回登録費・管理費なし"}
                </p>
                {!isCustom && calc.terms && (
                  <p className="text-[11px] text-zinc-400">
                    この市の最低料金 {formatYen(calc.terms.floor)}／月・契約期間{calc.terms.minMonths}ヶ月以上（人口{calc.terms.small ? "5万人未満" : "5万人以上"}）
                  </p>
                )}
                {calc.belowFloor && (
                  <p className="text-[11px] font-semibold text-amber-300">入力が最低料金を下回るため、最低料金 {formatYen(calc.monthly)} で計算しています</p>
                )}
              </div>

              {/* ①の3プラン（1エリアのとき） */}
              {cityPlans.length > 0 && (
                <div className="bg-zinc-800 rounded-lg p-3 space-y-1.5">
                  <p className="text-[10px] text-zinc-400 tracking-wider">この市の市町村プラン（申込ページと同じ額）</p>
                  {cityPlans.map((c) => (
                    <button
                      key={c.key}
                      onClick={() => { setInputMode("budget"); setBudget(c.fee); }}
                      className="w-full flex items-center justify-between text-[11px] px-2 py-1 rounded hover:bg-zinc-700"
                    >
                      <span className="text-zinc-400">{PLAN_NAME[c.key]}（住民の{c.perResidents}人に1人）</span>
                      <span className={cn("tabular-nums font-semibold", c.fee >= CUSTOM_MONTHLY_FROM ? "text-amber-300" : "text-zinc-200")}>
                        {formatYen(c.fee)}{c.floored ? "・最低料金" : ""}{c.fee >= CUSTOM_MONTHLY_FROM ? "・大規模展開" : ""}
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {/* 目安 */}
              <div className="bg-zinc-800 rounded-lg p-3 space-y-1.5">
                <p className="text-[10px] text-zinc-400 tracking-wider">月の再生数の目安</p>
                <div className="flex items-end gap-2">
                  <span className="text-2xl font-bold text-emerald-400">約{Math.round(calc.est.impressions).toLocaleString("ja-JP")}回</span>
                </div>
                <p className="text-[11px] text-zinc-400">
                  月の媒体費: {formatYen(calc.monthly)}（税抜） / {formatYen(calc.monthly * (1 + TAX_RATE))}（税込）
                </p>
                {calc.discount && (
                  <p className="text-[11px] text-zinc-500">値引き後の再生単価 ¥{calc.unit}（基準 ¥{listUnit}）。再生数の目安は基準単価で出しています</p>
                )}
              </div>

              <div className="bg-zinc-800 rounded-lg p-3 space-y-2">
                <p className="text-[10px] text-zinc-400 tracking-wider">届く人数の目安</p>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <p className="text-[10px] text-zinc-500">TVerを見ている人（推計）</p>
                    <p className="text-base font-bold text-emerald-400">{formatCount(Math.round(plan.viewers))}人</p>
                    <p className="text-[10px] text-zinc-500">人口 {formatCount(plan.population)}人</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-zinc-500">月に届く人数（目安）</p>
                    <p className="text-base font-bold text-blue-400">{formatCount(Math.round(calc.est.reach))}人</p>
                    <p className="text-[10px] text-zinc-500">住民の{(calc.est.pctResidents ?? 0).toFixed(1)}%・1人あたり月{FREQ}回</p>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-[10px] text-zinc-400 mb-1">
                    <span>TVerを見ている人に届く割合</span>
                    <span className="font-bold text-zinc-300">{pctViewers.toFixed(1)}%</span>
                  </div>
                  <div className="h-2 bg-zinc-700 rounded-full overflow-hidden">
                    <div className="h-full rounded-full bg-emerald-400 transition-all duration-500" style={{ width: `${Math.min(100, pctViewers)}%` }} />
                  </div>
                </div>
              </div>

              <p className="text-[10px] text-zinc-500 text-center">※ {TVER_ESTIMATE_NOTE}</p>

              {/* ---- 手数料（入力欄なし） ---- */}
              <div className="border-t border-zinc-700 pt-3 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-bold text-zinc-300">手数料</p>
                  {isCustom && (
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input type="checkbox" checked={isFirst} onChange={(e) => setIsFirst(e.target.checked)} className="w-3.5 h-3.5 accent-amber-400" />
                      <span className={cn("text-[10px]", isFirst ? "text-zinc-400" : "font-semibold text-amber-300")}>{isFirst ? "初めての広告主（設計・考査費あり）" : REPEAT_ADVERTISER}</span>
                    </label>
                  )}
                </div>
                <div className="bg-zinc-800 rounded-lg overflow-hidden text-[11px]">
                  {isCustom ? (
                    <>
                      <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-700">
                        <span className="text-zinc-400">運用管理費<span className="ml-1 text-zinc-600">（媒体費の{Math.round(CUSTOM_OPS_RATE * 100)}%{calc.fees.opsMinApplied ? `→最低額 ${formatYen(CUSTOM_OPS_MIN)}` : ""}・毎月）</span></span>
                        <span className="font-semibold tabular-nums text-zinc-200">{formatYen(calc.fees.opsFeeMonthly)}</span>
                      </div>
                      <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-700">
                        <span className="text-zinc-400">設計・考査費<span className="ml-1 text-zinc-600">{calc.fees.designFee ? "（初回のみ）" : "（2回目以降の広告主・過去に設計・考査済み）"}</span></span>
                        <span className="font-semibold tabular-nums text-amber-300">{calc.fees.designFee ? formatYen(CUSTOM_DESIGN_FEE) : "なし"}</span>
                      </div>
                    </>
                  ) : (
                    <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-700">
                      <span className="text-zinc-400">初回登録費・管理費</span>
                      <span className="font-semibold tabular-nums text-emerald-300">0円</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between px-3 py-2.5 bg-zinc-700/60">
                    <span className="text-zinc-300 font-bold">毎月（媒体費＋手数料・税抜）</span>
                    <span className="text-white font-bold tabular-nums">{formatYen(calc.monthlyTotal)}</span>
                  </div>
                </div>
                <div className="bg-zinc-800 rounded-lg px-3 py-2.5 flex items-center justify-between">
                  <span className="text-zinc-300 font-bold text-xs">初月の合計（税抜）</span>
                  <span className="text-yellow-300 font-bold text-sm tabular-nums">{formatYen(calc.firstTotal)}</span>
                </div>
                <p className="text-[10px] text-zinc-600 text-center">※ 手数料は値引きの対象外です</p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
