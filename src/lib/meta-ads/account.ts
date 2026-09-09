// ==============================================================
// Meta広告アカウント — 拠点ごとの接続（2026-09-09 代表決定「出稿は各拠点のアカウントで・本部は責任を持たない」）
//   ・拠点の代表が自分の広告アカウント（act_…）・Facebookページ・アクセストークンをOSに貼る
//   ・トークンは LINE公式と同じ暗号化（AES-256-GCM・AUTH_SECRET派生）
//   ・create_local_ad は呼んだ人の拠点の接続を使う。本部は branchId=null の行（本部が自分の広告を出す時だけ）
// ==============================================================

import { db } from "@/lib/db";
import { encryptSecret, decryptSecret } from "@/lib/line/secret";
import type { MetaConfig } from "./local-campaign";

const API_VERSION = process.env.META_API_VERSION ?? "v21.0";
const GRAPH = `https://graph.facebook.com/${API_VERSION}`;

export const normalizeAdAccountId = (s: string) => {
  const t = s.trim();
  return t.startsWith("act_") ? t : `act_${t.replace(/\D/g, "")}`;
};

/** 接続テスト＝広告アカウントの名前・通貨と、ページ名を取れるか */
export async function verifyMetaAccess(accessToken: string, adAccountId: string, pageId: string): Promise<{ adAccountName: string; currency: string; pageName: string }> {
  const act = normalizeAdAccountId(adAccountId);
  const r1 = await fetch(`${GRAPH}/${act}?fields=name,currency,account_status&access_token=${encodeURIComponent(accessToken)}`, { cache: "no-store" });
  const j1 = (await r1.json()) as { name?: string; currency?: string; account_status?: number; error?: { message: string } };
  if (!r1.ok || j1.error) throw new Error(`広告アカウントに届きません: ${j1.error?.message ?? r1.status}`);
  const r2 = await fetch(`${GRAPH}/${encodeURIComponent(pageId)}?fields=name&access_token=${encodeURIComponent(accessToken)}`, { cache: "no-store" });
  const j2 = (await r2.json()) as { name?: string; error?: { message: string } };
  if (!r2.ok || j2.error) throw new Error(`Facebookページに届きません: ${j2.error?.message ?? r2.status}`);
  return { adAccountName: j1.name ?? act, currency: j1.currency ?? "JPY", pageName: j2.name ?? pageId };
}

export function encryptMetaToken(token: string): string {
  return encryptSecret(token);
}

/** 呼んだ人の拠点（本部は branchId=null）の接続。無ければ null */
export async function resolveMetaConfig(viewer: { role: string; branchId: string | null; branchId2?: string | null }): Promise<(MetaConfig & { accountName: string; branchId: string | null }) | null> {
  const candidates: (string | null)[] = viewer.role === "ADMIN" && !viewer.branchId ? [null] : [viewer.branchId, viewer.branchId2 ?? null].filter((b) => b !== undefined);
  for (const branchId of candidates) {
    const row = await db.metaAdAccount.findFirst({ where: { branchId, isActive: true } });
    if (row) {
      return { accessToken: decryptSecret(row.accessTokenEnc), adAccountId: row.adAccountId, pageId: row.pageId, accountName: row.name, branchId: row.branchId };
    }
  }
  return null;
}
