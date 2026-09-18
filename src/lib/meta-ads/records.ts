// ==============================================================
// Meta広告の記録（2026-09-18 代表決定）
//   広告の作成はAIがMeta公式コネクタ（mcp.facebook.com/ads）で行う。OSは設計を出し、作った結果と成果を記録する
//   ・record_local_ad        : 作った直後に1件記録（MetaのキャンペーンIDで重複しない）
//   ・update_local_ad_results: AIがMetaから取ってきた表示回数・クリック等を書き足す（自拠点の分だけ）
//   ・local_ad_results       : 自拠点（本部は全社）の一覧＋全社の見比べ。他拠点は社名・費用を出さない
// ==============================================================

import { db } from "@/lib/db";
import { resolveCity, resolvePref } from "@/lib/mcp/os-campaign-tools";
import { WriteError } from "@/lib/mcp/os-write-tools";
import type { McpViewer } from "@/lib/mcp/os-read-tools";
import { estimateLocalAudience } from "@/lib/meta-ads/targeting";

function need(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new WriteError(msg);
}
const digits = (s: string | undefined | null) => (s ?? "").replace(/^act_/, "").trim();
const isHq = (v: Pick<McpViewer, "role" | "branchId">) => v.role === "ADMIN" && !v.branchId;
const ymd = (d: Date | null | undefined) =>
  d ? new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit" }).format(d) : null;
const toDate = (s: string | undefined) => {
  if (!s) return null;
  const d = new Date(/^\d{4}-\d{2}-\d{2}$/.test(s) ? `${s}T00:00:00+09:00` : s);
  return Number.isNaN(d.getTime()) ? null : d;
};
export const ctr = (clicks: number | null, imps: number | null) => (clicks != null && imps ? Math.round((clicks / imps) * 10000) / 100 : null);

export interface RecordLocalAdInput {
  prefecture: string;
  city: string;
  industry?: string;
  radiusKm?: number;
  ageMin?: number;
  ageMax?: number;
  genders?: string;
  audienceLabel?: string;
  audience?: { field: string; id: string; name: string }[];
  dailyBudgetJpy: number;
  startDate?: string;
  endDate?: string;
  landingUrl: string;
  imageUrl?: string;
  headline: string;
  primaryText: string;
  adAccountId: string;
  campaignId: string;
  adsetId?: string;
  adId?: string;
  status?: string;
}

export async function recordLocalAd(v: McpViewer, a: RecordLocalAdInput) {
  need(v.role !== "USER", "広告の記録は代表（MANAGER以上）のみです");
  const pref = resolvePref(a.prefecture);
  need(pref, "都道府県名が一致しません（例: 岐阜県）");
  const city = resolveCity(pref, a.city);
  need(city, "市区町村が見つかりません");
  const campaignId = digits(a.campaignId);
  need(/^\d{5,}$/.test(campaignId), "campaignId はMetaのキャンペーンID（数字）を入れてください");
  const account = digits(a.adAccountId);
  need(/^\d{5,}$/.test(account), "adAccountId はMetaの広告アカウントID（数字）を入れてください");
  need(Number.isFinite(a.dailyBudgetJpy) && a.dailyBudgetJpy > 0, "dailyBudgetJpy（日額・円）を入れてください");
  need(/^https?:\/\//.test(a.landingUrl ?? ""), "landingUrl は https:// から始めてください");
  need(!a.imageUrl?.trim() || /^https?:\/\//i.test(a.imageUrl.trim()), "imageUrl は https:// から始めてください");
  need(a.headline?.trim() && a.primaryText?.trim(), "見出しと本文を入れてください");
  const FIELDS = ["work_positions", "work_employers", "behaviors", "industries", "interests"];
  const audience = (a.audience ?? []).filter((x) => x && FIELDS.includes(x.field) && /^\d{5,}$/.test(String(x.id)) && x.name?.trim()).map((x) => ({ field: x.field, id: String(x.id), name: x.name.trim().slice(0, 100) })).slice(0, 30);
  const age = (n: number | undefined) => (n == null || !Number.isFinite(n) ? null : Math.min(65, Math.max(13, Math.round(n))));
  const genders = ["all", "male", "female"].includes((a.genders ?? "all").toLowerCase()) ? (a.genders ?? "all").toLowerCase() : "all";
  const status = ["PAUSED", "ACTIVE", "ENDED"].includes((a.status ?? "PAUSED").toUpperCase()) ? (a.status ?? "PAUSED").toUpperCase() : "PAUSED";
  const data = {
    prefecture: pref, cityCode: city.code, cityName: city.name, industry: a.industry?.trim() || null,
    radiusKm: a.radiusKm ?? 10, ageMin: age(a.ageMin), ageMax: age(a.ageMax), genders, audienceLabel: a.audienceLabel?.trim().slice(0, 120) || null, audienceSpec: audience.length ? audience : undefined, dailyBudgetJpy: Math.round(a.dailyBudgetJpy), startDate: toDate(a.startDate), endDate: toDate(a.endDate),
    landingUrl: a.landingUrl.trim(), imageUrl: a.imageUrl?.trim() || null, headline: a.headline.trim().slice(0, 200), primaryText: a.primaryText.trim().slice(0, 2000),
    metaAdAccountId: account, metaAdsetId: digits(a.adsetId) || null, metaAdId: digits(a.adId) || null, status,
  };
  const existing = await db.metaAdRecord.findUnique({ where: { metaCampaignId: campaignId }, select: { id: true, createdByEmail: true, branchId: true, estDailyMin: true } });
  // 記録した時点の想定（対象人数と日額の目安）を残す＝一覧で実績と見比べる。取れなくても記録は止めない
  if (!existing?.estDailyMin) {
    const est = await estimateLocalAudience({ prefecture: pref, city: city.name, radiusKm: data.radiusKm, ageMin: data.ageMin ?? undefined, ageMax: data.ageMax ?? undefined, genders: genders as "all" | "male" | "female", audience }).catch(() => null);
    if (est?.ok) Object.assign(data, { estAudienceLower: est.numbers.audienceLower, estAudienceUpper: est.numbers.audienceUpper, estDailyMin: est.numbers.dailyMin, estDailyMax: est.numbers.dailyMax });
  }
  if (existing) {
    need(isHq(v) || existing.branchId === v.branchId, "このキャンペーンは別の拠点が記録済みです");
    const r = await db.metaAdRecord.update({ where: { id: existing.id }, data, select: { id: true } });
    return { id: r.id, updated: true, next: "成果が出たら Meta公式コネクタで表示回数・リーチ・クリック・費用を取り、update_local_ad_results で書き足す" };
  }
  const r = await db.metaAdRecord.create({
    data: { ...data, metaCampaignId: campaignId, branchId: v.branchId, groupCompanyId: v.groupCompanyId, createdByEmail: v.email, createdByName: v.name },
    select: { id: true },
  });
  return { id: r.id, updated: false, next: "成果が出たら Meta公式コネクタで表示回数・リーチ・クリック・費用を取り、update_local_ad_results で書き足す" };
}

export interface UpdateLocalAdResultsInput {
  campaignId: string;
  impressions?: number;
  reach?: number;
  clicks?: number;
  spendJpy?: number;
  status?: string;
}

export async function updateLocalAdResults(v: McpViewer, a: UpdateLocalAdResultsInput) {
  need(v.role !== "USER", "広告の記録は代表（MANAGER以上）のみです");
  const campaignId = digits(a.campaignId);
  const rec = await db.metaAdRecord.findUnique({ where: { metaCampaignId: campaignId }, select: { id: true, branchId: true } });
  need(rec, "このキャンペーンはOSに記録がありません。先に record_local_ad で記録してください");
  need(isHq(v) || rec.branchId === v.branchId, "他拠点の広告は更新できません");
  const n = (x: number | undefined) => (x == null || !Number.isFinite(x) ? undefined : Math.max(0, Math.round(x)));
  const status = a.status && ["PAUSED", "ACTIVE", "ENDED"].includes(a.status.toUpperCase()) ? a.status.toUpperCase() : undefined;
  const r = await db.metaAdRecord.update({
    where: { id: rec.id },
    data: { impressions: n(a.impressions), reach: n(a.reach), clicks: n(a.clicks), spendJpy: n(a.spendJpy), ...(status ? { status } : {}), resultsUpdatedAt: new Date() },
    select: { impressions: true, clicks: true },
  });
  return { ok: true, ctrPct: ctr(r.clicks, r.impressions) };
}

/** 画面・AI共通の一覧。自拠点は全項目、他拠点は社名・費用・文面の作成者を伏せる */
export async function listLocalAdRecords(v: Pick<McpViewer, "role" | "branchId">, opts: { scope?: "mine" | "group"; industry?: string; prefecture?: string; audience?: string; limit?: number } = {}) {
  const hq = isHq(v);
  const mineOnly = opts.scope !== "group" && !hq;
  const rows = await db.metaAdRecord.findMany({
    where: {
      ...(mineOnly ? { branchId: v.branchId } : {}),
      ...(opts.industry ? { industry: { contains: opts.industry } } : {}),
      ...(opts.prefecture ? { prefecture: { contains: opts.prefecture.replace(/[都府県]$/, "") } } : {}),
      ...(opts.audience ? { audienceLabel: { contains: opts.audience } } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: Math.min(100, Math.max(1, opts.limit ?? 30)),
  });
  const branchIds = [...new Set(rows.map((r) => r.branchId).filter((b): b is string => !!b))];
  const branches = branchIds.length ? await db.branch.findMany({ where: { id: { in: branchIds } }, select: { id: true, name: true } }) : [];
  const bName = new Map(branches.map((b) => [b.id, b.name]));
  return rows.map((r) => {
    const own = hq || r.branchId === v.branchId;
    return {
      id: r.id,
      own,
      branch: own ? (r.branchId ? bName.get(r.branchId) ?? "拠点" : "本部") : "他拠点",
      area: `${r.prefecture}${r.cityName}`,
      industry: r.industry,
      radiusKm: r.radiusKm,
      // ターゲットは費用でないので他拠点にも見せる（どの層に当てるとクリックされるかの材料）
      audience: {
        label: r.audienceLabel,
        age: r.ageMin || r.ageMax ? `${r.ageMin ?? 18}〜${r.ageMax ?? 65}歳` : null,
        genders: r.genders,
        detail: Array.isArray(r.audienceSpec) ? (r.audienceSpec as { field: string; name: string }[]).map((x) => `${x.name}`) : [],
      },
      period: [ymd(r.startDate), ymd(r.endDate)].filter(Boolean).join("〜") || null,
      headline: r.headline,
      primaryText: r.primaryText,
      imageUrl: r.imageUrl,
      landingUrl: own ? r.landingUrl : null,
      status: r.status,
      impressions: r.impressions,
      reach: r.reach,
      clicks: r.clicks,
      ctrPct: ctr(r.clicks, r.impressions),
      ...(own ? { dailyBudgetJpy: r.dailyBudgetJpy, spendJpy: r.spendJpy, campaignId: r.metaCampaignId } : {}),
      // 想定（記録した時点）は費用でなく目安なので全社に見せる。実績の費用・1,000回表示あたりは自拠点だけ
      estimate: r.estDailyMin != null ? { audience: `${(r.estAudienceLower ?? 0).toLocaleString("ja-JP")}〜${(r.estAudienceUpper ?? 0).toLocaleString("ja-JP")}人`, daily: `${r.estDailyMin.toLocaleString("ja-JP")}〜${(r.estDailyMax ?? r.estDailyMin).toLocaleString("ja-JP")}円` } : null,
      ...(own ? { cpmJpy: r.spendJpy != null && r.impressions ? Math.round((r.spendJpy / r.impressions) * 1000) : null } : {}),
      resultsUpdatedAt: ymd(r.resultsUpdatedAt),
      createdAt: ymd(r.createdAt),
    };
  });
}
