// ---------------------------------------------------------------
// イオンシネマ広告 リード獲得 定数
// ---------------------------------------------------------------

import type { PlaceLead, WebsiteAnalysis, LeadScore } from "./leads";

/** イオンシネマ対象業種 */
export const CINEMA_TARGET_INDUSTRIES: readonly CinemaIndustryDef[] = [
  { value: "real_estate", label: "不動産・ハウスメーカー", placeType: "real_estate_agency", keywords: "不動産 ハウスメーカー 住宅展示場 マンション 賃貸" },
  { value: "car_dealer", label: "自動車ディーラー", placeType: "car_dealer", keywords: "自動車販売 カーディーラー 中古車販売" },
  { value: "wedding", label: "結婚式場・ブライダル", placeType: null, keywords: "結婚式場 ブライダル ウェディング" },
  { value: "eye_clinic", label: "眼科", placeType: "doctor", keywords: "眼科 アイクリニック レーシック" },
  { value: "dental", label: "歯科", placeType: "dentist", keywords: "歯科 歯医者 矯正歯科 インプラント" },
  { value: "construction", label: "建設業（採用向け）", placeType: null, keywords: "建設会社 工務店 リフォーム 施工" },
];

interface CinemaIndustryDef {
  value: string;
  label: string;
  placeType: string | null;
  keywords: string;
}

export type CinemaIndustryValue = string;

/** 検索半径オプション (km) */
export const CINEMA_RADIUS_OPTIONS = [3, 5, 10, 15, 20] as const;
export type CinemaRadius = (typeof CINEMA_RADIUS_OPTIONS)[number];

/** 距離帯の色 */
export const RADIUS_BAND_COLORS: Record<number, { bg: string; border: string; text: string; mapColor: string }> = {
  3:  { bg: "bg-red-50",    border: "border-red-200",    text: "text-red-700",    mapColor: "#ef4444" },
  5:  { bg: "bg-orange-50", border: "border-orange-200", text: "text-orange-700", mapColor: "#f97316" },
  10: { bg: "bg-yellow-50", border: "border-yellow-200", text: "text-yellow-700", mapColor: "#eab308" },
  15: { bg: "bg-blue-50",   border: "border-blue-200",   text: "text-blue-700",   mapColor: "#3b82f6" },
  20: { bg: "bg-zinc-50",   border: "border-zinc-200",   text: "text-zinc-600",   mapColor: "#71717a" },
};

/** シネアド特化スコア項目 (合計100点) */
export const CINEMA_SCORE_ITEMS = [
  { key: "industryMatch", label: "業種適合度", max: 25 },
  { key: "proximity", label: "劇場距離", max: 20 },
  { key: "scale", label: "規模感", max: 15 },
  { key: "digitalPresence", label: "デジタル活用度", max: 15 },
  { key: "localFit", label: "地域密着度", max: 15 },
  { key: "accessibility", label: "接触しやすさ", max: 10 },
] as const;

export type CinemaScoreKey = (typeof CINEMA_SCORE_ITEMS)[number]["key"];

/** シネアドリードの拡張型 */
export interface CinemaPlaceLead extends PlaceLead {
  distanceKm: number;
  radiusBand: number; // 3, 5, 10, 15, 20
  lat: number;
  lng: number;
}

export interface CinemaLeadScore {
  total: number;
  breakdown: Record<CinemaScoreKey, number>;
  comment: string;
}

export interface ScoredCinemaLead extends CinemaPlaceLead {
  score: CinemaLeadScore;
  digitalAnalysis?: WebsiteAnalysis;
}

/** 距離帯を判定する */
export function getRadiusBand(distanceKm: number): number {
  if (distanceKm <= 3) return 3;
  if (distanceKm <= 5) return 5;
  if (distanceKm <= 10) return 10;
  if (distanceKm <= 15) return 15;
  return 20;
}
