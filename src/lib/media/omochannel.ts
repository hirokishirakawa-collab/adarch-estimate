// ==============================================================
// 媒体データ — omochannel（シミュレーターとブランドキットの共通の正本）
//   ここを直すと、シミュレーターの計算とAI用材料の両方に反映される。
// ==============================================================

export type Target = "japanese" | "inbound";

export type Area   = "national" | "tokyo" | "kansai" | "other";

export type Dur    = "15s" | "30s";

export type Period = "1w" | "4w" | "12w" | "26w" | "52w";

export type InfoPeriod = "2w" | "4w" | "12w" | "26w" | "52w";

export const PERIODS: { id: Period; label: string }[] = [
  { id: "1w",  label: "1週間"           },
  { id: "4w",  label: "4週間"           },
  { id: "12w", label: "1クール（12週）" },
  { id: "26w", label: "半年（26週）"    },
  { id: "52w", label: "年間（52週）"    },
];

export const INFO_PERIODS_JP: { id: InfoPeriod; label: string }[] = [
  { id: "2w",  label: "2週間"           },
  { id: "4w",  label: "4週間"           },
  { id: "12w", label: "1クール（12週）" },
  { id: "26w", label: "半年（26週）"    },
  { id: "52w", label: "年間（52週）"    },
];

export const INFO_PERIODS_IB: { id: InfoPeriod; label: string }[] = [
  { id: "4w",  label: "4週間"           },
  { id: "12w", label: "1クール（12週）" },
  { id: "26w", label: "半年（26週）"    },
  { id: "52w", label: "年間（52週）"    },
];

export const JP_PRICES: Record<"national" | "tokyo" | "kansai", Record<Dur, Record<Period, number>>> = {
  national: {
    "15s": { "1w": 1_500_000, "4w":  3_600_000, "12w":  9_720_000, "26w": 18_360_000, "52w": 34_560_000 },
    "30s": { "1w": 1_875_000, "4w":  4_500_000, "12w": 12_150_000, "26w": 22_950_000, "52w": 43_200_000 },
  },
  tokyo: {
    "15s": { "1w": 1_000_000, "4w":  2_400_000, "12w":  6_480_000, "26w": 12_240_000, "52w": 23_040_000 },
    "30s": { "1w": 1_250_000, "4w":  3_000_000, "12w":  8_100_000, "26w": 15_300_000, "52w": 28_800_000 },
  },
  kansai: {
    "15s": { "1w":   600_000, "4w":  1_440_000, "12w":  3_888_000, "26w":  7_344_000, "52w": 13_824_000 },
    "30s": { "1w":   750_000, "4w":  1_800_000, "12w":  4_860_000, "26w":  9_180_000, "52w": 17_280_000 },
  },
};

export const IB_PRICES: Record<"national" | "tokyo" | "kansai", Partial<Record<Period, number>>> = {
  national: { "4w":  4_000_000, "12w": 10_000_000, "26w": 18_000_000, "52w": 33_000_000 },
  tokyo:    { "4w":  3_000_000, "12w":  7_500_000, "26w": 13_500_000, "52w": 24_750_000 },
  kansai:   { "4w":  1_500_000, "12w":  3_750_000, "26w":  6_750_000, "52w": 12_375_000 },
};

export const INFO_JP: Record<InfoPeriod, number> = {
  "2w":  3_000_000,
  "4w":  5_400_000,
  "12w": 15_300_000,
  "26w": 28_800_000,
  "52w": 50_400_000,
};

export const INFO_IB: Partial<Record<InfoPeriod, number>> = {
  "4w":  5_200_000,
  "12w": 13_000_000,
  "26w": 25_000_000,
  "52w": 46_000_000,
};

export const MIRRORING_MONTHLY = 1_680_000;

export const VOD_PRICES: Record<number, number> = { 1: 2_000_000, 2: 3_200_000, 3: 4_200_000 };

export const AREA_META: Record<"national" | "tokyo" | "kansai" | "other", { label: string; sub: string }> = {
  national: { label: "全国",         sub: "52,963室" },
  tokyo:    { label: "首都圏エリア", sub: "26,015室" },
  kansai:   { label: "関西エリア",   sub: "12,672室" },
  other:    { label: "その他エリア", sub: "単独価格なし" },
};
