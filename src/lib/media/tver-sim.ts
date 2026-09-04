// ==============================================================
// 媒体データ — tver-sim（シミュレーターとブランドキットの共通の正本）
//   ここを直すと、シミュレーターの計算とAI用材料の両方に反映される。
// ==============================================================

export const TVER_PENETRATION = 0.30; // TVer普及率（約30%）

export const TAX_RATE = 0.10;

export type AdSeconds = 6 | 15 | 30 | 45 | 60;

export const AD_FORMATS: { seconds: AdSeconds; label: string; cpm: number; note?: string }[] = [
  { seconds: 6,  label: "6秒",  cpm: 3200, note: "バンパー" },
  { seconds: 15, label: "15秒", cpm: 4400, note: "標準" },
  { seconds: 30, label: "30秒", cpm: 5200 },
  { seconds: 45, label: "45秒", cpm: 6000 },
  { seconds: 60, label: "60秒", cpm: 7400 },
];

export const SELL_MULTIPLIER = 1.5;

export const sellCpm = (seconds: AdSeconds) =>
  (AD_FORMATS.find((f) => f.seconds === seconds)?.cpm ?? 0) * SELL_MULTIPLIER;

export function calcAdArchFees(mediaBudget: number, isFirstTransaction: boolean, creativeCount: number) {
  // 媒体管理費: 50万以下→10万固定, 50万超→20%
  const managementFee = mediaBudget <= 500000 ? 100000 : mediaBudget * 0.20;
  // クリエイティブ考査費（1本3万円 × 本数、0本なら無し）
  const creativeFee = 30000 * creativeCount;
  // 初期取引（業態考査含む）
  const initialFee = isFirstTransaction ? 150000 : 0;

  const subtotal = managementFee + creativeFee + initialFee;
  return { managementFee, creativeFee, creativeCount, initialFee, subtotal };
}
