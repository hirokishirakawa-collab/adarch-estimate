import { PREFECTURES } from "@/lib/constants/crm";

/**
 * 表示用の地域名。prefecture が空のリードは住所から都道府県だけ拾う。
 *
 * Google Places 由来の住所は「日本、〒524-0102 滋賀県草津市…」の形で入っており、
 * 頭から切ると「日本、〒524-01」になって読めない。
 */
export function areaLabel(prefecture: string | null, address: string | null): string | null {
  if (prefecture) return prefecture;
  if (!address) return null;
  const hit = (PREFECTURES as readonly string[]).find((p) => address.includes(p));
  if (hit) return hit;
  // 都道府県が見当たらない住所は、郵便番号と「日本、」を落としてから出す
  const cleaned = address
    .replace(/^日本[、,]?\s*/, "")
    .replace(/〒\s*\d{3}-?\d{0,4}\s*/, "")
    .trim();
  return cleaned ? cleaned.slice(0, 16) : null;
}
