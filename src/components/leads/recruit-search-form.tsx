"use client";

import { PREFECTURES } from "@/lib/constants/crm";
import {
  RECRUIT_INDUSTRY_OPTIONS,
  LEAD_COUNT_OPTIONS,
} from "@/lib/constants/leads";
import { Button } from "@/components/ui/button";
import { Search, Loader2 } from "lucide-react";
import { useState } from "react";

interface RecruitSearchFormProps {
  onSubmit: (params: {
    prefecture: string;
    city: string;
    industry: string;
    industryKeywords: string;
    count: number;
  }) => void;
  loading: boolean;
}

export function RecruitSearchForm({ onSubmit, loading }: RecruitSearchFormProps) {
  const [freeText, setFreeText] = useState("");
  const [selectedPreset, setSelectedPreset] = useState("");

  const handlePresetClick = (value: string) => {
    const opt = RECRUIT_INDUSTRY_OPTIONS.find((o) => o.value === value);
    if (!opt) return;
    if (selectedPreset === value) {
      setSelectedPreset("");
      setFreeText("");
    } else {
      setSelectedPreset(value);
      setFreeText(opt.keywords);
    }
  };

  const handleFreeTextChange = (val: string) => {
    setFreeText(val);
    setSelectedPreset("");
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const keywords = freeText.trim();
    if (!keywords) return;

    const opt = RECRUIT_INDUSTRY_OPTIONS.find((o) => o.value === selectedPreset);
    const industryLabel = opt?.label ?? keywords;

    onSubmit({
      prefecture: fd.get("prefecture") as string,
      city: fd.get("city") as string,
      industry: industryLabel,
      industryKeywords: keywords,
      count: Number(fd.get("count")) || 20,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* 都道府県 */}
        <div>
          <label className="block text-xs font-medium text-zinc-700 mb-1">
            都道府県
          </label>
          <select
            name="prefecture"
            required
            className="w-full h-9 px-3 rounded-md border border-zinc-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
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
            className="w-full h-9 px-3 rounded-md border border-zinc-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
        </div>

        {/* 業種・検索キーワード */}
        <div className="sm:col-span-2">
          <label className="block text-xs font-medium text-zinc-700 mb-1">
            業種・検索キーワード
          </label>
          <input
            type="text"
            value={freeText}
            onChange={(e) => handleFreeTextChange(e.target.value)}
            required
            placeholder="例: 介護施設 採用 求人、飲食店 正社員 急募、ITエンジニア 採用"
            className="w-full h-9 px-3 rounded-md border border-zinc-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
          <div className="flex flex-wrap gap-1.5 mt-2">
            {RECRUIT_INDUSTRY_OPTIONS.filter((o) => o.value !== "other").map((o) => (
              <button
                key={o.value}
                type="button"
                onClick={() => handlePresetClick(o.value)}
                className={`px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors ${
                  selectedPreset === o.value
                    ? "bg-amber-600 text-white border-amber-600"
                    : "bg-white text-zinc-600 border-zinc-200 hover:border-amber-300 hover:text-amber-600"
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
            className="w-full h-9 px-3 rounded-md border border-zinc-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
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

      <Button type="submit" disabled={loading || !freeText.trim()} className="w-full sm:w-auto bg-amber-600 hover:bg-amber-700">
        {loading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Search className="w-4 h-4" />
        )}
        {loading ? "検索中..." : "採用企業を検索"}
      </Button>
    </form>
  );
}
