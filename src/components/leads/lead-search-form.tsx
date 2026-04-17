"use client";

import { PREFECTURES } from "@/lib/constants/crm";
import {
  LEAD_INDUSTRY_OPTIONS,
  LEAD_COUNT_OPTIONS,
} from "@/lib/constants/leads";
import { Button } from "@/components/ui/button";
import { Search, Loader2, TrendingUp } from "lucide-react";
import { useState } from "react";
import type { SearchSuggestion } from "@/lib/actions/lead";

interface LeadSearchFormProps {
  onSubmit: (params: {
    prefecture: string;
    city: string;
    industry: string;
    industryKeywords: string;
    count: number;
  }) => void;
  loading: boolean;
  suggestions?: SearchSuggestion[];
}

export function LeadSearchForm({ onSubmit, loading, suggestions = [] }: LeadSearchFormProps) {
  const [freeText, setFreeText] = useState("");
  const [selectedPreset, setSelectedPreset] = useState("");
  const [selectedPref, setSelectedPref] = useState("");

  const handlePresetClick = (value: string) => {
    const opt = LEAD_INDUSTRY_OPTIONS.find((o) => o.value === value);
    if (!opt) return;
    if (selectedPreset === value) {
      // 同じプリセットをクリックしたら解除
      setSelectedPreset("");
      setFreeText("");
    } else {
      setSelectedPreset(value);
      setFreeText(opt.keywords);
    }
  };

  const handleFreeTextChange = (val: string) => {
    setFreeText(val);
    setSelectedPreset(""); // 自由入力したらプリセット解除
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const keywords = freeText.trim();
    if (!keywords) return;

    // プリセットが選択中ならそのラベルを業種名に、それ以外は自由入力テキストを業種名に
    const opt = LEAD_INDUSTRY_OPTIONS.find((o) => o.value === selectedPreset);
    const industryLabel = opt?.label ?? keywords;

    onSubmit({
      prefecture: fd.get("prefecture") as string,
      city: fd.get("city") as string,
      industry: industryLabel,
      industryKeywords: keywords,
      count: Number(fd.get("count")) || 20,
    });
  };

  const handleSuggestionClick = (s: SearchSuggestion) => {
    setFreeText(s.keywords);
    setSelectedPreset("");
    // エリアから都道府県を設定
    const pref = PREFECTURES.find((p) => s.area.includes(p));
    if (pref) setSelectedPref(pref);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* おすすめ検索（営業実績ベース） */}
      {suggestions.length > 0 && (
        <div className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-lg border border-amber-200 px-4 py-3">
          <p className="text-xs font-medium text-amber-800 mb-2 flex items-center gap-1.5">
            <TrendingUp className="w-3.5 h-3.5" />
            営業実績からのおすすめ検索
          </p>
          <div className="flex flex-wrap gap-2">
            {suggestions.map((s, i) => (
              <button
                key={i}
                type="button"
                onClick={() => handleSuggestionClick(s)}
                className="group flex items-center gap-2 px-3 py-1.5 rounded-lg border border-amber-200 bg-white hover:border-amber-400 hover:shadow-sm transition-all text-left"
              >
                <div>
                  <p className="text-xs font-medium text-zinc-800 group-hover:text-amber-800">
                    {s.industryLabel} × {s.area}
                  </p>
                  <p className="text-[10px] text-zinc-500">
                    成功率{s.successRate}%（{s.successCount}/{s.totalCount}件） 平均{s.avgScore}点
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* 都道府県 */}
        <div>
          <label className="block text-xs font-medium text-zinc-700 mb-1">
            都道府県
          </label>
          <select
            name="prefecture"
            required
            value={selectedPref}
            onChange={(e) => setSelectedPref(e.target.value)}
            className="w-full h-9 px-3 rounded-md border border-zinc-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">選択してください</option>
            {PREFECTURES.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>

        {/* 市区町村 */}
        <div>
          <label className="block text-xs font-medium text-zinc-700 mb-1">
            市区町村（任意）
          </label>
          <input
            name="city"
            type="text"
            placeholder="例: 渋谷区"
            className="w-full h-9 px-3 rounded-md border border-zinc-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* 業種キーワード（自由入力メイン） */}
        <div className="sm:col-span-2">
          <label className="block text-xs font-medium text-zinc-700 mb-1">
            業種・検索キーワード
          </label>
          <input
            type="text"
            value={freeText}
            onChange={(e) => handleFreeTextChange(e.target.value)}
            required
            placeholder="例: 美容室 エステ、ハウスメーカー 注文住宅、ヨガスタジオ"
            className="w-full h-9 px-3 rounded-md border border-zinc-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <div className="flex flex-wrap gap-1.5 mt-2">
            {LEAD_INDUSTRY_OPTIONS.filter((o) => o.value !== "other").map((o) => (
              <button
                key={o.value}
                type="button"
                onClick={() => handlePresetClick(o.value)}
                className={`px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors ${
                  selectedPreset === o.value
                    ? "bg-blue-600 text-white border-blue-600"
                    : "bg-white text-zinc-600 border-zinc-200 hover:border-blue-300 hover:text-blue-600"
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>

        {/* 取得件数 */}
        <div>
          <label className="block text-xs font-medium text-zinc-700 mb-1">
            取得件数
          </label>
          <select
            name="count"
            className="w-full h-9 px-3 rounded-md border border-zinc-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            defaultValue={20}
          >
            {LEAD_COUNT_OPTIONS.map((n) => (
              <option key={n} value={n}>
                {n}件
              </option>
            ))}
          </select>
        </div>
      </div>

      <Button type="submit" disabled={loading || !freeText.trim()} className="w-full sm:w-auto">
        {loading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Search className="w-4 h-4" />
        )}
        {loading ? "検索中..." : "リストを生成する"}
      </Button>
    </form>
  );
}
