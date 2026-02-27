"use client";

import { useState, useMemo } from "react";
import { RotateCcw, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";

// ================================================================
// 型・定数
// ================================================================

type RegularMenu = "none" | "video15" | "video30" | "still15";
type FrontNavi   = "none" | "still"   | "video";

const REGULAR_MENU: { id: RegularMenu; label: string; price: number; impressions: number }[] = [
  { id: "none",    label: "なし",       price: 0,         impressions: 0 },
  { id: "video15", label: "動画15秒",   price: 1_300_000, impressions: 580_000 },
  { id: "video30", label: "動画30秒",   price: 2_000_000, impressions: 580_000 },
  { id: "still15", label: "静止画15秒", price:   500_000, impressions: 580_000 },
];

interface Course { key: string; name: string; carts: number; holes: number }
interface PrefGroup { pref: string; courses: Course[] }

const GOLF_COURSES: PrefGroup[] = [
  { pref: "東京", courses: [
    { key: "t0", name: "立川国際カントリー倶楽部",                carts: 100, holes: 36 },
    { key: "t1", name: "多摩カントリークラブ",                    carts: 60,  holes: 18 },
    { key: "t2", name: "東京相武カントリークラブ（アコーディア）", carts: 60,  holes: 18 },
  ]},
  { pref: "神奈川", courses: [
    { key: "ka0", name: "相模野カントリークラブ",                          carts: 90,  holes: 27 },
    { key: "ka1", name: "葉山国際カンツリー倶楽部",                        carts: 110, holes: 36 },
    { key: "ka2", name: "小田原ゴルフ倶楽部 松田コース（アコーディア）",   carts: 70,  holes: 18 },
    { key: "ka3", name: "大厚木カントリークラブ 桜コース（アコーディア）", carts: 75,  holes: 18 },
    { key: "ka4", name: "大厚木カントリークラブ 本コース（アコーディア）", carts: 98,  holes: 27 },
  ]},
  { pref: "埼玉", courses: [
    { key: "sa0", name: "大麻生ゴルフ場",                          carts: 65, holes: 18 },
    { key: "sa1", name: "岡部チサンCC岡部コース（PGM）",           carts: 58, holes: 18 },
    { key: "sa2", name: "上里ゴルフ場",                            carts: 60, holes: 18 },
    { key: "sa3", name: "富貴ゴルフ倶楽部（PGM）",                carts: 60, holes: 18 },
    { key: "sa4", name: "吉見ゴルフ場",                            carts: 90, holes: 27 },
    { key: "sa5", name: "川越カントリークラブ",                    carts: 85, holes: 27 },
    { key: "sa6", name: "秩父国際カントリークラブ（アコーディア）", carts: 95, holes: 18 },
  ]},
  { pref: "山梨", courses: [
    { key: "ya0", name: "大月カントリークラブ", carts: 55, holes: 18 },
    { key: "ya1", name: "西東京ゴルフ倶楽部",  carts: 56, holes: 18 },
  ]},
  { pref: "群馬", courses: [
    { key: "gu0", name: "赤城カントリー倶楽部",                     carts: 55,  holes: 18 },
    { key: "gu1", name: "赤城国際カントリークラブ",                  carts: 90,  holes: 27 },
    { key: "gu2", name: "伊香保ゴルフ倶楽部",                       carts: 80,  holes: 27 },
    { key: "gu3", name: "梅ノ郷ゴルフ倶楽部",                       carts: 57,  holes: 18 },
    { key: "gu4", name: "小幡郷ゴルフ倶楽部",                       carts: 60,  holes: 18 },
    { key: "gu5", name: "関越ハイランドゴルフクラブ（アコーディア）", carts: 101, holes: 27 },
    { key: "gu6", name: "藤岡ゴルフクラブ（アコーディア）",          carts: 125, holes: 36 },
    { key: "gu7", name: "新玉村ゴルフ場",                            carts: 70,  holes: 18 },
  ]},
  { pref: "千葉", courses: [
    { key: "ch0",  name: "ABCいずみゴルフコース",                       carts: 50,  holes: 18 },
    { key: "ch1",  name: "CPGカントリークラブ",                         carts: 60,  holes: 18 },
    { key: "ch2",  name: "市原京急カントリークラブ",                    carts: 55,  holes: 18 },
    { key: "ch3",  name: "大多喜城ゴルフ倶楽部",                       carts: 82,  holes: 27 },
    { key: "ch4",  name: "大原・御宿ゴルフコース",                     carts: 56,  holes: 18 },
    { key: "ch5",  name: "勝浦ゴルフ倶楽部",                           carts: 85,  holes: 27 },
    { key: "ch6",  name: "上総富士ゴルフクラブ",                       carts: 85,  holes: 27 },
    { key: "ch7",  name: "鎌ヶ谷カントリークラブ",                     carts: 75,  holes: 27 },
    { key: "ch8",  name: "木更津ゴルフクラブ",                         carts: 50,  holes: 18 },
    { key: "ch9",  name: "コスモクラシッククラブ",                     carts: 60,  holes: 18 },
    { key: "ch10", name: "ゴルフ5カントリーオークビレッヂ",            carts: 48,  holes: 18 },
    { key: "ch11", name: "ゴルフ倶楽部成田ハイツリー",                carts: 50,  holes: 18 },
    { key: "ch12", name: "山武グリーンカントリー倶楽部",              carts: 50,  holes: 18 },
    { key: "ch13", name: "東庄ゴルフ倶楽部",                          carts: 58,  holes: 18 },
    { key: "ch14", name: "成田ビルズカントリークラブ",                carts: 48,  holes: 18 },
    { key: "ch15", name: "南総カントリークラブ",                       carts: 101, holes: 36 },
    { key: "ch16", name: "船橋カントリークラブ",                       carts: 55,  holes: 18 },
    { key: "ch17", name: "ベルセルバ カントリークラブ 市原コース",    carts: 80,  holes: 27 },
    { key: "ch18", name: "丸の内倶楽部（PGM）",                        carts: 65,  holes: 18 },
    { key: "ch19", name: "四街道ゴルフ倶楽部（アコーディア）",        carts: 62,  holes: 18 },
    { key: "ch20", name: "千葉桜の里ゴルフクラブ（アコーディア）",    carts: 68,  holes: 18 },
    { key: "ch21", name: "東京湾カントリークラブ（アコーディア）",    carts: 105, holes: 27 },
    { key: "ch22", name: "成田東カントリークラブ（アコーディア）",    carts: 63,  holes: 18 },
    { key: "ch23", name: "鹿野山ゴルフ倶楽部",                        carts: 75,  holes: 27 },
    { key: "ch24", name: "カメリアヒルズカントリークラブ",            carts: 45,  holes: 18 },
    { key: "ch25", name: "ニュー南総ゴルフ倶楽部（アコーディア）",   carts: 60,  holes: 18 },
    { key: "ch26", name: "アクアラインゴルフクラブ（アコーディア）",  carts: 81,  holes: 18 },
  ]},
  { pref: "栃木", courses: [
    { key: "to0",  name: "G7カントリー倶楽部",                            carts: 60,  holes: 18 },
    { key: "to1",  name: "イーストウッドカントリークラブ",                carts: 42,  holes: 18 },
    { key: "to2",  name: "烏山城カントリークラブ",                        carts: 80,  holes: 27 },
    { key: "to3",  name: "鬼怒川カントリークラブ",                        carts: 52,  holes: 18 },
    { key: "to4",  name: "佐野ゴルフクラブ",                              carts: 130, holes: 36 },
    { key: "to5",  name: "塩原カントリークラブ",                          carts: 75,  holes: 27 },
    { key: "to6",  name: "東雲ゴルフクラブ",                              carts: 49,  holes: 18 },
    { key: "to7",  name: "新宇都宮カントリークラブ",                      carts: 80,  holes: 27 },
    { key: "to8",  name: "セブンハンドレッドクラブ",                      carts: 56,  holes: 18 },
    { key: "to9",  name: "千成ゴルフクラブ（PGM）",                       carts: 63,  holes: 18 },
    { key: "to10", name: "鷹ゴルフ倶楽部",                                carts: 50,  holes: 18 },
    { key: "to11", name: "東松苑ゴルフ倶楽部",                            carts: 48,  holes: 18 },
    { key: "to12", name: "栃木カントリークラブ",                          carts: 80,  holes: 27 },
    { key: "to13", name: "馬頭ゴルフ倶楽部",                              carts: 47,  holes: 18 },
    { key: "to14", name: "ビートダイゴルフクラブ VIPコース（PGM）",      carts: 64,  holes: 18 },
    { key: "to15", name: "ビートダイゴルフクラブ ロイヤルコース（PGM）", carts: 63,  holes: 18 },
    { key: "to16", name: "ひとどのやカントリー倶楽部（アコーディア）",   carts: 67,  holes: 18 },
    { key: "to17", name: "鳳月カントリー倶楽部",                          carts: 81,  holes: 27 },
    { key: "to18", name: "ベルセルバカントリークラブ さくらコース",      carts: 49,  holes: 18 },
    { key: "to19", name: "ロイヤルメドウゴルフ倶楽部",                   carts: 53,  holes: 18 },
    { key: "to20", name: "矢板カントリークラブ",                          carts: 80,  holes: 27 },
    { key: "to21", name: "関東国際カントリークラブ（アコーディア）",     carts: 95,  holes: 27 },
  ]},
  { pref: "茨城", courses: [
    { key: "ib0",  name: "阿見ゴルフクラブ（PGM）",                      carts: 60,  holes: 18 },
    { key: "ib1",  name: "浅見ゴルフ倶楽部",                             carts: 92,  holes: 27 },
    { key: "ib2",  name: "茨城パシフィックカントリークラブ",             carts: 40,  holes: 18 },
    { key: "ib3",  name: "茨城ロイヤルカントリークラブ",                 carts: 60,  holes: 18 },
    { key: "ib4",  name: "江戸崎カントリー倶楽部",                       carts: 75,  holes: 18 },
    { key: "ib5",  name: "オールドオーチャードゴルフクラブ（PGM）",     carts: 60,  holes: 18 },
    { key: "ib6",  name: "勝田ゴルフ倶楽部（PGM）",                      carts: 63,  holes: 18 },
    { key: "ib7",  name: "ゴルフ5カントリーかさまフォレスト",           carts: 53,  holes: 18 },
    { key: "ib8",  name: "ゴルフ5カントリーサニーフィールド",           carts: 50,  holes: 18 },
    { key: "ib9",  name: "ゴルフ倶楽部セブンレイクス",                  carts: 56,  holes: 18 },
    { key: "ib10", name: "ザ・オーシャンゴルフクラブ",                  carts: 55,  holes: 18 },
    { key: "ib11", name: "サザンヤードカントリークラブ",                carts: 50,  holes: 18 },
    { key: "ib12", name: "ジェイゴルフ霞ヶ浦",                          carts: 60,  holes: 18 },
    { key: "ib13", name: "スプリングフィルズゴルフクラブ（PGM）",      carts: 62,  holes: 18 },
    { key: "ib14", name: "ロックヒルゴルフクラブ",                      carts: 110, holes: 36 },
    { key: "ib15", name: "ワンウェイゴルフクラブ",                      carts: 52,  holes: 18 },
    { key: "ib16", name: "スターツ笠間ゴルフ倶楽部",                   carts: 40,  holes: 18 },
    { key: "ib17", name: "東筑波カントリークラブ（アコーディア）",     carts: 75,  holes: 27 },
    { key: "ib18", name: "土浦カントリー倶楽部（アコーディア）",       carts: 105, holes: 27 },
    { key: "ib19", name: "桜の宮ゴルフクラブ",                          carts: 63,  holes: 18 },
  ]},
  { pref: "その他", courses: [
    { key: "ot0", name: "五浦荘園カントリー倶楽部（福島）", carts: 50,  holes: 18 },
    { key: "ot1", name: "富士竜坂36ゴルフクラブ（静岡）",  carts: 100, holes: 36 },
  ]},
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
// メインコンポーネント
// ================================================================

export function GolfcartSimulator() {
  const [weeks, setWeeks] = useState(4);
  const [regularAds, setRegularAds] = useState<RegularMenu>("none");
  const [selectedCourses, setSelectedCourses] = useState<Set<string>>(new Set());
  const [expandedPrefs, setExpandedPrefs] = useState<Set<string>>(new Set());
  const [contentMenu, setContentMenu] = useState<"none" | "weekly" | "pack4w">("none");
  const [tieup, setTieup] = useState(false);
  const [frontNavi, setFrontNavi] = useState<FrontNavi>("none");
  const [sampling, setSampling] = useState(false);
  const [samplingQty, setSamplingQty] = useState(2400);
  const [research, setResearch] = useState(false);

  // ----------------------------------------------------------------
  // ヘルパー
  // ----------------------------------------------------------------

  const toggleCourse = (key: string) => {
    setSelectedCourses((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const togglePref = (pref: string) => {
    setExpandedPrefs((prev) => {
      const next = new Set(prev);
      next.has(pref) ? next.delete(pref) : next.add(pref);
      return next;
    });
  };

  const toggleAllInPref = (group: PrefGroup) => {
    const allKeys = group.courses.map((c) => c.key);
    const allSelected = allKeys.every((k) => selectedCourses.has(k));
    setSelectedCourses((prev) => {
      const next = new Set(prev);
      if (allSelected) {
        allKeys.forEach((k) => next.delete(k));
      } else {
        allKeys.forEach((k) => next.add(k));
      }
      return next;
    });
  };

  const reset = () => {
    setWeeks(4);
    setRegularAds("none");
    setSelectedCourses(new Set());
    setExpandedPrefs(new Set());
    setContentMenu("none");
    setTieup(false);
    setFrontNavi("none");
    setSampling(false);
    setSamplingQty(2400);
    setResearch(false);
  };

  // ----------------------------------------------------------------
  // 計算
  // ----------------------------------------------------------------

  const calc = useMemo(() => {
    type Row = { label: string; unitPrice: number; w: number; total: number; impressions: number };
    const rows: Row[] = [];
    const add = (label: string, unitPrice: number, w: number, impressions: number) =>
      rows.push({ label, unitPrice, w, total: unitPrice * w, impressions: impressions * w });

    // Regular Ads
    const rm = REGULAR_MENU.find((m) => m.id === regularAds);
    if (rm && rm.id !== "none") {
      add(`Regular Ads ${rm.label}`, rm.price, weeks, rm.impressions);
    }

    // Select Ads
    if (selectedCourses.size > 0) {
      add(`Select Ads（${selectedCourses.size}ゴルフ場）`, selectedCourses.size * 50_000, weeks, 0);
    }

    // GolfBrand Contents
    if (contentMenu === "weekly") {
      add("GolfBrand Contents（1週間）", 200_000, weeks, 580_000);
    } else if (contentMenu === "pack4w") {
      rows.push({ label: "GolfBrand Contents（4週間パック）", unitPrice: 600_000, w: 1, total: 600_000, impressions: 2_320_000 });
    }

    // タイアップコンテンツ
    if (tieup) {
      add("タイアップコンテンツ", 500_000, weeks, 580_000);
    }

    // 前ナビ広告配信
    if (frontNavi === "still") {
      add("前ナビ広告配信（静止画15秒）", 340_000, weeks, 5_900);
    } else if (frontNavi === "video") {
      add("前ナビ広告配信（動画15秒）", 800_000, weeks, 5_900);
    }

    // ゴルフ場サンプリング
    if (sampling) {
      const qty = Math.max(2400, samplingQty);
      rows.push({ label: `ゴルフ場サンプリング（${qty.toLocaleString()}個）`, unitPrice: qty * 80, w: 1, total: qty * 80, impressions: 0 });
    }

    // マーケティングリサーチ
    if (research) {
      rows.push({ label: "マーケティングリサーチ", unitPrice: 600_000, w: 1, total: 600_000, impressions: 0 });
    }

    const mediaCost        = rows.reduce((s, r) => s + r.total, 0);
    const totalImpressions = rows.reduce((s, r) => s + r.impressions, 0);
    return { rows, mediaCost, totalImpressions };
  }, [weeks, regularAds, selectedCourses, contentMenu, tieup, frontNavi, sampling, samplingQty, research]);

  // ================================================================
  // レンダリング
  // ================================================================

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[1fr_380px] gap-4 items-start">

      {/* ===== 左: 設定パネル ===== */}
      <div className="space-y-4">

        {/* 掲載週数 */}
        <div className="bg-white rounded-xl border border-zinc-200 p-4 space-y-3">
          <p className="text-xs font-bold text-zinc-700">掲載週数</p>
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
          <p className="text-[10px] text-zinc-400">※ 掲載は毎週月曜日開始。4週間パックは週数に関わらず固定価格。</p>
        </div>

        {/* 広告枠 - Regular Ads */}
        <div className="bg-white rounded-xl border border-zinc-200 p-4 space-y-3">
          <div>
            <p className="text-xs font-bold text-zinc-700">広告枠 — Regular Ads</p>
            <p className="text-[11px] text-zinc-400 mt-0.5">全96ゴルフ場 / 約6,500台 / 月間リーチ約427,000人</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {REGULAR_MENU.map((m) => (
              <button
                key={m.id}
                onClick={() => setRegularAds(m.id)}
                className={cn(
                  "px-3 py-2 rounded-lg border text-[11px] transition-colors text-center min-w-[76px]",
                  regularAds === m.id
                    ? "bg-zinc-800 text-white border-zinc-800"
                    : "border-zinc-200 text-zinc-600 hover:bg-zinc-50"
                )}
              >
                <div className="font-semibold">{m.label}</div>
                {m.id !== "none" && (
                  <div className="text-[9px] opacity-70 mt-0.5">{fmt(m.price)}/週</div>
                )}
              </button>
            ))}
          </div>
          {regularAds !== "none" && (
            <p className="text-[10px] text-zinc-400">想定視聴数: 約580,000回/週（3枠）</p>
          )}
        </div>

        {/* 広告枠 - Select Ads */}
        <div className="bg-white rounded-xl border border-zinc-200 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-zinc-700">広告枠 — Select Ads</p>
              <p className="text-[11px] text-zinc-400 mt-0.5">50,000円/ゴルフ場/週 / 最低6場（30万円）/ 5枠/週</p>
            </div>
            {selectedCourses.size > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-emerald-600">{selectedCourses.size}場選択中</span>
                <button
                  onClick={() => setSelectedCourses(new Set())}
                  className="text-[10px] text-zinc-400 hover:text-red-500 transition-colors"
                >
                  全解除
                </button>
              </div>
            )}
          </div>

          {selectedCourses.size > 0 && selectedCourses.size < 6 && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              <p className="text-[11px] text-amber-700">最低出稿は6ゴルフ場（300,000円/週）以上です</p>
            </div>
          )}

          <div className="space-y-1">
            {GOLF_COURSES.map((group) => {
              const isExpanded = expandedPrefs.has(group.pref);
              const selectedInPref = group.courses.filter((c) => selectedCourses.has(c.key)).length;
              const allSelected = selectedInPref === group.courses.length;

              return (
                <div key={group.pref} className="border border-zinc-100 rounded-lg overflow-hidden">
                  <div className="flex items-center justify-between px-3 py-2 bg-zinc-50">
                    <button
                      onClick={() => togglePref(group.pref)}
                      className="flex items-center gap-2 flex-1 text-left"
                    >
                      <span className="text-xs font-semibold text-zinc-700">{group.pref}</span>
                      <span className="text-[10px] text-zinc-400">{group.courses.length}場</span>
                      {selectedInPref > 0 && (
                        <span className="text-[10px] font-bold text-emerald-600">{selectedInPref}場選択</span>
                      )}
                      {isExpanded
                        ? <ChevronUp className="w-3.5 h-3.5 text-zinc-400 ml-auto" />
                        : <ChevronDown className="w-3.5 h-3.5 text-zinc-400 ml-auto" />
                      }
                    </button>
                    <button
                      onClick={() => toggleAllInPref(group)}
                      className={cn(
                        "ml-2 text-[10px] px-2 py-0.5 rounded border transition-colors flex-shrink-0",
                        allSelected
                          ? "bg-zinc-800 text-white border-zinc-800"
                          : "border-zinc-300 text-zinc-500 hover:bg-zinc-100"
                      )}
                    >
                      {allSelected ? "全解除" : "全選択"}
                    </button>
                  </div>

                  {isExpanded && (
                    <div className="px-3 py-2 grid grid-cols-1 sm:grid-cols-2 gap-0.5">
                      {group.courses.map((course) => {
                        const checked = selectedCourses.has(course.key);
                        return (
                          <label
                            key={course.key}
                            className={cn(
                              "flex items-center gap-2 px-2 py-1.5 rounded-md text-xs cursor-pointer transition-colors",
                              checked
                                ? "bg-emerald-50 text-emerald-800"
                                : "hover:bg-zinc-50 text-zinc-600"
                            )}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleCourse(course.key)}
                              className="w-3.5 h-3.5 accent-emerald-600 flex-shrink-0"
                            />
                            <span className="flex-1 min-w-0 truncate">{course.name}</span>
                            <span className="text-[9px] text-zinc-400 flex-shrink-0">{course.carts}台</span>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* コンテンツ枠 */}
        <div className="bg-white rounded-xl border border-zinc-200 p-4 space-y-4">
          <p className="text-xs font-bold text-zinc-700">コンテンツ枠</p>

          {/* GolfBrand Contents */}
          <div>
            <p className="text-[11px] font-semibold text-zinc-500 mb-1.5">GolfBrand Contents</p>
            <div className="flex flex-wrap gap-2">
              {[
                { id: "none"   as const, label: "なし",         sub: "" },
                { id: "weekly" as const, label: "1週間",         sub: "20万/週" },
                { id: "pack4w" as const, label: "4週間パック",   sub: "60万（固定）" },
              ].map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => setContentMenu(opt.id)}
                  className={cn(
                    "px-3 py-2 rounded-lg border text-[11px] transition-colors text-center min-w-[84px]",
                    contentMenu === opt.id
                      ? "bg-zinc-800 text-white border-zinc-800"
                      : "border-zinc-200 text-zinc-600 hover:bg-zinc-50"
                  )}
                >
                  <div className="font-semibold">{opt.label}</div>
                  {opt.sub && <div className="text-[9px] opacity-70 mt-0.5">{opt.sub}</div>}
                </button>
              ))}
            </div>
            {contentMenu !== "none" && (
              <p className="text-[10px] text-zinc-400 mt-1.5">
                想定視聴数: {contentMenu === "pack4w" ? "約2,320,000回（4週）" : "約580,000回/週（3枠）"}
              </p>
            )}
          </div>

          {/* タイアップコンテンツ */}
          <div>
            <p className="text-[11px] font-semibold text-zinc-500 mb-1.5">タイアップコンテンツ</p>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={tieup}
                onChange={(e) => setTieup(e.target.checked)}
                className="w-4 h-4 accent-zinc-700"
              />
              <span className="text-xs text-zinc-600">タイアップコンテンツ</span>
              <span className="text-[10px] text-zinc-400">50万/週・約580,000回（3枠）</span>
            </label>
          </div>
        </div>

        {/* オプション */}
        <div className="bg-white rounded-xl border border-zinc-200 p-4 space-y-4">
          <p className="text-xs font-bold text-zinc-700">オプション</p>

          {/* 前ナビ広告配信 */}
          <div>
            <p className="text-[11px] font-semibold text-zinc-500 mb-0.5">前ナビ広告配信</p>
            <p className="text-[10px] text-zinc-400 mb-1.5">34ゴルフ場 / 約2,200台 限定 / 音声あり可 / 約5,900回/週</p>
            <div className="flex flex-wrap gap-2">
              {[
                { id: "none"  as FrontNavi, label: "なし",            sub: "" },
                { id: "still" as FrontNavi, label: "静止画（15秒）",  sub: "34万/週" },
                { id: "video" as FrontNavi, label: "動画（15秒）",    sub: "80万/週" },
              ].map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => setFrontNavi(opt.id)}
                  className={cn(
                    "px-3 py-2 rounded-lg border text-[11px] transition-colors text-center min-w-[84px]",
                    frontNavi === opt.id
                      ? "bg-zinc-800 text-white border-zinc-800"
                      : "border-zinc-200 text-zinc-600 hover:bg-zinc-50"
                  )}
                >
                  <div className="font-semibold">{opt.label}</div>
                  {opt.sub && <div className="text-[9px] opacity-70 mt-0.5">{opt.sub}</div>}
                </button>
              ))}
            </div>
          </div>

          {/* ゴルフ場サンプリング */}
          <div>
            <label className="flex items-center gap-2 cursor-pointer mb-2">
              <input
                type="checkbox"
                checked={sampling}
                onChange={(e) => setSampling(e.target.checked)}
                className="w-4 h-4 accent-zinc-700"
              />
              <span className="text-xs text-zinc-600">ゴルフ場サンプリング</span>
              <span className="text-[10px] text-zinc-400">@80円 / 最低2,400個〜</span>
            </label>
            {sampling && (
              <div className="flex items-center gap-2 pl-6">
                <input
                  type="number"
                  min={2400}
                  step={100}
                  value={samplingQty}
                  onChange={(e) => setSamplingQty(Math.max(2400, Number(e.target.value)))}
                  className="w-24 px-2 py-1 text-xs text-center border border-zinc-200 rounded-lg outline-none focus:border-blue-400"
                />
                <span className="text-xs text-zinc-500">個</span>
                <span className="text-[10px] text-zinc-400">= {fmt(Math.max(2400, samplingQty) * 80)}</span>
              </div>
            )}
          </div>

          {/* マーケティングリサーチ */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={research}
              onChange={(e) => setResearch(e.target.checked)}
              className="w-4 h-4 accent-zinc-700"
            />
            <span className="text-xs text-zinc-600">マーケティングリサーチ</span>
            <span className="text-[10px] text-zinc-400">60万円</span>
          </label>
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

              {/* 価格サマリー */}
              <div className="space-y-1.5">
                <div className="bg-zinc-800 rounded-lg px-3 py-2.5 flex items-center justify-between">
                  <div>
                    <p className="text-[10px] text-zinc-400 font-semibold">定価（税抜）</p>
                    <p className="text-[9px] text-zinc-600">税込: {fmt(Math.round(calc.mediaCost * 1.10))}</p>
                  </div>
                  <span className="text-base font-bold text-zinc-200 tabular-nums">{fmt(calc.mediaCost)}</span>
                </div>

                <div className="bg-zinc-800 rounded-lg px-3 py-2.5 flex items-center justify-between">
                  <div>
                    <p className="text-[10px] text-zinc-400 font-semibold">仕入れ価格</p>
                    <p className="text-[9px] text-zinc-600">定価 × 85%（−15%）</p>
                  </div>
                  <span className="text-base font-bold text-blue-300 tabular-nums">{fmt(Math.round(calc.mediaCost * 0.85))}</span>
                </div>

                <div className="bg-zinc-700/60 rounded-lg px-3 py-3 flex items-center justify-between">
                  <div>
                    <p className="text-xs text-zinc-300 font-bold">提案価格</p>
                    <p className="text-[9px] text-zinc-500">定価 × 120%（+20%）</p>
                  </div>
                  <span className="text-xl font-bold text-yellow-300 tabular-nums">{fmt(Math.round(calc.mediaCost * 1.20))}</span>
                </div>
              </div>

              {calc.totalImpressions > 0 && (
                <div className="flex items-center justify-between text-[10px] px-1">
                  <span className="text-zinc-500">想定インプレッション合計</span>
                  <span className="text-emerald-400 font-semibold tabular-nums">{fmtImp(calc.totalImpressions)}</span>
                </div>
              )}

              <p className="text-[10px] text-zinc-600 text-center">
                ※ 価格はすべて税抜。インプレッション数は目安値です。
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
