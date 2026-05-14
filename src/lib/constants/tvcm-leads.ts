// ---------------------------------------------------------------
// TVCM/動画PR リード獲得 定数（YouTube / PR TIMES / @Press 由来）
// ---------------------------------------------------------------

/**
 * 検索キーワード（「公開・発表」を含むフレーズで精度を確保）
 * 一般的すぎる "CM" 単独や "プロモーション" 単独は誤検出が多いため、
 * 動画コンテンツの新規公開発表をシグナリングするフレーズに統一。
 */
export const TVCM_SEARCH_KEYWORDS = [
  "新CM公開",
  "新CM発表",
  "新TVCM",
  "ブランドムービー公開",
  "プロモーションムービー公開",
  "コンセプトムービー公開",
  "ブランドフィルム公開",
  "PR動画公開",
  "ティザームービー公開",
  "採用動画公開",
] as const;

/** 大手代理店リスト（除外対象） */
export const MAJOR_AGENCIES = [
  "電通",
  "博報堂",
  "ADK",
  "ADKマーケティング",
  "ADKホールディングス",
  "東急エージェンシー",
  "大広",
  "読売広告社",
  "サイバーエージェント",
  "セプテーニ",
  "オプト",
  "博報堂DYメディアパートナーズ",
  "博報堂DYホールディングス",
  "サンアド",
  "電通プロモーションプラス",
  "電通東日本",
  "電通西日本",
  "ジェイアール東日本企画",
  "ジェイアール東海エージェンシー",
] as const;

/** 抽出候補（AI抽出後の構造化データ） */
export interface TvcmLeadCandidate {
  pressReleaseUrl: string;
  pressReleaseTitle: string;
  announcedDate: string | null; // ISO date
  companyName: string;
  companyWebsite: string | null;
  prefecture: string | null;
  address: string | null;
  videoUrl: string | null;
  productionCompany: string | null;
  agencyDetected: string | null; // 検出された大手代理店名
  isListed: boolean; // 上場企業か
  capital: number | null; // 円
  employeeCount: number | null;
  industryGuess: string | null;
  summary: string; // AI生成の営業観点サマリー
}

/** フィルタ適用後 */
export interface TvcmLeadResult extends TvcmLeadCandidate {
  excluded: boolean;
  exclusionReason: string | null; // 警告理由（大手代理店/上場 等）
  // クロール時に自動保存されたDB状態（auto-save後にAPI側で付与）
  leadId?: string;
  currentStatus?: "CRAWLED" | "UNTOUCHED" | "CALLED" | "APPOINTMENT" | "DEAL_CONVERTED" | "SKIPPED";
  currentAssigneeName?: string | null;
}

/** 大手代理店名を本文から検出 */
export function detectMajorAgency(text: string): string | null {
  for (const agency of MAJOR_AGENCIES) {
    if (text.includes(agency)) return agency;
  }
  return null;
}

/** 都道府県名から東京かどうか判定（市区町村含む） */
export function isTokyo(prefecture: string | null | undefined, address: string | null | undefined): boolean {
  const target = `${prefecture ?? ""} ${address ?? ""}`;
  return target.includes("東京都") || /東京$/.test(prefecture ?? "");
}

/** 情報元プラットフォーム */
export type TvcmSourcePlatform = "youtube" | "prtimes" | "atpress" | "unknown";

/** pressReleaseUrl から情報元プラットフォームを判定 */
export function detectTvcmSourcePlatform(
  url: string | null | undefined,
): TvcmSourcePlatform {
  if (!url) return "unknown";
  if (url.includes("youtube.com") || url.includes("youtu.be")) return "youtube";
  if (url.includes("prtimes.jp")) return "prtimes";
  if (url.includes("atpress.ne.jp")) return "atpress";
  return "unknown";
}

/** 情報元プラットフォームの表示名 */
export const TVCM_SOURCE_LABEL: Record<TvcmSourcePlatform, string> = {
  youtube: "YouTube",
  prtimes: "PR TIMES",
  atpress: "@Press",
  unknown: "その他",
};
