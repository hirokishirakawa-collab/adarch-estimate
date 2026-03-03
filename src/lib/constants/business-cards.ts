// ---------------------------------------------------------------
// 名刺管理 共有定数
// ---------------------------------------------------------------

export const REGION_OPTIONS = [
  { value: "regionHokkaido",  label: "北海道" },
  { value: "regionTohoku",    label: "東北" },
  { value: "regionKitakanto", label: "北関東" },
  { value: "regionSaitama",   label: "埼玉" },
  { value: "regionChiba",     label: "千葉" },
  { value: "regionTokyo",     label: "東京" },
  { value: "regionKanagawa",  label: "神奈川" },
  { value: "regionChubu",     label: "中部" },
  { value: "regionKansai",    label: "関西" },
  { value: "regionChugoku",   label: "中国" },
  { value: "regionShikoku",   label: "四国" },
  { value: "regionKyushu",    label: "九州・沖縄" },
] as const;

export type RegionValue = (typeof REGION_OPTIONS)[number]["value"];

export const DISCLOSURE_STATUS_OPTIONS = [
  { value: "PENDING",  label: "申請中",   color: "bg-amber-100 text-amber-700 border-amber-200" },
  { value: "APPROVED", label: "承認済み", color: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  { value: "REJECTED", label: "却下",     color: "bg-red-100 text-red-600 border-red-200" },
] as const;

export const INDUSTRY_OPTIONS = [
  "IT",
  "広告",
  "製造",
  "不動産",
  "金融",
  "メディア",
  "教育",
  "医療",
  "飲食",
  "小売",
  "建設",
  "自治体",
  "その他",
] as const;

export const ITEMS_PER_PAGE = 30;
