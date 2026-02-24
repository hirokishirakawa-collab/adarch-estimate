"use client";

import { useState, useMemo, useCallback } from "react";
import { ChevronDown, ChevronRight, Search, X, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { MUNICIPALITIES, PREFECTURES } from "@/data/tver-municipalities";
import { PdfDownloadButton } from "@/components/pdf/PdfDownloadButton";

// ----------------------------------------------------------------
// 定数
// ----------------------------------------------------------------
const TVER_PENETRATION = 0.30; // TVer普及率（約30%）
const TAX_RATE = 0.10;

type AdSeconds = 6 | 15 | 30 | 45 | 60;

// CPMフロア価格（ネット）/ 令和最新版
const AD_FORMATS: { seconds: AdSeconds; label: string; cpm: number; note?: string }[] = [
  { seconds: 6,  label: "6秒",  cpm: 1600, note: "バンパー" },
  { seconds: 15, label: "15秒", cpm: 2200, note: "標準" },
  { seconds: 30, label: "30秒", cpm: 2600 },
  { seconds: 45, label: "45秒", cpm: 3000 },
  { seconds: 60, label: "60秒", cpm: 3700 },
];

// ----------------------------------------------------------------
// アドアーチ手数料ルール
// ----------------------------------------------------------------
function calcAdArchFees(mediaBudget: number, isFirstTransaction: boolean) {
  // 媒体管理費: 50万以下→10万固定, 50万超→20%
  const managementFee = mediaBudget <= 500000 ? 100000 : mediaBudget * 0.20;
  // クリエイティブ考査費（固定）
  const creativeFee = 30000;
  // 初期取引（業態考査含む）
  const initialFee = isFirstTransaction ? 150000 : 0;

  const subtotal = managementFee + creativeFee + initialFee;
  return { managementFee, creativeFee, initialFee, subtotal };
}

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
    if (!searchQuery) return MUNICIPALITIES;
    const q = searchQuery.toLowerCase();
    return MUNICIPALITIES.filter(
      (m) => m.name.includes(q) || m.prefName.includes(q)
    );
  }, [searchQuery]);

  // 都道府県ごとにグループ化
  const grouped = useMemo(() => {
    const map = new Map<string, typeof MUNICIPALITIES>();
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
export function TVerSimulator() {
  // エリア選択
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");

  // 広告設定
  const [adSeconds, setAdSeconds] = useState<AdSeconds>(15);
  const [customCpm, setCustomCpm] = useState<Partial<Record<AdSeconds, number>>>({});
  const [frequency, setFrequency] = useState(3);
  const [isFirstTransaction, setIsFirstTransaction] = useState(false);

  // 入力モード
  const [inputMode, setInputMode] = useState<"budget" | "plays">("budget");
  const [budget, setBudget] = useState<number>(500000);
  const [plays, setPlays] = useState<number>(100000);

  // CPM取得（カスタム or デフォルト）
  const currentFormat = AD_FORMATS.find((f) => f.seconds === adSeconds)!;
  const cpm = customCpm[adSeconds] ?? currentFormat.cpm;

  // エリア人口合計
  const totalPop = useMemo(() => {
    let sum = 0;
    for (const code of selected) {
      const m = MUNICIPALITIES.find((m) => m.code === code);
      if (m) sum += m.population;
    }
    return sum;
  }, [selected]);

  // 計算
  const calcResult = useMemo(() => {
    const effectivePlays = inputMode === "budget"
      ? Math.floor(budget / (cpm / 1000))
      : plays;
    const effectiveBudget = inputMode === "plays"
      ? plays * (cpm / 1000)
      : budget;

    const reachPotential = Math.floor((totalPop * TVER_PENETRATION) / Math.max(1, frequency));
    const reachByPlays = effectivePlays > 0
      ? Math.min(reachPotential, Math.floor(effectivePlays / Math.max(1, frequency)))
      : 0;
    const fillRate = reachPotential > 0
      ? Math.min(100, Math.round((reachByPlays / reachPotential) * 100))
      : 0;

    return {
      plays: effectivePlays,
      budget: effectiveBudget,
      budgetWithTax: effectiveBudget * (1 + TAX_RATE),
      reachPotential,
      reachByPlays,
      fillRate,
      tverAudience: Math.floor(totalPop * TVER_PENETRATION),
    };
  }, [inputMode, budget, plays, cpm, totalPop, frequency]);

  // エリア操作
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
      for (const m of MUNICIPALITIES) {
        if (m.prefCode === prefCode) {
          checked ? next.add(m.code) : next.delete(m.code);
        }
      }
      return next;
    });
  }, []);

  const fees = useMemo(
    () => calcAdArchFees(calcResult.budget, isFirstTransaction),
    [calcResult.budget, isFirstTransaction]
  );

  const pdfData = useMemo(() => {
    if (selected.size === 0) return null;
    const mgmtNote = calcResult.budget <= 500000 ? "（50万以下：固定）" : "（媒体費 × 20%）";
    return {
      simulatorName: "TVer広告シミュレーター",
      sections: [
        {
          title: "概算費用",
          rows: [
            {
              label: `媒体費（${adSeconds}秒 × ${calcResult.plays.toLocaleString()}回 / CPM ¥${cpm.toLocaleString()}）`,
              value: formatYen(calcResult.budget),
            },
            { label: "税込", value: formatYen(calcResult.budgetWithTax) },
          ],
        },
        {
          title: "Ad-Arch 手数料内訳",
          rows: [
            { label: `媒体管理費${mgmtNote}`, value: formatYen(fees.managementFee) },
            { label: "クリエイティブ考査費（固定）", value: formatYen(fees.creativeFee) },
            ...(isFirstTransaction
              ? [{ label: "初期取引費（業態考査含む）", value: formatYen(fees.initialFee) }]
              : []),
            { divider: true as const, label: "", value: "" },
            { label: "手数料合計（税抜）", value: formatYen(fees.subtotal), bold: true },
          ],
        },
      ],
      clientPrice: formatYen(calcResult.budget + fees.subtotal),
      purchasePrice: formatYen(calcResult.budget),
      margin: formatYen(fees.subtotal),
      priceNote: "媒体費 + Ad-Arch手数料",
    };
  }, [selected.size, adSeconds, calcResult.budget, calcResult.plays, calcResult.budgetWithTax, cpm, fees, isFirstTransaction]);

  const pdfFileName = `adarch-tver-estimate-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}.pdf`;

  const resetAll = () => {
    setSelected(new Set());
    setBudget(500000);
    setPlays(100000);
    setFrequency(3);
    setAdSeconds(15);
    setCustomCpm({});
    setIsFirstTransaction(false);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-4">

      {/* ========== 左: エリア選択 ========== */}
      <div className="bg-white rounded-xl border border-zinc-200 p-4 flex flex-col gap-3 min-h-0">
        <div className="flex items-center justify-between flex-shrink-0">
          <p className="text-xs font-bold text-zinc-700">
            配信エリア選択
            {selected.size > 0 && (
              <span className="ml-2 text-blue-600">{selected.size}市区町村 / 推定人口 {formatCount(totalPop)}人</span>
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

        {/* 広告フォーマット */}
        <div className="bg-white rounded-xl border border-zinc-200 p-4 space-y-3">
          <p className="text-xs font-bold text-zinc-700">広告フォーマット</p>
          <div className="grid grid-cols-5 gap-1.5">
            {AD_FORMATS.map((f) => (
              <button
                key={f.seconds}
                onClick={() => setAdSeconds(f.seconds)}
                className={cn(
                  "py-2 rounded-lg border text-xs font-semibold transition-colors",
                  adSeconds === f.seconds
                    ? "bg-red-500 border-red-500 text-white"
                    : "border-zinc-200 text-zinc-600 hover:border-zinc-300 hover:bg-zinc-50"
                )}
              >
                <div>{f.label}</div>
                {f.note && <div className="text-[10px] font-normal opacity-70">{f.note}</div>}
              </button>
            ))}
          </div>

          {/* CPM調整 */}
          <div>
            <label className="flex items-center justify-between text-[11px] text-zinc-500 mb-1">
              <span>CPM単価（{adSeconds}秒）</span>
              <button
                onClick={() => setCustomCpm((p) => { const n = {...p}; delete n[adSeconds]; return n; })}
                className="text-zinc-400 hover:text-zinc-600 text-[10px]"
              >
                フロア価格に戻す
              </button>
            </label>
            <div className="flex items-center gap-2">
              <span className="text-zinc-400 text-xs">¥</span>
              <input
                type="number"
                value={cpm}
                min={100}
                max={99999}
                step={100}
                onChange={(e) => setCustomCpm((p) => ({ ...p, [adSeconds]: Number(e.target.value) }))}
                className="flex-1 px-3 py-1.5 text-xs border border-zinc-200 rounded-lg outline-none focus:border-blue-400"
              />
              <span className="text-zinc-400 text-[11px]">/ 1,000回</span>
            </div>
            <p className="text-[10px] text-zinc-400 mt-1">
              フロア価格（ネット）: ¥{AD_FORMATS.find(f => f.seconds === adSeconds)?.cpm.toLocaleString()}
            </p>
          </div>
        </div>

        {/* 予算・再生回数 */}
        <div className="bg-white rounded-xl border border-zinc-200 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <p className="text-xs font-bold text-zinc-700">予算 / 再生回数</p>
            <div className="flex rounded-lg border border-zinc-200 overflow-hidden text-[11px]">
              {(["budget", "plays"] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setInputMode(mode)}
                  className={cn(
                    "px-2.5 py-1 transition-colors",
                    inputMode === mode
                      ? "bg-zinc-800 text-white"
                      : "text-zinc-500 hover:bg-zinc-50"
                  )}
                >
                  {mode === "budget" ? "予算から" : "回数から"}
                </button>
              ))}
            </div>
          </div>

          {inputMode === "budget" ? (
            <div className="space-y-1.5">
              <label className="text-[11px] text-zinc-500">投下予算（税抜）</label>
              <div className="flex items-center gap-2">
                <span className="text-zinc-400 text-xs">¥</span>
                <input
                  type="number"
                  value={budget}
                  min={10000}
                  step={10000}
                  onChange={(e) => setBudget(Number(e.target.value))}
                  className="flex-1 px-3 py-1.5 text-xs border border-zinc-200 rounded-lg outline-none focus:border-blue-400"
                />
              </div>
              <input
                type="range"
                min={50000}
                max={10000000}
                step={50000}
                value={budget}
                onChange={(e) => setBudget(Number(e.target.value))}
                className="w-full accent-red-500"
              />
              <div className="flex justify-between text-[10px] text-zinc-400">
                <span>¥50,000</span><span>¥1,000万</span>
              </div>
            </div>
          ) : (
            <div className="space-y-1.5">
              <label className="text-[11px] text-zinc-500">目標再生回数</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={plays}
                  min={1000}
                  step={1000}
                  onChange={(e) => setPlays(Number(e.target.value))}
                  className="flex-1 px-3 py-1.5 text-xs border border-zinc-200 rounded-lg outline-none focus:border-blue-400"
                />
                <span className="text-zinc-400 text-[11px]">回</span>
              </div>
              <input
                type="range"
                min={10000}
                max={5000000}
                step={10000}
                value={plays}
                onChange={(e) => setPlays(Number(e.target.value))}
                className="w-full accent-red-500"
              />
              <div className="flex justify-between text-[10px] text-zinc-400">
                <span>1万回</span><span>500万回</span>
              </div>
            </div>
          )}

          {/* フリークエンシー */}
          <div className="space-y-1">
            <div className="flex justify-between text-[11px]">
              <span className="text-zinc-500">フリークエンシー（FQ）</span>
              <span className="font-semibold text-zinc-700">{frequency}回</span>
            </div>
            <input
              type="range"
              min={1}
              max={10}
              step={1}
              value={frequency}
              onChange={(e) => setFrequency(Number(e.target.value))}
              className="w-full accent-red-500"
            />
            <div className="flex justify-between text-[10px] text-zinc-400">
              <span>1回（単純リーチ）</span><span>10回</span>
            </div>
          </div>
        </div>

        {/* ========== 結果 ========== */}
        <div className="bg-zinc-900 rounded-xl p-4 space-y-3 text-white">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-zinc-300">シミュレーション結果</p>
            <button
              onClick={resetAll}
              className="flex items-center gap-1 text-[11px] text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              <RotateCcw className="w-3 h-3" />
              リセット
            </button>
          </div>

          {selected.size === 0 && (
            <p className="text-[11px] text-zinc-500 text-center py-2">
              ← エリアを選択すると計算されます
            </p>
          )}

          {selected.size > 0 && (
            <>
              {/* コスト */}
              <div className="bg-zinc-800 rounded-lg p-3 space-y-1.5">
                <p className="text-[10px] text-zinc-400 uppercase tracking-wider">概算費用</p>
                <div className="flex items-end gap-2">
                  <span className="text-2xl font-bold text-white">
                    {formatYen(calcResult.budget)}
                  </span>
                  <span className="text-[11px] text-zinc-400 mb-0.5">税抜</span>
                </div>
                <p className="text-[11px] text-zinc-400">
                  税込: {formatYen(calcResult.budgetWithTax)}
                </p>
                <p className="text-[11px] text-zinc-400">
                  再生回数: {calcResult.plays.toLocaleString()}回 ×
                  CPM ¥{cpm.toLocaleString()} = {formatYen(calcResult.budget)}
                </p>
              </div>

              {/* リーチ */}
              <div className="bg-zinc-800 rounded-lg p-3 space-y-2">
                <p className="text-[10px] text-zinc-400 uppercase tracking-wider">リーチポテンシャル</p>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <p className="text-[10px] text-zinc-500">TVer視聴者数（エリア）</p>
                    <p className="text-base font-bold text-emerald-400">
                      {formatCount(calcResult.tverAudience)}人
                    </p>
                    <p className="text-[10px] text-zinc-500">
                      人口{formatCount(totalPop)}人 × 30%
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-zinc-500">推定リーチ（FQ÷{frequency}）</p>
                    <p className="text-base font-bold text-blue-400">
                      {formatCount(calcResult.reachPotential)}人
                    </p>
                    <p className="text-[10px] text-zinc-500">最大到達人数</p>
                  </div>
                </div>

                {/* 充足度バー */}
                <div>
                  <div className="flex justify-between text-[10px] text-zinc-400 mb-1">
                    <span>配信ボリューム充足度</span>
                    <span className={cn(
                      "font-bold",
                      calcResult.fillRate >= 80 ? "text-emerald-400" :
                      calcResult.fillRate >= 40 ? "text-amber-400" : "text-zinc-400"
                    )}>
                      {calcResult.fillRate}%
                    </span>
                  </div>
                  <div className="h-2 bg-zinc-700 rounded-full overflow-hidden">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all duration-500",
                        calcResult.fillRate >= 80 ? "bg-emerald-400" :
                        calcResult.fillRate >= 40 ? "bg-amber-400" : "bg-zinc-500"
                      )}
                      style={{ width: `${calcResult.fillRate}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-zinc-500 mt-1">
                    {calcResult.fillRate < 40
                      ? "▲ 予算を増やすとリーチが改善します"
                      : calcResult.fillRate < 80
                      ? "◎ バランスの取れた配信量です"
                      : "✓ リーチポテンシャルに対して十分な配信量です"}
                  </p>
                </div>
              </div>

              {/* サマリー行 */}
              <div className="grid grid-cols-3 gap-2 text-center">
                {[
                  { label: "選択エリア", value: `${selected.size}市区町村` },
                  { label: "対象人口", value: `${formatCount(totalPop)}人` },
                  { label: "CPM単価", value: `¥${cpm.toLocaleString()}` },
                ].map((item) => (
                  <div key={item.label} className="bg-zinc-800 rounded-lg py-2 px-1">
                    <p className="text-[10px] text-zinc-500">{item.label}</p>
                    <p className="text-xs font-bold text-zinc-200 mt-0.5">{item.value}</p>
                  </div>
                ))}
              </div>

              <p className="text-[10px] text-zinc-600 text-center">
                ※ TVer普及率30%・インプレッション数は目安値です。実際の配信結果は保証されません。
              </p>

              {/* ---- アドアーチ手数料 ---- */}
              <div className="border-t border-zinc-700 pt-3 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-bold text-zinc-300">Ad-Arch 手数料内訳</p>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isFirstTransaction}
                      onChange={(e) => setIsFirstTransaction(e.target.checked)}
                      className="w-3.5 h-3.5 accent-amber-400"
                    />
                    <span className="text-[10px] text-zinc-400">初期取引（業態考査含む）</span>
                  </label>
                </div>

                <div className="bg-zinc-800 rounded-lg overflow-hidden text-[11px]">
                  {[
                    {
                      label: "媒体管理費",
                      note: calcResult.budget <= 500000 ? "（50万以下：固定）" : "（媒体費 × 20%）",
                      value: fees.managementFee,
                      color: "text-zinc-200",
                    },
                    {
                      label: "クリエイティブ考査費",
                      note: "（固定）",
                      value: fees.creativeFee,
                      color: "text-zinc-200",
                    },
                    ...(isFirstTransaction ? [{
                      label: "初期取引費（業態考査含む）",
                      note: "（固定）",
                      value: fees.initialFee,
                      color: "text-amber-300",
                    }] : []),
                  ].map((row) => (
                    <div key={row.label} className="flex items-center justify-between px-3 py-2 border-b border-zinc-700 last:border-0">
                      <span className="text-zinc-400">
                        {row.label}
                        <span className="ml-1 text-zinc-600">{row.note}</span>
                      </span>
                      <span className={cn("font-semibold tabular-nums", row.color)}>
                        {formatYen(row.value)}
                      </span>
                    </div>
                  ))}
                  <div className="flex items-center justify-between px-3 py-2.5 bg-zinc-700/60">
                    <span className="text-zinc-300 font-bold">手数料合計（税抜）</span>
                    <span className="text-white font-bold tabular-nums">{formatYen(fees.subtotal)}</span>
                  </div>
                </div>

                <div className="bg-zinc-800 rounded-lg px-3 py-2.5 flex items-center justify-between">
                  <span className="text-zinc-300 font-bold text-xs">総合計（媒体費＋手数料・税抜）</span>
                  <span className="text-yellow-300 font-bold text-sm tabular-nums">
                    {formatYen(calcResult.budget + fees.subtotal)}
                  </span>
                </div>
                <p className="text-[10px] text-zinc-600 text-center">
                  ※ 手数料はすべてネット価格を基準に算出しています
                </p>
              </div>
            </>
          )}
        </div>

        {/* PDF出力 */}
        {selected.size > 0 && pdfData && (
          <PdfDownloadButton data={pdfData} fileName={pdfFileName} />
        )}
      </div>
    </div>
  );
}
