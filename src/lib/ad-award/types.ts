// ==============================================================
// 広告賞ファインダー: 型定義
// DBは持たない。正本は curated.ts の1ファイル。
// ==============================================================

export type AwardScope = "NATIONAL" | "REGIONAL" | "INTERNATIONAL";

/** 日程の確度。HIGH=公式ページで日付まで確認 / MEDIUM=存在は確実・日程は要確認 / LOW=存在未確認 */
export type AwardConfidence = "HIGH" | "MEDIUM" | "LOW";

/** 狙いやすさ（本部の見立て）。LOCAL=地元・応募すれば入賞圏 / MID=中堅 / HARD=大手代理店中心 */
export type AwardWinTier = "LOCAL" | "MID" | "HARD";

export const AWARD_CATEGORIES = [
  "TVCM",
  "WEB動画",
  "ラジオCM",
  "新聞",
  "雑誌",
  "OOH交通",
  "デジタルWeb",
  "PR",
  "BtoB",
  "キャンペーン総合",
  "デザイン",
  "パッケージ",
  "学生",
  "その他",
] as const;

export type AwardCategory = (typeof AWARD_CATEGORIES)[number];

export interface AdAward {
  id: string;
  name: string;
  nameEn: string | null;
  organizer: string;
  scope: AwardScope;
  /** 地方賞の地域名（例「香川県」「九州」）。全国・国際は null */
  region: string | null;
  /** 地方賞が対象にする都道府県（フル名）。全国・国際は空配列 */
  prefectures: string[];
  categories: AwardCategory[];
  eligibility: string | null;
  entryOpenMonth: number | null;
  entryOpenDay: number | null;
  entryCloseMonth: number | null;
  entryCloseDay: number | null;
  /** 確認時に見つけた応募期間の原文 */
  entryPeriodRaw: string | null;
  announceMonth: number | null;
  ceremonyRaw: string | null;
  feeRaw: string | null;
  url: string | null;
  sourceUrl: string | null;
  /** 日程を確認した回の年 */
  verifiedYear: number | null;
  difficultyNote: string | null;
  /** 提案書に貼れる一文 */
  pitchNote: string | null;
  confidence: AwardConfidence;
  winTier: AwardWinTier;
}
