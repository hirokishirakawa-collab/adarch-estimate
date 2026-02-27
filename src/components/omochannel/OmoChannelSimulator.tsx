"use client";

import { useState, useMemo } from "react";
import { RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";

// ================================================================
// 型・定数
// ================================================================

type Target = "japanese" | "inbound";
type Area   = "national" | "tokyo" | "kansai" | "other";
type Dur    = "15s" | "30s";
type Period = "1w" | "4w" | "12w" | "26w" | "52w";
type InfoPeriod = "2w" | "4w" | "12w" | "26w" | "52w";

const PERIODS: { id: Period; label: string }[] = [
  { id: "1w",  label: "1週間"           },
  { id: "4w",  label: "4週間"           },
  { id: "12w", label: "1クール（12週）" },
  { id: "26w", label: "半年（26週）"    },
  { id: "52w", label: "年間（52週）"    },
];

const INFO_PERIODS_JP: { id: InfoPeriod; label: string }[] = [
  { id: "2w",  label: "2週間"           },
  { id: "4w",  label: "4週間"           },
  { id: "12w", label: "1クール（12週）" },
  { id: "26w", label: "半年（26週）"    },
  { id: "52w", label: "年間（52週）"    },
];

const INFO_PERIODS_IB: { id: InfoPeriod; label: string }[] = [
  { id: "4w",  label: "4週間"           },
  { id: "12w", label: "1クール（12週）" },
  { id: "26w", label: "半年（26週）"    },
  { id: "52w", label: "年間（52週）"    },
];

// 日本語ロール 価格表（税抜）
const JP_PRICES: Record<"national" | "tokyo" | "kansai", Record<Dur, Record<Period, number>>> = {
  national: {
    "15s": { "1w": 1_500_000, "4w":  3_600_000, "12w":  9_720_000, "26w": 18_360_000, "52w": 34_560_000 },
    "30s": { "1w": 1_875_000, "4w":  4_500_000, "12w": 12_150_000, "26w": 22_950_000, "52w": 43_200_000 },
  },
  tokyo: {
    "15s": { "1w": 1_000_000, "4w":  2_400_000, "12w":  6_480_000, "26w": 12_240_000, "52w": 23_040_000 },
    "30s": { "1w": 1_250_000, "4w":  3_000_000, "12w":  8_100_000, "26w": 15_300_000, "52w": 28_800_000 },
  },
  kansai: {
    "15s": { "1w":   600_000, "4w":  1_440_000, "12w":  3_888_000, "26w":  7_344_000, "52w": 13_824_000 },
    "30s": { "1w":   750_000, "4w":  1_800_000, "12w":  4_860_000, "26w":  9_180_000, "52w": 17_280_000 },
  },
};

// インバウンドロール 価格表（30秒のみ・1週間なし）
const IB_PRICES: Record<"national" | "tokyo" | "kansai", Partial<Record<Period, number>>> = {
  national: { "4w":  4_000_000, "12w": 10_000_000, "26w": 18_000_000, "52w": 33_000_000 },
  tokyo:    { "4w":  3_000_000, "12w":  7_500_000, "26w": 13_500_000, "52w": 24_750_000 },
  kansai:   { "4w":  1_500_000, "12w":  3_750_000, "26w":  6_750_000, "52w": 12_375_000 },
};

// インフォマーシャル（最大180秒）
const INFO_JP: Record<InfoPeriod, number> = {
  "2w":  3_000_000,
  "4w":  5_400_000,
  "12w": 15_300_000,
  "26w": 28_800_000,
  "52w": 50_400_000,
};
const INFO_IB: Partial<Record<InfoPeriod, number>> = {
  "4w":  5_200_000,
  "12w": 13_000_000,
  "26w": 25_000_000,
  "52w": 46_000_000,
};

const MIRRORING_MONTHLY = 1_680_000;
const VOD_PRICES: Record<number, number> = { 1: 2_000_000, 2: 3_200_000, 3: 4_200_000 };

const AREA_META: Record<"national" | "tokyo" | "kansai" | "other", { label: string; sub: string }> = {
  national: { label: "全国",         sub: "52,963室" },
  tokyo:    { label: "首都圏エリア", sub: "26,015室" },
  kansai:   { label: "関西エリア",   sub: "12,672室" },
  other:    { label: "その他エリア", sub: "単独価格なし" },
};

// ================================================================
// ユーティリティ
// ================================================================

function fmt(n: number): string {
  const m = n / 10_000;
  if (m >= 10_000) return (m / 10_000).toFixed(1) + "億円";
  if (m >= 1)       return (m % 1 === 0 ? m.toFixed(0) : m.toFixed(1)) + "万円";
  return n.toLocaleString("ja-JP") + "円";
}
function fmtTax(n: number) { return fmt(Math.round(n * 1.1)); }

// ================================================================
// メインコンポーネント
// ================================================================

export function OmoChannelSimulator() {
  // ターゲット・エリア・尺・期間
  const [target, setTarget] = useState<Target>("japanese");
  const [area,   setArea]   = useState<Area>("national");
  const [dur,    setDur]    = useState<Dur>("15s");
  const [period, setPeriod] = useState<Period>("4w");

  // インフォマーシャル
  const [useInfo,     setUseInfo]     = useState(false);
  const [infoPeriod,  setInfoPeriod]  = useState<InfoPeriod>("4w");

  // ミラーリング前CM（日本語のみ）
  const [useMirroring,      setUseMirroring]      = useState(false);
  const [mirroringMonths,   setMirroringMonths]   = useState(1);

  // VOD無料コンテンツ枠（日本語のみ）
  const [useVod,      setUseVod]      = useState(false);
  const [vodEpisodes, setVodEpisodes] = useState(1);
  const [vodMonths,   setVodMonths]   = useState(1);

  // ---------------------------------------------------------------
  // ターゲット切替ハンドラ（インバウンド時は制約を補正）
  // ---------------------------------------------------------------
  const handleTargetChange = (t: Target) => {
    setTarget(t);
    if (t === "inbound") {
      setDur("30s");
      if (period === "1w")     setPeriod("4w");
      if (infoPeriod === "2w") setInfoPeriod("4w");
    }
  };

  const reset = () => {
    setTarget("japanese"); setArea("national"); setDur("15s"); setPeriod("4w");
    setUseInfo(false); setInfoPeriod("4w");
    setUseMirroring(false); setMirroringMonths(1);
    setUseVod(false); setVodEpisodes(1); setVodMonths(1);
  };

  const isInbound   = target === "inbound";
  const isOtherArea = area === "other";

  // ---------------------------------------------------------------
  // 計算
  // ---------------------------------------------------------------
  const calc = useMemo(() => {
    type Row = { label: string; price: number };
    const rows: Row[] = [];
    let mainUnavailable = false;

    // メインCM
    if (isOtherArea) {
      mainUnavailable = true;
    } else if (isInbound && period === "1w") {
      mainUnavailable = true;
    } else {
      const a = area as "national" | "tokyo" | "kansai";
      const areaLabel  = AREA_META[a].label;
      const periodLabel = PERIODS.find(p => p.id === period)!.label;
      if (!isInbound) {
        const p = JP_PRICES[a][dur][period];
        rows.push({ label: `メインCM（${areaLabel}・${dur}・${periodLabel}）`, price: p });
      } else {
        const p = IB_PRICES[a][period];
        if (p) rows.push({ label: `インバウンドCM（${areaLabel}・30秒・${periodLabel}）`, price: p });
      }
    }

    // インフォマーシャル（全国・エリア不問）
    if (useInfo) {
      const infoPeriodLabel = (isInbound ? INFO_PERIODS_IB : INFO_PERIODS_JP).find(x => x.id === infoPeriod)!.label;
      const p = isInbound ? (INFO_IB[infoPeriod] ?? 0) : INFO_JP[infoPeriod];
      if (p) rows.push({ label: `インフォマーシャル（最大180秒・全国・${infoPeriodLabel}）`, price: p });
    }

    // ミラーリング前CM（日本語のみ）
    if (useMirroring && !isInbound) {
      rows.push({
        label: `ミラーリング前CM（15秒・${mirroringMonths}ヵ月）`,
        price: MIRRORING_MONTHLY * mirroringMonths,
      });
    }

    // VOD（日本語のみ）
    if (useVod && !isInbound) {
      rows.push({
        label: `VOD無料コンテンツ枠（${vodEpisodes}話・${vodMonths}ヵ月）`,
        price: VOD_PRICES[vodEpisodes] * vodMonths,
      });
    }

    const total = rows.reduce((s, r) => s + r.price, 0);
    return { rows, total, mainUnavailable };
  }, [target, area, dur, period, useInfo, infoPeriod,
      useMirroring, mirroringMonths, useVod, vodEpisodes, vodMonths,
      isInbound, isOtherArea]);

  // ---------------------------------------------------------------
  // 期間ボタン用の参考価格プレビュー
  // ---------------------------------------------------------------
  const getPeriodPreview = (pid: Period): number | null => {
    if (isOtherArea) return null;
    if (isInbound) {
      if (pid === "1w") return null;
      return IB_PRICES[area as "national" | "tokyo" | "kansai"][pid] ?? null;
    }
    return JP_PRICES[area as "national" | "tokyo" | "kansai"][dur][pid];
  };

  const infoPeriodsToUse = isInbound ? INFO_PERIODS_IB : INFO_PERIODS_JP;

  // ================================================================
  // レンダリング
  // ================================================================

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[1fr_380px] gap-4 items-start">

      {/* ===== 左: 設定パネル ===== */}
      <div className="space-y-4">

        {/* ターゲット */}
        <div className="bg-white rounded-xl border border-zinc-200 p-4 space-y-3">
          <p className="text-xs font-bold text-zinc-700">ターゲット</p>
          <div className="flex gap-2">
            {(["japanese", "inbound"] as Target[]).map((t) => (
              <button
                key={t}
                onClick={() => handleTargetChange(t)}
                className={cn(
                  "flex-1 py-2.5 rounded-lg border text-xs font-semibold transition-colors text-center",
                  target === t
                    ? "bg-zinc-800 text-white border-zinc-800"
                    : "border-zinc-200 text-zinc-600 hover:bg-zinc-50"
                )}
              >
                <div>{t === "japanese" ? "日本語ロール" : "インバウンドロール"}</div>
                <div className={cn("text-[10px] font-normal mt-0.5", target === t ? "text-zinc-400" : "text-zinc-400")}>
                  {t === "japanese"
                    ? "15・30秒 / 月間122.7万人（日本人）"
                    : "30秒のみ / 訪日外国人62.8万人/月"}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* エリア選択 */}
        <div className="bg-white rounded-xl border border-zinc-200 p-4 space-y-3">
          <p className="text-xs font-bold text-zinc-700">配信エリア</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {(["national", "tokyo", "kansai", "other"] as Area[]).map((a) => {
              const meta = AREA_META[a];
              return (
                <button
                  key={a}
                  onClick={() => setArea(a)}
                  className={cn(
                    "py-2.5 px-2 rounded-lg border text-xs transition-colors text-center",
                    area === a
                      ? "bg-zinc-800 text-white border-zinc-800"
                      : a === "other"
                        ? "border-dashed border-zinc-300 text-zinc-500 hover:bg-zinc-50"
                        : "border-zinc-200 text-zinc-600 hover:bg-zinc-50"
                  )}
                >
                  <div className="font-semibold">{meta.label}</div>
                  <div className={cn(
                    "text-[10px] mt-0.5",
                    area === a ? "text-zinc-400" : a === "other" ? "text-red-400" : "text-zinc-400"
                  )}>
                    {meta.sub}
                  </div>
                </button>
              );
            })}
          </div>
          {isOtherArea && (
            <p className="text-[11px] text-amber-700 bg-amber-50 rounded-lg px-3 py-2">
              北海道・東北 / 中部 / 中国・四国 / 九州エリアは単独プランの設定がありません。全国プランへの内包としてご提案ください。
            </p>
          )}
        </div>

        {/* 広告尺（日本語ロールのみ） */}
        {!isInbound && (
          <div className="bg-white rounded-xl border border-zinc-200 p-4 space-y-3">
            <p className="text-xs font-bold text-zinc-700">広告尺</p>
            <div className="flex gap-2">
              {(["15s", "30s"] as Dur[]).map((d) => (
                <button
                  key={d}
                  onClick={() => setDur(d)}
                  className={cn(
                    "flex-1 py-2 rounded-lg border text-xs font-semibold transition-colors",
                    dur === d
                      ? "bg-zinc-800 text-white border-zinc-800"
                      : "border-zinc-200 text-zinc-600 hover:bg-zinc-50"
                  )}
                >
                  {d === "15s" ? "15秒" : "30秒"}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 掲載期間 */}
        <div className="bg-white rounded-xl border border-zinc-200 p-4 space-y-3">
          <p className="text-xs font-bold text-zinc-700">掲載期間</p>
          <div className="flex flex-wrap gap-2">
            {PERIODS.map((p) => {
              const unavailable = isInbound && p.id === "1w";
              const preview = getPeriodPreview(p.id);
              return (
                <button
                  key={p.id}
                  onClick={() => !unavailable && setPeriod(p.id)}
                  className={cn(
                    "flex-1 min-w-[80px] py-2 rounded-lg border text-xs transition-colors text-center",
                    period === p.id && !unavailable
                      ? "bg-zinc-800 text-white border-zinc-800"
                      : unavailable
                        ? "border-zinc-100 bg-zinc-50 text-zinc-300 cursor-not-allowed"
                        : "border-zinc-200 text-zinc-600 hover:bg-zinc-50"
                  )}
                >
                  <div className="font-semibold">{p.label}</div>
                  {unavailable ? (
                    <div className="text-[10px] text-red-400 mt-0.5">対象外</div>
                  ) : preview != null ? (
                    <div className={cn("text-[10px] mt-0.5", period === p.id ? "text-zinc-400" : "text-zinc-400")}>
                      {fmt(preview)}
                    </div>
                  ) : null}
                </button>
              );
            })}
          </div>
          {isInbound && (
            <p className="text-[10px] text-zinc-400">
              ※ インバウンドロールは最短4週間からのお申し込みです
            </p>
          )}
        </div>

        {/* オプションメニュー */}
        <div className="bg-white rounded-xl border border-zinc-200 p-4 space-y-5">
          <p className="text-xs font-bold text-zinc-700">オプションメニュー</p>

          {/* インフォマーシャル */}
          <div className="space-y-2.5">
            <label className="flex items-start gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={useInfo}
                onChange={(e) => setUseInfo(e.target.checked)}
                className="w-4 h-4 mt-0.5 accent-zinc-700 flex-shrink-0"
              />
              <div>
                <span className="text-xs text-zinc-700 font-medium">インフォマーシャル枠（最大180秒）</span>
                <p className="text-[10px] text-zinc-400 mt-0.5">
                  全国対象。番組形式で最大180秒の動画を配信できます
                </p>
              </div>
            </label>
            {useInfo && (
              <div className="pl-6 space-y-2">
                <p className="text-[11px] text-zinc-500">配信期間</p>
                <div className="flex flex-wrap gap-1.5">
                  {infoPeriodsToUse.map((ip) => {
                    const price = isInbound ? (INFO_IB[ip.id] ?? 0) : INFO_JP[ip.id];
                    return (
                      <button
                        key={ip.id}
                        onClick={() => setInfoPeriod(ip.id)}
                        className={cn(
                          "px-2.5 py-1.5 rounded-lg border text-[11px] transition-colors text-center",
                          infoPeriod === ip.id
                            ? "bg-zinc-800 text-white border-zinc-800"
                            : "border-zinc-200 text-zinc-600 hover:bg-zinc-50"
                        )}
                      >
                        <div>{ip.label}</div>
                        <div className={cn("text-[9px]", infoPeriod === ip.id ? "text-zinc-400" : "text-zinc-400")}>
                          {fmt(price)}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <div className="border-t border-zinc-100" />

          {/* ミラーリング前CM */}
          <div className="space-y-2.5">
            <label className={cn(
              "flex items-start gap-2",
              isInbound ? "opacity-40 cursor-not-allowed" : "cursor-pointer"
            )}>
              <input
                type="checkbox"
                checked={!isInbound && useMirroring}
                onChange={(e) => !isInbound && setUseMirroring(e.target.checked)}
                disabled={isInbound}
                className="w-4 h-4 mt-0.5 accent-zinc-700 flex-shrink-0"
              />
              <div>
                <span className="text-xs text-zinc-700 font-medium">
                  ミラーリング前CM（15秒・スキップ不可）
                </span>
                {isInbound && (
                  <span className="ml-1.5 text-[10px] text-red-400">日本語ロールのみ</span>
                )}
                <p className="text-[10px] text-zinc-400 mt-0.5">
                  {fmt(MIRRORING_MONTHLY)}/月 · 46,744室・164施設 · 想定210,000回/月
                </p>
              </div>
            </label>
            {useMirroring && !isInbound && (
              <div className="pl-6 flex items-center gap-3">
                <span className="text-[11px] text-zinc-500">掲載月数</span>
                <input
                  type="number" min={1} max={12}
                  value={mirroringMonths}
                  onChange={(e) => setMirroringMonths(Math.max(1, Number(e.target.value)))}
                  className="w-16 px-2 py-1 text-sm text-center border border-zinc-200 rounded-lg outline-none focus:border-zinc-400"
                />
                <span className="text-[11px] text-zinc-500">ヵ月</span>
                <span className="text-[11px] text-zinc-400 ml-auto">
                  {fmt(MIRRORING_MONTHLY * mirroringMonths)}
                </span>
              </div>
            )}
          </div>

          <div className="border-t border-zinc-100" />

          {/* VOD無料コンテンツ枠 */}
          <div className="space-y-2.5">
            <label className={cn(
              "flex items-start gap-2",
              isInbound ? "opacity-40 cursor-not-allowed" : "cursor-pointer"
            )}>
              <input
                type="checkbox"
                checked={!isInbound && useVod}
                onChange={(e) => !isInbound && setUseVod(e.target.checked)}
                disabled={isInbound}
                className="w-4 h-4 mt-0.5 accent-zinc-700 flex-shrink-0"
              />
              <div>
                <span className="text-xs text-zinc-700 font-medium">
                  VOD無料コンテンツ枠（最大1時間/話）
                </span>
                {isInbound && (
                  <span className="ml-1.5 text-[10px] text-red-400">日本語ロールのみ</span>
                )}
                <p className="text-[10px] text-zinc-400 mt-0.5">
                  全52,963室のVODコーナーに設置。1話=200万・2話=320万・3話=420万（/月）
                </p>
              </div>
            </label>
            {useVod && !isInbound && (
              <div className="pl-6 space-y-2.5">
                <div className="flex gap-1.5 flex-wrap">
                  {[1, 2, 3].map((ep) => (
                    <button
                      key={ep}
                      onClick={() => setVodEpisodes(ep)}
                      className={cn(
                        "px-3 py-1.5 rounded-lg border text-[11px] transition-colors text-center",
                        vodEpisodes === ep
                          ? "bg-zinc-800 text-white border-zinc-800"
                          : "border-zinc-200 text-zinc-600 hover:bg-zinc-50"
                      )}
                    >
                      <div className="font-semibold">{ep}話</div>
                      <div className={cn("text-[9px]", vodEpisodes === ep ? "text-zinc-400" : "text-zinc-400")}>
                        {fmt(VOD_PRICES[ep])}/月
                      </div>
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[11px] text-zinc-500">掲載月数</span>
                  <input
                    type="number" min={1} max={12}
                    value={vodMonths}
                    onChange={(e) => setVodMonths(Math.max(1, Number(e.target.value)))}
                    className="w-16 px-2 py-1 text-sm text-center border border-zinc-200 rounded-lg outline-none focus:border-zinc-400"
                  />
                  <span className="text-[11px] text-zinc-500">ヵ月</span>
                  <span className="text-[11px] text-zinc-400 ml-auto">
                    {fmt(VOD_PRICES[vodEpisodes] * vodMonths)}
                  </span>
                </div>
              </div>
            )}
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

          {/* 警告メッセージ */}
          {calc.mainUnavailable && (
            <div className="bg-amber-900/30 border border-amber-700/50 rounded-lg px-3 py-2 text-[11px] text-amber-300">
              {isOtherArea
                ? "その他エリアは単独価格がありません。メインCMは計算対象外です。"
                : "インバウンドロールは1週間プランが対象外です。"}
            </div>
          )}

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
                    <div className="text-zinc-400 min-w-0 flex-1 truncate">{row.label}</div>
                    <div className="text-zinc-200 font-semibold tabular-nums flex-shrink-0">
                      {fmt(row.price)}
                    </div>
                  </div>
                ))}
              </div>

              {/* 価格サマリー */}
              <div className="space-y-1.5">
                {/* 定価 */}
                <div className="bg-zinc-800 rounded-lg px-3 py-2.5">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] text-zinc-400 font-semibold">定価（税抜）</p>
                    <span className="text-base font-bold text-zinc-200 tabular-nums">
                      {fmt(calc.total)}
                    </span>
                  </div>
                  <div className="flex justify-end">
                    <span className="text-[10px] text-zinc-600 tabular-nums">
                      {fmtTax(calc.total)}（税込）
                    </span>
                  </div>
                </div>

                {/* 仕入れ価格 */}
                <div className="bg-zinc-800 rounded-lg px-3 py-2.5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[10px] text-zinc-400 font-semibold">仕入れ価格</p>
                      <p className="text-[9px] text-zinc-600">定価 × 80%（−20%）</p>
                    </div>
                    <span className="text-base font-bold text-blue-300 tabular-nums">
                      {fmt(Math.round(calc.total * 0.80))}
                    </span>
                  </div>
                  <div className="flex justify-end">
                    <span className="text-[10px] text-zinc-600 tabular-nums">
                      {fmtTax(Math.round(calc.total * 0.80))}（税込）
                    </span>
                  </div>
                </div>

                {/* 提案価格 */}
                <div className="bg-zinc-700/60 rounded-lg px-3 py-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-zinc-300 font-bold">提案価格</p>
                      <p className="text-[9px] text-zinc-500">定価 × 120%（媒体管理費込）</p>
                    </div>
                    <span className="text-xl font-bold text-yellow-300 tabular-nums">
                      {fmt(Math.round(calc.total * 1.20))}
                    </span>
                  </div>
                  <div className="flex justify-end">
                    <span className="text-[10px] text-zinc-500 tabular-nums">
                      {fmtTax(Math.round(calc.total * 1.20))}（税込）
                    </span>
                  </div>
                </div>
              </div>

              <p className="text-[10px] text-zinc-600 text-center">
                ※ 価格はすべて税抜。提案価格は目安です。
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
