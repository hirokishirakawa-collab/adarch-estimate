/**
 * AIが返すスコアの企業名と元の企業名をファジーマッチングする。
 * 全角/半角・空白・括弧の違いでマッチ失敗するケースを防ぐ。
 */

function normalize(s: string): string {
  return s
    .normalize("NFKC")
    .replace(/[\s\u3000\u00A0]+/g, "")
    .toLowerCase();
}

export function findScoreByName<T extends { name: string }>(
  scores: T[],
  targetName: string,
): T | undefined {
  // 1) 完全一致
  const exact = scores.find((s) => s.name === targetName);
  if (exact) return exact;

  // 2) 正規化マッチング
  const nt = normalize(targetName);
  const normed = scores.find((s) => normalize(s.name) === nt);
  if (normed) return normed;

  // 3) 部分一致（一方が他方を含む）
  return scores.find((s) => {
    const ns = normalize(s.name);
    return ns.includes(nt) || nt.includes(ns);
  });
}
