// ==============================================================
// 取引先マップの情報補完
//
//   1. Google Places（New）で口コミ★・件数・所在地・座標・写真・口コミ要約
//   2. 社内構成（従業員数・資本金・代表者・設立年）
//        法人番号あり → gBizINFO
//        法人番号なし → 相手の会社概要ページを辿る（周年ファインダーと同じ方式）
//
// 1社ごとに保存する（途中で切れても続きから）。取れなかった会社も *CheckedAt を
// 押して「探したが無かった」と分かるようにする。同じ会社を何度も叩かない。
// ==============================================================

import sharp from "sharp";
import { db } from "@/lib/db";
import { fetchHtml, findAboutLinks, toSafeUrl } from "@/lib/anniversary/crawl";
import { extractFounding, htmlToText } from "@/lib/anniversary/extract";
import { extractProfile } from "./extract-profile";
import { isSameCompany, normalizeCompanyName, parsePrefecture } from "./normalize";
import { BRANCH_MAP } from "@/lib/data/customers";

/** 担当拠点の地元県。顧客は地元にいることが多いので Places の照合で優先する。本部・東京は全国なので空 */
const LEGACY_BRANCH_PREFS: Record<string, string[]> = {
  branch_isk: ["石川県"], branch_kyt: ["京都府"], branch_kgo: ["香川県", "岡山県"], branch_ibk: ["茨城県"],
  branch_ymc: ["山口県", "広島県"], branch_tks: ["徳島県"], branch_okn: ["沖縄県"], branch_hkd: ["北海道"],
  branch_fku: ["福岡県"], branch_knw: ["神奈川県"], branch_kns: ["大阪府", "京都府", "兵庫県"],
};
export function branchHomePrefectures(branchId: string): string[] {
  if (LEGACY_BRANCH_PREFS[branchId]) return LEGACY_BRANCH_PREFS[branchId];
  if (branchId.startsWith("pref_")) {
    const name = BRANCH_MAP[branchId as keyof typeof BRANCH_MAP]?.name;
    return name ? [name] : [];
  }
  return [];
}

const PLACES_FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.location",
  "places.rating",
  "places.userRatingCount",
  "places.googleMapsUri",
  "places.websiteUri",
  "places.photos",
  "places.generativeSummary",
  "places.reviewSummary",
].join(",");

interface PlaceHit {
  id: string;
  name: string;
  address: string;
  prefecture: string | null;
  lat: number | null;
  lng: number | null;
  rating: number | null;
  ratingCount: number | null;
  mapsUrl: string | null;
  websiteUrl: string | null;
  photoName: string | null;
  summary: string | null;
  /** 社名が正規化後に完全一致した（所在地を書き戻してよい強さ） */
  exact: boolean;
}

/** 支店・営業所・店舗など「本社ではない拠点」らしい名前 */
const BRANCH_OFFICE_RE = /営業所|支店|支社|出張所|事業所|センター|工場|倉庫|店$|店\b|本社$|東京本社|オフィス|ショールーム|プラザ/;

// 日本全体を覆う矩形。これを渡さないと、API を叩いた場所（回線の所在地）の近くに寄る
const JAPAN_BIAS = { rectangle: { low: { latitude: 24.0, longitude: 122.5 }, high: { latitude: 45.8, longitude: 146.0 } } };

async function placesTextSearch(textQuery: string, apiKey: string): Promise<Record<string, unknown>[]> {
  const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": PLACES_FIELD_MASK,
    },
    body: JSON.stringify({ textQuery, maxResultCount: 5, languageCode: "ja", regionCode: "JP", locationBias: JAPAN_BIAS }),
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Places ${res.status}: ${body.slice(0, 200)}`);
  }
  const data = (await res.json()) as { places?: Record<string, unknown>[] };
  return data.places ?? [];
}

/**
 * 社名を除いた残りが「法人格・本社・グループ」程度なら本社と見なせる。
 * 「ジェトロ横浜」「ロピア湘南プロセスセンター」「JTB ららぽーと店」のように地名や店舗名が残るものは別拠点。
 */
const HQ_REMAINDER_RE = /^(株式会社|有限会社|合同会社|一般社団法人|公益社団法人|本社|本店|グループ|ホールディングス|工業|製作所|商事|商店|inc|co|ltd|corporation|corp|japan|日本|の|・)*$/;

function looksLikeHeadOffice(customerName: string, placeName: string): boolean {
  const x = normalizeCompanyName(customerName);
  const y = normalizeCompanyName(placeName);
  if (!x || !y.includes(x)) return false;
  const remainder = y.replace(x, "");
  return HQ_REMAINDER_RE.test(remainder);
}

/**
 * 社名の照合。短い社名（WHO・SEED 等）は別の店に化けやすいので、完全一致か「社名で始まる」だけ通す。
 * strict=true（県の手がかりが無い会社）は、残りが法人格・本社程度のものだけ通す。
 */
function nameMatches(customerName: string, placeName: string, strict = false): { ok: boolean; exact: boolean } {
  const x = normalizeCompanyName(customerName);
  const y = normalizeCompanyName(placeName);
  if (!x || !y) return { ok: false, exact: false };
  if (x === y) return { ok: true, exact: true };
  if (strict) return { ok: looksLikeHeadOffice(customerName, placeName), exact: false };
  if (x.length <= 4) return { ok: y.startsWith(x), exact: false };
  return { ok: isSameCompany(customerName, placeName), exact: false };
}

/**
 * 社名で Places を引き、いちばん確からしい候補を返す。
 *   - 名前が照合できない結果は捨てる（口コミが他社のものになるのが一番まずい）
 *   - 担当拠点の地元県（homePrefs）にある候補・本社らしい候補を優先し、
 *     「◯◯営業所」「◯◯支店」より本社を選ぶ
 *   - 地元県を付けた検索で見つからなければ、県なしで引き直す（全国企業・本部の顧客向け）
 */
export async function searchPlace(
  name: string,
  prefecture: string | null,
  apiKey: string,
  homePrefs: string[] = [],
): Promise<PlaceHit | null> {
  const hint = prefecture && prefecture !== "海外" ? prefecture : homePrefs[0] ?? null;
  // 手がかり（県）が無く社名も短い会社（WHO・SEED 等）は、同名の別の店に当たる確率の方が高いので引かない
  if (!hint && normalizeCompanyName(name).length <= 4) return null;
  const queries = hint ? [`${name} ${hint}`, name] : [name];
  const wantsBranchOffice = BRANCH_OFFICE_RE.test(name);

  for (const q of queries) {
    const places = await placesTextSearch(q, apiKey);
    let best: { hit: PlaceHit; score: number } | null = null;
    for (const p of places) {
      const displayName = (p.displayName as { text?: string })?.text ?? "";
      // 県の手がかりが無い会社は、本社と見なせる名前だけ通す（別拠点の口コミを付けない）
      const m = nameMatches(name, displayName, !hint);
      if (!m.ok) continue;
      const address = (p.formattedAddress as string) ?? "";
      const pf = parsePrefecture(address);
      let score = 0;
      if (m.exact) score += 2;
      if (pf && prefecture && pf === prefecture) score += 2;
      if (pf && homePrefs.includes(pf)) score += 3;
      if (!wantsBranchOffice && BRANCH_OFFICE_RE.test(displayName)) {
        // 県の手がかりが無いのに「◯◯営業所」「◯◯店」しか出ないときは、本社かどうか確かめようがないので捨てる
        if (!hint && !m.exact) continue;
        score -= 3;
      }
      // 県が分かっている会社で別の県に当たったものは、完全一致でも弱い
      if (pf && prefecture && prefecture !== "海外" && pf !== prefecture) score -= 2;
      const loc = p.location as { latitude?: number; longitude?: number } | undefined;
      const photos = (p.photos as { name?: string }[] | undefined) ?? [];
      const gen = p.generativeSummary as { overview?: { text?: string } } | undefined;
      const rev = p.reviewSummary as { text?: { text?: string } } | undefined;
      const hit: PlaceHit = {
        id: p.id as string,
        name: displayName,
        address,
        prefecture: pf,
        lat: loc?.latitude ?? null,
        lng: loc?.longitude ?? null,
        rating: (p.rating as number) ?? null,
        ratingCount: (p.userRatingCount as number) ?? null,
        mapsUrl: (p.googleMapsUri as string) ?? null,
        websiteUrl: (p.websiteUri as string) ?? null,
        photoName: photos[0]?.name ?? null,
        summary: rev?.text?.text ?? gen?.overview?.text ?? null,
        exact: m.exact,
      };
      if (!best || score > best.score) best = { hit, score };
    }
    if (best) return best.hit;
  }
  return null;
}

/** 画像を 640px 幅の JPEG に落として返す（DBに置くので小さくする） */
async function toThumb(buf: Buffer): Promise<Uint8Array<ArrayBuffer> | null> {
  try {
    const out = await sharp(buf).rotate().resize({ width: 640, withoutEnlargement: true }).jpeg({ quality: 78 }).toBuffer();
    const arr = new Uint8Array(out.byteLength);
    arr.set(out);
    return arr;
  } catch {
    return null;
  }
}

export async function fetchPlacePhoto(photoName: string, apiKey: string): Promise<Uint8Array<ArrayBuffer> | null> {
  try {
    const res = await fetch(
      `https://places.googleapis.com/v1/${photoName}/media?maxWidthPx=800&key=${encodeURIComponent(apiKey)}`,
      { signal: AbortSignal.timeout(15000) },
    );
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length === 0 || buf.length > 8_000_000) return null;
    return toThumb(buf);
  } catch {
    return null;
  }
}

/** 会社サイトの og:image を写真の代わりに使う（Places に写真が無い会社向け） */
export async function fetchOgImage(websiteUrl: string): Promise<Uint8Array<ArrayBuffer> | null> {
  const html = await fetchHtml(websiteUrl);
  if (!html) return null;
  const m =
    html.match(/<meta[^>]+property=["']og:image(?::secure_url)?["'][^>]+content=["']([^"']+)["']/i) ??
    html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
  if (!m) return null;
  let abs: string;
  try {
    abs = new URL(m[1], websiteUrl).toString();
  } catch {
    return null;
  }
  // リダイレクトは自分で辿り、行き先も毎回検査する（fetchHtml と同じ。最初のURLだけ見ても内部へ飛ばせてしまう）
  let current = abs;
  for (let hop = 0; hop <= 3; hop++) {
    const safe = await toSafeUrl(current);
    if (!safe) return null;
    try {
      const res = await fetch(safe, { signal: AbortSignal.timeout(15000), redirect: "manual" });
      if (res.status >= 300 && res.status < 400) {
        const loc = res.headers.get("location");
        if (!loc) return null;
        current = new URL(loc, safe).toString();
        continue;
      }
      if (!res.ok) return null;
      const type = res.headers.get("content-type") ?? "";
      if (!type.startsWith("image/")) return null;
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length === 0 || buf.length > 8_000_000) return null;
      return toThumb(buf);
    } catch {
      return null;
    }
  }
  return null;
}

// ---------------------------------------------------------------
// 社内構成
// ---------------------------------------------------------------

export interface ProfileHit {
  employeeCount: number | null;
  capital: bigint | null;
  representativeName: string | null;
  foundedYear: number | null;
  foundedRaw: string | null;
  source: "gbiz" | "site";
  sourceUrl: string;
}

const GBIZ_BASE = "https://info.gbiz.go.jp/hojin/v1/hojin";

export async function fetchGbizProfile(corporateNumber: string, token: string): Promise<ProfileHit | null> {
  try {
    const res = await fetch(`${GBIZ_BASE}/${corporateNumber}`, {
      headers: { Accept: "application/json", "X-hojinInfo-api-token": token },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const h = data["hojin-infos"]?.[0];
    if (!h) return null;
    const employeeCount = h.employee_number ? Number(h.employee_number) : null;
    const capital = h.capital_stock ? BigInt(Math.round(Number(h.capital_stock))) : null;
    const representativeName = h.representative_name
      ? String(h.representative_name).replace(/\s+/g, " ").trim()
      : null;
    // 設立年月日は行政と取引のある法人にしか入っていない（実測済）。入っていれば使う
    const founded = h.date_of_establishment ? Number(String(h.date_of_establishment).slice(0, 4)) : null;
    if (employeeCount == null && capital == null && !representativeName && !founded) return null;
    return {
      employeeCount: employeeCount && employeeCount > 0 ? employeeCount : null,
      capital: capital && capital > BigInt(0) ? capital : null,
      representativeName: representativeName || null,
      foundedYear: founded && founded > 1850 ? founded : null,
      foundedRaw: founded ? `gBizINFO 設立年月日 ${h.date_of_establishment}` : null,
      source: "gbiz",
      sourceUrl: `https://info.gbiz.go.jp/hojin/ichiran?hojinBango=${corporateNumber}`,
    };
  } catch {
    return null;
  }
}

const FALLBACK_PATHS = ["/company", "/company/", "/about", "/about/", "/profile", "/outline", "/corporate", "/company/profile"];

/**
 * 会社サイトを トップ → 会社概要リンク → 定番パス の順に見て、
 * 従業員数・資本金・代表者・設立年を拾う。3項目以上そろった時点で止める。
 */
export async function crawlSiteProfile(websiteUrl: string): Promise<ProfileHit | null> {
  const top = await fetchHtml(websiteUrl);
  if (!top) return null;

  const urls = [websiteUrl, ...findAboutLinks(top, websiteUrl, 5)];
  if (urls.length === 1) {
    for (const p of FALLBACK_PATHS) {
      try { urls.push(new URL(p, websiteUrl).toString()); } catch { /* noop */ }
    }
  }

  let best: ProfileHit | null = null;
  let bestScore = 0;
  const visited = new Set<string>();
  for (const url of urls) {
    if (visited.has(url)) continue;
    visited.add(url);
    const html = url === websiteUrl ? top : await fetchHtml(url);
    if (!html) continue;
    const text = htmlToText(html);
    const prof = extractProfile(text);
    const founded = extractFounding(text);
    const hit: ProfileHit = {
      employeeCount: prof.employeeCount,
      capital: prof.capital,
      representativeName: prof.representativeName,
      foundedYear: founded?.year ?? null,
      foundedRaw: founded?.raw ?? null,
      source: "site",
      sourceUrl: url,
    };
    const score = [hit.employeeCount, hit.capital, hit.representativeName, hit.foundedYear].filter((v) => v != null).length;
    if (score > bestScore) {
      best = hit;
      bestScore = score;
    }
    if (score >= 3) break;
  }
  return bestScore > 0 ? best : null;
}

// ---------------------------------------------------------------
// まとめて回す
// ---------------------------------------------------------------

export interface EnrichStats {
  targeted: number;
  placeFound: number;
  placeNotFound: number;
  photoSaved: number;
  profileFound: number;
  profileNotFound: number;
  errors: number;
}

export interface EnrichOptions {
  limit?: number;
  concurrency?: number;
  placesApiKey?: string;
  gbizToken?: string;
  /** true のとき、既に確認済みの会社もやり直す */
  force?: boolean;
  /** 特定の顧客だけ */
  customerIds?: string[];
  /** Places だけ／社内構成だけ を回す */
  only?: "places" | "profile";
  log?: (line: string) => void;
}

export async function runClientEnrich(opts: EnrichOptions = {}): Promise<EnrichStats> {
  const placesApiKey = opts.placesApiKey ?? process.env.GOOGLE_PLACES_API_KEY ?? "";
  const gbizToken = opts.gbizToken ?? process.env.GBIZINFO_API_TOKEN ?? "";
  const log = opts.log ?? (() => {});
  const limit = opts.limit ?? 60;

  const customers = await db.customer.findMany({
    where: {
      status: { not: "BLOCKED" },
      ...(opts.customerIds ? { id: { in: opts.customerIds } } : {}),
      ...(opts.force
        ? {}
        : opts.only === "places"
          ? { placeCheckedAt: null }
          : opts.only === "profile"
            ? { profileCheckedAt: null }
            : { OR: [{ placeCheckedAt: null }, { profileCheckedAt: null }] }),
    },
    select: {
      id: true, name: true, prefecture: true, website: true, corporateNumber: true, branchId: true,
      placeCheckedAt: true, profileCheckedAt: true, photoSource: true,
    },
    // 取引中 → 実績あり → それ以外 の順ではなく、単純に古い顧客から（全件回す前提）
    orderBy: { recordNumber: "asc" },
    take: limit,
  });

  const stats: EnrichStats = { targeted: customers.length, placeFound: 0, placeNotFound: 0, photoSaved: 0, profileFound: 0, profileNotFound: 0, errors: 0 };
  const queue = [...customers];

  async function one(c: (typeof customers)[number]) {
    let website = c.website;
    let prefecture = c.prefecture;

    // ---- Places
    if (placesApiKey && opts.only !== "profile" && (opts.force || !c.placeCheckedAt)) {
      try {
        const homePrefs = branchHomePrefectures(c.branchId);
        const hit = await searchPlace(c.name, prefecture, placesApiKey, homePrefs);
        if (hit) {
          stats.placeFound++;
          let photo: Uint8Array<ArrayBuffer> | null = null;
          if (hit.photoName) photo = await fetchPlacePhoto(hit.photoName, placesApiKey);
          // 所在地の書き戻しは、社名が完全一致か地元県に当たったときだけ（弱い照合で県を上書きしない）
          const trusted = hit.exact || (hit.prefecture != null && homePrefs.includes(hit.prefecture));
          const writePref = hit.prefecture && trusted && (!c.prefecture || opts.force) ? hit.prefecture : null;
          if (writePref) prefecture = writePref;
          // サイトURLも、照合が強いときだけ埋める（弱い照合で他社のサイトを読みに行かない）
          if (!website && hit.websiteUrl && trusted) website = hit.websiteUrl;
          await db.customer.update({
            where: { id: c.id },
            data: {
              placeId: hit.id,
              placeName: hit.name,
              placeAddress: hit.address,
              googleRating: hit.rating,
              googleRatingCount: hit.ratingCount,
              googleMapsUrl: hit.mapsUrl,
              placeSummary: hit.summary,
              lat: hit.lat,
              lng: hit.lng,
              ...(photo ? { photoData: photo, photoSource: "places" } : {}),
              ...(writePref ? { prefecture: writePref } : {}),
              ...(website && !c.website ? { website } : {}),
              placeCheckedAt: new Date(),
            },
          });
          if (photo) stats.photoSaved++;
          log(`★ ${c.name} → ${hit.name} [${hit.prefecture ?? "?"}] ${hit.rating ?? "-"} (${hit.ratingCount ?? 0})${photo ? " 📷" : ""}${hit.exact ? "" : " (部分一致)"}`);
        } else {
          stats.placeNotFound++;
          await db.customer.update({
            where: { id: c.id },
            data: {
              placeCheckedAt: new Date(),
              // やり直しで見つからなくなった会社は、前回の（誤った可能性のある）値を消す
              ...(opts.force
                ? {
                    placeId: null, placeName: null, placeAddress: null, googleRating: null, googleRatingCount: null,
                    googleMapsUrl: null, placeSummary: null, lat: null, lng: null,
                    ...(c.photoSource === "places" ? { photoData: null, photoSource: null } : {}),
                  }
                : {}),
            },
          });
          log(`－ ${c.name} Places 該当なし${opts.force ? "（前回の値を消去）" : ""}`);
        }
      } catch (e) {
        stats.errors++;
        log(`！ ${c.name} Places エラー: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    // ---- 社内構成
    if (opts.only !== "places" && (opts.force || !c.profileCheckedAt)) {
      try {
        let hit: ProfileHit | null = null;
        if (c.corporateNumber && gbizToken) hit = await fetchGbizProfile(c.corporateNumber, gbizToken);
        if (!hit && website) {
          const site = await crawlSiteProfile(website);
          if (site) hit = site;
        }
        if (hit) {
          stats.profileFound++;
          await db.customer.update({
            where: { id: c.id },
            data: {
              employeeCount: hit.employeeCount,
              capital: hit.capital,
              representativeName: hit.representativeName,
              foundedYear: hit.foundedYear,
              foundedRaw: hit.foundedRaw,
              profileSource: hit.source,
              profileSourceUrl: hit.sourceUrl,
              profileCheckedAt: new Date(),
            },
          });
          log(`👥 ${c.name} 従業員${hit.employeeCount ?? "-"} 資本金${hit.capital ?? "-"} 代表${hit.representativeName ?? "-"} 設立${hit.foundedYear ?? "-"} [${hit.source}]`);
        } else {
          stats.profileNotFound++;
          await db.customer.update({ where: { id: c.id }, data: { profileCheckedAt: new Date() } });
        }
      } catch (e) {
        stats.errors++;
        log(`！ ${c.name} 社内構成 エラー: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    // ---- 写真がまだ無ければ og:image
    if (website && opts.only !== "places") {
      const fresh = await db.customer.findUnique({ where: { id: c.id }, select: { photoData: true } });
      if (!fresh?.photoData) {
        const og = await fetchOgImage(website);
        if (og) {
          await db.customer.update({ where: { id: c.id }, data: { photoData: og, photoSource: "og" } });
          stats.photoSaved++;
          log(`📷 ${c.name} og:image`);
        }
      }
    }
  }

  async function worker() {
    for (;;) {
      const c = queue.shift();
      if (!c) return;
      await one(c);
    }
  }
  const n = Math.min(opts.concurrency ?? 3, Math.max(queue.length, 1));
  await Promise.all(Array.from({ length: n }, worker));
  return stats;
}
