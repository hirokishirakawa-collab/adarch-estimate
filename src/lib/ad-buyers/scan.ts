// ==============================================================
// 広告出稿者ファインダー — 探す（2026-09-10）
//   Google Places で県×市×業種の店を取り、Places の websiteUrl が有料媒体（HPB等）なら即判定。
//   自社サイトの店は、トップページ1枚だけ取りに行き、ページ内リンクに媒体があるかを見る。
//   判定できた店だけを Lead に保存する（一覧＝「広告費を払っている店」だけにするため）。
//   AI採点（Anthropic）は呼ばない＝Places だけで完結（費用の都合）。
//   画面（/api/ad-buyers/scan）から呼ぶ。MCP には出さない（書き込みになるため）。
// ==============================================================

import { db } from "@/lib/db";
import { searchPlaces } from "@/lib/leads/places-search";
import { checkSaveCap } from "@/lib/leads/release-stale";
import { resolveSignal, shouldReplaceSignal } from "@/lib/leads/signal";
import { buildPlaceLeadMemo } from "@/lib/leads/company-memo";
import { fetchHtml } from "@/lib/anniversary/crawl";
import { logApiUsage } from "@/lib/api-usage";
import type { McpViewer } from "@/lib/mcp/os-read-tools";
import type { PlaceLead, ScoredLead } from "@/lib/constants/leads";
import { AD_BUYER_MAX_COUNT, detectPlatforms, isOwnSiteUrl, platformOf } from "./platforms";

export interface ScanInput {
  prefecture: string;
  city?: string;
  industry: string;
  count?: number;
}

export interface ScanItem {
  leadId: string;
  name: string;
  address: string;
  platforms: string[];
  evidenceUrl: string;
  websiteUrl: string | null;
  rating: number;
  ratingCount: number;
}

export interface ScanResult {
  blocked?: boolean;
  reason?: string;
  unsent?: number;
  found: number;
  matched: number;
  saved: number;
  updated: number;
  /** 人が「ファインダーから外す」を押した店（再判定しても戻さない） */
  excluded: number;
  fetched: number;
  items: ScanItem[];
  note: string;
}

/** 1回の実行で自社サイトを取りに行く上限（時間の蓋） */
const MAX_FETCH_PER_RUN = 30;
const FETCH_TIMEOUT_MS = 8_000;
const MAX_HTML_BYTES = 300_000;
const FETCH_CONCURRENCY = 4;

interface Detected {
  platforms: string[];
  evidenceUrl: string;
}

/** HTML の href から媒体リンクを拾う。最初に見つかった媒体ページを根拠URLにする */
export function detectFromHtml(html: string): Detected | null {
  const re = /href\s*=\s*["']([^"']+)["']/gi;
  const platforms = new Set<string>();
  let evidence = "";
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const href = m[1].trim();
    if (!/^https?:\/\//i.test(href)) continue; // 媒体リンクは絶対URL。相対パスは自社内
    const keys = detectPlatforms(href);
    if (keys.length === 0) continue;
    if (!evidence) evidence = href;
    for (const k of keys) platforms.add(k);
  }
  if (platforms.size === 0) return null;
  return { platforms: [...platforms], evidenceUrl: evidence };
}

/** 自社サイトのトップページ1枚だけ見て媒体リンクを探す */
async function detectFromSite(websiteUrl: string): Promise<Detected | null> {
  const html = await fetchHtml(websiteUrl, FETCH_TIMEOUT_MS, 2);
  if (!html) return null;
  return detectFromHtml(html.slice(0, MAX_HTML_BYTES));
}

export async function scanAdBuyers(v: McpViewer, input: ScanInput): Promise<ScanResult> {
  const placesKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!placesKey) throw new Error("Google Places のキーが未設定です。本部にお知らせください");
  const count = Math.min(AD_BUYER_MAX_COUNT, Math.max(1, Math.floor(input.count ?? 20)));
  const city = (input.city ?? "").trim();
  const industry = input.industry.trim();
  const area = [input.prefecture, city].filter(Boolean).join("");
  const empty = (note: string): ScanResult => ({ found: 0, matched: 0, saved: 0, updated: 0, excluded: 0, fetched: 0, items: [], note });

  // 取得の蓋（送ってから取る運用）はリード獲得AIと同じ
  const cap = await checkSaveCap(v.id);
  if (cap.blocked) return { ...empty(cap.message ?? "未送付のリードが多いため、新規の保存は止まっています"), blocked: true, reason: cap.message, unsent: cap.unsent };

  logApiUsage(v.email, "ad-buyers/scan");
  const places = await searchPlaces({ prefecture: input.prefecture, city, industry, industryKeywords: "", count }, placesKey);
  if (places.length === 0) return empty("該当する店が見つかりませんでした。業種の言い方や市を変えてみてください");

  // 1) Places の websiteUrl が媒体そのもの（HPBのサロンページ等）なら即判定
  const detected = new Map<string, Detected>(); // key = name|address
  const keyOf = (p: PlaceLead) => `${p.name}|${p.address ?? ""}`;
  const toFetch: PlaceLead[] = [];
  for (const p of places) {
    const url = (p.websiteUrl ?? "").trim();
    if (!url) continue;
    const keys = detectPlatforms(url);
    if (keys.length > 0) detected.set(keyOf(p), { platforms: keys, evidenceUrl: url });
    else if (isOwnSiteUrl(url)) toFetch.push(p);
  }

  // 2) 自社サイトの店はトップページ1枚だけ見る（上限30サイト・同時4）
  const queue = toFetch.slice(0, MAX_FETCH_PER_RUN);
  const fetched = queue.length;
  async function worker() {
    for (;;) {
      const p = queue.shift();
      if (!p) return;
      const hit = await detectFromSite(p.websiteUrl);
      if (hit) detected.set(keyOf(p), hit);
    }
  }
  await Promise.all(Array.from({ length: Math.min(FETCH_CONCURRENCY, Math.max(queue.length, 1)) }, worker));

  // 3) 判定できた店だけ保存（同名＋同住所は1件）
  const now = new Date();
  const staffName = v.name ?? v.email;
  const items: ScanItem[] = [];
  let saved = 0;
  let updated = 0;
  let excluded = 0;
  for (const p of places) {
    const hit = detected.get(keyOf(p));
    if (!hit) continue;
    const labels = hit.platforms.map((k) => platformOf(k)?.label ?? k).join("・");
    const existing = await db.lead.findUnique({
      where: { name_address: { name: p.name, address: p.address ?? "" } },
      select: { id: true, memo: true, assigneeId: true, signalAt: true, industry: true, websiteUrl: true, adPlatforms: true, adPlatformCheckedAt: true },
    });
    const memo = buildPlaceLeadMemo({ ...p, score: { total: 0, breakdown: {}, comment: "" } } as unknown as ScoredLead);
    const signal = resolveSignal("FOUND", null, now);
    let leadId: string;
    if (existing) {
      // 人が「ファインダーから外す」を押した店（判定済みなのに媒体が空）は戻さない
      if (existing.adPlatformCheckedAt && existing.adPlatforms.length === 0) {
        excluded++;
        continue;
      }
      await db.lead.update({
        where: { id: existing.id },
        data: {
          adPlatforms: hit.platforms, adPlatformUrl: hit.evidenceUrl, adPlatformCheckedAt: now,
          rating: p.rating, ratingCount: p.ratingCount, businessStatus: p.businessStatus || null,
          ...(existing.websiteUrl || !p.websiteUrl ? {} : { websiteUrl: p.websiteUrl }),
          ...(existing.industry ? {} : { industry }),
          ...(existing.memo || !memo ? {} : { memo }),
          ...(existing.assigneeId ? {} : { assigneeId: v.id }),
          ...(shouldReplaceSignal(existing, signal) ? signal : {}),
        },
      });
      leadId = existing.id;
      updated++;
    } else {
      const created = await db.lead.create({
        data: {
          name: p.name, address: p.address || null, phone: p.phone || null, rating: p.rating, ratingCount: p.ratingCount, types: p.types,
          mapsUrl: p.mapsUrl || null, websiteUrl: p.websiteUrl || null, businessStatus: p.businessStatus || null,
          memo: memo || null, ...signal, industry, area, source: "GOOGLE_PLACES", createdById: v.id, assigneeId: v.id,
          adPlatforms: hit.platforms, adPlatformUrl: hit.evidenceUrl, adPlatformCheckedAt: now,
        },
      });
      await db.leadLog.create({ data: { leadId: created.id, action: "CREATED", detail: `広告出稿者ファインダーから保存（掲載媒体: ${labels}）`, staffName } });
      leadId = created.id;
      saved++;
    }
    items.push({ leadId, name: p.name, address: p.address ?? "", platforms: hit.platforms, evidenceUrl: hit.evidenceUrl, websiteUrl: p.websiteUrl || null, rating: p.rating, ratingCount: p.ratingCount });
  }

  const matched = items.length + excluded;
  const note =
    matched === 0
      ? `${places.length}件見つかりましたが、有料媒体の掲載を確認できた店はありませんでした（自社サイトを見たのは${fetched}件）。業種を変えるか、件数を増やしてみてください`
      : `${places.length}件のうち${matched}件で有料媒体の掲載を確認しました（保存${saved}・更新${updated}${excluded ? `・外した店${excluded}` : ""}）`;
  return { found: places.length, matched, saved, updated, excluded, fetched, items, note };
}
