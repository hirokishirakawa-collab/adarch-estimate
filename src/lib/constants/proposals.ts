// ---------------------------------------------------------------
// 提案書AI 定数
// ---------------------------------------------------------------

/** 営業アクティビティの種類ラベル */
export const ACTIVITY_TYPE_LABELS: Record<string, string> = {
  CALL: "電話",
  EMAIL: "メール",
  VISIT: "訪問",
  MEETING: "Web会議",
  OTHER: "その他",
};

/** デフォルトのアンロック閾値 */
export const DEFAULT_UNLOCK_THRESHOLD = 5;

/** アンロック閾値のAppSettingキー */
export const SETTING_KEY_UNLOCK_THRESHOLD = "proposal_unlock_threshold";

/** 提案書の業種オプション */
export const PROPOSAL_INDUSTRY_OPTIONS = [
  { value: "restaurant", label: "飲食店" },
  { value: "real_estate", label: "不動産" },
  { value: "beauty", label: "美容・エステ" },
  { value: "medical", label: "医療・クリニック" },
  { value: "education", label: "教育・学習塾" },
  { value: "retail", label: "小売・EC" },
  { value: "manufacturing", label: "製造業" },
  { value: "it_web", label: "IT・Web" },
  { value: "consulting", label: "コンサルティング" },
  { value: "finance", label: "金融・保険" },
  { value: "construction", label: "建設・建築" },
  { value: "hotel", label: "ホテル・旅館" },
  { value: "fitness", label: "フィットネス・ジム" },
  { value: "car_dealer", label: "自動車" },
  { value: "recruitment", label: "人材・採用" },
  { value: "logistics", label: "物流・運送" },
  { value: "entertainment", label: "エンターテインメント" },
  { value: "other", label: "その他" },
] as const;
