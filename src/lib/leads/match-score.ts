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

/** 企業名から法人格を除去して正規化（既存リード照合の表記揺れ対応） */
export function normalizeCompanyName(name: string): string {
  return name
    .normalize("NFKC")
    .replace(/[\s\u3000\u00A0]+/g, "")
    .replace(/株式会社|有限会社|合同会社|合資会社|一般社団法人|一般財団法人|公益社団法人|公益財団法人|医療法人|社会福祉法人|学校法人|宗教法人|NPO法人|特定非営利活動法人/g, "")
    .replace(/[（(]\s*株\s*[）)]/g, "")
    .replace(/[（(]\s*有\s*[）)]/g, "")
    .replace(/[（(]\s*合\s*[）)]/g, "")
    .toLowerCase();
}

export function findScoreByName<T extends { name: string }>(
  scores: T[],
  targetName: string,
): T | undefined {
  // AI出力には null や name 欠落の要素が混ざりうるため、有効な要素だけに絞る
  const valid = (scores ?? []).filter(
    (s): s is T => !!s && typeof s.name === "string",
  );

  // 1) 完全一致
  const exact = valid.find((s) => s.name === targetName);
  if (exact) return exact;

  // 2) 正規化マッチング
  const nt = normalize(targetName);
  const normed = valid.find((s) => normalize(s.name) === nt);
  if (normed) return normed;

  // 3) 部分一致（一方が他方を含む — 短すぎる名前の誤マッチ防止）
  if (nt.length >= 4) {
    return valid.find((s) => {
      const ns = normalize(s.name);
      if (ns.length < 4) return false;
      return ns.includes(nt) || nt.includes(ns);
    });
  }
  return undefined;
}
