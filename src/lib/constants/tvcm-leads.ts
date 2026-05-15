// ---------------------------------------------------------------
// TVCM/動画PR リード獲得 定数（YouTube / PR TIMES / @Press 由来）
// ---------------------------------------------------------------

/**
 * 検索キーワード（ローカル・小規模事業者寄り）
 * 「新CM」「ご当地CM」「ローカルCM」はノイズが多く効果薄のため撤去。
 * 地方中小企業が自社・地元クリエイターで動画を制作して公開した瞬間を狙う。
 * 業種フィルタ（TARGET_INDUSTRY_KEYWORDS）と組み合わせて精度を確保。
 */
export const TVCM_SEARCH_KEYWORDS = [
  "採用動画",
  "会社紹介ムービー",
  "店舗紹介動画",
  "商品紹介動画",
  "ブランディング動画",
  "コンセプトムービー",
  "サービス紹介動画",
  "周年記念ムービー",
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

/**
 * ターゲット業種（地方中小事業者向け）
 * industryGuess に部分一致したらヒット扱い。
 * これに合致しない業種（IT/SaaS/全国チェーン/上場企業 等）は営業対象外として除外。
 */
export const TARGET_INDUSTRY_KEYWORDS = [
  "飲食",
  "レストラン",
  "カフェ",
  "美容",
  "ヘアサロン",
  "サロン",
  "ネイル",
  "エステ",
  "工務",
  "建設",
  "リフォーム",
  "不動産",
  "自動車",
  "整備",
  "歯科",
  "クリニック",
  "整骨",
  "整体",
  "鍼灸",
  "塾",
  "スクール",
  "スイミング",
  "教室",
  "葬儀",
  "葬祭",
  "ペット",
  "観光",
  "旅館",
  "ホテル",
  "民泊",
  "フィットネス",
  "ジム",
  "結婚式",
  "フォトスタジオ",
  "食品",
  "酒造",
  "醸造",
  "農園",
  "牧場",
] as const;

/** 除外エリア（3大都市圏は対象外 — ローカル小規模に絞るため） */
export const EXCLUDED_AREA_KEYWORDS = ["東京", "大阪", "名古屋"] as const;

/** industryGuess がターゲット業種に該当するか判定 */
export function isTargetIndustry(industryGuess: string | null | undefined): boolean {
  if (!industryGuess) return false; // 業種不明は除外（精度優先）
  return TARGET_INDUSTRY_KEYWORDS.some((kw) => industryGuess.includes(kw));
}

/** 本社所在地が除外エリア（東京・大阪・名古屋）に該当するか判定 */
export function isExcludedArea(
  prefecture: string | null | undefined,
  address: string | null | undefined,
): boolean {
  const target = `${prefecture ?? ""} ${address ?? ""}`;
  return EXCLUDED_AREA_KEYWORDS.some((kw) => target.includes(kw));
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
