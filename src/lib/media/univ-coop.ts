// ==============================================================
// 媒体データ — univ-coop（シミュレーターとブランドキットの共通の正本）
//   ここを直すと、シミュレーターの計算とAI用材料の両方に反映される。
// ==============================================================

export const PRINT_TIERS: { min: number; max: number; unitPrice: number }[] = [
  { min: 100,  max: 299,      unitPrice: 1800 },
  { min: 300,  max: 399,      unitPrice:  670 },
  { min: 400,  max: 499,      unitPrice:  500 },
  { min: 500,  max: 999,      unitPrice:  430 },
  { min: 1000, max: 1499,     unitPrice:  230 },
  { min: 1500, max: 1999,     unitPrice:  175 },
  { min: 2000, max: 2999,     unitPrice:  155 },
  { min: 3000, max: 4999,     unitPrice:  130 },
  { min: 5000, max: Infinity, unitPrice:  110 },
];

export function getPrintUnitPrice(totalSheets: number): number | null {
  const tier = PRINT_TIERS.find(t => totalSheets >= t.min && totalSheets <= t.max);
  return tier?.unitPrice ?? null;
}

export const PLACEMENT_UNIT = 700;   // 掲載費 ¥700/枚

export const SHIPPING_UNIT  = 2600;  // 発送費 ¥2,600/食堂

export const DESIGN_FEE     = 150000; // デザイン制作費 ¥150,000/案
