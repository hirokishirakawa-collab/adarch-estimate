// ==============================================================
// 広告出稿者ファインダー — 有料媒体の定義（2026-09-10）
//   「有料媒体に載っている店 ＝ 今か過去に広告費を払っている店」。
//   URLのホスト名の末尾一致で機械判定する。画面（バッジ）と scan の両方から使うので
//   ここは DB・fetch に依存しない純粋な定数と関数だけ。
//
//   paidConfidence:
//     high = 実質、有料掲載しかない媒体（ホットペッパービューティー／SUUMO／HOME'S）
//     mid  = 無料枠がある媒体（食べログ・ぐるなび等）＝掲載だけでは広告費の有無を断言できない
// ==============================================================

export type AdIndustryGroup = "beauty" | "food" | "realestate" | "travel" | "medical";
export type PaidConfidence = "high" | "mid";

export interface AdPlatformDef {
  key: string;
  label: string;
  /** バッジ用の短い表記 */
  short: string;
  domains: string[];
  industryGroup: AdIndustryGroup;
  paidConfidence: PaidConfidence;
}

export const AD_PLATFORMS: AdPlatformDef[] = [
  { key: "hotpepper_beauty", label: "ホットペッパービューティー", short: "HPB", domains: ["beauty.hotpepper.jp"], industryGroup: "beauty", paidConfidence: "high" },
  { key: "minimo", label: "minimo（ミニモ）", short: "minimo", domains: ["minimodel.jp"], industryGroup: "beauty", paidConfidence: "mid" },
  { key: "hotpepper_gourmet", label: "ホットペッパーグルメ", short: "HPG", domains: ["hotpepper.jp"], industryGroup: "food", paidConfidence: "mid" },
  { key: "tabelog", label: "食べログ", short: "食べログ", domains: ["tabelog.com"], industryGroup: "food", paidConfidence: "mid" },
  { key: "gnavi", label: "ぐるなび", short: "ぐるなび", domains: ["r.gnavi.co.jp"], industryGroup: "food", paidConfidence: "mid" },
  { key: "suumo", label: "SUUMO", short: "SUUMO", domains: ["suumo.jp"], industryGroup: "realestate", paidConfidence: "high" },
  { key: "homes", label: "LIFULL HOME'S", short: "HOME'S", domains: ["homes.co.jp"], industryGroup: "realestate", paidConfidence: "high" },
  { key: "jalan", label: "じゃらん", short: "じゃらん", domains: ["jalan.net"], industryGroup: "travel", paidConfidence: "mid" },
  { key: "epark", label: "EPARK", short: "EPARK", domains: ["epark.jp"], industryGroup: "medical", paidConfidence: "mid" },
];

export const INDUSTRY_GROUP_LABEL: Record<AdIndustryGroup, string> = {
  beauty: "美容",
  food: "飲食",
  realestate: "不動産",
  travel: "宿泊",
  medical: "医療・美容",
};

export function platformOf(key: string): AdPlatformDef | undefined {
  return AD_PLATFORMS.find((p) => p.key === key);
}

/** 初回の検索プリセット（美容系）。判定そのものは全媒体で動く */
export const BEAUTY_PRESETS = ["美容室", "ネイルサロン", "エステサロン", "まつげエクステ", "リラクゼーション"] as const;

/** 1回の検索で Places から取る上限（費用の蓋） */
export const AD_BUYER_MAX_COUNT = 60;
export const AD_BUYER_COUNT_OPTIONS = [20, 40, 60] as const;

function hostMatches(host: string, domain: string): boolean {
  return host === domain || host.endsWith("." + domain);
}

/**
 * URL → 媒体キーの配列。ホスト名の末尾一致。
 * 「beauty.hotpepper.jp」は「hotpepper.jp」にも末尾一致するので、
 * 一致したドメインが最も長い媒体だけを返す（HPB を HPG と誤判定しない）。
 */
export function detectPlatforms(url: string): string[] {
  let host: string;
  try {
    host = new URL(url.trim()).hostname.toLowerCase().replace(/\.$/, "");
  } catch {
    return [];
  }
  if (!host) return [];
  let best: { len: number; keys: string[] } = { len: 0, keys: [] };
  for (const p of AD_PLATFORMS) {
    for (const d of p.domains) {
      if (!hostMatches(host, d)) continue;
      if (d.length > best.len) best = { len: d.length, keys: [p.key] };
      else if (d.length === best.len && !best.keys.includes(p.key)) best.keys.push(p.key);
    }
  }
  return best.keys;
}

/** その URL 自体が媒体（ポータル）か。自社サイトではない＝トップページを巡回しない */
export function isPlatformUrl(url: string): boolean {
  return detectPlatforms(url).length > 0;
}

/** SNS・地図・ブログ等、自社サイトではないが媒体でもないホスト。ここは巡回しない（媒体リンクが出ないため） */
const NON_OWN_HOSTS = [
  "instagram.com", "facebook.com", "fb.com", "x.com", "twitter.com", "tiktok.com", "youtube.com", "youtu.be",
  "line.me", "lin.ee", "ameblo.jp", "google.com", "goo.gl", "g.page", "maps.app.goo.gl", "linktr.ee", "lit.link",
  "note.com", "wixsite.com", "jimdofree.com", "jimdosite.com",
];

/** 自社ドメインとみなせる URL か（http(s)・媒体でない・SNS等でない） */
export function isOwnSiteUrl(url: string): boolean {
  let u: URL;
  try {
    u = new URL(url.trim());
  } catch {
    return false;
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return false;
  const host = u.hostname.toLowerCase().replace(/\.$/, "");
  if (!host || host === "localhost" || /^[\d.]+$/.test(host) || host.includes(":")) return false;
  if (isPlatformUrl(url)) return false;
  return !NON_OWN_HOSTS.some((d) => hostMatches(host, d));
}
