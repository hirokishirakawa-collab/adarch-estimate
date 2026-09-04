// ==============================================================
// 媒体データ — skylark（シミュレーターとブランドキットの共通の正本）
//   ここを直すと、シミュレーターの計算とAI用材料の両方に反映される。
// ==============================================================

export const MEDIA_FEE_TIERS: { min: number; max: number; fee: number }[] = [
  { min: 100,  max: 149,      fee: 15000 },
  { min: 150,  max: 199,      fee: 14500 },
  { min: 200,  max: 249,      fee: 14000 },
  { min: 250,  max: 299,      fee: 13500 },
  { min: 300,  max: 349,      fee: 13000 },
  { min: 350,  max: 399,      fee: 12500 },
  { min: 400,  max: 449,      fee: 12000 },
  { min: 450,  max: 499,      fee: 11500 },
  { min: 500,  max: 599,      fee: 11000 },
  { min: 600,  max: 699,      fee: 10500 },
  { min: 700,  max: 799,      fee: 10000 },
  { min: 800,  max: 899,      fee:  9500 },
  { min: 900,  max: 999,      fee:  9000 },
  { min: 1000, max: 1499,     fee:  8500 },
  { min: 1500, max: 1999,     fee:  8000 },
  { min: 2000, max: Infinity, fee:  7500 },
];

export function getMediaFeePerStore(count: number): number {
  const tier = MEDIA_FEE_TIERS.find(t => count >= t.min && count <= t.max);
  return tier?.fee ?? 7500;
}

export const STICKER_PROD_BPS = [
  { count: 100,  fee: 6725 },
  { count: 300,  fee: 3817 },
  { count: 500,  fee: 3330 },
  { count: 1000, fee: 2868 },
  { count: 2000, fee: 2694 },
];

export const STAND_PROD_BPS = [
  { count: 100,  fee: 1275 },
  { count: 300,  fee:  644 },
  { count: 500,  fee:  428 },
  { count: 1000, fee:  256 },
  { count: 2000, fee:  174 },
];

export function interpolateFee(count: number, bps: { count: number; fee: number }[]): number {
  if (count <= bps[0].count) return bps[0].fee;
  if (count >= bps[bps.length - 1].count) return bps[bps.length - 1].fee;
  for (let i = 0; i < bps.length - 1; i++) {
    const lo = bps[i];
    const hi = bps[i + 1];
    if (count >= lo.count && count <= hi.count) {
      const t = (count - lo.count) / (hi.count - lo.count);
      return Math.round(lo.fee + t * (hi.fee - lo.fee));
    }
  }
  return bps[0].fee;
}

export const DESIGN_FEE = 50_000; // デザイン制作費（固定・税抜）

export type ProductType = "sticker" | "stand" | "dmb";

export type Brand = "ガスト" | "バーミヤン" | "ジョナサン";

export const ALL_BRANDS: Brand[] = ["ガスト", "バーミヤン", "ジョナサン"];
