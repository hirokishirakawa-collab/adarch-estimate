"use client";

import { useState, useCallback, useMemo } from "react";
import {
  Search,
  Loader2,
  AlertCircle,
  RotateCcw,
  Save,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Sparkles,
  MessageSquare,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { findScoreByName } from "@/lib/leads/match-score";

// ----------------------------------------------------------------
// Types
// ----------------------------------------------------------------
interface PlaceResult {
  name: string;
  address: string;
  phone: string;
  rating: number;
  ratingCount: number;
  types: string[];
  mapsUrl: string;
  websiteUrl: string;
  businessStatus: string;
  reviewSummary?: string;
  placeSummary?: string;
  neighborhoodSummary?: string;
  googleMapsTypeLabel?: string;
  isFutureOpening?: boolean;
}

interface ScoreResult {
  name: string;
  total: number;
  breakdown: {
    regionPotential: number;
    salesPotential: number;
    businessScale: number;
    digitalLiteracy: number;
    motivationEstimate: number;
    compatibility: number;
  };
  comment: string;
}

interface WebAnalysis {
  hasWebsite: boolean;
  hasYoutube: boolean;
  hasSns: string[];
  siteAge: string;
  hasRecruitPage: boolean;
  summary: string;
}

interface ScoredPlace extends PlaceResult {
  score: ScoreResult;
  analysis?: WebAnalysis;
}

interface AdviceResult {
  dmTemplate: string;
  talkScript: string;
  keyPoints: string[];
}

// ----------------------------------------------------------------
// Constants
// ----------------------------------------------------------------
const PRIORITY_PREFECTURES = [
  "\u5BCC\u5C71\u770C",  // 富山県
  "\u798F\u4E95\u770C",  // 福井県
  "\u9CE5\u53D6\u770C",  // 鳥取県
  "\u5CF6\u6839\u770C",  // 島根県
  "\u611B\u5A9B\u770C",  // 愛媛県
  "\u9AD8\u77E5\u770C",  // 高知県
  "\u718A\u672C\u770C",  // 熊本県
  "\u5927\u5206\u770C",  // 大分県
];

const ALL_PREFECTURES = [
  "\u5317\u6D77\u9053",  // 北海道
  "\u9752\u68EE\u770C",  // 青森県
  "\u5CA9\u624B\u770C",  // 岩手県
  "\u5BAE\u57CE\u770C",  // 宮城県
  "\u79CB\u7530\u770C",  // 秋田県
  "\u5C71\u5F62\u770C",  // 山形県
  "\u798F\u5CF6\u770C",  // 福島県
  "\u8328\u57CE\u770C",  // 茨城県
  "\u6803\u6728\u770C",  // 栃木県
  "\u7FA4\u99AC\u770C",  // 群馬県
  "\u57FC\u7389\u770C",  // 埼玉県
  "\u5343\u8449\u770C",  // 千葉県
  "\u6771\u4EAC\u90FD",  // 東京都
  "\u795E\u5948\u5DDD\u770C", // 神奈川県
  "\u65B0\u6F5F\u770C",  // 新潟県
  "\u5BCC\u5C71\u770C",  // 富山県
  "\u77F3\u5DDD\u770C",  // 石川県
  "\u798F\u4E95\u770C",  // 福井県
  "\u5C71\u68A8\u770C",  // 山梨県
  "\u9577\u91CE\u770C",  // 長野県
  "\u5C90\u961C\u770C",  // 岐阜県
  "\u9759\u5CA1\u770C",  // 静岡県
  "\u611B\u77E5\u770C",  // 愛知県
  "\u4E09\u91CD\u770C",  // 三重県
  "\u6ECB\u8CC0\u770C",  // 滋賀県
  "\u4EAC\u90FD\u5E9C",  // 京都府
  "\u5927\u962A\u5E9C",  // 大阪府
  "\u5175\u5EAB\u770C",  // 兵庫県
  "\u5948\u826F\u770C",  // 奈良県
  "\u548C\u6B4C\u5C71\u770C", // 和歌山県
  "\u9CE5\u53D6\u770C",  // 鳥取県
  "\u5CF6\u6839\u770C",  // 島根県
  "\u5CA1\u5C71\u770C",  // 岡山県
  "\u5E83\u5CF6\u770C",  // 広島県
  "\u5C71\u53E3\u770C",  // 山口県
  "\u5FB3\u5CF6\u770C",  // 徳島県
  "\u9999\u5DDD\u770C",  // 香川県
  "\u611B\u5A9B\u770C",  // 愛媛県
  "\u9AD8\u77E5\u770C",  // 高知県
  "\u798F\u5CA1\u770C",  // 福岡県
  "\u4F50\u8CC0\u770C",  // 佐賀県
  "\u9577\u5D0E\u770C",  // 長崎県
  "\u718A\u672C\u770C",  // 熊本県
  "\u5927\u5206\u770C",  // 大分県
  "\u5BAE\u5D0E\u770C",  // 宮崎県
  "\u9E7F\u5150\u5CF6\u770C", // 鹿児島県
  "\u6C96\u7E04\u770C",  // 沖縄県
];

// 2026-06-02 \u696D\u7A2E\u3092\u300C\u58F2\u308B\u982D\u304C\u3042\u308B\uFF0B\u5E97\u8217\u30AA\u30FC\u30CA\u30FC\u5BA2\u3092\u6301\u3064\u300D\u5C64\u306B\u518D\u69CB\u6210\u3002
// \u770B\u677F/\u5DE5\u52D9\u5E97/\u53A8\u623F\u6A5F\u5668/\u5546\u696D\u64AE\u5F71/Web\u5236\u4F5C\uFF08\uFF1D\u4F5C\u308B\u7CFB\u30FB\u7269\u7406\u88FD\u9020\u3067"\u5A92\u4F53\u3092\u58F2\u308B\u982D"\u304C\u5F31\u3044\uFF09\u306F\u5916\u3057\u3001
// \u8CA9\u4FC3\u30FB\u96C6\u5BA2\u30FB\u958B\u696D\u652F\u63F4\u30FB\u5E97\u8217\u30B3\u30F3\u30B5\u30EB\uFF08\u65E2\u306B"\u58F2\u308B"\u5546\u58F2\uFF0B\u5E97\u8217\u5BA2\uFF09\u3092\u4E0A\u4F4D\u306B\u3002
const BUSINESS_TYPES = [
  { value: "\u8CA9\u4FC3\u30FB\u96C6\u5BA2\u652F\u63F4\uFF08\u5E97\u8217\u5411\u3051\uFF09", label: "\u8CA9\u4FC3\u30FB\u96C6\u5BA2\u652F\u63F4\uFF08\u5E97\u8217\u5411\u3051\uFF09", keywords: "\u5E97\u8217 \u96C6\u5BA2\u652F\u63F4 \u8CA9\u4FC3\u652F\u63F4 \u96C6\u5BA2\u30B3\u30F3\u30B5\u30EB \u8CA9\u4FC3\u4EE3\u884C" },
  { value: "\u958B\u696D\u30FB\u72EC\u7ACB\u652F\u63F4\u30B3\u30F3\u30B5\u30EB", label: "\u958B\u696D\u30FB\u72EC\u7ACB\u652F\u63F4\u30B3\u30F3\u30B5\u30EB", keywords: "\u958B\u696D\u652F\u63F4 \u72EC\u7ACB\u652F\u63F4 \u5275\u696D\u652F\u63F4 \u958B\u696D\u30B3\u30F3\u30B5\u30EB" },
  { value: "\u5E97\u8217\u30FB\u7D4C\u55B6\u30B3\u30F3\u30B5\u30EB\u30C6\u30A3\u30F3\u30B0", label: "\u5E97\u8217\u30FB\u7D4C\u55B6\u30B3\u30F3\u30B5\u30EB\u30C6\u30A3\u30F3\u30B0", keywords: "\u5E97\u8217\u30B3\u30F3\u30B5\u30EB \u7D4C\u55B6\u30B3\u30F3\u30B5\u30EB \u5E97\u8217\u7D4C\u55B6\u652F\u63F4 \u98F2\u98DF\u5E97\u30B3\u30F3\u30B5\u30EB" },
  { value: "\u8CA9\u4FC3\u30FB\u5E97\u8217\u5411\u3051\u5370\u5237", label: "\u8CA9\u4FC3\u30FB\u5E97\u8217\u5411\u3051\u5370\u5237", keywords: "\u8CA9\u4FC3 \u8CA9\u4FC3\u7269 \u5E97\u8217\u5411\u3051\u5370\u5237 \u30C1\u30E9\u30B7\u5236\u4F5C" },
  { value: "\u5E97\u8217\u5185\u88C5\u30FB\u7A7A\u9593\u30C7\u30B6\u30A4\u30F3", label: "\u5E97\u8217\u5185\u88C5\u30FB\u7A7A\u9593\u30C7\u30B6\u30A4\u30F3\uFF08\u96C6\u5BA2\u5FD7\u5411\uFF09", keywords: "\u5E97\u8217\u5185\u88C5 \u5E97\u8217\u30C7\u30B6\u30A4\u30F3 \u5185\u88C5\u30C7\u30B6\u30A4\u30F3 \u7A7A\u9593\u30C7\u30B6\u30A4\u30F3" },
  { value: "\u5E97\u8217\u30FB\u30C6\u30CA\u30F3\u30C8\u4E0D\u52D5\u7523", label: "\u5E97\u8217\u30FB\u30C6\u30CA\u30F3\u30C8\u7269\u4EF6\u306E\u4E0D\u52D5\u7523", keywords: "\u5E97\u8217\u7269\u4EF6 \u30C6\u30CA\u30F3\u30C8 \u5E97\u8217\u4E0D\u52D5\u7523 \u5546\u696D\u4E0D\u52D5\u7523" },
  { value: "\u30EA\u30D5\u30A9\u30FC\u30E0\u30FB\u5E97\u8217\u6539\u88C5", label: "\u30EA\u30D5\u30A9\u30FC\u30E0\u30FB\u5E97\u8217\u6539\u88C5", keywords: "\u30EA\u30D5\u30A9\u30FC\u30E0 \u30EA\u30CE\u30D9\u30FC\u30B7\u30E7\u30F3 \u5E97\u8217\u6539\u88C5 \u6539\u88C5" },
];

// Existing partner prefectures
const EXISTING_PARTNER_PREFECTURES = [
  "\u6771\u4EAC\u90FD", "\u795E\u5948\u5DDD\u770C", "\u5343\u8449\u770C", "\u57FC\u7389\u770C",
  "\u5927\u962A\u5E9C", "\u611B\u77E5\u770C", "\u798F\u5CA1\u770C", "\u5317\u6D77\u9053",
  "\u5BAE\u57CE\u770C", "\u5E83\u5CF6\u770C", "\u5CA1\u5C71\u770C", "\u9759\u5CA1\u770C",
  "\u4EAC\u90FD\u5E9C", "\u5175\u5EAB\u770C", "\u65B0\u6F5F\u770C", "\u77F3\u5DDD\u770C",
  "\u9577\u91CE\u770C", "\u5C90\u961C\u770C", "\u4E09\u91CD\u770C", "\u5948\u826F\u770C",
  "\u548C\u6B4C\u5C71\u770C", "\u5C71\u53E3\u770C", "\u5FB3\u5CF6\u770C", "\u9999\u5DDD\u770C",
  "\u4F50\u8CC0\u770C", "\u9577\u5D0E\u770C", "\u5BAE\u5D0E\u770C", "\u9E7F\u5150\u5CF6\u770C",
  "\u6C96\u7E04\u770C",
];

const SCORE_LABELS: Record<string, string> = {
  regionPotential: "\u5730\u57DF\u30DD\u30C6\u30F3\u30B7\u30E3\u30EB",     // 地域ポテンシャル
  salesPotential: "\u55B6\u696D\u529B\u30DD\u30C6\u30F3\u30B7\u30E3\u30EB", // 営業力ポテンシャル
  businessScale: "\u4E8B\u696D\u898F\u6A21",           // 事業規模
  digitalLiteracy: "\u30C7\u30B8\u30BF\u30EB\u6D3B\u7528\u5EA6", // デジタル活用度
  motivationEstimate: "\u72EC\u7ACB\u52D5\u6A5F\u306E\u63A8\u5B9A", // 独立動機の推定
  compatibility: "\u76F8\u6027",                         // 相性
};

type Phase = "form" | "searching" | "scoring" | "done" | "error";

// ----------------------------------------------------------------
// Component
// ----------------------------------------------------------------
export function FranchiseSearchPanel() {
  const [phase, setPhase] = useState<Phase>("form");
  const [prefecture, setPrefecture] = useState("");
  const [city, setCity] = useState("");
  const [businessType, setBusinessType] = useState("");
  const [count, setCount] = useState(20);
  const [leads, setLeads] = useState<ScoredPlace[]>([]);
  const [savedNames, setSavedNames] = useState<Set<string>>(new Set());
  const [savingName, setSavingName] = useState<string | null>(null);
  const [selectedNames, setSelectedNames] = useState<Set<string>>(new Set());
  const [bulkSaving, setBulkSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);
  const [adviceLoading, setAdviceLoading] = useState<string | null>(null);
  const [adviceMap, setAdviceMap] = useState<Record<string, AdviceResult>>({});

  const handleSearch = useCallback(async () => {
    if (!prefecture || !businessType) return;
    setPhase("searching");
    setErrorMsg("");

    const bt = BUSINESS_TYPES.find((b) => b.value === businessType);

    try {
      const searchRes = await fetch("/api/franchise-leads/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prefecture,
          city,
          businessType,
          businessTypeKeywords: bt?.keywords ?? "",
          count,
        }),
      });

      if (!searchRes.ok) {
        const err = await searchRes.json();
        throw new Error(err.error || "\u691C\u7D22\u306B\u5931\u6557\u3057\u307E\u3057\u305F");
      }

      const { places } = (await searchRes.json()) as { places: PlaceResult[] };

      if (places.length === 0) {
        throw new Error("\u8A72\u5F53\u3059\u308B\u4F01\u696D\u304C\u898B\u3064\u304B\u308A\u307E\u305B\u3093\u3067\u3057\u305F\u3002\u30A8\u30EA\u30A2\u3084\u696D\u7A2E\u3092\u5909\u66F4\u3057\u3066\u304A\u8A66\u3057\u304F\u3060\u3055\u3044\u3002");
      }

      setPhase("scoring");

      const scoreRes = await fetch("/api/franchise-leads/score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          places,
          businessType,
          area: [city, prefecture].filter(Boolean).join(" "),
        }),
      });

      if (!scoreRes.ok) {
        const err = await scoreRes.json();
        throw new Error(err.error || "\u30B9\u30B3\u30A2\u30EA\u30F3\u30B0\u306B\u5931\u6557\u3057\u307E\u3057\u305F");
      }

      const { scores, analyses } = (await scoreRes.json()) as {
        scores?: ScoreResult[];
        analyses?: Record<string, WebAnalysis>;
      };

      const scoreList = Array.isArray(scores) ? scores : [];

      const merged: ScoredPlace[] = places.map((place) => {
        const s = findScoreByName(scoreList, place.name);
        return {
          ...place,
          score: s ?? {
            name: place.name,
            total: 0,
            breakdown: {
              regionPotential: 0, salesPotential: 0, businessScale: 0,
              digitalLiteracy: 0, motivationEstimate: 0, compatibility: 0,
            },
            comment: "\u30B9\u30B3\u30A2\u30EA\u30F3\u30B0\u5BFE\u8C61\u5916",
          },
          analysis: analyses?.[place.name],
        };
      });

      merged.sort((a, b) => b.score.total - a.score.total);
      setLeads(merged);
      setSavedNames(new Set());
      setSelectedNames(new Set());
      setPhase("done");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "\u4E88\u671F\u3057\u306A\u3044\u30A8\u30E9\u30FC\u304C\u767A\u751F\u3057\u307E\u3057\u305F");
      setPhase("error");
    }
  }, [prefecture, city, businessType, count]);

  const handleSaveLead = useCallback(
    async (lead: ScoredPlace) => {
      if (savedNames.has(lead.name) || savingName) return;
      setSavingName(lead.name);
      try {
        const res = await fetch("/api/franchise-leads", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            companyName: lead.name,
            address: lead.address,
            phone: lead.phone || null,
            website: lead.websiteUrl || null,
            googleMapsUrl: lead.mapsUrl || null,
            rating: lead.rating,
            reviewCount: lead.ratingCount,
            businessType,
            scoreTotal: lead.score.total,
            scoreBreakdown: lead.score.breakdown,
            scoreComment: lead.score.comment,
            hasWebsite: lead.analysis?.hasWebsite ?? false,
            hasYoutube: lead.analysis?.hasYoutube ?? false,
            hasSns: (lead.analysis?.hasSns?.length ?? 0) > 0,
          }),
        });
        if (res.ok) {
          setSavedNames((prev) => new Set(prev).add(lead.name));
        }
      } finally {
        setSavingName(null);
      }
    },
    [savedNames, savingName, businessType]
  );

  // 保存用のリクエストボディに変換（個別・一括で共通）
  const toLeadBody = useCallback(
    (lead: ScoredPlace) => ({
      companyName: lead.name,
      address: lead.address,
      phone: lead.phone || null,
      website: lead.websiteUrl || null,
      googleMapsUrl: lead.mapsUrl || null,
      rating: lead.rating,
      reviewCount: lead.ratingCount,
      businessType,
      scoreTotal: lead.score.total,
      scoreBreakdown: lead.score.breakdown,
      scoreComment: lead.score.comment,
      hasWebsite: lead.analysis?.hasWebsite ?? false,
      hasYoutube: lead.analysis?.hasYoutube ?? false,
      hasSns: (lead.analysis?.hasSns?.length ?? 0) > 0,
    }),
    [businessType]
  );

  // チェックボックスの選択切り替え（保存済みは選べない）
  const toggleSelect = useCallback((name: string) => {
    setSelectedNames((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }, []);

  // 未保存リードを全選択 / 全解除
  const toggleSelectAll = useCallback(() => {
    setSelectedNames((prev) => {
      const selectable = leads.filter((l) => !savedNames.has(l.name)).map((l) => l.name);
      // すでに全選択済みなら解除、そうでなければ全選択
      const allSelected = selectable.length > 0 && selectable.every((n) => prev.has(n));
      return allSelected ? new Set() : new Set(selectable);
    });
  }, [leads, savedNames]);

  // 選択したリードをまとめて保存（POSTは配列を受け付ける）
  const handleBulkSave = useCallback(async () => {
    if (bulkSaving) return;
    const targets = leads.filter(
      (l) => selectedNames.has(l.name) && !savedNames.has(l.name)
    );
    if (targets.length === 0) return;
    setBulkSaving(true);
    try {
      const res = await fetch("/api/franchise-leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(targets.map(toLeadBody)),
      });
      if (res.ok) {
        setSavedNames((prev) => {
          const next = new Set(prev);
          targets.forEach((l) => next.add(l.name));
          return next;
        });
        setSelectedNames(new Set());
      }
    } finally {
      setBulkSaving(false);
    }
  }, [bulkSaving, leads, selectedNames, savedNames, toLeadBody]);

  const handleGetAdvice = useCallback(
    async (lead: ScoredPlace) => {
      if (adviceLoading || adviceMap[lead.name]) return;
      setAdviceLoading(lead.name);
      try {
        const res = await fetch("/api/franchise-leads/advise", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            companyName: lead.name,
            address: lead.address,
            businessType,
            website: lead.websiteUrl || undefined,
            scoreComment: lead.score.comment,
            scoreTotal: lead.score.total,
          }),
        });
        if (res.ok) {
          const advice = await res.json();
          setAdviceMap((prev) => ({ ...prev, [lead.name]: advice }));
        }
      } finally {
        setAdviceLoading(null);
      }
    },
    [adviceLoading, adviceMap, businessType]
  );

  const handleReset = useCallback(() => {
    setPhase("form");
    setLeads([]);
    setErrorMsg("");
    setExpandedIdx(null);
  }, []);

  const isPartnerPref = useMemo(
    () => EXISTING_PARTNER_PREFECTURES.includes(prefecture),
    [prefecture]
  );

  const getPriorityBadge = (score: number) => {
    if (score >= 75) return { label: "S", color: "bg-red-100 text-red-700 border-red-200" };
    if (score >= 60) return { label: "A", color: "bg-orange-100 text-orange-700 border-orange-200" };
    if (score >= 40) return { label: "B", color: "bg-yellow-100 text-yellow-700 border-yellow-200" };
    return { label: "C", color: "bg-zinc-100 text-zinc-600 border-zinc-200" };
  };

  return (
    <div className="space-y-5">
      {/* Search form */}
      {(phase === "form" || phase === "done") && (
        <div className="bg-white rounded-xl border border-zinc-200 px-5 py-4 space-y-4">
          <p className="text-xs font-semibold text-zinc-700">{"\u691C\u7D22\u6761\u4EF6"}</p>

          {/* Priority region quick select */}
          <div>
            <p className="text-[11px] text-zinc-500 mb-2">{"\u512A\u5148\u5730\u57DF\uFF08\u30D1\u30FC\u30C8\u30CA\u30FC\u672A\u9032\u51FA\uFF09"}</p>
            <div className="flex flex-wrap gap-1.5">
              {PRIORITY_PREFECTURES.map((p) => (
                <button
                  key={p}
                  onClick={() => setPrefecture(p)}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-colors ${
                    prefecture === p
                      ? "bg-blue-600 text-white border-blue-600"
                      : "bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100"
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div>
              <label className="text-[11px] text-zinc-500 block mb-1">{"\u90FD\u9053\u5E9C\u770C"}</label>
              <select
                value={prefecture}
                onChange={(e) => setPrefecture(e.target.value)}
                className="w-full border border-zinc-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">{"\u9078\u629E\u3057\u3066\u304F\u3060\u3055\u3044"}</option>
                <optgroup label={"\u512A\u5148\u5730\u57DF"}>
                  {PRIORITY_PREFECTURES.map((p) => (
                    <option key={`p-${p}`} value={p}>{p}</option>
                  ))}
                </optgroup>
                <optgroup label={"\u5168\u90FD\u9053\u5E9C\u770C"}>
                  {ALL_PREFECTURES.map((p, i) => (
                    <option key={`${p}-${i}`} value={p}>
                      {p}
                      {EXISTING_PARTNER_PREFECTURES.includes(p) ? " (\u30D1\u30FC\u30C8\u30CA\u30FC\u6E08)" : ""}
                    </option>
                  ))}
                </optgroup>
              </select>
            </div>

            <div>
              <label className="text-[11px] text-zinc-500 block mb-1">{"\u5E02\u533A\u753A\u6751\uFF08\u4EFB\u610F\uFF09"}</label>
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder={"\u4F8B: \u5BCC\u5C71\u5E02"}
                className="w-full border border-zinc-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="text-[11px] text-zinc-500 block mb-1">{"\u696D\u7A2E"}</label>
              <select
                value={businessType}
                onChange={(e) => setBusinessType(e.target.value)}
                className="w-full border border-zinc-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">{"\u9078\u629E\u3057\u3066\u304F\u3060\u3055\u3044"}</option>
                {BUSINESS_TYPES.map((b) => (
                  <option key={b.value} value={b.value}>{b.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[11px] text-zinc-500 block mb-1">{"\u53D6\u5F97\u4EF6\u6570"}</label>
              <select
                value={count}
                onChange={(e) => setCount(Number(e.target.value))}
                className="w-full border border-zinc-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value={10}>{"10\u4EF6"}</option>
                <option value={20}>{"20\u4EF6"}</option>
                <option value={30}>{"30\u4EF6"}</option>
                <option value={50}>{"50\u4EF6"}</option>
              </select>
            </div>
          </div>

          {prefecture && isPartnerPref && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              <p className="text-xs text-amber-700">
                {prefecture}{"\u306B\u306F\u65E2\u306B\u52A0\u76DF\u30D1\u30FC\u30C8\u30CA\u30FC\u304C\u5B58\u5728\u3057\u307E\u3059\u3002\u30A8\u30EA\u30A2\u91CD\u8907\u306B\u6CE8\u610F\u3057\u3066\u304F\u3060\u3055\u3044\u3002"}
              </p>
            </div>
          )}

          <div className="flex justify-end">
            <Button onClick={handleSearch} disabled={!prefecture || !businessType} className="gap-1.5">
              <Search className="w-4 h-4" />
              {"\u52A0\u76DF\u5019\u88DC\u3092\u691C\u7D22"}
            </Button>
          </div>
        </div>
      )}

      {/* Loading */}
      {(phase === "searching" || phase === "scoring") && (
        <div className="bg-white rounded-xl border border-zinc-200 px-5 py-12 flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
          <p className="text-sm text-zinc-600">
            {phase === "searching"
              ? "\u4F01\u696D\u60C5\u5831\u3092\u53D6\u5F97\u4E2D..."
              : "AI\u304C\u52A0\u76DF\u5019\u88DC\u3092\u30B9\u30B3\u30A2\u30EA\u30F3\u30B0\u4E2D..."}
          </p>
          <p className="text-xs text-zinc-400">
            {phase === "searching"
              ? "Google Places API \u3067\u691C\u7D22\u3057\u3066\u3044\u307E\u3059"
              : "Web\u30B5\u30A4\u30C8\u5206\u6790 + \u52A0\u76DF\u9069\u6027\u3092\u30B9\u30B3\u30A2\u30EA\u30F3\u30B0\u4E2D"}
          </p>
        </div>
      )}

      {/* Error */}
      {phase === "error" && (
        <div className="bg-white rounded-xl border border-red-200 px-5 py-6 flex flex-col items-center gap-3">
          <AlertCircle className="w-8 h-8 text-red-400" />
          <p className="text-sm text-red-600">{errorMsg}</p>
          <Button size="sm" variant="outline" onClick={handleReset}>
            <RotateCcw className="w-3.5 h-3.5" />
            {"\u3084\u308A\u76F4\u3059"}
          </Button>
        </div>
      )}

      {/* Results table */}
      {phase === "done" && leads.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm text-zinc-600">
              {leads.length}{"\u4EF6\u53D6\u5F97"} &mdash;{" "}
              S: {leads.filter((l) => l.score.total >= 75).length}{"\u4EF6"} /{" "}
              A: {leads.filter((l) => l.score.total >= 60 && l.score.total < 75).length}{"\u4EF6"} /{" "}
              B: {leads.filter((l) => l.score.total >= 40 && l.score.total < 60).length}{"\u4EF6"} /{" "}
              C: {leads.filter((l) => l.score.total < 40).length}{"\u4EF6"}
            </p>
            {savedNames.size > 0 && (
              <p className="text-xs text-emerald-600 font-medium">
                {savedNames.size}{"\u4EF6\u3092\u30D1\u30A4\u30D7\u30E9\u30A4\u30F3\u306B\u4FDD\u5B58\u6E08\u307F"}
              </p>
            )}
          </div>

          {/* \u4E00\u62EC\u4FDD\u5B58\u30D0\u30FC */}
          <div className="flex items-center justify-between bg-zinc-50 border border-zinc-200 rounded-lg px-4 py-2.5">
            <label className="flex items-center gap-2 text-xs text-zinc-600 cursor-pointer select-none">
              <input
                type="checkbox"
                className="w-4 h-4 rounded border-zinc-300 text-emerald-600 focus:ring-emerald-500"
                checked={
                  leads.filter((l) => !savedNames.has(l.name)).length > 0 &&
                  leads
                    .filter((l) => !savedNames.has(l.name))
                    .every((l) => selectedNames.has(l.name))
                }
                onChange={toggleSelectAll}
              />
              {"\u672A\u4FDD\u5B58\u3092\u3059\u3079\u3066\u9078\u629E"}
            </label>
            <div className="flex items-center gap-3">
              {selectedNames.size > 0 && (
                <span className="text-xs text-zinc-500">{selectedNames.size}{"\u4EF6\u9078\u629E\u4E2D"}</span>
              )}
              <Button
                size="sm"
                onClick={handleBulkSave}
                disabled={selectedNames.size === 0 || bulkSaving}
                className="gap-1.5"
              >
                {bulkSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                {"\u9078\u629E\u3057\u305F\u5019\u88DC\u3092\u4E00\u62EC\u4FDD\u5B58"}
              </Button>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-100 bg-zinc-50">
                  <th className="text-center px-2 py-2.5 text-xs font-medium text-zinc-500 w-10" />
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-zinc-500 w-8" />
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-zinc-500">{"\u4F01\u696D\u540D"}</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-zinc-500 hidden lg:table-cell">{"\u4F4F\u6240"}</th>
                  <th className="text-center px-4 py-2.5 text-xs font-medium text-zinc-500 w-20">{"\u30B9\u30B3\u30A2"}</th>
                  <th className="text-center px-4 py-2.5 text-xs font-medium text-zinc-500 w-20">{"\u30E9\u30F3\u30AF"}</th>
                  <th className="text-center px-4 py-2.5 text-xs font-medium text-zinc-500 w-20">{"\u64CD\u4F5C"}</th>
                </tr>
              </thead>
              <tbody>
                {leads.map((lead, i) => {
                  const priority = getPriorityBadge(lead.score.total);
                  const isExpanded = expandedIdx === i;
                  const isSaved = savedNames.has(lead.name);
                  const advice = adviceMap[lead.name];

                  return (
                    <tr key={`${lead.name}-${i}`}>
                      <td colSpan={7} className="p-0">
                        <div
                          className="grid grid-cols-[2.5rem_2rem_1fr_5rem_5rem_5rem] lg:grid-cols-[2.5rem_2rem_1fr_1fr_5rem_5rem_5rem] items-center cursor-pointer hover:bg-zinc-50 transition-colors"
                          onClick={() => setExpandedIdx(isExpanded ? null : i)}
                        >
                          <div className="px-2 py-3 flex justify-center" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              className="w-4 h-4 rounded border-zinc-300 text-emerald-600 focus:ring-emerald-500 disabled:opacity-40"
                              checked={selectedNames.has(lead.name)}
                              disabled={isSaved}
                              onChange={() => toggleSelect(lead.name)}
                              aria-label={`${lead.name}を選択`}
                            />
                          </div>
                          <div className="px-4 py-3">
                            {isExpanded ? <ChevronUp className="w-4 h-4 text-zinc-400" /> : <ChevronDown className="w-4 h-4 text-zinc-400" />}
                          </div>
                          <div className="px-4 py-3">
                            <p className="font-medium text-zinc-900 truncate">{lead.name}</p>
                            {lead.googleMapsTypeLabel && (
                              <p className="text-[11px] text-zinc-400 truncate mt-0.5">{lead.googleMapsTypeLabel}</p>
                            )}
                          </div>
                          <div className="px-4 py-3 hidden lg:block">
                            <p className="text-zinc-500 truncate text-xs">{lead.address}</p>
                          </div>
                          <div className="px-4 py-3 text-center">
                            <span className="font-bold text-zinc-900">{lead.score.total}</span>
                          </div>
                          <div className="px-4 py-3 text-center">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold border ${priority.color}`}>
                              {priority.label}
                            </span>
                          </div>
                          <div className="px-4 py-3 text-center">
                            <Button
                              size="xs"
                              variant={isSaved ? "secondary" : "default"}
                              disabled={isSaved || savingName === lead.name}
                              onClick={(e) => { e.stopPropagation(); handleSaveLead(lead); }}
                              className="gap-1"
                            >
                              {savingName === lead.name ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                              {isSaved ? "\u4FDD\u5B58\u6E08" : "\u4FDD\u5B58"}
                            </Button>
                          </div>
                        </div>

                        {/* Expanded panel */}
                        {isExpanded && (
                          <div className="px-6 pb-4 pt-1 border-t border-zinc-100 bg-zinc-50/50">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {/* Score breakdown */}
                              <div>
                                <p className="text-xs font-semibold text-zinc-600 mb-2">{"\u30B9\u30B3\u30A2\u5185\u8A33"}</p>
                                <div className="space-y-1.5">
                                  {Object.entries(lead.score.breakdown).map(([key, val]) => (
                                    <div key={key} className="flex items-center gap-2">
                                      <span className="text-[11px] text-zinc-500 w-32 flex-shrink-0">{SCORE_LABELS[key] ?? key}</span>
                                      <div className="flex-1 bg-zinc-200 rounded-full h-1.5">
                                        <div className="bg-emerald-500 h-1.5 rounded-full" style={{ width: `${Math.min(100, (val / 25) * 100)}%` }} />
                                      </div>
                                      <span className="text-[11px] font-medium text-zinc-700 w-8 text-right">{val}</span>
                                    </div>
                                  ))}
                                </div>
                                <p className="text-xs text-zinc-600 mt-3 bg-white rounded-lg p-2.5 border border-zinc-200">
                                  {lead.score.comment}
                                </p>
                              </div>

                              {/* Company info */}
                              <div className="space-y-3">
                                <div>
                                  <p className="text-xs font-semibold text-zinc-600 mb-2">{"\u4F01\u696D\u60C5\u5831"}</p>
                                  <div className="text-xs space-y-1 text-zinc-600">
                                    <p>{"\u96FB\u8A71: "}{lead.phone || "\u4E0D\u660E"}</p>
                                    <p>{"\u8A55\u4FA1: "}{lead.rating} ({lead.ratingCount}{"\u4EF6"})</p>
                                    <p>Web: {lead.analysis?.summary || "\u672A\u5206\u6790"}</p>
                                  </div>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                  {lead.websiteUrl && (
                                    <a href={lead.websiteUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline">
                                      <ExternalLink className="w-3 h-3" /> {"Web\u30B5\u30A4\u30C8"}
                                    </a>
                                  )}
                                  {lead.mapsUrl && (
                                    <a href={lead.mapsUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline">
                                      <ExternalLink className="w-3 h-3" /> Google Maps
                                    </a>
                                  )}
                                </div>
                                {!advice && (
                                  <Button
                                    size="sm" variant="outline"
                                    onClick={(e) => { e.stopPropagation(); handleGetAdvice(lead); }}
                                    disabled={adviceLoading === lead.name}
                                    className="gap-1.5"
                                  >
                                    {adviceLoading === lead.name ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                                    {"\u55B6\u696D\u30A2\u30D7\u30ED\u30FC\u30C1\u3092\u751F\u6210"}
                                  </Button>
                                )}
                              </div>
                            </div>

                            {/* AI advice */}
                            {advice && (
                              <div className="mt-4 space-y-3 bg-gradient-to-r from-emerald-50 to-teal-50 rounded-lg p-4 border border-emerald-200">
                                <p className="text-xs font-semibold text-emerald-700 flex items-center gap-1.5">
                                  <MessageSquare className="w-3.5 h-3.5" />
                                  {"AI\u55B6\u696D\u30A2\u30C9\u30D0\u30A4\u30B9"}
                                </p>
                                <div>
                                  <p className="text-[11px] font-medium text-emerald-600 mb-1">{"\u8A34\u6C42\u30DD\u30A4\u30F3\u30C8"}</p>
                                  <ul className="text-xs text-zinc-700 space-y-0.5">
                                    {advice.keyPoints.map((p, j) => (
                                      <li key={j} className="flex items-start gap-1.5">
                                        <span className="text-emerald-500 mt-0.5">-</span>{p}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                                <div>
                                  <p className="text-[11px] font-medium text-emerald-600 mb-1">{"\u521D\u56DEDM\u30C6\u30F3\u30D7\u30EC\u30FC\u30C8"}</p>
                                  <p className="text-xs text-zinc-700 bg-white rounded-md p-2.5 border border-emerald-200 whitespace-pre-wrap">{advice.dmTemplate}</p>
                                </div>
                                <div>
                                  <p className="text-[11px] font-medium text-emerald-600 mb-1">{"\u96FB\u8A71\u30C8\u30FC\u30AF\u4F8B"}</p>
                                  <p className="text-xs text-zinc-700 bg-white rounded-md p-2.5 border border-emerald-200 whitespace-pre-wrap">{advice.talkScript}</p>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
