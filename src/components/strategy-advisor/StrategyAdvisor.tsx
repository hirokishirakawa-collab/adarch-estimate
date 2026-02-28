"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import {
  Sparkles,
  ChevronRight,
  ChevronLeft,
  RefreshCw,
  ExternalLink,
  CheckCircle2,
  Lightbulb,
  ArrowUpCircle,
  Layers,
  TrendingUp,
  Palette,
  ArrowRight,
  Target,
  Zap,
} from "lucide-react";
import { MEDIA_MATRIX, type MediaId } from "@/lib/strategy-matrix";
import { cn } from "@/lib/utils";

// ----------------------------------------------------------------
// 型定義
// ----------------------------------------------------------------
interface MediaBudget {
  mediaId: MediaId;
  budget: number;
}

interface CombinationPlan {
  name: string;
  media: MediaBudget[];
  totalBudget: number;
  synergy: string;
}

interface RoadmapPhase {
  phase: number;
  period: string;
  theme: string;
  mediaIds: MediaId[];
  monthlyBudget: number;
  actions: string;
  objective: string;
  creativeNote: string;
}

interface SingleRecommendation {
  mediaId: MediaId;
  allocatedBudget: number;
  reason: string;
  expectedEffect: string;
}

interface AIResult {
  strategyConcept: string;
  creativeStrategy: string;
  primaryRecommendation: SingleRecommendation;
  secondaryRecommendation: SingleRecommendation;
  combinationPlans: CombinationPlan[];
  longTermRoadmap: RoadmapPhase[];
  upsellAdvice: string;
  budgetAdvice: string;
  summary: string;
}

interface FormState {
  gender: string;
  ageRange: string[];
  layer: string;
  inbound: string;
  industry: string;
  purposes: string[];
  region: string;
  regionDetail: string;
  budget: string;
}

// ----------------------------------------------------------------
// 定数
// ----------------------------------------------------------------
// Step 0:ターゲット属性 / 1:業種・業界 / 2:主要目的 / 3:実施地域 / 4:予算 / 5:確認
// step === 6 でAI結果表示
const STEPS = ["ターゲット属性", "業種・業界", "主要目的", "実施地域", "予算", "確認"];

const GENDER_OPTIONS = [
  { value: "both",   label: "両性（男女共通）" },
  { value: "male",   label: "男性メイン" },
  { value: "female", label: "女性メイン" },
];

const AGE_OPTIONS = ["10代", "20代", "30代", "40代", "50代", "60代以上"];

const LAYER_OPTIONS = [
  { value: "general",  label: "一般消費者" },
  { value: "business", label: "ビジネス層（会社員・経営者）" },
  { value: "both",     label: "どちらも" },
];

const INBOUND_OPTIONS = [
  { value: "none",    label: "国内のみ" },
  { value: "include", label: "インバウンドも含む" },
  { value: "main",    label: "インバウンドがメイン" },
];

const INDUSTRY_CATEGORIES: { category: string; items: { value: string; label: string }[] }[] = [
  {
    category: "BtoC・消費者向け",
    items: [
      { value: "飲食・フード・飲料",         label: "飲食・フード・飲料" },
      { value: "小売・EC・通販",             label: "小売・EC・通販" },
      { value: "美容・コスメ・健康食品",     label: "美容・コスメ・健康食品" },
      { value: "ファッション・アパレル",     label: "ファッション・アパレル" },
      { value: "スポーツ・フィットネス",     label: "スポーツ・フィットネス" },
      { value: "旅行・観光・ホテル・宿泊",   label: "旅行・観光・ホテル" },
      { value: "エンターテインメント・レジャー", label: "エンタメ・レジャー" },
      { value: "住宅・不動産・リフォーム",   label: "住宅・不動産・リフォーム" },
      { value: "自動車・バイク・モビリティ", label: "自動車・バイク" },
    ],
  },
  {
    category: "BtoB・法人向け",
    items: [
      { value: "IT・SaaS・テクノロジー",       label: "IT・SaaS・テクノロジー" },
      { value: "製造・メーカー",               label: "製造・メーカー" },
      { value: "建設・設備・工事",             label: "建設・設備・工事" },
      { value: "金融・保険・証券・投資",       label: "金融・保険・証券" },
      { value: "コンサルティング・士業・法務", label: "コンサル・士業・法務" },
    ],
  },
  {
    category: "その他",
    items: [
      { value: "医療・介護・福祉・クリニック", label: "医療・介護・福祉" },
      { value: "教育・学習・スクール・資格",   label: "教育・学習・スクール" },
      { value: "採用・人材・HR",               label: "採用・人材・HR" },
      { value: "地方自治体・公共・NPO",        label: "行政・公共・NPO" },
      { value: "その他・未定",                 label: "その他・未定" },
    ],
  },
];

const PURPOSE_OPTIONS = [
  { value: "認知拡大",       label: "認知拡大",       desc: "まずブランドを知ってもらう" },
  { value: "理解促進",       label: "理解促進",       desc: "商品・サービスの内容を伝える" },
  { value: "来店・販売促進", label: "来店・販売促進", desc: "行動・購買に繋げる" },
  { value: "ブランドリフト", label: "ブランドリフト", desc: "ブランドイメージを向上させる" },
  { value: "採用",           label: "採用",           desc: "求職者・学生へのリーチ" },
];

const REGION_OPTIONS = [
  { value: "nationwide", label: "全国" },
  { value: "regional",   label: "エリア指定（関東・関西など）" },
  { value: "municipal",  label: "市区町村単位" },
];

const REGION_DETAIL_OPTIONS = [
  "関東", "関西", "東海", "北海道", "東北", "九州", "中国", "四国", "沖縄",
];

const BUDGET_PRESETS = [
  { label: "〜50万円",    value: "500000" },
  { label: "50〜100万円", value: "1000000" },
  { label: "100〜300万円",value: "2000000" },
  { label: "300〜500万円",value: "4000000" },
  { label: "500万円〜",   value: "6000000" },
];

const PHASE_COLORS = [
  { bg: "bg-blue-50", border: "border-blue-200", text: "text-blue-700", badge: "bg-blue-600 text-white", dot: "bg-blue-600" },
  { bg: "bg-violet-50", border: "border-violet-200", text: "text-violet-700", badge: "bg-violet-600 text-white", dot: "bg-violet-600" },
  { bg: "bg-emerald-50", border: "border-emerald-200", text: "text-emerald-700", badge: "bg-emerald-600 text-white", dot: "bg-emerald-600" },
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
function StepIndicator({ current }: { current: number }) {
  return (
    <div className="flex items-center gap-1 mb-6 overflow-x-auto pb-1">
      {STEPS.map((label, i) => (
        <div key={i} className="flex items-center gap-1 flex-shrink-0">
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
              "text-[11px] font-medium hidden sm:inline whitespace-nowrap",
              i === current ? "text-blue-600" : "text-zinc-400"
            )}
          >
            {label}
          </span>
          {i < STEPS.length - 1 && (
            <div className={cn("w-4 h-px mx-0.5 flex-shrink-0", i < current ? "bg-blue-600" : "bg-zinc-200")} />
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
  selected, onClick, children, className,
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
// サブコンポーネント: 推奨媒体カード
// ----------------------------------------------------------------
function RecommendationCard({
  rec,
  rank,
}: {
  rec: SingleRecommendation;
  rank: 1 | 2;
}) {
  const media = MEDIA_MATRIX[rec.mediaId];
  if (!media) return null;
  const simulatorUrl = `${media.simulatorPath}?budget=${rec.allocatedBudget}`;
  const isPrimary = rank === 1;

  return (
    <div className={cn(
      "bg-white rounded-xl border p-5 space-y-3",
      isPrimary ? "border-blue-300 shadow-sm shadow-blue-100" : "border-zinc-200"
    )}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="text-2xl">{media.emoji}</span>
          <div>
            <span className={cn(
              "text-[10px] font-bold px-1.5 py-0.5 rounded",
              isPrimary ? "bg-blue-600 text-white" : "bg-zinc-400 text-white"
            )}>
              {isPrimary ? "第1推奨" : "第2推奨"}
            </span>
            <p className="text-sm font-bold text-zinc-900 mt-0.5">{media.name}</p>
          </div>
        </div>
        <div className="text-right flex-shrink-0">
          <p className="text-[10px] text-zinc-400">月額目安</p>
          <p className={cn("text-lg font-bold", isPrimary ? "text-blue-700" : "text-zinc-700")}>
            {formatBudget(rec.allocatedBudget)}
          </p>
        </div>
      </div>

      <div className="bg-zinc-50 rounded-lg p-3 space-y-2">
        <div>
          <p className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wide mb-1">選定理由</p>
          <p className="text-xs text-zinc-700 leading-relaxed">{rec.reason}</p>
        </div>
        <div>
          <p className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wide mb-1">期待効果・KPI</p>
          <p className="text-xs text-zinc-700 leading-relaxed">{rec.expectedEffect}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {media.strengths.map((s) => (
          <span key={s} className="text-[10px] px-2 py-0.5 bg-blue-50 text-blue-600 rounded-full border border-blue-100">
            {s}
          </span>
        ))}
      </div>

      {media.simulatorPath ? (
        <Link
          href={simulatorUrl}
          className="flex items-center justify-center gap-2 w-full px-4 py-2.5 bg-blue-600
                     text-white text-xs font-semibold rounded-lg hover:bg-blue-700 transition-colors"
        >
          <ExternalLink className="w-3.5 h-3.5" />
          詳細シミュレーターで試算する →
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
// サブコンポーネント: 組み合わせプランカード
// ----------------------------------------------------------------
function CombinationCard({ plan }: { plan: CombinationPlan }) {
  return (
    <div className="bg-white rounded-xl border border-zinc-200 p-4 space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-sm font-bold text-zinc-900">{plan.name}</p>
        <span className="text-sm font-bold text-blue-700">合計 {formatBudget(plan.totalBudget)}/月</span>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {plan.media.map((m, i) => {
          const def = MEDIA_MATRIX[m.mediaId];
          if (!def) return null;
          return (
            <div key={m.mediaId} className="flex items-center gap-1">
              <span className="flex items-center gap-1 px-2.5 py-1 bg-zinc-100 rounded-full text-xs font-medium text-zinc-700">
                {def.emoji} {def.name.split("（")[0].replace(" インストア", "")}
                <span className="text-zinc-400 ml-1">{formatBudget(m.budget)}</span>
              </span>
              {i < plan.media.length - 1 && <ArrowRight className="w-3 h-3 text-zinc-400 flex-shrink-0" />}
            </div>
          );
        })}
      </div>

      <div className="flex items-start gap-2 bg-blue-50 rounded-lg p-3">
        <Zap className="w-3.5 h-3.5 text-blue-600 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-blue-700 leading-relaxed">{plan.synergy}</p>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------
// サブコンポーネント: ロードマップフェーズ
// ----------------------------------------------------------------
function RoadmapPhaseCard({ phase, isLast }: { phase: RoadmapPhase; isLast: boolean }) {
  const color = PHASE_COLORS[(phase.phase - 1) % PHASE_COLORS.length];
  return (
    <div className="flex gap-4">
      {/* タイムライン縦線 */}
      <div className="flex flex-col items-center flex-shrink-0">
        <div className={cn("w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0", color.dot)}>
          {phase.phase}
        </div>
        {!isLast && <div className="w-px flex-1 bg-zinc-200 mt-1" />}
      </div>

      <div className={cn("flex-1 rounded-xl border p-4 space-y-3 mb-4", color.bg, color.border)}>
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <div>
            <p className={cn("text-[11px] font-semibold", color.text)}>{phase.period}</p>
            <p className="text-sm font-bold text-zinc-900">{phase.theme}</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-zinc-400">月額目安</p>
            <p className={cn("text-sm font-bold", color.text)}>{formatBudget(phase.monthlyBudget)}</p>
          </div>
        </div>

        {/* 媒体バッジ */}
        <div className="flex flex-wrap gap-1.5">
          {phase.mediaIds.map((id) => {
            const def = MEDIA_MATRIX[id];
            if (!def) return null;
            return (
              <span key={id} className={cn("text-[11px] px-2 py-0.5 rounded-full font-medium", color.badge)}>
                {def.emoji} {def.name.split("（")[0].replace(" インストア", "")}
              </span>
            );
          })}
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          <div>
            <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wide mb-1">実施内容</p>
            <p className="text-xs text-zinc-700 leading-relaxed">{phase.actions}</p>
          </div>
          <div>
            <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wide mb-1">目標・KPI</p>
            <p className="text-xs text-zinc-700 leading-relaxed">{phase.objective}</p>
          </div>
        </div>

        <div className="flex items-start gap-2 bg-white/70 rounded-lg p-2.5">
          <Palette className="w-3.5 h-3.5 text-violet-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-[10px] font-semibold text-violet-600 mb-0.5">クリエイティブ活用</p>
            <p className="text-xs text-zinc-600 leading-relaxed">{phase.creativeNote}</p>
          </div>
        </div>
      </div>
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
    industry: "",
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
      return { ...prev, [key]: arr.includes(val) ? arr.filter((v) => v !== val) : [...arr, val] };
    });
  };

  // ---- バリデーション ----
  const canNext = () => {
    if (step === 1 && !form.industry) return false;
    if (step === 2 && form.purposes.length === 0) return false;
    return true;
  };

  // ---- ラベル変換ヘルパー ----
  const genderLabel   = form.gender === "both" ? "両性（男女共通）" : form.gender === "male" ? "男性メイン" : "女性メイン";
  const layerLabel    = form.layer === "general" ? "一般消費者" : form.layer === "business" ? "ビジネス層（会社員・経営者）" : "どちらも";
  const inboundLabel  = form.inbound === "none" ? "国内のみ" : form.inbound === "include" ? "インバウンドも含む" : "インバウンドがメイン";
  const regionLabel   = form.region === "nationwide" ? "全国"
    : form.region === "regional"  ? `エリア指定（${form.regionDetail || "未指定"}）`
    : `市区町村（${form.regionDetail || "未指定"}）`;

  // ---- AI 呼び出し ----
  const handleSubmit = async () => {
    setIsLoading(true);
    setStreamText("");
    setResult(null);
    setError(null);
    abortRef.current?.abort();
    abortRef.current = new AbortController();

    const budgetNum = form.budget ? parseInt(form.budget, 10) : 0;

    try {
      const res = await fetch("/api/strategy-advisor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gender:    genderLabel,
          ageRange:  form.ageRange,
          layer:     layerLabel,
          inbound:   form.inbound !== "none",
          industry:  form.industry,
          purposes:  form.purposes,
          region:    regionLabel,
          budget:    budgetNum,
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

      // ```json ... ``` ブロックを除去してから最外JSONを抽出
      const stripped = accumulated.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "");
      const start = stripped.indexOf("{");
      const end = stripped.lastIndexOf("}");
      if (start === -1 || end === -1) throw new Error("レスポンスのパースに失敗しました");
      setResult(JSON.parse(stripped.slice(start, end + 1)) as AIResult);
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      setError((err as Error).message || "AI提案の生成に失敗しました。しばらく経ってからお試しください。");
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    abortRef.current?.abort();
    setStep(0);
    setForm({ gender: "both", ageRange: [], layer: "general", inbound: "none", industry: "", purposes: [], region: "nationwide", regionDetail: "", budget: "" });
    setResult(null);
    setError(null);
    setStreamText("");
  };

  // ----------------------------------------------------------------
  // レンダリング: ローディング / 結果画面 (step === 6)
  // ----------------------------------------------------------------
  if (step === 6) {
    if (isLoading) {
      return (
        <div className="flex flex-col items-center justify-center py-24 gap-6">
          <div className="relative">
            <div className="w-16 h-16 rounded-full border-4 border-blue-100" />
            <div className="absolute inset-0 w-16 h-16 rounded-full border-4 border-blue-600 border-t-transparent animate-spin" />
            <Sparkles className="absolute inset-0 m-auto w-6 h-6 text-blue-600" />
          </div>
          <div className="text-center">
            <p className="text-sm font-semibold text-zinc-800">AI が複合提案を生成中...</p>
            <p className="text-xs text-zinc-400 mt-1">
              {streamText.length > 0 ? `分析中 (${streamText.length} 文字)` : "長期ロードマップを策定しています"}
            </p>
          </div>
          <button
            onClick={() => { abortRef.current?.abort(); setStep(5); setIsLoading(false); }}
            className="text-xs text-zinc-400 hover:text-zinc-600 transition-colors"
          >
            キャンセル
          </button>
        </div>
      );
    }

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
            onClick={() => { setError(null); setStep(5); }}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium bg-zinc-100 text-zinc-700 rounded-lg hover:bg-zinc-200 transition-colors"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            戻る
          </button>
        </div>
      );
    }

    if (result) {
      return (
        <div className="space-y-6 max-w-3xl">
          {/* ヘッダー */}
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-blue-600" />
              <h3 className="text-base font-bold text-zinc-900">AI 複合提案プラン</h3>
              {form.industry && (
                <span className="text-[11px] px-2 py-0.5 bg-blue-50 text-blue-600 rounded-full border border-blue-100">
                  {form.industry}
                </span>
              )}
            </div>
            <button
              onClick={handleReset}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-zinc-500 border border-zinc-200 rounded-lg hover:bg-zinc-50 transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              最初からやり直す
            </button>
          </div>

          {/* 戦略コンセプト */}
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-2">
              <Target className="w-4 h-4 text-blue-600" />
              <p className="text-xs font-semibold text-blue-600 uppercase tracking-wide">戦略コンセプト</p>
            </div>
            <p className="text-sm text-zinc-800 leading-relaxed">{result.strategyConcept}</p>
          </div>

          {/* クリエイティブ横断活用 */}
          <div className="bg-violet-50 border border-violet-200 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Palette className="w-4 h-4 text-violet-600" />
              <p className="text-xs font-semibold text-violet-700 uppercase tracking-wide">クリエイティブ横断活用戦略</p>
            </div>
            <p className="text-sm text-zinc-700 leading-relaxed">{result.creativeStrategy}</p>
          </div>

          {/* 第1・第2推奨 */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="w-4 h-4 text-zinc-600" />
              <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">推奨媒体（第1・第2）</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <RecommendationCard rec={result.primaryRecommendation} rank={1} />
              <RecommendationCard rec={result.secondaryRecommendation} rank={2} />
            </div>
          </div>

          {/* 組み合わせプラン */}
          {result.combinationPlans && result.combinationPlans.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Layers className="w-4 h-4 text-zinc-600" />
                <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">媒体組み合わせプラン</p>
              </div>
              <div className="space-y-3">
                {result.combinationPlans.map((plan, i) => (
                  <CombinationCard key={i} plan={plan} />
                ))}
              </div>
            </div>
          )}

          {/* 長期ロードマップ */}
          {result.longTermRoadmap && result.longTermRoadmap.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp className="w-4 h-4 text-zinc-600" />
                <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">長期ロードマップ（6ヶ月計画）</p>
              </div>
              <div>
                {result.longTermRoadmap.map((phase, i) => (
                  <RoadmapPhaseCard
                    key={phase.phase}
                    phase={phase}
                    isLast={i === result.longTermRoadmap.length - 1}
                  />
                ))}
              </div>
            </div>
          )}

          {/* アドバイス */}
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

          {/* サマリー */}
          <div className="bg-zinc-800 rounded-xl p-5">
            <p className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wide mb-2">プランサマリー</p>
            <p className="text-sm text-zinc-100 leading-relaxed">{result.summary}</p>
          </div>

          {/* シミュレーターリンク */}
          <div className="border border-zinc-100 rounded-xl p-4">
            <p className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wide mb-3">
              各媒体のシミュレーターで詳細試算する
            </p>
            <div className="flex flex-wrap gap-2">
              {Object.values(MEDIA_MATRIX).filter((m) => m.simulatorPath).map((m) => (
                <Link
                  key={m.id}
                  href={m.simulatorPath}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium bg-zinc-50 border border-zinc-200 text-zinc-600 rounded-lg hover:bg-zinc-100 transition-colors"
                >
                  {m.emoji} {m.name.split("（")[0].replace(" インストア", "")}
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
  // レンダリング: フォームステップ (step 0〜5)
  // ----------------------------------------------------------------
  return (
    <div className="max-w-2xl">
      <StepIndicator current={step} />

      <div className="bg-white rounded-xl border border-zinc-200 p-6 space-y-5">

        {/* Step 0: ターゲット属性 */}
        {step === 0 && (
          <div className="space-y-5">
            <div>
              <label className="text-xs font-semibold text-zinc-700 block mb-2">性別</label>
              <div className="flex flex-wrap gap-2">
                {GENDER_OPTIONS.map((o) => (
                  <SelectButton key={o.value} selected={form.gender === o.value} onClick={() => setForm((p) => ({ ...p, gender: o.value }))}>
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
                  <SelectButton key={age} selected={form.ageRange.includes(age)} onClick={() => toggleMulti("ageRange", age)}>
                    {age}
                  </SelectButton>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-zinc-700 block mb-2">層</label>
              <div className="flex flex-col gap-2">
                {LAYER_OPTIONS.map((o) => (
                  <SelectButton key={o.value} selected={form.layer === o.value} onClick={() => setForm((p) => ({ ...p, layer: o.value }))}>
                    {o.label}
                  </SelectButton>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-zinc-700 block mb-2">インバウンド（訪日外国人）</label>
              <div className="flex flex-col gap-2">
                {INBOUND_OPTIONS.map((o) => (
                  <SelectButton key={o.value} selected={form.inbound === o.value} onClick={() => setForm((p) => ({ ...p, inbound: o.value }))}>
                    {o.label}
                  </SelectButton>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Step 1: 業種・業界 */}
        {step === 1 && (
          <div className="space-y-4">
            <p className="text-xs text-zinc-500">
              クライアントの業種・業界を選択してください。AIがその業界の特性に合わせた提案を行います。
            </p>
            {INDUSTRY_CATEGORIES.map((cat) => (
              <div key={cat.category}>
                <p className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wide mb-2">
                  {cat.category}
                </p>
                <div className="flex flex-wrap gap-2">
                  {cat.items.map((item) => (
                    <SelectButton
                      key={item.value}
                      selected={form.industry === item.value}
                      onClick={() => setForm((p) => ({ ...p, industry: item.value }))}
                    >
                      {item.label}
                    </SelectButton>
                  ))}
                </div>
              </div>
            ))}
            {!form.industry && (
              <p className="text-[11px] text-red-500">業種を1つ選択してください</p>
            )}
          </div>
        )}

        {/* Step 2: 主要目的 */}
        {step === 2 && (
          <div className="space-y-3">
            <p className="text-xs text-zinc-500">最も重要な目的を選んでください（複数選択可）</p>
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

        {/* Step 3: 実施地域 */}
        {step === 3 && (
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
                  エリアを選択 <span className="text-zinc-400 font-normal">（複数選択可）</span>
                </label>
                <div className="flex flex-wrap gap-2">
                  {REGION_DETAIL_OPTIONS.map((r) => {
                    const selected = form.regionDetail.split(",").map((s) => s.trim()).includes(r);
                    return (
                      <SelectButton
                        key={r}
                        selected={selected}
                        onClick={() => {
                          const current = form.regionDetail ? form.regionDetail.split(",").map((s) => s.trim()).filter(Boolean) : [];
                          const next = selected ? current.filter((v) => v !== r) : [...current, r];
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
                <label className="text-xs font-semibold text-zinc-700 block mb-1.5">対象エリアを記入</label>
                <input
                  type="text"
                  placeholder="例: 渋谷区、新宿区、大阪市"
                  value={form.regionDetail}
                  onChange={(e) => setForm((p) => ({ ...p, regionDetail: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white"
                />
              </div>
            )}
          </div>
        )}

        {/* Step 4: 予算 */}
        {step === 4 && (
          <div className="space-y-4">
            <p className="text-xs text-zinc-500">
              広告費全体の予定予算を入力してください（AIが媒体ごとに最適配分します）
            </p>
            <div>
              <p className="text-xs font-semibold text-zinc-600 mb-2">目安から選ぶ</p>
              <div className="flex flex-wrap gap-2">
                {BUDGET_PRESETS.map((p) => (
                  <SelectButton key={p.value} selected={form.budget === p.value} onClick={() => setForm((prev) => ({ ...prev, budget: p.value }))}>
                    {p.label}
                  </SelectButton>
                ))}
              </div>
            </div>

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
                  className="flex-1 px-3 py-2 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white"
                />
                <span className="text-sm text-zinc-500">円</span>
              </div>
              {form.budget && (
                <p className="mt-1 text-xs text-zinc-400">≈ {formatBudget(parseInt(form.budget, 10))}</p>
              )}
            </div>

            <div className="bg-zinc-50 rounded-lg p-3">
              <p className="text-[11px] font-semibold text-zinc-500 mb-2">各媒体の最低予算（参考）</p>
              <div className="grid grid-cols-2 gap-1">
                {Object.values(MEDIA_MATRIX).map((m) => (
                  <div key={m.id} className="flex items-center gap-1.5 text-[11px] text-zinc-600">
                    <span>{m.emoji}</span>
                    <span className="truncate">{m.name.split("（")[0].replace(" インストア", "")}</span>
                    <span className="text-zinc-400 ml-auto">{formatBudget(m.minBudget)}〜</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Step 5: 確認 */}
        {step === 5 && (() => {
          const budgetNum = form.budget ? parseInt(form.budget, 10) : 0;
          const rows = [
            { label: "業種・業界",   value: form.industry || "未選択" },
            { label: "性別",         value: genderLabel },
            { label: "年代",         value: form.ageRange.length > 0 ? form.ageRange.join("・") : "指定なし" },
            { label: "層",           value: layerLabel },
            { label: "インバウンド", value: inboundLabel },
            { label: "主要目的",     value: form.purposes.length > 0 ? form.purposes.join("・") : "未選択" },
            { label: "実施地域",     value: regionLabel },
            { label: "予算",         value: budgetNum > 0 ? formatBudget(budgetNum) : "未入力" },
          ];
          return (
            <div className="space-y-4">
              <p className="text-xs text-zinc-500">以下の内容でAI提案を生成します。内容を確認してください。</p>
              <div className="rounded-lg border border-zinc-200 overflow-hidden">
                {rows.map(({ label, value }, i) => (
                  <div key={label} className={cn("flex items-start gap-4 px-4 py-2.5", i % 2 === 0 ? "bg-white" : "bg-zinc-50")}>
                    <span className="text-[11px] font-semibold text-zinc-400 w-24 flex-shrink-0 pt-0.5">{label}</span>
                    <span className="text-zinc-800 text-xs leading-relaxed">{value}</span>
                  </div>
                ))}
              </div>
              <div className="bg-blue-50 rounded-lg p-3 flex items-start gap-2">
                <Sparkles className="w-3.5 h-3.5 text-blue-600 flex-shrink-0 mt-0.5" />
                <p className="text-[11px] text-blue-700 leading-relaxed">
                  AIが第1推奨・第2推奨・組み合わせプラン・6ヶ月ロードマップ・クリエイティブ活用戦略を含む複合提案を生成します。
                </p>
              </div>
              <p className="text-[11px] text-zinc-400">修正する場合は「戻る」を押してください。</p>
            </div>
          );
        })()}

        {/* ナビゲーション */}
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
              onClick={() => { setStep(6); handleSubmit(); }}
              className="flex items-center gap-2 px-5 py-2 text-xs font-semibold
                         bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
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
          <p className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wide mb-1.5">入力内容</p>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-zinc-600">
            {form.industry && <span><span className="text-zinc-400">業種:</span> {form.industry}</span>}
            <span><span className="text-zinc-400">性別:</span> {genderLabel}</span>
            {form.ageRange.length > 0 && <span><span className="text-zinc-400">年代:</span> {form.ageRange.join("・")}</span>}
            {step >= 3 && form.purposes.length > 0 && <span><span className="text-zinc-400">目的:</span> {form.purposes.join("・")}</span>}
            {step >= 4 && <span><span className="text-zinc-400">地域:</span> {form.region === "nationwide" ? "全国" : form.regionDetail || "エリア"}</span>}
          </div>
        </div>
      )}
    </div>
  );
}
