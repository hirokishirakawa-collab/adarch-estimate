// ---------------------------------------------------------------
// 購買シグナル（「買う気配」）
//
// リストを上から当たるのをやめ、シグナルが立った直後に当たるための軸。
// 既存のAIスコア（業種一致度などの質の判定）は残したまま、
// 「質が同じなら新しい方を先に」という2軸目として使う。
// ---------------------------------------------------------------

export type SignalKind = "SUBSIDY" | "TVCM" | "RECRUIT" | "FOUND";

export const SIGNAL_KIND_LABEL: Record<SignalKind, string> = {
  SUBSIDY: "補助金が通った",
  TVCM: "CMを発表した",
  RECRUIT: "求人を出している",
  FOUND: "発掘",
};

/** シグナルの強さ。同じ鮮度ならこの順で優先する */
export const SIGNAL_KIND_WEIGHT: Record<SignalKind, number> = {
  SUBSIDY: 3, // 予算がついた＝一番強い
  TVCM: 2, // 広告に金を使う会社だと確定している
  RECRUIT: 1, // 採用に金をかける気がある
  FOUND: 0, // シグナルなし
};

/** 鮮度の帯。声かけの優先度はここで決まる */
export const FRESHNESS_BANDS = [
  { maxDays: 14, key: "hot", label: "14日以内", icon: "◎" },
  { maxDays: 30, key: "warm", label: "30日以内", icon: "○" },
  { maxDays: 90, key: "cool", label: "90日以内", icon: "△" },
] as const;

export type FreshnessKey = "hot" | "warm" | "cool" | "cold";

export interface Freshness {
  key: FreshnessKey;
  label: string;
  icon: string;
  days: number;
}

/** シグナルが立ってからの経過日数と帯を返す。signalAt が無ければ null */
export function getFreshness(
  signalAt: Date | string | null | undefined,
  now: Date = new Date()
): Freshness | null {
  if (!signalAt) return null;
  const d = signalAt instanceof Date ? signalAt : new Date(signalAt);
  if (isNaN(d.getTime())) return null;

  const days = Math.max(0, Math.floor((now.getTime() - d.getTime()) / 86_400_000));
  for (const band of FRESHNESS_BANDS) {
    if (days <= band.maxDays) {
      return { key: band.key, label: band.label, icon: band.icon, days };
    }
  }
  return { key: "cold", label: "90日超", icon: "·", days };
}

/**
 * 認定日などの文字列（"YYYY-MM-DD"）を Date にする。
 * 解釈できない値・未来の日付は null（シグナルとして使わない）。
 */
export function parseSignalDate(raw: string | null | undefined): Date | null {
  if (!raw) return null;
  const d = new Date(raw);
  if (isNaN(d.getTime())) return null;
  if (d.getTime() > Date.now()) return null;
  return d;
}

/**
 * 保存時に入れるシグナルを決める。
 * 実際の日付を持つシグナルが取れなければ「発掘日」に倒す。
 */
export function resolveSignal(
  kind: SignalKind,
  at: Date | null,
  now: Date = new Date()
): { signalAt: Date; signalKind: SignalKind } {
  if (at) return { signalAt: at, signalKind: kind };
  return { signalAt: now, signalKind: kind === "FOUND" ? "FOUND" : kind };
}

/**
 * 既存リードのシグナルを更新すべきか。
 * 新しい日付のときだけ上書きする（古いシグナルで塗り替えない）。
 */
export function shouldReplaceSignal(
  existing: { signalAt: Date | null },
  next: { signalAt: Date }
): boolean {
  if (!existing.signalAt) return true;
  return next.signalAt.getTime() > existing.signalAt.getTime();
}
