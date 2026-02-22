// ---------------------------------------------------------------
// 経費カテゴリ定数
// ---------------------------------------------------------------

export const EXPENSE_CATEGORY_OPTIONS = [
  { value: "LABOR",         label: "人件費",       icon: "👷" },
  { value: "MATERIAL",      label: "材料費",       icon: "🔩" },
  { value: "SUBCONTRACT",   label: "外注費",       icon: "🤝" },
  { value: "TRANSPORT",     label: "交通・運送費", icon: "🚚" },
  { value: "COMMUNICATION", label: "通信費",       icon: "📡" },
  { value: "OTHER",         label: "その他",       icon: "📦" },
] as const;

export type ExpenseCategoryValue =
  (typeof EXPENSE_CATEGORY_OPTIONS)[number]["value"];
