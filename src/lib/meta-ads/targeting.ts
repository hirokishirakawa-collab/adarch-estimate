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

// ==============================================================
// 対象人数と日額の目安（2026-09-18 代表決定「該当人口から適正な投下価格を割り出す」）
//   ・対象人数: Metaの delivery_estimate（本部の接続・読み取りのみ）＝月間の推定人数
//   ・日額: Metaの「予算ごとの到達曲線」は廃止済み → OSで計算する
//       対象の6割に・1週間で3回見せる回数 × 1,000回表示あたりの費用（OSに記録した全社の実績。無ければ本部アカウントの過去実績の幅）
// ==============================================================

const REACH_SHARE = 0.6;
const WEEKLY_FREQUENCY = 3;
/** 記録が足りないときの幅（本部アカウントの過去実績 2024〜2026: 1,000回表示あたり 約250円〜2,000円） */
const FALLBACK_CPM: [number, number] = [250, 2000];

export async function estimateLocalAudience(input: {
  prefecture: string;
  city: string;
  radiusKm?: number;
  ageMin?: number;
  ageMax?: number;
  genders?: "all" | "male" | "female";
  audience?: { field: string; id: string; name: string }[];
  dailyBudgetJpy?: number;
}) {
  const { geocodeCity } = await import("@/lib/meta-ads/local-campaign");
  const geo = await geocodeCity(input.prefecture, input.city).catch(() => null);
  if (!geo) return { ok: false, note: "市の中心の位置が取れませんでした（都道府県名と市区町村名を確かめてください）" };
  const token = await hqToken();
  if (!token) return { ok: false, note: "本部のMeta接続がありません。本部に連絡してください" };
  const hq = await db.metaAdAccount.findFirst({ where: { branchId: null, isActive: true }, select: { adAccountId: true } });
  const radius = Math.min(80, Math.max(1, input.radiusKm ?? 10));
  const FIELDS = ["work_positions", "work_employers", "behaviors", "industries", "interests"];
  const byField: Record<string, { id: string; name: string }[]> = {};
  for (const x of input.audience ?? []) if (FIELDS.includes(x.field) && /^\d{5,}$/.test(String(x.id))) (byField[x.field] ??= []).push({ id: String(x.id), name: x.name });
  const spec = {
    geo_locations: { custom_locations: [{ latitude: geo.latitude, longitude: geo.longitude, radius, distance_unit: "kilometer" }], location_types: ["home", "recent"] },
    age_min: Math.max(18, input.ageMin ?? 25),
    age_max: Math.min(65, input.ageMax ?? 65),
    ...(input.genders === "male" ? { genders: [1] } : input.genders === "female" ? { genders: [2] } : {}),
    ...(Object.keys(byField).length ? { flexible_spec: [byField] } : {}),
  };
  const params = new URLSearchParams({ targeting_spec: JSON.stringify(spec), optimization_goal: "LINK_CLICKS" });
  const res = await fetch(`${GRAPH}/act_${hq!.adAccountId.replace(/^act_/, "")}/delivery_estimate?${params}`, { cache: "no-store", headers: { Authorization: `Bearer ${token}` } });
  const j = (await res.json()) as { data?: { estimate_mau_lower_bound?: number; estimate_mau_upper_bound?: number; estimate_ready?: boolean }[]; error?: { message: string; code?: number } };
  if (!res.ok || j.error) return { ok: false, note: j.error?.code === 190 ? "本部のMeta接続（トークン）の期限が切れています。本部に連絡してください" : `Metaの見積もりでエラー: ${j.error?.message ?? res.status}` };
  const lo = j.data?.[0]?.estimate_mau_lower_bound ?? 0;
  const hi = j.data?.[0]?.estimate_mau_upper_bound ?? lo;
  const mid = (lo + hi) / 2;

  // 1,000回表示あたりの費用＝OSに記録した全社の実績（絞り込みあり／なしで分ける・1,000回以上表示されたものだけ）
  const narrowed = Object.keys(byField).length > 0;
  const recs = await db.metaAdRecord.findMany({ where: { impressions: { gte: 1000 }, spendJpy: { gt: 0 } }, select: { impressions: true, spendJpy: true, audienceSpec: true } });
  const same = recs.filter((r) => (Array.isArray(r.audienceSpec) && r.audienceSpec.length > 0) === narrowed);
  const cpms = same.map((r) => (r.spendJpy! / r.impressions!) * 1000).sort((a, b) => a - b);
  const cpm: [number, number] = cpms.length >= 3 ? [cpms[Math.floor(cpms.length * 0.25)], cpms[Math.floor(cpms.length * 0.75)]] : FALLBACK_CPM;
  const weeklyImps = Math.round(mid * REACH_SHARE * WEEKLY_FREQUENCY);
  const daily = cpm.map((c) => Math.max(100, Math.round((weeklyImps / 1000) * c / 7 / 100) * 100)) as [number, number];
  const b = input.dailyBudgetJpy;
  return {
    ok: true,
    area: `${geo.formatted}の中心から半径${radius}km・${spec.age_min}〜${spec.age_max}歳${narrowed ? `・${Object.values(byField).flat().map((x) => x.name).join("／")}` : ""}`,
    audienceMonthly: `${lo.toLocaleString("ja-JP")}〜${hi.toLocaleString("ja-JP")}人（Metaの推定）`,
    tooSmall: hi < 1000 ? "対象が1,000人未満＝配信が止まりやすい。半径を広げるか絞り込みを減らす" : null,
    dailyBudgetGuide: `日額${daily[0].toLocaleString("ja-JP")}〜${daily[1].toLocaleString("ja-JP")}円（目安・税抜）`,
    ...(b ? { yourBudget: b < daily[0] ? `日額${b}円は目安より少ない＝届く人が対象の6割より減る` : b > daily[1] ? `日額${b}円は目安より多い＝同じ人に何度も出る（週3回より多い）` : `日額${b}円は目安の範囲内` } : {}),
    howCalculated: `対象の${REACH_SHARE * 100}%に1週間で${WEEKLY_FREQUENCY}回見せる（週${weeklyImps.toLocaleString("ja-JP")}回表示）× 1,000回表示あたり${Math.round(cpm[0])}〜${Math.round(cpm[1])}円（${cpms.length >= 3 ? `OSに記録した全社の実績${cpms.length}件・${narrowed ? "絞り込みあり" : "絞り込みなし"}` : "記録がまだ少ないため本部アカウントの過去実績の幅"}）。Metaが出した予算ではなくOSの計算。配信3日後に実績で見直す`,
  };
}
