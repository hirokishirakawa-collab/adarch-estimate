"use client";

import { PREFECTURES } from "@/lib/constants/crm";
import {
  LEAD_INDUSTRY_OPTIONS,
  LEAD_COUNT_OPTIONS,
} from "@/lib/constants/leads";
import { Button } from "@/components/ui/button";
import { Search, Loader2 } from "lucide-react";
import { useState } from "react";

interface LeadSearchFormProps {
  onSubmit: (params: {
    prefecture: string;
    city: string;
    industry: string;
    industryKeywords: string;
    count: number;
  }) => void;
  loading: boolean;
}

export function LeadSearchForm({ onSubmit, loading }: LeadSearchFormProps) {
  const [selectedIndustry, setSelectedIndustry] = useState("");

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const industryValue = fd.get("industry") as string;
    const opt = LEAD_INDUSTRY_OPTIONS.find((o) => o.value === industryValue);
    const customKeywords = (fd.get("customKeywords") as string) ?? "";
    onSubmit({
      prefecture: fd.get("prefecture") as string,
      city: fd.get("city") as string,
      industry: opt?.label ?? customKeywords,
      industryKeywords: industryValue === "other" ? customKeywords : (opt?.keywords ?? ""),
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

        {/* 業種 */}
        <div>
          <label className="block text-xs font-medium text-zinc-700 mb-1">
            業種
          </label>
          <select
            name="industry"
            required
            value={selectedIndustry}
            onChange={(e) => setSelectedIndustry(e.target.value)}
            className="w-full h-9 px-3 rounded-md border border-zinc-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">選択してください</option>
            {LEAD_INDUSTRY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        {selectedIndustry === "other" && (
          <div>
            <label className="block text-xs font-medium text-zinc-700 mb-1">
              検索キーワード
            </label>
            <input
              name="customKeywords"
              type="text"
              required
              placeholder="例: 物流会社、イベント企画"
              className="w-full h-9 px-3 rounded-md border border-zinc-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        )}

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

      <Button type="submit" disabled={loading} className="w-full sm:w-auto">
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
