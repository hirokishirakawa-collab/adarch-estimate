"use client";

import { AEON_THEATERS, AEON_AREA_ORDER } from "@/data/aeon-theaters";
import {
  CINEMA_TARGET_INDUSTRIES,
  CINEMA_RADIUS_OPTIONS,
} from "@/lib/constants/cinema-leads";
import { Button } from "@/components/ui/button";
import { Search, Loader2 } from "lucide-react";
import { useState, useMemo } from "react";

interface CinemaSearchFormProps {
  onSubmit: (params: {
    theaterId: number;
    theaterName: string;
    theaterAddress: string;
    radius: number;
    industries: string[];
    count: number;
  }) => void;
  loading: boolean;
}

export function CinemaSearchForm({ onSubmit, loading }: CinemaSearchFormProps) {
  const [selectedArea, setSelectedArea] = useState("");
  const [selectedTheaterId, setSelectedTheaterId] = useState<number | null>(null);
  const [selectedIndustries, setSelectedIndustries] = useState<Set<string>>(new Set());
  const [radius, setRadius] = useState(10);

  const filteredTheaters = useMemo(() => {
    if (!selectedArea) return AEON_THEATERS;
    return AEON_THEATERS.filter((t) => t.area === selectedArea);
  }, [selectedArea]);

  const selectedTheater = useMemo(
    () => AEON_THEATERS.find((t) => t.id === selectedTheaterId),
    [selectedTheaterId]
  );

  const toggleIndustry = (value: string) => {
    setSelectedIndustries((prev) => {
      const next = new Set(prev);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return next;
    });
  };

  const selectAllIndustries = () => {
    setSelectedIndustries(new Set(CINEMA_TARGET_INDUSTRIES.map((i) => i.value)));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTheater || selectedIndustries.size === 0) return;
    onSubmit({
      theaterId: selectedTheater.id,
      theaterName: selectedTheater.name,
      theaterAddress: selectedTheater.address,
      radius: radius * 1000, // km → meters
      industries: Array.from(selectedIndustries),
      count: 50,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* エリア + 劇場 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-zinc-700 mb-1">
            エリア
          </label>
          <select
            value={selectedArea}
            onChange={(e) => {
              setSelectedArea(e.target.value);
              setSelectedTheaterId(null);
            }}
            className="w-full h-9 px-3 rounded-md border border-zinc-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">全国</option>
            {AEON_AREA_ORDER.map((area) => (
              <option key={area} value={area}>
                {area}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-zinc-700 mb-1">
            劇場
          </label>
          <select
            value={selectedTheaterId ?? ""}
            onChange={(e) => setSelectedTheaterId(Number(e.target.value) || null)}
            required
            className="w-full h-9 px-3 rounded-md border border-zinc-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">劇場を選択してください</option>
            {filteredTheaters.map((t) => (
              <option key={t.id} value={t.id}>
                イオンシネマ{t.name}（{t.pref}・{t.sc}スクリーン）
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* 選択中の劇場情報 */}
      {selectedTheater && (
        <div className="text-xs text-zinc-500 bg-zinc-50 rounded-lg px-3 py-2">
          {selectedTheater.facility} | {selectedTheater.address} | {selectedTheater.seats}席
        </div>
      )}

      {/* 検索半径 */}
      <div>
        <label className="block text-xs font-medium text-zinc-700 mb-2">
          検索半径
        </label>
        <div className="flex gap-2">
          {CINEMA_RADIUS_OPTIONS.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRadius(r)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium border transition-colors ${
                radius === r
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-white text-zinc-700 border-zinc-300 hover:bg-zinc-50"
              }`}
            >
              {r}km
            </button>
          ))}
        </div>
      </div>

      {/* 対象業種 */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-medium text-zinc-700">対象業種</label>
          <button
            type="button"
            onClick={selectAllIndustries}
            className="text-[11px] text-blue-600 hover:underline"
          >
            すべて選択
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {CINEMA_TARGET_INDUSTRIES.map((ind) => (
            <button
              key={ind.value}
              type="button"
              onClick={() => toggleIndustry(ind.value)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium border transition-colors ${
                selectedIndustries.has(ind.value)
                  ? "bg-blue-50 text-blue-700 border-blue-300"
                  : "bg-white text-zinc-600 border-zinc-300 hover:bg-zinc-50"
              }`}
            >
              {ind.label}
            </button>
          ))}
        </div>
      </div>

      <Button
        type="submit"
        disabled={loading || !selectedTheaterId || selectedIndustries.size === 0}
        className="w-full sm:w-auto"
      >
        {loading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Search className="w-4 h-4" />
        )}
        {loading ? "検索中..." : "周辺企業を検索"}
      </Button>
    </form>
  );
}
