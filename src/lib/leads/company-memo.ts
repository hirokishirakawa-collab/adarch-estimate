// ---------------------------------------------------------------
// リード獲得AI → リード管理 に流すときの「会社内容」メモ生成
//
// 検索結果の詳細パネルには Google概要・レビュー要約・企業タイプ・
// 事業内容といった「その会社が何をしているか」が出るが、保存すると
// 捨てられていた。声かけ時に一番効くのがこの情報なので、保存時に
// リードのメモ欄へ落とす。
//
// リード管理のメモ欄は1行 input で編集する（改行は入力時に落ちる）ため、
// 改行は使わず「／」区切りの1行にまとめる。
// ---------------------------------------------------------------

import type {
  ScoredLead,
  ScoredBtoBLead,
  ScoredRecruitLead,
  WebsiteAnalysis,
  BusinessType,
} from "@/lib/constants/leads";
import type { ScoredCinemaLead } from "@/lib/constants/cinema-leads";

/** 1項目あたりの上限。メモ欄が長文で埋まらないように切る */
const ITEM_MAX = 160;
/** メモ全体の上限 */
const TOTAL_MAX = 600;

const BUSINESS_TYPE_LABEL: Record<BusinessType, string> = {
  independent: "独立企業",
  chain: "チェーン店",
  franchise: "フランチャイズ",
  branch: "支店・店舗",
  unknown: "",
};

function trim(text: string | undefined | null, max = ITEM_MAX): string {
  if (!text) return "";
  const one = text.replace(/\s+/g, " ").trim();
  if (!one) return "";
  return one.length > max ? `${one.slice(0, max)}…` : one;
}

function join(parts: string[]): string {
  const body = parts.filter(Boolean).join("／");
  if (!body) return "";
  return body.length > TOTAL_MAX ? `${body.slice(0, TOTAL_MAX)}…` : body;
}

/** 企業タイプ + デジタル活用度（Webサイト分析）の共通パート */
function analysisParts(analysis: WebsiteAnalysis | undefined): string[] {
  if (!analysis) return [];
  const parts: string[] = [];
  const typeLabel = BUSINESS_TYPE_LABEL[analysis.businessType];
  if (typeLabel) {
    const reason = trim(analysis.businessTypeReason, 60);
    parts.push(reason ? `${typeLabel}（${reason}）` : typeLabel);
  }
  const summary = trim(analysis.summary);
  if (summary && summary !== "Webサイトなし") parts.push(summary);
  return parts;
}

/** Google Places 由来（通常・シネアド・採用）の会社内容 */
function placeParts(lead: ScoredLead | ScoredCinemaLead | ScoredRecruitLead): string[] {
  const parts: string[] = [];
  if (lead.isFutureOpening) parts.push("近日開業予定");
  const typeLabel = trim(lead.googleMapsTypeLabel, 40);
  if (typeLabel) parts.push(typeLabel);
  const place = trim(lead.placeSummary);
  if (place) parts.push(`概要: ${place}`);
  const review = trim(lead.reviewSummary);
  if (review) parts.push(`口コミ: ${review}`);
  return parts;
}

/** 通常リード獲得AI（Google Places） */
export function buildPlaceLeadMemo(lead: ScoredLead): string {
  return join([...placeParts(lead), ...analysisParts(lead.digitalAnalysis)]);
}

/** シネアドリード獲得AI */
export function buildCinemaLeadMemo(lead: ScoredCinemaLead): string {
  return join([...placeParts(lead), ...analysisParts(lead.digitalAnalysis)]);
}

/** 採用リード獲得AI（採用状況も会社内容として残す） */
export function buildRecruitLeadMemo(lead: ScoredRecruitLead): string {
  const recruit: string[] = [];
  const ra = lead.recruitAnalysis;
  if (ra) {
    if (ra.jobTypes.length > 0) {
      recruit.push(`募集職種: ${trim(ra.jobTypes.join("・"), 80)}`);
    }
    const summary = trim(ra.summary);
    if (summary) recruit.push(`採用: ${summary}`);
  }
  return join([...placeParts(lead), ...analysisParts(lead.digitalAnalysis), ...recruit]);
}

/** BtoBリード獲得AI（gBizINFO） */
export function buildBtoBLeadMemo(lead: ScoredBtoBLead): string {
  const parts: string[] = [];
  if (lead.businessItems?.length > 0) {
    parts.push(`事業内容: ${trim(lead.businessItems.join("・"), 200)}`);
  }
  if (lead.capital != null) {
    parts.push(`資本金 ${(lead.capital / 10000).toLocaleString("ja-JP")}万円`);
  }
  if (lead.employeeCount != null) parts.push(`従業員 ${lead.employeeCount}名`);
  if (lead.representativeName) parts.push(`代表 ${trim(lead.representativeName, 40)}`);
  if (lead.subsidies?.length > 0) {
    parts.push(`補助金: ${trim(lead.subsidies.join("・"), 100)}`);
  }
  return join([...parts, ...analysisParts(lead.digitalAnalysis)]);
}
