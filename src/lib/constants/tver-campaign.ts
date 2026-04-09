// ---------------------------------------------------------------
// TVer配信申請 定数
// ---------------------------------------------------------------

export const TVER_CAMPAIGN_STATUS_OPTIONS = [
  { value: "SUBMITTED", label: "申請済み",  className: "bg-blue-50 text-blue-700 border-blue-200" },
  { value: "APPROVED",  label: "承認",      className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  { value: "REJECTED",  label: "否決",      className: "bg-red-50 text-red-600 border-red-200" },
  { value: "DRAFT",     label: "下書き",    className: "bg-zinc-100 text-zinc-500 border-zinc-200" },
] as const;

export const BUDGET_TYPE_OPTIONS = [
  { value: "TOTAL",   label: "期間予算",             desc: "配信期間全体で予算を消化" },
  { value: "MONTHLY", label: "月次予算（毎月1日更新）", desc: "毎月1日に予算をリセットして消化" },
] as const;

export const FREQ_CAP_UNIT_OPTIONS = [
  { value: "LIFETIME", label: "全期間" },
  { value: "WEEKLY",   label: "1週間" },
  { value: "DAILY",    label: "1日" },
  { value: "HOURLY",   label: "1時間" },
] as const;

export const COMPANION_MOBILE_OPTIONS = [
  { value: "NONE",      label: "利用しない" },
  { value: "BANNER",    label: "バナー" },
  { value: "ICON_TEXT", label: "アイコン/テキスト" },
  { value: "TEXT",      label: "テキスト" },
] as const;

export const COMPANION_PC_OPTIONS = [
  { value: "NONE",   label: "利用しない" },
  { value: "BANNER", label: "バナー" },
] as const;

export const GENDER_TARGET_OPTIONS = [
  { value: "ALL",    label: "指定なし（全性別）" },
  { value: "MALE",   label: "男性" },
  { value: "FEMALE", label: "女性" },
] as const;

export function getGenderTargetLabel(value: string): string {
  return GENDER_TARGET_OPTIONS.find((o) => o.value === value)?.label ?? value;
}

// ---------------------------------------------------------------
// 広告再生時間
// ---------------------------------------------------------------
export const AD_DURATION_OPTIONS = [
  { value: "6",  label: "6秒",  note: "6-10秒" },
  { value: "15", label: "15秒", note: "11-22秒" },
  { value: "30", label: "30秒", note: "23-37秒" },
  { value: "45", label: "45秒", note: "38-52秒" },
  { value: "60", label: "60秒", note: "53-60秒" },
] as const;

// ---------------------------------------------------------------
// デバイス
// ---------------------------------------------------------------
export const DEVICE_OPTIONS = [
  { value: "PC",         label: "PC" },
  { value: "SP_IOS",     label: "SP iOS" },
  { value: "SP_ANDROID", label: "SP Android" },
  { value: "CTV",        label: "CTV" },
] as const;

// ---------------------------------------------------------------
// オーディエンス — 年齢
// ---------------------------------------------------------------
export const AGE_GROUP_OPTIONS = [
  { value: "15-19", label: "15-19歳" },
  { value: "20-24", label: "20-24歳" },
  { value: "25-29", label: "25-29歳" },
  { value: "30-34", label: "30-34歳" },
  { value: "35-39", label: "35-39歳" },
  { value: "40-44", label: "40-44歳" },
  { value: "45-49", label: "45-49歳" },
  { value: "50-54", label: "50-54歳" },
  { value: "55-59", label: "55-59歳" },
  { value: "60-64", label: "60-64歳" },
  { value: "65+",   label: "65歳以上" },
] as const;

// ---------------------------------------------------------------
// コンテンツ — 番組ジャンル
// ---------------------------------------------------------------
export const GENRE_OPTIONS = [
  { value: "DRAMA",    label: "ドラマ" },
  { value: "VARIETY",  label: "バラエティ" },
] as const;

// ---------------------------------------------------------------
// コンテンツ — 番組ジャンル除外
// ---------------------------------------------------------------
export const GENRE_EXCLUDE_OPTIONS = [
  { value: "DRAMA",       label: "ドラマ" },
  { value: "VARIETY",     label: "バラエティ" },
  { value: "ANIME_HERO",  label: "アニメ/ヒーロー" },
  { value: "NEWS_DOC",    label: "報道/ドキュメンタリー" },
  { value: "SPORTS",      label: "スポーツ" },
] as const;

// ---------------------------------------------------------------
// コンテンツ — 番組サブジャンル除外
// ---------------------------------------------------------------
export const SUB_GENRE_EXCLUDE_OPTIONS = [
  { value: "ROMANCE",      label: "恋愛" },
  { value: "SUSPENSE",     label: "サスペンス" },
  { value: "HUMAN",        label: "ヒューマン" },
  { value: "MEDICAL",      label: "医療" },
  { value: "DETECTIVE",    label: "刑事" },
  { value: "SCHOOL",       label: "学園" },
  { value: "YOUTH",        label: "青春" },
  { value: "COMEDY",       label: "コメディ" },
  { value: "SPORTS",       label: "スポーツ" },
  { value: "FAMILY",       label: "ファミリー" },
  { value: "MYSTERY",      label: "ミステリー" },
  { value: "HORROR",       label: "ホラー" },
  { value: "PERIOD",       label: "時代劇" },
  { value: "BUSINESS",     label: "ビジネス" },
  { value: "FANTASY_SF",   label: "ファンタジー・SF" },
  { value: "TRAVEL",       label: "旅行・街ブラ" },
  { value: "TALK",         label: "トーク" },
  { value: "MANZAI",       label: "漫才・コント" },
  { value: "LIFESTYLE",    label: "生活情報" },
  { value: "GOURMET",      label: "グルメ" },
  { value: "QUIZ",         label: "クイズ" },
  { value: "MUSIC",        label: "音楽" },
  { value: "NEWS",         label: "報道" },
  { value: "DOCUMENTARY",  label: "ドキュメンタリー" },
  { value: "KIDS",         label: "キッズ" },
  { value: "GOLF",         label: "ゴルフ" },
  { value: "FISHING",      label: "釣り" },
  { value: "SOCCER",       label: "サッカー" },
  { value: "BASEBALL",     label: "野球" },
  { value: "RUGBY",        label: "ラグビー" },
  { value: "ESPORTS",      label: "eSports・ゲーム" },
  { value: "MARTIAL_ARTS", label: "格闘技" },
  { value: "ANIMALS",      label: "動物" },
  { value: "HEALTH",       label: "健康" },
  { value: "EDUCATION",    label: "教養" },
  { value: "VTR_LOCATION", label: "VTR・ロケ番組" },
] as const;

// ---------------------------------------------------------------
// オーディエンス — その他ターゲティングカテゴリ
// ---------------------------------------------------------------
export const AUDIENCE_TARGETING_CATEGORIES = [
  { key: "interest",      label: "興味関心" },
  { key: "income",        label: "世帯年収" },
  { key: "tvViewing",     label: "テレビ視聴傾向" },
  { key: "demographic",   label: "デモグラフィック" },
] as const;

// ---------------------------------------------------------------
// TVer 配信エリア
// ---------------------------------------------------------------
export const TVER_AREA_GROUPS = [
  {
    region: "北海道",
    areas: [{ code: "hokkaido", label: "北海道" }],
  },
  {
    region: "東北",
    areas: [
      { code: "aomori",   label: "青森県" },
      { code: "iwate",    label: "岩手県" },
      { code: "miyagi",   label: "宮城県" },
      { code: "akita",    label: "秋田県" },
      { code: "yamagata", label: "山形県" },
      { code: "fukushima",label: "福島県" },
    ],
  },
  {
    region: "関東",
    areas: [
      { code: "ibaraki",  label: "茨城県" },
      { code: "tochigi",  label: "栃木県" },
      { code: "gunma",    label: "群馬県" },
      { code: "saitama",  label: "埼玉県" },
      { code: "chiba",    label: "千葉県" },
      { code: "tokyo",    label: "東京都" },
      { code: "kanagawa", label: "神奈川県" },
    ],
  },
  {
    region: "甲信越",
    areas: [
      { code: "niigata",  label: "新潟県" },
      { code: "yamanashi",label: "山梨県" },
      { code: "nagano",   label: "長野県" },
    ],
  },
  {
    region: "北陸",
    areas: [
      { code: "toyama",   label: "富山県" },
      { code: "ishikawa", label: "石川県" },
      { code: "fukui",    label: "福井県" },
    ],
  },
  {
    region: "東海",
    areas: [
      { code: "gifu",     label: "岐阜県" },
      { code: "shizuoka", label: "静岡県" },
      { code: "aichi",    label: "愛知県" },
      { code: "mie",      label: "三重県" },
    ],
  },
  {
    region: "関西",
    areas: [
      { code: "shiga",    label: "滋賀県" },
      { code: "kyoto",    label: "京都府" },
      { code: "osaka",    label: "大阪府" },
      { code: "hyogo",    label: "兵庫県" },
      { code: "nara",     label: "奈良県" },
      { code: "wakayama", label: "和歌山県" },
    ],
  },
  {
    region: "中国",
    areas: [
      { code: "tottori",  label: "鳥取県" },
      { code: "shimane",  label: "島根県" },
      { code: "okayama",  label: "岡山県" },
      { code: "hiroshima",label: "広島県" },
      { code: "yamaguchi",label: "山口県" },
    ],
  },
  {
    region: "四国",
    areas: [
      { code: "tokushima",label: "徳島県" },
      { code: "kagawa",   label: "香川県" },
      { code: "ehime",    label: "愛媛県" },
      { code: "kochi",    label: "高知県" },
    ],
  },
  {
    region: "九州",
    areas: [
      { code: "fukuoka",  label: "福岡県" },
      { code: "saga",     label: "佐賀県" },
      { code: "nagasaki", label: "長崎県" },
      { code: "kumamoto", label: "熊本県" },
      { code: "oita",     label: "大分県" },
      { code: "miyazaki", label: "宮崎県" },
      { code: "kagoshima",label: "鹿児島県" },
    ],
  },
  {
    region: "沖縄",
    areas: [{ code: "okinawa", label: "沖縄県" }],
  },
] as const;

/** 全エリアをフラットにしたマップ（code → label） */
export const TVER_AREA_MAP: Record<string, string> = Object.fromEntries(
  TVER_AREA_GROUPS.flatMap((g) => g.areas.map((a) => [a.code, a.label]))
);

export function getAreaLabel(code: string): string {
  return TVER_AREA_MAP[code] ?? code;
}

export function getCampaignStatusOption(value: string) {
  return (
    TVER_CAMPAIGN_STATUS_OPTIONS.find((o) => o.value === value) ??
    TVER_CAMPAIGN_STATUS_OPTIONS[0]
  );
}

export function getBudgetTypeLabel(value: string): string {
  return BUDGET_TYPE_OPTIONS.find((o) => o.value === value)?.label ?? value;
}

export function getCompanionMobileLabel(value: string): string {
  return COMPANION_MOBILE_OPTIONS.find((o) => o.value === value)?.label ?? value;
}

export function getCompanionPcLabel(value: string): string {
  return COMPANION_PC_OPTIONS.find((o) => o.value === value)?.label ?? value;
}

export function getFreqCapUnitLabel(value: string): string {
  return FREQ_CAP_UNIT_OPTIONS.find((o) => o.value === value)?.label ?? value;
}
