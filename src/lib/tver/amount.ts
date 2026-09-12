// ==============================================================
// TVer配信実績の「拠点に見せる金額」
//   本部が金額を調整していれば（sellAmountAdjusted）そちらが正。していなければ自動計算（卸値×MULT）
//   内訳は表示回数ではなく「自動計算の金額」の比で按分する（＝表示回数の比と同じ。単価が混在しても崩れない）
//   端数は最大剰余法で配り、内訳の合計が必ず総額と一致するようにする
// ==============================================================

export type Adjustable = { sellAmount: number; sellAmountAdjusted?: number | null };

/** 拠点・MCP・請求に出す金額 */
export const effectiveSell = (r: Adjustable): number => r.sellAmountAdjusted ?? r.sellAmount;

/** 調整されているか */
export const isAdjusted = (r: Adjustable): boolean => r.sellAmountAdjusted != null && r.sellAmountAdjusted !== r.sellAmount;

/**
 * parts を合計が target になるように比例配分する（最大剰余法）。
 * parts の合計が0なら均等割り。負の値は扱わない。
 */
export function allocate(parts: number[], target: number): number[] {
  const n = parts.length;
  if (n === 0) return [];
  const sum = parts.reduce((a, b) => a + b, 0);
  if (sum === target) return [...parts];
  if (sum <= 0) {
    const base = Math.floor(target / n);
    const out = new Array(n).fill(base);
    for (let i = 0; i < target - base * n; i++) out[i] += 1;
    return out;
  }
  const exact = parts.map((p) => (p * target) / sum);
  const out = exact.map((x) => Math.floor(x));
  let rest = target - out.reduce((a, b) => a + b, 0);
  const order = exact
    .map((x, i) => ({ i, frac: x - Math.floor(x) }))
    .sort((a, b) => b.frac - a.frac || a.i - b.i);
  for (let k = 0; rest > 0 && k < order.length; k++, rest--) out[order[k].i] += 1;
  return out;
}

/** 内訳（sellAmount を持つ配列）を調整後の総額に合わせて按分し直す */
export function allocateBreakdown<T extends { sellAmount: number }>(rows: T[], report: Adjustable): T[] {
  if (!isAdjusted(report)) return rows;
  const alloc = allocate(rows.map((r) => r.sellAmount), effectiveSell(report));
  return rows.map((r, i) => ({ ...r, sellAmount: alloc[i] }));
}
