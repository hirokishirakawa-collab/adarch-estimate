// ==============================================================
// Ad Arch Studio（公開MCP）の守り
//   ・上限: IPごと（情報ツール・問い合わせ）＋全体。問い合わせはDBでも数える（再起動で戻らない）
//   ・キャッシュ: 情報ツールの結果を短時間持つ
//   ⚠️ プロセス内の数え方は再起動・複数台で戻る＝全体上限とメール単位（DB）を後ろ盾にする
// ==============================================================

import { createHash } from "crypto";
import { db } from "@/lib/db";

export const LIMITS = {
  infoPerIpHour: 60,
  infoGlobalDay: 5000,
  inquiryPerIpHour: 3,
  inquiryPerIpDay: 10,
  inquiryPerEmailDay: 5,
  inquiryGlobalDay: 200,
} as const;

type Counter = { n: number; until: number };
const stores = new Map<string, Map<string, Counter>>();

/** 窓の中の回数を1つ進めて、上限を超えたら true */
function over(bucket: string, key: string, windowMs: number, max: number): boolean {
  let store = stores.get(bucket);
  if (!store) stores.set(bucket, (store = new Map()));
  const now = Date.now();
  const e = store.get(key);
  if (!e || e.until < now) {
    store.set(key, { n: 1, until: now + windowMs });
    if (store.size > 20_000) for (const [k, v] of store) if (v.until < now) store.delete(k);
    return 1 > max;
  }
  e.n += 1;
  return e.n > max;
}

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

export function ipHash(ip: string): string {
  return createHash("sha256").update(`studio:${process.env.AUTH_SECRET ?? ""}:${ip}`).digest("hex");
}

/** 情報ツールの上限。超えたら利用者向けの一言、通れば null */
export function infoLimited(ipH: string): string | null {
  if (over("info-ip", ipH, HOUR, LIMITS.infoPerIpHour)) return "短い時間にご利用が集中しています。1時間ほど空けてからお試しください。";
  if (over("info-all", "all", DAY, LIMITS.infoGlobalDay)) return "ただいま混み合っています。時間をおいてお試しください。";
  return null;
}

/** 問い合わせの上限（IPはプロセス内・メールと全体はDBで数える） */
export async function inquiryLimited(ipH: string, email: string): Promise<string | null> {
  const msg = "本日の受付の上限に達しました。お急ぎの場合は時間をおいてお試しください。";
  if (over("inq-ip-h", ipH, HOUR, LIMITS.inquiryPerIpHour)) return "短い時間に続けて送信されています。1時間ほど空けてからお試しください。";
  if (over("inq-ip-d", ipH, DAY, LIMITS.inquiryPerIpDay)) return msg;
  const since = new Date(Date.now() - DAY);
  const [byEmail, all] = await Promise.all([
    db.studioInquiry.count({ where: { email, createdAt: { gte: since } } }),
    db.studioInquiry.count({ where: { createdAt: { gte: since } } }),
  ]);
  if (byEmail >= LIMITS.inquiryPerEmailDay) return msg;
  if (all >= LIMITS.inquiryGlobalDay) return "ただいま混み合っています。時間をおいてお試しください。";
  return null;
}

// ---- キャッシュ ------------------------------------------------------------
const cache = new Map<string, { at: number; value: unknown }>();

export async function cached<T>(key: string, ttlMs: number, load: () => Promise<T> | T): Promise<T> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < ttlMs) return hit.value as T;
  const value = await load();
  cache.set(key, { at: Date.now(), value });
  if (cache.size > 2000) {
    const cut = Date.now() - DAY;
    for (const [k, v] of cache) if (v.at < cut) cache.delete(k);
  }
  return value;
}

/** 本部の画面で公開パッケージを変えたとき */
export function clearStudioCache(prefix: string): void {
  for (const k of cache.keys()) if (k.startsWith(prefix)) cache.delete(k);
}
