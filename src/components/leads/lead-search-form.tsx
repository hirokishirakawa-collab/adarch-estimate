"use client";

import { PREFECTURES } from "@/lib/constants/crm";
import {
  LEAD_INDUSTRY_OPTIONS,
  LEAD_COUNT_OPTIONS,
  MEDIA_MENU_OPTIONS,
} from "@/lib/constants/leads";
import { Button } from "@/components/ui/button";
import { Search, Loader2, Tv, Briefcase } from "lucide-react";
import { useState } from "react";

export type SearchMode = "industry" | "media";

interface LeadSearchFormProps {
  onSubmit: (params: {
    prefecture: string;
    city: string;
    industry: string;
    industryKeywords: string;
    count: number;
    mediaValue?: string;
    mediaScoringHint?: string;
  }) => void;
  loading: boolean;
}

export function LeadSearchForm({ onSubmit, loading }: LeadSearchFormProps) {
  const [mode, setMode] = useState<SearchMode>("industry");
  const [selectedIndustry, setSelectedIndustry] = useState("");
  const [selectedMedia, setSelectedMedia] = useState("");
  const mediaOption = MEDIA_MENU_OPTIONS.find((o) => o.value === selectedMedia);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);

    if (mode === "media") {
      if (!mediaOption) return;
      onSubmit({
        prefecture: fd.get("prefecture") as string,
        city: fd.get("city") as string,
        industry: mediaOption.label + " 向けリード",
        industryKeywords: mediaOption.searchKeywords,
        count: Number(fd.get("count")) || 20,
        mediaValue: mediaOption.value,
        mediaScoringHint: mediaOption.scoringHint,
      });
    } else {
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
    }
  };

  return (
    <div className="space-y-4">
      {/* モード切り替え */}
      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => setMode("industry")}
          className={`flex items-center gap-3 px-4 py-3.5 rounded-xl text-left border-2 transition-all ${
            mode === "industry"
              ? "bg-blue-50 border-blue-500 shadow-md ring-2 ring-blue-200"
              : "bg-white border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50"
          }`}
        >
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
            mode === "industry" ? "bg-blue-500" : "bg-zinc-100"
          }`}>
            <Briefcase className={`w-5 h-5 ${mode === "industry" ? "text-white" : "text-zinc-400"}`} />
          </div>
          <div>
            <p className={`text-sm font-bold ${mode === "industry" ? "text-blue-700" : "text-zinc-600"}`}>
              業種から探す
            </p>
            <p className={`text-[10px] mt-0.5 ${mode === "industry" ? "text-blue-500" : "text-zinc-400"}`}>
              業種 x 地域で見込み顧客を検索
            </p>
          </div>
        </button>
        <button
          type="button"
          onClick={() => setMode("media")}
          className={`flex items-center gap-3 px-4 py-3.5 rounded-xl text-left border-2 transition-all ${
            mode === "media"
              ? "bg-orange-50 border-orange-500 shadow-md ring-2 ring-orange-200"
              : "bg-white border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50"
          }`}
        >
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
            mode === "media" ? "bg-orange-500" : "bg-zinc-100"
          }`}>
            <Tv className={`w-5 h-5 ${mode === "media" ? "text-white" : "text-zinc-400"}`} />
          </div>
          <div>
            <p className={`text-sm font-bold ${mode === "media" ? "text-orange-700" : "text-zinc-600"}`}>
              媒体メニューから探す
            </p>
            <p className={`text-[10px] mt-0.5 ${mode === "media" ? "text-orange-500" : "text-zinc-400"}`}>
              広告媒体に響く企業を抽出
            </p>
          </div>
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* 媒体モード */}
        {mode === "media" && (
          <>
            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1">
                広告媒体
              </label>
              <select
                value={selectedMedia}
                onChange={(e) => setSelectedMedia(e.target.value)}
                required
                className="w-full h-9 px-3 rounded-md border border-zinc-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
              >
                <option value="">媒体を選択してください</option>
                {MEDIA_MENU_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            {mediaOption && (
              <div className="rounded-lg border border-orange-200 bg-orange-50 px-4 py-3 space-y-1.5">
                <p className="text-xs text-orange-700 font-medium">{mediaOption.label}</p>
                <p className="text-[11px] text-zinc-600">{mediaOption.description}</p>
                <p className="text-[10px] text-zinc-500">
                  相性の良い業種: {mediaOption.targetIndustries.map((v) => LEAD_INDUSTRY_OPTIONS.find((o) => o.value === v)?.label).filter(Boolean).join("、")}
                </p>
              </div>
            )}

          </>
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

          {/* 業種モード時のみ */}
          {mode === "industry" && (
            <>
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
            </>
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
          {loading ? "検索中..." : mode === "media" ? "媒体に響く企業を検索" : "リストを生成する"}
        </Button>
      </form>
    </div>
  );
}
