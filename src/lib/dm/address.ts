// ==============================================================
// 郵送DM — 住所の分解（Webレターの宛先CSVは 都道府県／市区町村／町域／丁目・番地／ビル に分ける必要がある）
//   1) 住所文字列を正規表現で分解（API不要・決定的）
//   2) 郵便番号は「〒123-4567」が住所に入っていればそれを使い、無ければ Google Geocoding で補完
// ==============================================================

export interface ParsedAddress {
  postal3: string | null;
  postal4: string | null;
  pref: string;
  city: string;
  town: string;
  block: string;
  building: string;
  /** 分解できなかった（都道府県 or 市区町村が取れない） */
  incomplete: boolean;
  raw: string;
}

const PREF_RE = /(北海道|東京都|(?:京都|大阪)府|[^\s]{2,3}県)/;
// 政令市の区（〜市〜区）／郡＋町村／市／区（東京23区）／町／村
const CITY_RE = /^((?:[^\s\d０-９]{1,6}市[^\s\d０-９]{1,5}区)|(?:[^\s\d０-９]{1,5}郡[^\s\d０-９]{1,6}[町村])|(?:[^\s\d０-９]{1,6}市)|(?:[^\s\d０-９]{1,5}区)|(?:[^\s\d０-９]{1,6}[町村]))/;

const toHalf = (s: string) => s.replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0)).replace(/[－ー−‐]/g, "-");

export function cleanAddress(raw: string): { postal: string | null; text: string } {
  let s = raw.replace(/^日本[、,]?\s*/, "").replace(/\s+/g, " ").trim();
  let postal: string | null = null;
  const m = s.match(/〒?\s*(\d{3})-?(\d{4})/);
  if (m) {
    postal = `${m[1]}${m[2]}`;
    s = s.replace(m[0], "").trim();
  }
  return { postal, text: s.replace(/^[、,\s]+/, "") };
}

export function parseJapaneseAddress(raw: string, prefHint?: string | null): ParsedAddress {
  const { postal, text } = cleanAddress(raw);
  let rest = text;
  let pref = "";
  const pm = rest.match(PREF_RE);
  if (pm && rest.indexOf(pm[1]) <= 2) {
    pref = pm[1];
    rest = rest.slice(rest.indexOf(pm[1]) + pm[1].length);
  } else if (prefHint) {
    pref = prefHint;
  }
  rest = rest.trim();
  let city = "";
  const cm = rest.match(CITY_RE);
  if (cm) {
    city = cm[1];
    rest = rest.slice(cm[1].length);
  }
  // ビル名: 半角/全角スペース以降、または「ビル」「マンション」「階」「F」を含む末尾
  let building = "";
  const sp = rest.search(/[\s　]/);
  if (sp > 0) {
    building = rest.slice(sp).trim();
    rest = rest.slice(0, sp);
  } else {
    const bm = rest.match(/^(.*?\d[\d\-－ー−]*(?:号|番地|番)?)(\D{2,}(?:ビル|マンション|ハイツ|コーポ|タワー|センター|会館|[0-9０-９]+[階F]).*)$/);
    if (bm) {
      rest = bm[1];
      building = bm[2];
    }
  }
  // 町域 = 最初の数字（丁目・番地）まで。丁目・番地 = 残り
  let town = rest;
  let block = "";
  const nm = rest.search(/[0-9０-９一二三四五六七八九十]+(?:丁目|番地|番|-|－|ー|の)|[0-9０-９]/);
  if (nm > 0) {
    town = rest.slice(0, nm);
    block = rest.slice(nm);
  } else if (nm === 0) {
    town = "";
    block = rest;
  }
  return {
    postal3: postal ? postal.slice(0, 3) : null,
    postal4: postal ? postal.slice(3) : null,
    pref,
    city,
    town: town.trim(),
    block: toHalf(block.trim()),
    building: building.trim(),
    incomplete: !pref || !city,
    raw,
  };
}

/** Google Geocoding で郵便番号を補完（キーが無い／見つからない場合は null） */
export async function lookupPostalCode(address: string): Promise<string | null> {
  const key = process.env.GOOGLE_API_KEY ?? process.env.GOOGLE_PLACES_API_KEY;
  if (!key) return null;
  try {
    const res = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&region=jp&language=ja&key=${key}`, { cache: "no-store", signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const j = (await res.json()) as { results?: { address_components: { long_name: string; types: string[] }[] }[] };
    const comp = j.results?.[0]?.address_components.find((c) => c.types.includes("postal_code"));
    const digits = comp?.long_name.replace(/\D/g, "");
    return digits && digits.length === 7 ? digits : null;
  } catch {
    return null;
  }
}
