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
