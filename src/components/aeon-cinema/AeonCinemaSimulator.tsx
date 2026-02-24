"use client";

import { useState, useMemo } from "react";
import { ChevronDown, ChevronRight, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  AEON_THEATERS,
  AEON_AREA_ORDER,
  CINEMA_AD_COLS,
  LOBBY_COLS,
  type CinemaAdColKey,
  type LobbyColKey,
} from "@/data/aeon-theaters";

// ────────────────────────────────────────────────────────────────
// 定数・ユーティリティ
// ────────────────────────────────────────────────────────────────
function dcpFee(seconds: number): number {
  // ¥40,000/素材・60秒まで。60秒超は60秒毎 +¥10,000
  return 40_000 + Math.ceil(Math.max(0, seconds - 60) / 60) * 10_000;
}

function deliveryFee(theaterCount: number): number {
  if (theaterCount === 0) return 0;
  if (theaterCount <= 5) return 10_000;
  return 6_000 * theaterCount;
}

function fmt(n: number): string {
  return "¥" + Math.round(n).toLocaleString("ja-JP");
}

type AdMode = "cinema" | "lobby";

const COL_INDEX: Record<CinemaAdColKey, number> = {
  spec2w:   0,
  spec4w:   1,
  all26_2w: 2,
  all26_4w: 3,
  all26m:   4,
  all26t:   5,
  all52m:   6,
  all52t:   7,
};

const LOBBY_COL_INDEX: Record<LobbyColKey, number> = {
  flyer:    0,
  poster:   1,
  display:  2,
  sampling: 3,
  demo:     4,
  entrance: 5,
};

// ────────────────────────────────────────────────────────────────
// メインコンポーネント
// ────────────────────────────────────────────────────────────────
export function AeonCinemaSimulator() {
  const [adMode, setAdMode] = useState<AdMode>("cinema");

  // シネアド設定
  const [duration, setDuration] = useState<15 | 30>(15);
  const [colKey, setColKey] = useState<CinemaAdColKey>("spec2w");
  const [materialSec, setMaterialSec] = useState<number>(30);

  // ロビー設定
  const [lobbyKey, setLobbyKey] = useState<LobbyColKey>("flyer");
  const [samplingQty, setSamplingQty] = useState<number>(1000);

  // 共通設定
  const [selectedTheaters, setSelectedTheaters] = useState<Set<number>>(new Set());
  const [openAreas, setOpenAreas] = useState<Set<string>>(new Set());

  // エリア別マップ
  const areaMap = useMemo(() => {
    const m = new Map<string, typeof AEON_THEATERS>();
    for (const t of AEON_THEATERS) {
      if (!m.has(t.area)) m.set(t.area, []);
      m.get(t.area)!.push(t);
    }
    return m;
  }, []);

  const selectedList = useMemo(
    () => AEON_THEATERS.filter(t => selectedTheaters.has(t.id)),
    [selectedTheaters]
  );

  // 媒体費計算
  const mediaFee = useMemo(() => {
    if (adMode === "cinema") {
      const idx = COL_INDEX[colKey];
      return selectedList.reduce((sum, t) => {
        const prices = duration === 15 ? t.p15 : t.p30;
        return sum + (prices[idx] ?? 0);
      }, 0);
    } else {
      if (lobbyKey === "entrance") {
        // 入場時サンプリング: 60円/部 × 配布部数 × 劇場数
        return Math.ceil(samplingQty / 1000) * 1000 * 60 * selectedList.length;
      }
      const idx = LOBBY_COL_INDEX[lobbyKey];
      return selectedList.reduce((sum, t) => sum + (t.lobby[idx] ?? 0), 0);
    }
  }, [adMode, colKey, lobbyKey, duration, selectedList, samplingQty]);

  const dcpTotal  = adMode === "cinema" && selectedList.length > 0 ? dcpFee(materialSec) : 0;
  const delivTotal = adMode === "cinema" ? deliveryFee(selectedList.length) : 0;

  // Ad-Arch価格: 媒体費のみ±20%、DCP/配信費はパススルー
  const clientPrice   = Math.round(mediaFee * 1.2) + dcpTotal + delivTotal;
  const purchasePrice = Math.round(mediaFee * 0.8) + dcpTotal + delivTotal;
  const margin        = clientPrice - purchasePrice;
  const totalSC       = selectedList.reduce((s, t) => s + t.sc, 0);

  // トグル
  const toggleArea = (area: string) => {
    const next = new Set(openAreas);
    next.has(area) ? next.delete(area) : next.add(area);
    setOpenAreas(next);
  };

  const toggleTheater = (id: number) => {
    const next = new Set(selectedTheaters);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelectedTheaters(next);
  };

  const toggleAreaAll = (area: string, checked: boolean) => {
    const next = new Set(selectedTheaters);
    (areaMap.get(area) ?? []).forEach(t => checked ? next.add(t.id) : next.delete(t.id));
    setSelectedTheaters(next);
  };

  const reset = () => {
    setSelectedTheaters(new Set());
    setAdMode("cinema");
    setDuration(15);
    setColKey("spec2w");
    setMaterialSec(30);
    setLobbyKey("flyer");
    setSamplingQty(1000);
  };

  const hasSelection = selectedList.length > 0;

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[1fr_340px] gap-4">
      {/* ── 左パネル ── */}
      <div className="space-y-4">

        {/* 広告タイプ */}
        <section className="bg-white border border-zinc-200 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-zinc-800">広告タイプ</h3>
            <button
              onClick={reset}
              className="text-xs text-zinc-400 hover:text-zinc-600 flex items-center gap-1"
            >
              <RotateCcw className="w-3 h-3" /> リセット
            </button>
          </div>
          <div className="flex gap-2">
            {(["cinema", "lobby"] as AdMode[]).map(m => (
              <button
                key={m}
                onClick={() => setAdMode(m)}
                className={cn(
                  "flex-1 py-2 rounded-lg text-xs font-medium transition-colors",
                  adMode === m
                    ? "bg-blue-600 text-white"
                    : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
                )}
              >
                {m === "cinema" ? "🎬 シネアド" : "🎪 ロビープロモーション"}
              </button>
            ))}
          </div>
        </section>

        {/* シネアド設定 */}
        {adMode === "cinema" && (
          <section className="bg-white border border-zinc-200 rounded-xl p-4 space-y-4">
            <h3 className="text-sm font-semibold text-zinc-800">シネアド設定</h3>

            {/* 秒数 */}
            <div>
              <p className="text-xs text-zinc-500 mb-2">秒数</p>
              <div className="flex gap-2">
                {([15, 30] as (15 | 30)[]).map(d => (
                  <button
                    key={d}
                    onClick={() => setDuration(d)}
                    className={cn(
                      "px-5 py-1.5 rounded-lg text-xs font-medium transition-colors",
                      duration === d
                        ? "bg-blue-600 text-white"
                        : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
                    )}
                  >
                    {d}秒
                  </button>
                ))}
              </div>
            </div>

            {/* 価格タイプ */}
            <div>
              <p className="text-xs text-zinc-500 mb-2">価格タイプ</p>
              <div className="space-y-3">
                {/* 1作品指定 */}
                <div>
                  <p className="text-[10px] text-zinc-400 uppercase tracking-wider mb-1.5">1作品指定</p>
                  <div className="flex gap-2">
                    {CINEMA_AD_COLS.slice(0, 2).map(col => (
                      <button
                        key={col.key}
                        onClick={() => setColKey(col.key as CinemaAdColKey)}
                        className={cn(
                          "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
                          colKey === col.key
                            ? "bg-violet-600 text-white"
                            : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
                        )}
                      >
                        {col.note}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 全作品26週 */}
                <div>
                  <p className="text-[10px] text-zinc-400 uppercase tracking-wider mb-1.5">全作品 26週（6ヶ月）</p>
                  <div className="flex gap-2 flex-wrap">
                    {CINEMA_AD_COLS.slice(2, 6).map(col => (
                      <button
                        key={col.key}
                        onClick={() => setColKey(col.key as CinemaAdColKey)}
                        className={cn(
                          "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
                          colKey === col.key
                            ? "bg-violet-600 text-white"
                            : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
                        )}
                      >
                        {col.note}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 全作品52週 */}
                <div>
                  <p className="text-[10px] text-zinc-400 uppercase tracking-wider mb-1.5">全作品 52週（12ヶ月）</p>
                  <div className="flex gap-2 flex-wrap">
                    {CINEMA_AD_COLS.slice(6).map(col => (
                      <button
                        key={col.key}
                        onClick={() => setColKey(col.key as CinemaAdColKey)}
                        className={cn(
                          "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
                          colKey === col.key
                            ? "bg-violet-600 text-white"
                            : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
                        )}
                      >
                        {col.note}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* 素材秒数（DCP変換費計算用） */}
            <div>
              <p className="text-xs text-zinc-500 mb-1.5">素材秒数（DCP変換費の計算用）</p>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  value={materialSec}
                  min={1}
                  max={300}
                  onChange={e => setMaterialSec(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-24 text-xs border border-zinc-200 rounded-lg px-3 py-2 text-center"
                />
                <span className="text-xs text-zinc-500">秒</span>
                <span className="text-xs text-blue-600 font-medium">
                  DCP変換費 {fmt(dcpFee(materialSec))}
                </span>
              </div>
              <p className="text-[11px] text-zinc-400 mt-1">
                ¥40,000/素材・60秒まで。61秒以上は60秒毎に+¥10,000
              </p>
            </div>
          </section>
        )}

        {/* ロビー設定 */}
        {adMode === "lobby" && (
          <section className="bg-white border border-zinc-200 rounded-xl p-4 space-y-4">
            <h3 className="text-sm font-semibold text-zinc-800">ロビープロモーション設定</h3>
            <div>
              <p className="text-xs text-zinc-500 mb-2">プロモーション種別</p>
              <div className="space-y-2">
                {LOBBY_COLS.map(col => (
                  <label key={col.key} className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="radio"
                      name="lobbyKey"
                      value={col.key}
                      checked={lobbyKey === col.key}
                      onChange={() => setLobbyKey(col.key as LobbyColKey)}
                      className="accent-blue-600"
                    />
                    <span className="text-xs text-zinc-700 flex-1">{col.label}</span>
                    <span className="text-[11px] text-zinc-400">{col.unit}</span>
                  </label>
                ))}
              </div>
            </div>

            {lobbyKey === "entrance" && (
              <div>
                <p className="text-xs text-zinc-500 mb-1.5">配布部数（1劇場あたり）</p>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    value={samplingQty}
                    min={1000}
                    step={1000}
                    onChange={e =>
                      setSamplingQty(Math.max(1000, parseInt(e.target.value) || 1000))
                    }
                    className="w-28 text-xs border border-zinc-200 rounded-lg px-3 py-2 text-center"
                  />
                  <span className="text-xs text-zinc-500">部</span>
                  <span className="text-xs text-blue-600 font-medium">
                    {fmt(Math.ceil(samplingQty / 1000) * 1000 * 60)}/劇場
                  </span>
                </div>
                <p className="text-[11px] text-zinc-400 mt-1">1,000部単位 · 1部¥60</p>
              </div>
            )}
          </section>
        )}

        {/* 劇場選択 */}
        <section className="bg-white border border-zinc-200 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-zinc-800">
              劇場選択
              {hasSelection && (
                <span className="ml-2 text-blue-600 font-normal">{selectedList.length}劇場</span>
              )}
            </h3>
            {hasSelection && (
              <button
                onClick={() => setSelectedTheaters(new Set())}
                className="text-xs text-zinc-400 hover:text-zinc-600"
              >
                全解除
              </button>
            )}
          </div>

          <div className="space-y-1.5">
            {AEON_AREA_ORDER.map(area => {
              const areaTheaters = areaMap.get(area) ?? [];
              const selectedInArea = areaTheaters.filter(t => selectedTheaters.has(t.id)).length;
              const isOpen = openAreas.has(area);
              const allChecked = selectedInArea === areaTheaters.length;
              const partialChecked = selectedInArea > 0 && !allChecked;

              return (
                <div key={area} className="border border-zinc-100 rounded-lg overflow-hidden">
                  {/* エリアヘッダー */}
                  <div
                    className={cn(
                      "flex items-center gap-2 px-3 py-2 select-none",
                      selectedInArea > 0 ? "bg-blue-50" : "bg-zinc-50"
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={allChecked}
                      ref={el => { if (el) el.indeterminate = partialChecked; }}
                      onChange={e => toggleAreaAll(area, e.target.checked)}
                      className="accent-blue-600"
                      onClick={e => e.stopPropagation()}
                    />
                    <span
                      className="flex-1 text-xs font-medium text-zinc-700 cursor-pointer"
                      onClick={() => toggleArea(area)}
                    >
                      {area}
                      <span className="ml-2 text-zinc-400 font-normal text-[11px]">
                        {selectedInArea > 0 ? `${selectedInArea}/` : ""}
                        {areaTheaters.length}劇場
                      </span>
                    </span>
                    <button onClick={() => toggleArea(area)} className="text-zinc-400">
                      {isOpen
                        ? <ChevronDown className="w-3.5 h-3.5" />
                        : <ChevronRight className="w-3.5 h-3.5" />}
                    </button>
                  </div>

                  {/* 劇場一覧 */}
                  {isOpen && (
                    <div className="px-3 pb-3 pt-2 bg-white">
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1">
                        {areaTheaters.map(t => (
                          <label key={t.id} className="flex items-center gap-1.5 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={selectedTheaters.has(t.id)}
                              onChange={() => toggleTheater(t.id)}
                              className="accent-blue-600 flex-shrink-0"
                            />
                            <span className="text-xs text-zinc-700 truncate">
                              {t.name}
                              <span className="text-zinc-400 ml-0.5 text-[10px]">
                                {t.sc}SC
                              </span>
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      </div>

      {/* ── 右パネル: 合計 ── */}
      <div className="space-y-4">
        <div className="xl:sticky xl:top-4 space-y-4">

          {/* 選択サマリー */}
          <div className="bg-white border border-zinc-200 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-zinc-800 mb-3">選択劇場サマリー</h3>
            {!hasSelection ? (
              <p className="text-xs text-zinc-400">劇場を選択してください</p>
            ) : (
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-zinc-500">選択劇場数</span>
                  <span className="font-medium">{selectedList.length}劇場</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-zinc-500">合計SC数</span>
                  <span className="font-medium">{totalSC}SC</span>
                </div>
              </div>
            )}
          </div>

          {/* 料金内訳 */}
          <div className="bg-white border border-zinc-200 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-zinc-800 mb-3">
              {adMode === "cinema" ? "シネアド" : "ロビー"}料金
            </h3>
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-zinc-500">
                  {adMode === "cinema"
                    ? `媒体費（${duration}秒 ${CINEMA_AD_COLS.find(c => c.key === colKey)?.label ?? ""}）`
                    : `${LOBBY_COLS.find(c => c.key === lobbyKey)?.label ?? ""}費`}
                </span>
                <span className="font-medium">{mediaFee > 0 ? fmt(mediaFee) : "—"}</span>
              </div>

              {adMode === "cinema" && hasSelection && (
                <>
                  <div className="flex justify-between text-xs">
                    <span className="text-zinc-500">DCP変換費</span>
                    <span className="font-medium">{fmt(dcpTotal)}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-zinc-500">
                      配信費
                      <span className="text-zinc-400 ml-1">
                        {selectedList.length <= 5 ? "（一律）" : `（¥6,000×${selectedList.length}）`}
                      </span>
                    </span>
                    <span className="font-medium">{fmt(delivTotal)}</span>
                  </div>
                </>
              )}

              <div className="border-t border-zinc-100 pt-2">
                <div className="flex justify-between text-xs font-semibold text-zinc-700">
                  <span>定価合計</span>
                  <span>
                    {hasSelection
                      ? fmt(mediaFee + dcpTotal + delivTotal)
                      : "—"}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Ad-Arch価格 */}
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-blue-800 mb-3">Ad-Arch 提示価格</h3>
            <div className="space-y-3">
              {/* クライアント価格 */}
              <div className="bg-white rounded-lg p-3 border border-blue-100">
                <p className="text-[10px] text-zinc-500 mb-0.5">クライアント提示（管理費込）</p>
                <p className="text-xl font-bold text-zinc-900">
                  {hasSelection ? fmt(clientPrice) : "—"}
                </p>
                <p className="text-[10px] text-zinc-400 mt-0.5">
                  媒体費×1.2 + DCP/配信費
                </p>
              </div>

              {/* 仕入れ価格 */}
              <div className="bg-white rounded-lg p-3 border border-blue-100">
                <p className="text-[10px] text-zinc-500 mb-0.5">仕入れ価格（参考）</p>
                <p className="text-lg font-bold text-zinc-700">
                  {hasSelection ? fmt(purchasePrice) : "—"}
                </p>
                <p className="text-[10px] text-zinc-400 mt-0.5">
                  媒体費×0.8 + DCP/配信費
                </p>
              </div>

              {/* 粗利 */}
              {hasSelection && (
                <div className="bg-emerald-50 rounded-lg p-3 border border-emerald-100">
                  <p className="text-[10px] text-emerald-600 mb-0.5">粗利（参考）</p>
                  <p className="text-base font-bold text-emerald-700">{fmt(margin)}</p>
                  <p className="text-[10px] text-emerald-500 mt-0.5">
                    媒体費の40%
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* 備考 */}
          <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-3">
            <p className="text-[10px] text-zinc-500 font-semibold mb-1">備考</p>
            <ul className="text-[10px] text-zinc-500 space-y-0.5 list-disc list-inside">
              <li>上記金額は消費税抜きです</li>
              <li>料金表は2025年10月改定（25-4）</li>
              {adMode === "cinema" && (
                <>
                  <li>1週間上映：2週間料金の60%</li>
                  <li>45秒/60秒：15秒料金の倍数</li>
                  <li>プレアド：15秒料金の30%（全作品上映のみ）</li>
                </>
              )}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
