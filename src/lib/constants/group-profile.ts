// ================================================================
// グループメンバープロフィール — 定数
// ================================================================

/** ジャンル選択肢 */
export const GENRE_OPTIONS = [
  { value: "営業",   label: "営業",   color: "bg-blue-50 text-blue-700 border-blue-200" },
  { value: "制作",   label: "制作",   color: "bg-violet-50 text-violet-700 border-violet-200" },
  { value: "両方",   label: "両方",   color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  { value: "その他", label: "その他", color: "bg-zinc-100 text-zinc-600 border-zinc-200" },
] as const;

export type GenreValue = (typeof GENRE_OPTIONS)[number]["value"];

/** SNSプラットフォーム定義 */
export const SNS_PLATFORMS = [
  { key: "twitterUrl",   label: "X (Twitter)",  placeholder: "https://x.com/username",          icon: "twitter"   },
  { key: "instagramUrl", label: "Instagram",     placeholder: "https://instagram.com/username",  icon: "instagram" },
  { key: "facebookUrl",  label: "Facebook",      placeholder: "https://facebook.com/username",   icon: "facebook"  },
  { key: "youtubeUrl",   label: "YouTube",       placeholder: "https://youtube.com/@channel",    icon: "youtube"   },
  { key: "tiktokUrl",    label: "TikTok",        placeholder: "https://tiktok.com/@username",    icon: "tiktok"    },
  { key: "lineId",       label: "LINE ID",       placeholder: "LINE ID を入力",                   icon: "line"      },
  { key: "websiteUrl",   label: "Webサイト",     placeholder: "https://example.com",              icon: "globe"     },
] as const;

export type SnsKey = (typeof SNS_PLATFORMS)[number]["key"];

/** プロフィール編集可能フィールド */
export const PROFILE_FIELDS = [
  "genre",
  "specialty",
  "workHistory",
  "prefecture",
  "bio",
  ...SNS_PLATFORMS.map((p) => p.key),
] as const;

/** 都道府県一覧 */
export const PREFECTURES = [
  "北海道","青森県","岩手県","宮城県","秋田県","山形県","福島県",
  "茨城県","栃木県","群馬県","埼玉県","千葉県","東京都","神奈川県",
  "新潟県","富山県","石川県","福井県","山梨県","長野県",
  "岐阜県","静岡県","愛知県","三重県",
  "滋賀県","京都府","大阪府","兵庫県","奈良県","和歌山県",
  "鳥取県","島根県","岡山県","広島県","山口県",
  "徳島県","香川県","愛媛県","高知県",
  "福岡県","佐賀県","長崎県","熊本県","大分県","宮崎県","鹿児島県","沖縄県",
] as const;
