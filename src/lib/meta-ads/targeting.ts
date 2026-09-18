// ==============================================================
// Meta広告のターゲット候補を探す（2026-09-18 代表決定「経営者のみ・職種などで細分化」）
//   Meta公式コネクタには候補（ID）を探す道具が無い＝AIがIDを作れない。OSが本部の接続（トークン）で検索だけ行う
//   ・検索のみ（作成・変更はしない）。IDはMeta全体で共通なので、各社の広告アカウントでもそのまま使える
//   ・本部のトークンは60日で切れる。切れたら検索できない旨を返す（/dashboard/meta-ads の従来接続を本部が貼り直す）
// ==============================================================

import { db } from "@/lib/db";
import { decryptSecret } from "@/lib/line/secret";

const API_VERSION = process.env.META_API_VERSION ?? "v21.0";
const GRAPH = `https://graph.facebook.com/${API_VERSION}`;

export type TargetingKind = "job_title" | "employer" | "interest" | "behavior" | "industry";
/** Meta の検索種別と、広告セットの targeting で入れる場所 */
const KINDS: Record<TargetingKind, { search: Record<string, string>; field: string; label: string; needsQuery: boolean }> = {
  job_title: { search: { type: "adworkposition" }, field: "work_positions", label: "職種・役職", needsQuery: true },
  employer: { search: { type: "adworkemployer" }, field: "work_employers", label: "勤務先", needsQuery: true },
  interest: { search: { type: "adinterest" }, field: "interests", label: "興味・関心", needsQuery: true },
  behavior: { search: { type: "adTargetingCategory", class: "behaviors" }, field: "behaviors", label: "行動（例: 小規模事業の経営者）", needsQuery: false },
  industry: { search: { type: "adTargetingCategory", class: "industries" }, field: "industries", label: "業界", needsQuery: false },
};

async function hqToken(): Promise<string | null> {
  const row = await db.metaAdAccount.findFirst({ where: { branchId: null, isActive: true }, select: { accessTokenEnc: true } });
  return row ? decryptSecret(row.accessTokenEnc) : null;
}

export async function searchMetaTargeting(input: { kind: TargetingKind; query?: string; limit?: number }) {
  const k = KINDS[input.kind];
  if (!k) throw new Error("kind は job_title / employer / interest / behavior / industry のどれか");
  const q = input.query?.trim() ?? "";
  if (k.needsQuery && !q) throw new Error("query（探す言葉。例: 経営者 / 工務店 / 不動産）を入れてください");
  const token = await hqToken();
  if (!token) return { ok: false, note: "本部のMeta接続がありません。本部に連絡してください（検索は本部の接続で行います）" };
  const params = new URLSearchParams({ ...k.search, locale: "ja_JP", limit: String(Math.min(50, Math.max(1, input.limit ?? 20))), ...(q && k.needsQuery ? { q } : {}) });
  // トークンはURLに載せず Authorization ヘッダーで
  const res = await fetch(`${GRAPH}/search?${params.toString()}`, { cache: "no-store", headers: { Authorization: `Bearer ${token}` } });
  const j = (await res.json()) as { data?: { id: string; name: string; audience_size_lower_bound?: number; audience_size_upper_bound?: number; path?: string[]; description?: string }[]; error?: { message: string; code?: number } };
  if (!res.ok || j.error) {
    const expired = j.error?.code === 190;
    return { ok: false, note: expired ? "本部のMeta接続（トークン）の期限が切れています。本部に連絡してください" : `Metaの検索でエラー: ${j.error?.message ?? res.status}` };
  }
  let rows = j.data ?? [];
  // 一覧型（行動・業界）は言葉で絞る
  if (!k.needsQuery && q) rows = rows.filter((r) => `${r.name} ${(r.path ?? []).join(" ")} ${r.description ?? ""}`.toLowerCase().includes(q.toLowerCase()));
  return {
    ok: true,
    kind: input.kind,
    targetingField: k.field,
    howToUse: `広告セットの targeting.flexible_spec に {"${k.field}":[{"id":"<id>","name":"<name>"}]} で入れる。同じ配列の中はどれか1つに当てはまる人（OR）・flexible_spec の別要素は両方に当てはまる人（AND）。細かくしすぎると届く人が減るので、市の半径と合わせて本人に確認`,
    results: rows.slice(0, input.limit ?? 20).map((r) => ({
      id: r.id,
      name: r.name,
      path: r.path?.join(" > ") ?? null,
      audienceSize: r.audience_size_lower_bound != null ? `${r.audience_size_lower_bound.toLocaleString("ja-JP")}〜${(r.audience_size_upper_bound ?? r.audience_size_lower_bound).toLocaleString("ja-JP")}人（全国の目安）` : null,
    })),
  };
}
