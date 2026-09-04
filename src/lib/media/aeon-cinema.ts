// ==============================================================
// 媒体データ — aeon-cinema（シミュレーターとブランドキットの共通の正本）
//   ここを直すと、シミュレーターの計算とAI用材料の両方に反映される。
// ==============================================================

import type { CinemaAdColKey, LobbyColKey } from "@/data/aeon-theaters";

export function dcpFee(seconds: number): number {
  // ¥40,000/素材・60秒まで。60秒超は60秒毎 +¥10,000
  return 40_000 + Math.ceil(Math.max(0, seconds - 60) / 60) * 10_000;
}

export function deliveryFee(theaterCount: number): number {
  if (theaterCount === 0) return 0;
  if (theaterCount <= 5) return 10_000;
  return 6_000 * theaterCount;
}

export const COL_INDEX: Record<CinemaAdColKey, number> = {
  spec2w:   0,
  spec4w:   1,
  all26_2w: 2,
  all26_4w: 3,
  all26m:   4,
  all26t:   5,
  all52m:   6,
  all52t:   7,
};

export const LOBBY_COL_INDEX: Record<LobbyColKey, number> = {
  flyer:    0,
  poster:   1,
  display:  2,
  sampling: 3,
  demo:     4,
  entrance: 5,
};
