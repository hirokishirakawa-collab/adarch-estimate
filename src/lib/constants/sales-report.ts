// ==============================================================
// 月次報告（売上）の明細行 — 共通ロジック
// フォーム（client）とサーバーアクションの双方から使う。
// ==============================================================

/** 消費税率（10%） */
export const TAX_RATE = 0.1;

/** 請求元区分 */
export type BilledBy = "SELF" | "HQ";

export const BILLED_BY_LABEL: Record<BilledBy, string> = {
  SELF: "自分で請求",
  HQ: "本部から請求",
};

/** 明細1行（フォーム／保存で共通に使う形） */
export interface RevenueItemInput {
  billedBy: BilledBy;
  clientName: string;
  projectName: string;
  amountExclTax: number; // 税抜
  memo: string;
}

/** 税抜 → 消費税額（円未満四捨五入。請求依頼と同じ方式） */
export function calcTax(amountExclTax: number): number {
  return Math.round(amountExclTax * TAX_RATE);
}

/** 税抜 → 税込 */
export function calcInclTax(amountExclTax: number): number {
  return amountExclTax + calcTax(amountExclTax);
}

/** 請求元別の税抜合計 */
export function sumByBilledBy(items: RevenueItemInput[], billedBy: BilledBy): number {
  return items
    .filter((i) => i.billedBy === billedBy)
    .reduce((sum, i) => sum + (Number(i.amountExclTax) || 0), 0);
}

/** 税抜総合計 */
export function sumExclTax(items: RevenueItemInput[]): number {
  return items.reduce((sum, i) => sum + (Number(i.amountExclTax) || 0), 0);
}

/**
 * 明細の案件名から、一覧表示用の要約テキストを作る。
 * 例: 「○○株式会社 CM制作 他2件」
 */
export function summarizeProjectNames(items: RevenueItemInput[]): string | null {
  const names = items.map((i) => i.projectName.trim()).filter(Boolean);
  if (names.length === 0) return null;
  if (names.length === 1) return names[0].slice(0, 200);
  return `${names[0]} 他${names.length - 1}件`.slice(0, 200);
}

/**
 * フォームから送られた JSON 文字列を明細配列に復元する。
 * 不正な行（クライアント名・案件名が空 / 金額が負）はエラーを返す。
 */
export function parseItemsJson(
  raw: string | null | undefined
): { ok: true; items: RevenueItemInput[] } | { ok: false; error: string } {
  if (!raw || !raw.trim()) return { ok: true, items: [] };

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, error: "明細の形式が正しくありません" };
  }
  if (!Array.isArray(parsed)) return { ok: false, error: "明細の形式が正しくありません" };
  if (parsed.length > 100) return { ok: false, error: "明細は100行までです" };

  const items: RevenueItemInput[] = [];
  for (const [index, row] of parsed.entries()) {
    if (typeof row !== "object" || row === null) return { ok: false, error: "明細の形式が正しくありません" };
    const r = row as Record<string, unknown>;

    const clientName = String(r.clientName ?? "").trim();
    const projectName = String(r.projectName ?? "").trim();
    const amountRaw = String(r.amountExclTax ?? "").replace(/,/g, "").trim();
    const memo = String(r.memo ?? "").trim();
    const billedBy: BilledBy = r.billedBy === "HQ" ? "HQ" : "SELF";

    // 完全な空行は無視（フォームで追加しただけの行）
    if (!clientName && !projectName && !amountRaw && !memo) continue;

    const lineNo = index + 1;
    if (!clientName) return { ok: false, error: `${lineNo}行目: クライアント名を入力してください` };
    if (!projectName) return { ok: false, error: `${lineNo}行目: 案件名を入力してください` };

    const amountExclTax = amountRaw ? Number(amountRaw) : NaN;
    if (!amountRaw || !Number.isFinite(amountExclTax) || !Number.isInteger(amountExclTax) || amountExclTax < 0)
      return { ok: false, error: `${lineNo}行目: 金額（税抜）は0以上の整数で入力してください` };

    items.push({
      billedBy,
      clientName: clientName.slice(0, 200),
      projectName: projectName.slice(0, 200),
      amountExclTax,
      memo: memo.slice(0, 1000),
    });
  }

  return { ok: true, items };
}
