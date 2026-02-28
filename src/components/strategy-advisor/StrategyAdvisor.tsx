"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import {
  Sparkles,
  ChevronRight,
  ChevronLeft,
  Loader2,
  RefreshCw,
  ExternalLink,
  CheckCircle2,
  TrendingUp,
  Calendar,
  Lightbulb,
  ArrowUpCircle,
} from "lucide-react";
import { MEDIA_MATRIX, type MediaId } from "@/lib/strategy-matrix";
import { cn } from "@/lib/utils";

// ----------------------------------------------------------------
// 型定義
// ----------------------------------------------------------------
interface RecommendedPlan {
  mediaId: MediaId;
  rank: number;
  allocatedBudget: number;
  reason: string;
  expectedEffect: string;
  crossEffect?: string;
}

interface AIResult {
  recommendedPlans: RecommendedPlan[];
  schedule: {
    week1_2: string;
    week3_6: string;
    week7_8: string;
  };
  upsellAdvice: string;
  budgetAdvice: string;
  summary: string;
}

interface FormState {
  gender: string;
  ageRange: string[];
  layer: string;
  inbound: string;
  purposes: string[];
  region: string;
  regionDetail: string;
  budget: string;
}

// ----------------------------------------------------------------
// 定数
// ----------------------------------------------------------------
const STEPS = ["ターゲット属性", "主要目的", "実施地域", "予算", "確認"];

const GENDER_OPTIONS = [
  { value: "both", label: "両性（男女共通）" },
  { value: "male", label: "男性メイン" },
  { value: "female", label: "女性メイン" },
];

const AGE_OPTIONS = ["10代", "20代", "30代", "40代", "50代", "60代以上"];

const LAYER_OPTIONS = [
  { value: "general", label: "一般消費者" },
  { value: "business", label: "ビジネス層（会社員・経営者）" },
  { value: "both", label: "どちらも" },
];

const INBOUND_OPTIONS = [
  { value: "none", label: "国内のみ" },
  { value: "include", label: "インバウンドも含む" },
  { value: "main", label: "インバウンドがメイン" },
];

const PURPOSE_OPTIONS = [
  { value: "認知拡大", label: "認知拡大", desc: "まずブランドを知ってもらう" },
  { value: "理解促進", label: "理解促進", desc: "商品・サービスの内容を伝える" },
  { value: "来店・販売促進", label: "来店・販売促進", desc: "行動・購買に繋げる" },
  { value: "ブランドリフト", label: "ブランドリフト", desc: "ブランドイメージを向上させる" },
  { value: "採用", label: "採用", desc: "求職者・学生へのリーチ" },
];

const REGION_OPTIONS = [
  { value: "nationwide", label: "全国" },
  { value: "regional", label: "エリア指定（関東・関西など）" },
  { value: "municipal", label: "市区町村単位" },
];

const REGION_DETAIL_OPTIONS = [
  "関東", "関西", "東海", "北海道", "東北", "九州", "中国", "四国", "沖縄",
];

const BUDGET_PRESETS = [
  { label: "〜50万円", value: "500000" },
  { label: "50〜100万円", value: "1000000" },
  { label: "100〜300万円", value: "2000000" },
  { label: "300〜500万円", value: "4000000" },
  { label: "500万円〜", value: "6000000" },
];

const RANK_COLORS = [
  "bg-amber-400 text-white",
  "bg-zinc-400 text-white",
  "bg-orange-300 text-white",
];

// ----------------------------------------------------------------
// ユーティリティ
// ----------------------------------------------------------------
function formatBudget(yen: number): string {
  const man = yen / 10_000;
  return man >= 10_000
    ? `${(man / 10_000).toFixed(1)}億円`
    : `${man % 1 === 0 ? man.toFixed(0) : man.toFixed(1)}万円`;
}

// ----------------------------------------------------------------
// サブコンポーネント: ステップインジケーター
// ----------------------------------------------------------------
function StepIndicator({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center gap-1.5 mb-6">
      {STEPS.map((label, i) => (
        <div key={i} className="flex items-center gap-1.5">
          <div
            className={cn(
              "flex items-center justify-center w-6 h-6 rounded-full text-[11px] font-bold transition-all",
              i < current
                ? "bg-blue-600 text-white"
                : i === current
                ? "bg-blue-600 text-white ring-4 ring-blue-100"
                : "bg-zinc-100 text-zinc-400"
            )}
          >
            {i < current ? <CheckCircle2 className="w-3.5 h-3.5" /> : i + 1}
          </div>
          <span
            className={cn(
              "text-[11px] font-medium hidden sm:inline",
              i === current ? "text-blue-600" : "text-zinc-400"
            )}
          >
            {label}
          </span>
          {i < total - 1 && (
            <div
              className={cn(
                "w-6 h-px mx-0.5",
                i < current ? "bg-blue-600" : "bg-zinc-200"
              )}
            />
          )}
        </div>
      ))}
    </div>
  );
}

// ----------------------------------------------------------------
// サブコンポーネント: 選択ボタン
// ----------------------------------------------------------------
function SelectButton({
  selected,
  onClick,
  children,
  className,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "px-3 py-2 rounded-lg border text-sm transition-all text-left",
        selected
          ? "border-blue-500 bg-blue-50 text-blue-700 font-medium"
          : "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300 hover:bg-zinc-50",
        className
      )}
    >
      {children}
    </button>
  );
}

// ----------------------------------------------------------------
// サブコンポーネント: メディアカード（結果表示）
// ----------------------------------------------------------------
function MediaResultCard({ plan }: { plan: RecommendedPlan }) {
  const media = MEDIA_MATRIX[plan.mediaId];
  if (!media) return null;

  const simulatorUrl = `${media.simulatorPath}?budget=${plan.allocatedBudget}`;

  return (
    <div className="bg-white rounded-xl border border-zinc-200 p-5 space-y-3">
      {/* ヘッダー */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="text-2xl">{media.emoji}</span>
          <div>
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "text-[10px] font-bold px-1.5 py-0.5 rounded",
                  RANK_COLORS[(plan.rank - 1) % 3]
                )}
              >
                第{plan.rank}推奨
              </span>
            </div>
            <p className="text-sm font-bold text-zinc-900 mt-0.5">{media.name}</p>
          </div>
        </div>
        <div className="text-right flex-shrink-0">
          <p className="text-[10px] text-zinc-400">推奨配分予算</p>
          <p className="text-lg font-bold text-blue-700">
            {formatBudget(plan.allocatedBudget)}
          </p>
        </div>
      </div>

      {/* 理由 */}
      <div className="bg-zinc-50 rounded-lg p-3 space-y-2">
        <div>
          <p className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wide mb-1">
            選定理由
          </p>
          <p className="text-xs text-zinc-700 leading-relaxed">{plan.reason}</p>
        </div>
        <div>
          <p className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wide mb-1">
            期待効果
          </p>
          <p className="text-xs text-zinc-700 leading-relaxed">{plan.expectedEffect}</p>
        </div>
        {plan.crossEffect && (
          <div>
            <p className="text-[11px] font-semibold text-blue-500 uppercase tracking-wide mb-1">
              クロスリレーション効果
            </p>
            <p className="text-xs text-blue-700 leading-relaxed">{plan.crossEffect}</p>
          </div>
        )}
      </div>

      {/* 媒体の強み */}
      <div className="flex flex-wrap gap-1.5">
        {media.strengths.map((s) => (
          <span
            key={s}
            className="text-[10px] px-2 py-0.5 bg-blue-50 text-blue-600 rounded-full border border-blue-100"
          >
            {s}
          </span>
        ))}
      </div>

      {/* シミュレーターリンク or 別途見積もり */}
      {media.simulatorPath ? (
        <Link
          href={simulatorUrl}
          className="flex items-center justify-center gap-2 w-full px-4 py-2.5 bg-blue-600
                     text-white text-xs font-semibold rounded-lg hover:bg-blue-700 transition-colors"
        >
          <ExternalLink className="w-3.5 h-3.5" />
          このプランで詳細見積もりを作る →
        </Link>
      ) : (
        <div className="flex items-center justify-center gap-2 w-full px-4 py-2.5
                        bg-zinc-50 border border-zinc-200 text-zinc-500 text-xs font-medium rounded-lg">
          別途お見積もり対応（担当者にご相談ください）
        </div>
      )}
    </div>
  );
}

// ----------------------------------------------------------------
// メインコンポーネント
// ----------------------------------------------------------------
export function StrategyAdvisor() {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormState>({
    gender: "both",
    ageRange: [],
    layer: "general",
    inbound: "none",
    purposes: [],
    region: "nationwide",
    regionDetail: "",
    budget: "",
  });
  const [isLoading, setIsLoading] = useState(false);
  const [streamText, setStreamText] = useState("");
  const [result, setResult] = useState<AIResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // ---- フォーム操作 ----
  const toggleMulti = (key: "ageRange" | "purposes", val: string) => {
    setForm((prev) => {
      const arr = prev[key];
      return {
        ...prev,
        [key]: arr.includes(val) ? arr.filter((v) => v !== val) : [...arr, val],
      };
    });
  };

  // ---- バリデーション ----
  const canNext = () => {
    if (step === 1 && form.purposes.length === 0) return false;
    return true;
  };

  // ---- AI 呼び出し ----
  const handleSubmit = async () => {
    setIsLoading(true);
    setStreamText("");
    setResult(null);
    setError(null);
    abortRef.current?.abort();
    abortRef.current = new AbortController();

    const budgetNum = form.budget ? parseInt(form.budget, 10) : 0;

    const layerLabel =
      form.layer === "general"
        ? "一般消費者"
        : form.layer === "business"
        ? "ビジネス層（会社員・経営者）"
        : "一般消費者・ビジネス層どちらも";

    const inboundLabel =
      form.inbound === "none"
        ? "国内のみ"
        : form.inbound === "include"
        ? "インバウンドも含む"
        : "インバウンドがメイン";

    const regionLabel =
      form.region === "nationwide"
        ? "全国"
        : form.region === "regional"
        ? `エリア指定: ${form.regionDetail || "未指定"}`
        : `市区町村単位: ${form.regionDetail || "未指定"}`;

    try {
      const res = await fetch("/api/strategy-advisor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gender:
            form.gender === "both"
              ? "両性"
              : form.gender === "male"
              ? "男性"
              : "女性",
          ageRange: form.ageRange,
          layer: layerLabel,
          inbound: form.inbound !== "none",
          purposes: form.purposes,
          region: regionLabel,
          budget: budgetNum,
        }),
        signal: abortRef.current.signal,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(err.error ?? `HTTP ${res.status}`);
      }

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        accumulated += decoder.decode(value, { stream: true });
        setStreamText(accumulated);
      }

      const jsonMatch = accumulated.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("レスポンスのパースに失敗しました");
      setResult(JSON.parse(jsonMatch[0]) as AIResult);
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      setError(
        (err as Error).message || "AI提案の生成に失敗しました。しばらく経ってからお試しください。"
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    abortRef.current?.abort();
    setStep(0);
    setForm({
      gender: "both",
      ageRange: [],
      layer: "general",
      inbound: "none",
      purposes: [],
      region: "nationwide",
      regionDetail: "",
      budget: "",
    });
    setResult(null);
    setError(null);
    setStreamText("");
  };

  // ----------------------------------------------------------------
  // レンダリング: ローディング / 結果画面
  // ----------------------------------------------------------------
  if (step === 5) {
    // ---- ローディング ----
    if (isLoading) {
      return (
        <div className="flex flex-col items-center justify-center py-24 gap-6">
          <div className="relative">
            <div className="w-16 h-16 rounded-full border-4 border-blue-100" />
            <div className="absolute inset-0 w-16 h-16 rounded-full border-4 border-blue-600 border-t-transparent animate-spin" />
            <Sparkles className="absolute inset-0 m-auto w-6 h-6 text-blue-600" />
          </div>
          <div className="text-center">
            <p className="text-sm font-semibold text-zinc-800">AI が提案を生成中...</p>
            <p className="text-xs text-zinc-400 mt-1">
              {streamText.length > 0
                ? `分析中 (${streamText.length} 文字)`
                : "戦略マトリクスを分析しています"}
            </p>
          </div>
          <button
            onClick={() => {
              abortRef.current?.abort();
              setStep(4);
              setIsLoading(false);
            }}
            className="text-xs text-zinc-400 hover:text-zinc-600 transition-colors"
          >
            キャンセル
          </button>
        </div>
      );
    }

    // ---- エラー ----
    if (error) {
      return (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center">
            <span className="text-2xl">⚠️</span>
          </div>
          <div className="text-center">
            <p className="text-sm font-semibold text-zinc-800">エラーが発生しました</p>
            <p className="text-xs text-red-600 mt-1">{error}</p>
          </div>
          <button
            onClick={() => { setError(null); setStep(4); }}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium bg-zinc-100 text-zinc-700 rounded-lg hover:bg-zinc-200 transition-colors"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            戻る
          </button>
        </div>
      );
    }

    // ---- 結果表示 ----
    if (result) {
      return (
        <div className="space-y-6">
          {/* ヘッダー */}
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-blue-600" />
              <h3 className="text-base font-bold text-zinc-900">AI提案プラン</h3>
            </div>
            <button
              onClick={handleReset}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-zinc-500 border border-zinc-200 rounded-lg hover:bg-zinc-50 transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              最初からやり直す
            </button>
          </div>

          {/* サマリー */}
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100 rounded-xl p-5">
            <p className="text-xs font-semibold text-blue-500 uppercase tracking-wide mb-2">
              戦略サマリー
            </p>
            <p className="text-sm text-zinc-800 leading-relaxed">{result.summary}</p>
          </div>

          {/* 推奨メディアカード */}
          <div>
            <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-3">
              推奨メディアプラン
            </p>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {result.recommendedPlans
                .sort((a, b) => a.rank - b.rank)
                .map((plan) => (
                  <MediaResultCard key={plan.mediaId} plan={plan} />
                ))}
            </div>
          </div>

          {/* 想定スケジュール */}
          <div className="bg-white rounded-xl border border-zinc-200 p-5">
            <div className="flex items-center gap-2 mb-4">
              <Calendar className="w-4 h-4 text-zinc-600" />
              <p className="text-sm font-bold text-zinc-900">想定スケジュール</p>
            </div>
            <div className="space-y-3">
              {[
                { period: "1〜2週目", content: result.schedule.week1_2, color: "bg-blue-50 border-blue-200 text-blue-700" },
                { period: "3〜6週目", content: result.schedule.week3_6, color: "bg-green-50 border-green-200 text-green-700" },
                { period: "7〜8週目", content: result.schedule.week7_8, color: "bg-zinc-50 border-zinc-200 text-zinc-600" },
              ].map(({ period, content, color }) => (
                <div key={period} className={cn("flex gap-3 p-3 rounded-lg border", color)}>
                  <span className="text-xs font-bold whitespace-nowrap">{period}</span>
                  <span className="text-xs leading-relaxed">{content}</span>
                </div>
              ))}
            </div>
          </div>

          {/* 予算アドバイス */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="bg-white rounded-xl border border-zinc-200 p-4">
              <div className="flex items-center gap-2 mb-2">
                <Lightbulb className="w-4 h-4 text-amber-500" />
                <p className="text-xs font-bold text-zinc-800">予算最適化アドバイス</p>
              </div>
              <p className="text-xs text-zinc-600 leading-relaxed">{result.budgetAdvice}</p>
            </div>
            <div className="bg-amber-50 rounded-xl border border-amber-200 p-4">
              <div className="flex items-center gap-2 mb-2">
                <ArrowUpCircle className="w-4 h-4 text-amber-600" />
                <p className="text-xs font-bold text-amber-800">アップセル提案</p>
              </div>
              <p className="text-xs text-amber-700 leading-relaxed">{result.upsellAdvice}</p>
            </div>
          </div>

          {/* 全シミュレーター一覧 */}
          <div className="border border-zinc-100 rounded-xl p-4">
            <p className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wide mb-3">
              その他のシミュレーターで試算する
            </p>
            <div className="flex flex-wrap gap-2">
              {Object.values(MEDIA_MATRIX).filter((m) => m.simulatorPath).map((m) => (
                <Link
                  key={m.id}
                  href={m.simulatorPath}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium bg-zinc-50 border border-zinc-200 text-zinc-600 rounded-lg hover:bg-zinc-100 transition-colors"
                >
                  {m.emoji} {m.name}
                </Link>
              ))}
            </div>
          </div>
        </div>
      );
    }

    return null;
  }

  // ----------------------------------------------------------------
  // レンダリング: フォームステップ
  // ----------------------------------------------------------------
  return (
    <div className="max-w-2xl">
      <StepIndicator current={step} total={STEPS.length} />

      <div className="bg-white rounded-xl border border-zinc-200 p-6 space-y-5">
        {/* ステップ 0: ターゲット属性 */}
        {step === 0 && (
          <div className="space-y-5">
            <div>
              <label className="text-xs font-semibold text-zinc-700 block mb-2">性別</label>
              <div className="flex flex-wrap gap-2">
                {GENDER_OPTIONS.map((o) => (
                  <SelectButton
                    key={o.value}
                    selected={form.gender === o.value}
                    onClick={() => setForm((p) => ({ ...p, gender: o.value }))}
                  >
                    {o.label}
                  </SelectButton>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-zinc-700 block mb-2">
                年代 <span className="text-zinc-400 font-normal">（複数選択可）</span>
              </label>
              <div className="flex flex-wrap gap-2">
                {AGE_OPTIONS.map((age) => (
                  <SelectButton
                    key={age}
                    selected={form.ageRange.includes(age)}
                    onClick={() => toggleMulti("ageRange", age)}
                  >
                    {age}
                  </SelectButton>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-zinc-700 block mb-2">層</label>
              <div className="flex flex-col gap-2">
                {LAYER_OPTIONS.map((o) => (
                  <SelectButton
                    key={o.value}
                    selected={form.layer === o.value}
                    onClick={() => setForm((p) => ({ ...p, layer: o.value }))}
                  >
                    {o.label}
                  </SelectButton>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-zinc-700 block mb-2">
                インバウンド（訪日外国人）
              </label>
              <div className="flex flex-col gap-2">
                {INBOUND_OPTIONS.map((o) => (
                  <SelectButton
                    key={o.value}
                    selected={form.inbound === o.value}
                    onClick={() => setForm((p) => ({ ...p, inbound: o.value }))}
                  >
                    {o.label}
                  </SelectButton>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ステップ 1: 主要目的 */}
        {step === 1 && (
          <div className="space-y-3">
            <p className="text-xs text-zinc-500">
              最も重要な目的を選んでください（複数選択可）
            </p>
            {PURPOSE_OPTIONS.map((o) => (
              <SelectButton
                key={o.value}
                selected={form.purposes.includes(o.value)}
                onClick={() => toggleMulti("purposes", o.value)}
                className="w-full"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="font-medium">{o.label}</span>
                  <span className="text-[11px] text-zinc-400">{o.desc}</span>
                </div>
              </SelectButton>
            ))}
            {form.purposes.length === 0 && (
              <p className="text-[11px] text-red-500">少なくとも1つ選択してください</p>
            )}
          </div>
        )}

        {/* ステップ 2: 実施地域 */}
        {step === 2 && (
          <div className="space-y-4">
            <div className="flex flex-col gap-2">
              {REGION_OPTIONS.map((o) => (
                <SelectButton
                  key={o.value}
                  selected={form.region === o.value}
                  onClick={() => setForm((p) => ({ ...p, region: o.value, regionDetail: "" }))}
                  className="w-full"
                >
                  {o.label}
                </SelectButton>
              ))}
            </div>

            {form.region === "regional" && (
              <div>
                <label className="text-xs font-semibold text-zinc-700 block mb-2">
                  エリアを選択
                  <span className="text-zinc-400 font-normal ml-1">（複数選択可）</span>
                </label>
                <div className="flex flex-wrap gap-2">
                  {REGION_DETAIL_OPTIONS.map((r) => {
                    const selected = form.regionDetail.split(",").map((s) => s.trim()).includes(r);
                    return (
                      <SelectButton
                        key={r}
                        selected={selected}
                        onClick={() => {
                          const current = form.regionDetail
                            ? form.regionDetail.split(",").map((s) => s.trim()).filter(Boolean)
                            : [];
                          const next = selected
                            ? current.filter((v) => v !== r)
                            : [...current, r];
                          setForm((p) => ({ ...p, regionDetail: next.join(", ") }));
                        }}
                      >
                        {r}
                      </SelectButton>
                    );
                  })}
                </div>
              </div>
            )}

            {form.region === "municipal" && (
              <div>
                <label className="text-xs font-semibold text-zinc-700 block mb-1.5">
                  対象エリアを記入
                </label>
                <input
                  type="text"
                  placeholder="例: 渋谷区、新宿区、大阪市"
                  value={form.regionDetail}
                  onChange={(e) => setForm((p) => ({ ...p, regionDetail: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg
                             focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-400 bg-white"
                />
              </div>
            )}
          </div>
        )}

        {/* ステップ 3: 予算 */}
        {step === 3 && (
          <div className="space-y-4">
            <p className="text-xs text-zinc-500">
              広告費全体の予定予算を入力してください（AIが媒体ごとに最適配分します）
            </p>

            {/* プリセット */}
            <div>
              <p className="text-xs font-semibold text-zinc-600 mb-2">目安から選ぶ</p>
              <div className="flex flex-wrap gap-2">
                {BUDGET_PRESETS.map((p) => (
                  <SelectButton
                    key={p.value}
                    selected={form.budget === p.value}
                    onClick={() => setForm((prev) => ({ ...prev, budget: p.value }))}
                  >
                    {p.label}
                  </SelectButton>
                ))}
              </div>
            </div>

            {/* 自由入力 */}
            <div>
              <p className="text-xs font-semibold text-zinc-600 mb-2">または金額を直接入力</p>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={0}
                  step={100000}
                  placeholder="例: 1500000"
                  value={form.budget}
                  onChange={(e) => setForm((p) => ({ ...p, budget: e.target.value }))}
                  className="flex-1 px-3 py-2 text-sm border border-zinc-200 rounded-lg
                             focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-400 bg-white"
                />
                <span className="text-sm text-zinc-500">円</span>
              </div>
              {form.budget && (
                <p className="mt-1 text-xs text-zinc-400">
                  ≈ {formatBudget(parseInt(form.budget, 10))}
                </p>
              )}
            </div>

            {/* 各媒体の最低予算参考 */}
            <div className="bg-zinc-50 rounded-lg p-3">
              <p className="text-[11px] font-semibold text-zinc-500 mb-2">各媒体の最低予算（参考）</p>
              <div className="grid grid-cols-2 gap-1">
                {Object.values(MEDIA_MATRIX).map((m) => (
                  <div key={m.id} className="flex items-center gap-1.5 text-[11px] text-zinc-600">
                    <span>{m.emoji}</span>
                    <span className="truncate">{m.name.replace(" インストア", "").replace("（アパホテル）", "")}</span>
                    <span className="text-zinc-400 ml-auto">{formatBudget(m.minBudget)}〜</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ステップ 4: 確認画面 */}
        {step === 4 && (() => {
          const genderLabel = form.gender === "both" ? "両性（男女共通）" : form.gender === "male" ? "男性メイン" : "女性メイン";
          const layerLabel = form.layer === "general" ? "一般消費者" : form.layer === "business" ? "ビジネス層（会社員・経営者）" : "どちらも";
          const inboundLabel = form.inbound === "none" ? "国内のみ" : form.inbound === "include" ? "インバウンドも含む" : "インバウンドがメイン";
          const regionLabel = form.region === "nationwide" ? "全国" : form.region === "regional" ? `エリア指定（${form.regionDetail || "未指定"}）` : `市区町村（${form.regionDetail || "未指定"}）`;
          const budgetNum = form.budget ? parseInt(form.budget, 10) : 0;
          const rows = [
            { label: "性別",           value: genderLabel },
            { label: "年代",           value: form.ageRange.length > 0 ? form.ageRange.join("・") : "指定なし" },
            { label: "層",             value: layerLabel },
            { label: "インバウンド",   value: inboundLabel },
            { label: "主要目的",       value: form.purposes.length > 0 ? form.purposes.join("・") : "未選択" },
            { label: "実施地域",       value: regionLabel },
            { label: "予算",           value: budgetNum > 0 ? formatBudget(budgetNum) : "未入力" },
          ];
          return (
            <div className="space-y-4">
              <p className="text-xs text-zinc-500">以下の内容でAI提案を生成します。内容を確認してください。</p>
              <div className="rounded-lg border border-zinc-200 overflow-hidden">
                {rows.map(({ label, value }, i) => (
                  <div
                    key={label}
                    className={cn(
                      "flex items-start gap-4 px-4 py-2.5 text-sm",
                      i % 2 === 0 ? "bg-white" : "bg-zinc-50"
                    )}
                  >
                    <span className="text-[11px] font-semibold text-zinc-400 w-24 flex-shrink-0 pt-0.5">{label}</span>
                    <span className="text-zinc-800 text-xs leading-relaxed">{value}</span>
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-zinc-400">
                修正する場合は「戻る」を押してください。
              </p>
            </div>
          );
        })()}

        {/* ナビゲーションボタン */}
        <div className="flex items-center justify-between pt-2 border-t border-zinc-100">
          <button
            type="button"
            onClick={() => setStep((s) => s - 1)}
            disabled={step === 0}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-zinc-500
                       border border-zinc-200 rounded-lg hover:bg-zinc-50 transition-colors
                       disabled:opacity-30 disabled:pointer-events-none"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            戻る
          </button>

          {step < STEPS.length - 1 ? (
            <button
              type="button"
              onClick={() => setStep((s) => s + 1)}
              disabled={!canNext()}
              className="flex items-center gap-1.5 px-5 py-2 text-xs font-semibold
                         bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors
                         disabled:opacity-40 disabled:pointer-events-none"
            >
              次へ
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => { setStep(5); handleSubmit(); }}
              disabled={isLoading}
              className="flex items-center gap-2 px-5 py-2 text-xs font-semibold
                         bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors
                         disabled:opacity-40"
            >
              <Sparkles className="w-3.5 h-3.5" />
              この内容でAI提案を生成する
            </button>
          )}
        </div>
      </div>

      {/* 入力内容サマリー（ステップ2以降） */}
      {step >= 1 && (
        <div className="mt-3 px-4 py-3 bg-zinc-50 rounded-lg border border-zinc-100">
          <p className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wide mb-1.5">
            入力内容
          </p>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-zinc-600">
            <span>
              <span className="text-zinc-400">性別:</span>{" "}
              {form.gender === "both" ? "両性" : form.gender === "male" ? "男性" : "女性"}
            </span>
            {form.ageRange.length > 0 && (
              <span>
                <span className="text-zinc-400">年代:</span> {form.ageRange.join("・")}
              </span>
            )}
            {step >= 2 && form.purposes.length > 0 && (
              <span>
                <span className="text-zinc-400">目的:</span> {form.purposes.join("・")}
              </span>
            )}
            {step >= 3 && (
              <span>
                <span className="text-zinc-400">地域:</span>{" "}
                {form.region === "nationwide" ? "全国" : form.regionDetail || "エリア"}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
