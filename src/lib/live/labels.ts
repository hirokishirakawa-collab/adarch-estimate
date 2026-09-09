// ---------------------------------------------------------------
// ライブボードで使う表示ラベル。
// フィードと詳細パネルの両方から読むのでここに置く（語がずれると別物に見えるため）。
// ---------------------------------------------------------------

export const DEAL_STATUS_LABEL: Record<string, string> = {
  PROSPECTING: "見込み",
  QUALIFYING: "検討中",
  PROPOSAL: "提案中",
  NEGOTIATION: "交渉中",
  CLOSED_WON: "受注",
  CLOSED_LOST: "見送り",
  DORMANT: "休眠",
  DEFERRED: "保留",
};

export const ACTIVITY_LABEL: Record<string, string> = {
  CALL: "電話",
  EMAIL: "メール",
  VISIT: "訪問",
  MEETING: "Web会議",
  OTHER: "フォロー",
};

export const MOVE_STAGE_LABEL: Record<string, string> = {
  APPROACHING: "当たってる",
  REPLIED: "反応あり",
  MEETING: "打合せ",
  PROPOSAL: "提案中",
  WON: "受注",
  LOST: "見送り",
};

export const MOVE_METHOD_LABEL: Record<string, string> = {
  FORM: "フォーム",
  EMAIL: "メール",
  DM: "DM",
  PHONE: "電話",
  VISIT: "訪問",
  REFERRAL: "紹介",
  EXISTING: "既存客",
  OTHER: "",
};

// リード（LeadLog）をライブに流すときの語。
//   ライブに出すのは「人が動いた」操作だけ＝取得／連絡／アポ／営業フォーム送付／返信あり。
//   作成・クロール・プール投入・却下（本部の選定作業）・自動の担当設定は出さない（2026-09-09 代表選択）。
export const LEAD_STATUS_LABEL: Record<string, string> = {
  UNTOUCHED: "未対応",
  CALLED: "連絡済み",
  APPOINTMENT: "アポ獲得",
  DEAL_CONVERTED: "商談化",
  SKIPPED: "スキップ",
  CRAWLED: "クロール済",
  ARCHIVED: "アーカイブ",
};

export const LEAD_SOURCE_LABEL: Record<string, string> = {
  GOOGLE_PLACES: "リード獲得AI（Googleマップ）",
  GBIZINFO: "gBizINFO",
  CINEMA_AD: "シネマ広告",
  RECRUIT_SEARCH: "採用シグナル",
  CSV_IMPORT: "CSV取込",
  MANUAL: "手入力",
  SIGNBOARD_SCAN: "看板スキャン",
  PR_TIMES_TVCM: "PR TIMES（TVCM）",
  VIDEO_ACHIEVEMENT: "動画実績",
};

export const OUTREACH_RESULT_LABEL: Record<string, string> = {
  REPLIED: "返信あり",
  REPLIED_NG: "返信NG",
  NO_REPLY: "無反応",
  REJECTED: "断り",
  WON: "受注",
};

/** ライブに流すリード操作の絞り込み条件（feed と 朝のまとめ で共用） */
export const LIVE_LEAD_LOG_WHERE = {
  OR: [
    { action: "CLAIMED" },
    { action: "FORM_SENT" },
    { action: "OUTREACH_RESULT", detail: { startsWith: "送付結果を「返信あり」" } },
    { action: "STATUS_CHANGED", detail: { endsWith: "「連絡済み」に変更" } },
    { action: "STATUS_CHANGED", detail: { endsWith: "「アポ獲得」に変更" } },
  ],
};

/** LeadLog 1件がライブのどの操作か。対象外なら null */
export type LeadLogKind = "claim" | "form" | "reply" | "appointment" | "contact";
export function leadLogKind(action: string, detail: string | null | undefined): LeadLogKind | null {
  if (action === "CLAIMED") return "claim";
  if (action === "FORM_SENT") return "form";
  if (action === "OUTREACH_RESULT") return detail?.startsWith("送付結果を「返信あり」") ? "reply" : null;
  if (action === "STATUS_CHANGED") {
    if (detail?.endsWith("「アポ獲得」に変更")) return "appointment";
    if (detail?.endsWith("「連絡済み」に変更")) return "contact";
  }
  return null;
}

/** 操作の種類と相手（「A社」（業種）ほか2社 など）から1行の文言を組む */
export function leadLogText(kind: LeadLogKind, who: string): string {
  switch (kind) {
    case "claim":
      return `${who}を案件プールから取得`;
    case "form":
      return `${who}へ営業フォームを送付`;
    case "reply":
      return `${who}から返信あり`;
    case "appointment":
      return `${who}とアポ獲得`;
    case "contact":
      return `${who}に連絡`;
  }
}
