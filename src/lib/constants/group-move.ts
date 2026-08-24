// ---------------------------------------------------------------
// グループの動き — 段階・当たり方の定義
//   ボードに出るのは「業界 × 当たり方 × 段階」だけ。
//   金額と顧客名はここに一切登場させない（ボードの目的は横の共有であって評価ではない）。
// ---------------------------------------------------------------
import type { DealStatus, GroupMoveMethod, GroupMoveStage } from "@/generated/prisma/client";

export interface StageOption {
  value: GroupMoveStage;
  label: string;
  /** バッジ（現在の段階）の見た目 */
  className: string;
  /** ボタン（押せる状態）の見た目 */
  buttonClassName: string;
  /** 動きとして数えるか。見送りは「動いた」に数えない */
  counts: boolean;
}

/** 左から右へ進む6段階。押しやすさのため並び順そのままボタンに出す */
export const STAGE_OPTIONS: StageOption[] = [
  {
    value: "APPROACHING",
    label: "当たってる",
    className: "bg-sky-50 text-sky-700 border-sky-200",
    buttonClassName: "text-sky-700 border-sky-200 hover:bg-sky-50",
    counts: true,
  },
  {
    value: "REPLIED",
    label: "反応あり",
    className: "bg-teal-50 text-teal-700 border-teal-200",
    buttonClassName: "text-teal-700 border-teal-200 hover:bg-teal-50",
    counts: true,
  },
  {
    value: "MEETING",
    label: "打合せ",
    className: "bg-indigo-50 text-indigo-700 border-indigo-200",
    buttonClassName: "text-indigo-700 border-indigo-200 hover:bg-indigo-50",
    counts: true,
  },
  {
    value: "PROPOSAL",
    label: "提案中",
    className: "bg-violet-50 text-violet-700 border-violet-200",
    buttonClassName: "text-violet-700 border-violet-200 hover:bg-violet-50",
    counts: true,
  },
  {
    value: "WON",
    label: "受注",
    className: "bg-emerald-600 text-white border-emerald-600",
    buttonClassName: "text-emerald-700 border-emerald-200 hover:bg-emerald-50",
    counts: true,
  },
  {
    value: "LOST",
    label: "見送り",
    className: "bg-zinc-100 text-zinc-500 border-zinc-200",
    buttonClassName: "text-zinc-500 border-zinc-200 hover:bg-zinc-50",
    counts: false,
  },
];

export function getStage(value: string): StageOption {
  return STAGE_OPTIONS.find((s) => s.value === value) ?? STAGE_OPTIONS[0];
}

export const METHOD_OPTIONS: { value: GroupMoveMethod; label: string }[] = [
  { value: "FORM", label: "問い合わせフォーム" },
  { value: "EMAIL", label: "メール" },
  { value: "DM", label: "DM（SNS等）" },
  { value: "PHONE", label: "電話" },
  { value: "VISIT", label: "訪問・飛び込み" },
  { value: "REFERRAL", label: "紹介" },
  { value: "EXISTING", label: "既存客" },
  { value: "OTHER", label: "その他" },
];

export function getMethodLabel(value: string): string {
  return METHOD_OPTIONS.find((m) => m.value === value)?.label ?? "その他";
}

// ---------------------------------------------------------------
// 商談（Deal）の状態を、この6段階に寄せる。
//   商談は自動でボードに出るので、加盟代表は普段どおり商談を動かすだけでよい。
//   休眠・保留は「今の動き」ではないので null＝ボードに出さない。
// ---------------------------------------------------------------
export function stageFromDealStatus(status: DealStatus): GroupMoveStage | null {
  switch (status) {
    case "PROSPECTING":
      return "APPROACHING";
    case "QUALIFYING":
      return "REPLIED";
    case "NEGOTIATION":
      return "MEETING";
    case "PROPOSAL":
      return "PROPOSAL";
    case "CLOSED_WON":
      return "WON";
    case "CLOSED_LOST":
      return "LOST";
    default:
      return null; // DORMANT / DEFERRED
  }
}

/** 何日触っていないカードを薄くするか */
export const STALE_DAYS = 14;

/** 経過日数（0以上） */
export function daysSince(date: Date | string): number {
  return Math.max(0, Math.floor((Date.now() - new Date(date).getTime()) / 86400000));
}

export function fmtAgo(date: Date | string): string {
  const d = daysSince(date);
  if (d === 0) return "今日";
  if (d === 1) return "昨日";
  if (d < 31) return `${d}日前`;
  return `${Math.floor(d / 30)}ヶ月前`;
}

// ---------------------------------------------------------------
// 業界の言葉をボード上で1本に揃える。
//   顧客管理とリードで別々の語彙が使われてきたため、実データには
//   「小売業」「小売・EC」、「宿泊・飲食業」「飲食・宿泊・レジャー」のような
//   同じ意味の語が併存している。そのまま出すと業界での絞り込みが割れるので、
//   表示するときだけ下の代表語に寄せる（元データは書き換えない）。
//   ⚠️ 対応表にない語は「その他」に落とさずそのまま出す（情報を捨てない）。
// ---------------------------------------------------------------
export const BOARD_INDUSTRIES = [
  "飲食・宿泊",
  "観光・レジャー",
  "美容・サロン",
  "医療・クリニック",
  "建設・リフォーム",
  "不動産",
  "自動車",
  "小売・EC",
  "卸売・商社",
  "製造",
  "運輸・物流",
  "教育・スクール",
  "IT・情報通信",
  "広告・メディア",
  "金融・保険",
  "士業",
  "官公庁・自治体",
  "スポーツ",
  "冠婚葬祭",
  "サービス業",
  "その他",
] as const;

const INDUSTRY_ALIASES: Record<string, string> = {
  // 顧客管理側（日本標準産業分類寄りの語）
  建設業: "建設・リフォーム",
  小売業: "小売・EC",
  卸売業: "卸売・商社",
  "商社・卸売": "卸売・商社",
  "運輸・郵便業": "運輸・物流",
  "教育・学習支援": "教育・スクール",
  不動産業: "不動産",
  情報通信業: "IT・情報通信",
  "宿泊・飲食業": "飲食・宿泊",
  "飲食・宿泊・レジャー": "飲食・宿泊",
  製造業: "製造",
  "金融・保険業": "金融・保険",
  // アプローチ事例集側の語
  飲食: "飲食・宿泊",
  "小売・物販": "小売・EC",
  "IT・Web": "IT・情報通信",
  "観光・ホテル": "観光・レジャー",
  "自治体・公共": "官公庁・自治体",
};

export function normalizeIndustry(raw: string | null | undefined): string {
  const v = (raw ?? "").trim();
  if (!v) return "その他";
  return INDUSTRY_ALIASES[v] ?? v;
}
