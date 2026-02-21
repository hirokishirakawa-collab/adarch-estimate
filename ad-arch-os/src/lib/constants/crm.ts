// ---------------------------------------------------------------
// CRM 共有定数（サーバー・クライアント両方で利用可）
// ---------------------------------------------------------------

export const ACTIVITY_TYPE_OPTIONS = [
  {
    value: "CALL",
    label: "電話",
    icon: "📞",
    color: "bg-blue-50 text-blue-700 border-blue-200",
    dotColor: "bg-blue-400",
  },
  {
    value: "EMAIL",
    label: "メール",
    icon: "📧",
    color: "bg-violet-50 text-violet-700 border-violet-200",
    dotColor: "bg-violet-400",
  },
  {
    value: "VISIT",
    label: "訪問",
    icon: "🏢",
    color: "bg-emerald-50 text-emerald-700 border-emerald-200",
    dotColor: "bg-emerald-400",
  },
  {
    value: "MEETING",
    label: "Web会議",
    icon: "💻",
    color: "bg-orange-50 text-orange-700 border-orange-200",
    dotColor: "bg-orange-400",
  },
  {
    value: "OTHER",
    label: "その他",
    icon: "📝",
    color: "bg-zinc-100 text-zinc-600 border-zinc-200",
    dotColor: "bg-zinc-400",
  },
] as const;

export type ActivityTypeValue =
  (typeof ACTIVITY_TYPE_OPTIONS)[number]["value"];

export const DEAL_STATUS_OPTIONS = [
  { value: "PROSPECTING", label: "見込み",  className: "bg-zinc-100 text-zinc-600 border-zinc-200" },
  { value: "QUALIFYING",  label: "検討中",  className: "bg-blue-100 text-blue-700 border-blue-200" },
  { value: "PROPOSAL",    label: "提案中",  className: "bg-yellow-100 text-yellow-700 border-yellow-200" },
  { value: "NEGOTIATION", label: "交渉中",  className: "bg-orange-100 text-orange-700 border-orange-200" },
  { value: "CLOSED_WON",  label: "受注 🎉", className: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  { value: "CLOSED_LOST", label: "失注",    className: "bg-red-100 text-red-600 border-red-200" },
] as const;

export type DealStatusValue =
  (typeof DEAL_STATUS_OPTIONS)[number]["value"];

// ---------------------------------------------------------------
// 顧客ランク
// ---------------------------------------------------------------
export const CUSTOMER_RANK_OPTIONS = [
  { value: "A", label: "A", desc: "重要",      className: "bg-red-100 text-red-700 border-red-300" },
  { value: "B", label: "B", desc: "通常",      className: "bg-blue-100 text-blue-700 border-blue-300" },
  { value: "C", label: "C", desc: "見込み",    className: "bg-yellow-100 text-yellow-700 border-yellow-300" },
  { value: "D", label: "D", desc: "取引回避",  className: "bg-zinc-100 text-zinc-500 border-zinc-300" },
] as const;

// ---------------------------------------------------------------
// 取引ステータス
// ---------------------------------------------------------------
export const CUSTOMER_STATUS_OPTIONS = [
  { value: "PROSPECT", label: "見込み",    className: "bg-blue-100 text-blue-700 border-blue-200" },
  { value: "ACTIVE",   label: "取引中",    className: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  { value: "INACTIVE", label: "休眠",      className: "bg-zinc-100 text-zinc-500 border-zinc-200" },
  { value: "BLOCKED",  label: "取引回避",  className: "bg-red-100 text-red-700 border-red-200" },
] as const;

// ---------------------------------------------------------------
// 業種
// ---------------------------------------------------------------
export const INDUSTRY_OPTIONS = [
  "建設業", "製造業", "情報通信業", "運輸・郵便業",
  "卸売業", "小売業", "金融・保険業", "不動産業",
  "サービス業", "医療・福祉", "教育・学習支援",
  "宿泊・飲食業", "農業・林業・漁業", "広告・メディア",
  "コンサルティング", "その他",
] as const;

// ---------------------------------------------------------------
// 流入経路
// ---------------------------------------------------------------
export const SOURCE_OPTIONS = [
  { value: "REFERRAL",   label: "紹介" },
  { value: "WEB",        label: "Web・SNS" },
  { value: "EXHIBITION", label: "展示会・イベント" },
  { value: "COLD_CALL",  label: "飛び込み・テレアポ" },
  { value: "EXISTING",   label: "既存取引先" },
  { value: "OTHER",      label: "その他" },
] as const;

// ---------------------------------------------------------------
// 47都道府県
// ---------------------------------------------------------------
export const PREFECTURES = [
  "北海道",
  "青森県", "岩手県", "宮城県", "秋田県", "山形県", "福島県",
  "茨城県", "栃木県", "群馬県", "埼玉県", "千葉県", "東京都", "神奈川県",
  "新潟県", "富山県", "石川県", "福井県", "山梨県", "長野県",
  "岐阜県", "静岡県", "愛知県", "三重県",
  "滋賀県", "京都府", "大阪府", "兵庫県", "奈良県", "和歌山県",
  "鳥取県", "島根県", "岡山県", "広島県", "山口県",
  "徳島県", "香川県", "愛媛県", "高知県",
  "福岡県", "佐賀県", "長崎県", "熊本県", "大分県", "宮崎県", "鹿児島県",
  "沖縄県",
] as const;
