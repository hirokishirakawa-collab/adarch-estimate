// ==============================================================
// サイトの数字（2026-09-19 代表決定）
//   OSはGoogleアナリティクス等を取りに行かない。各社のAIが読んだ数字（コネクタ・スクショ・CSV）を受け取る
//   ・record_site_results: 1期間ぶんの数字を記録（同じサイト・同じ期間は上書き）
//       customerId あり＝広告主のサイト（自拠点の顧客だけ）／なし＝加盟社の自社サイト
//   ・site_results       : 自拠点（本部は全社）の記録。広告主はTVer配信の前・中・後に並べて返す
// ==============================================================

import { db } from "@/lib/db";
import { getBranchFilter } from "@/lib/session";
import { ARCHIVE_BRANCH_ID } from "@/lib/data/customers";
import { WriteError } from "@/lib/mcp/os-write-tools";
import { ownBranchIds, type McpViewer } from "@/lib/mcp/os-read-tools";

function need(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new WriteError(msg);
}
const isHq = (v: McpViewer) => v.role === "ADMIN";
const ymd = (d: Date | null | undefined) =>
  d ? new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit" }).format(d) : null;
/** "YYYY-MM-DD" → その日の0時(JST)。同じ期間を同じ値にして上書きが効くように */
function parseDay(s: string | undefined, label: string): Date {
  need(s && /^\d{4}-\d{2}-\d{2}$/.test(s), `${label}は YYYY-MM-DD の形にしてください`);
  const d = new Date(`${s}T00:00:00+09:00`);
  need(!Number.isNaN(d.getTime()), `${label}が日付として読めません`);
  return d;
}
const count = (n: number | undefined | null, label: string) => {
  if (n == null) return null;
  need(Number.isFinite(n) && n >= 0, `${label}は0以上の数にしてください`);
  return Math.round(n);
};

/** 自拠点の顧客（書き込み用） */
async function ownedCustomer(v: McpViewer, id: string) {
  const c = await db.customer.findFirst({ where: { id, ...getBranchFilter(v), NOT: { branchId: ARCHIVE_BRANCH_ID } }, select: { id: true, name: true, branchId: true, website: true } });
  need(c, "顧客が見つかりません（貴社の拠点の範囲外か、存在しないIDです）。search_customers で探せます");
  return c;
}

/** 加盟社の自社サイトの scope。本部は本部拠点 */
function selfScope(v: McpViewer) {
  const branchId = v.branchId ?? (isHq(v) ? "branch_hq" : null);
  need(branchId, "拠点が割り当てられていません。本部にお問い合わせください");
  return { scope: `self:${v.groupCompanyId ?? branchId}`, branchId };
}

export interface RecordSiteResultsInput {
  customerId?: string;
  siteUrl?: string;
  periodStart: string;
  periodEnd: string;
  sessions?: number;
  users?: number;
  pageViews?: number;
  inquiries?: number;
  phoneTaps?: number;
  source: string;
  note?: string;
}

export async function recordSiteResults(v: McpViewer, a: RecordSiteResultsInput) {
  const periodStart = parseDay(a.periodStart, "periodStart");
  const periodEnd = parseDay(a.periodEnd, "periodEnd");
  need(periodStart <= periodEnd, "periodStart は periodEnd より前にしてください");
  need(periodEnd.getTime() <= Date.now() + 86_400_000, "periodEnd に未来の日付は入れられません（済んだ期間の数字だけ）");
  const nums = {
    sessions: count(a.sessions, "訪問数"), users: count(a.users, "ユーザー数"), pageViews: count(a.pageViews, "表示回数"),
    inquiries: count(a.inquiries, "問い合わせ数"), phoneTaps: count(a.phoneTaps, "電話タップ数"),
  };
  need(Object.values(nums).some((n) => n != null), "数字を1つ以上入れてください（sessions / users / pageViews / inquiries / phoneTaps）");
  const source = a.source?.trim();
  need(source, "数字の出どころ（source）を入れてください。例: Googleアナリティクス / スクショ / CSV");
  const siteUrl = a.siteUrl?.trim() || null;
  need(!siteUrl || /^https?:\/\//.test(siteUrl), "siteUrl は https:// から始めてください");

  const c = a.customerId ? await ownedCustomer(v, a.customerId) : null;
  const { scope, branchId } = c ? { scope: `customer:${c.id}`, branchId: c.branchId } : selfScope(v);
  const data = {
    customerId: c?.id ?? null, branchId, groupCompanyId: v.groupCompanyId, siteUrl: siteUrl ?? c?.website ?? null,
    ...nums, source: source.slice(0, 60), note: a.note?.trim().slice(0, 2000) || null, createdByEmail: v.email, createdByName: v.name,
  };
  const existed = await db.siteMetric.findUnique({ where: { scope_periodStart_periodEnd: { scope, periodStart, periodEnd } }, select: { id: true } });
  const row = await db.siteMetric.upsert({
    where: { scope_periodStart_periodEnd: { scope, periodStart, periodEnd } },
    create: { scope, periodStart, periodEnd, ...data },
    update: data,
    select: { id: true },
  });
  return {
    id: row.id,
    updated: !!existed,
    site: c ? `広告主: ${c.name}` : "自社サイト",
    period: `${ymd(periodStart)}〜${ymd(periodEnd)}`,
    ...nums,
    next: c ? "TVerの配信と並べて見るなら site_results(customerId)" : "推移を見るなら site_results",
  };
}

export async function listSiteResults(v: McpViewer, a: { customerId?: string; limit?: number }) {
  const take = Math.min(100, Math.max(1, Math.floor(a.limit ?? 24)));
  const own = ownBranchIds(v);
  const where = {
    ...(a.customerId ? { customerId: a.customerId } : {}),
    ...(isHq(v) ? {} : { branchId: { in: own.length ? own : ["__none__"] } }),
  };
  const rows = await db.siteMetric.findMany({ where, orderBy: { periodStart: "desc" }, take });
  if (!rows.length) return { rows: [], note: "記録がありません。数字は record_site_results で入れます（自拠点の分だけ見えます）" };

  const customerIds = [...new Set(rows.map((r) => r.customerId).filter((x): x is string => !!x))];
  const customers = customerIds.length ? await db.customer.findMany({ where: { id: { in: customerIds } }, select: { id: true, name: true, branchId: true } }) : [];
  // TVerの配信期間: 広告主名が顧客名と一致する、同じ拠点の配信（申込と顧客はIDで結ばれていないため名前で合わせる）
  const campaigns = customers.length
    ? await db.tverCampaign.findMany({
        where: { OR: customers.map((c) => ({ advertiser: { name: c.name, branchId: c.branchId } })) },
        select: { startDate: true, endDate: true, advertiser: { select: { name: true, branchId: true } } },
        orderBy: { startDate: "asc" },
      })
    : [];
  const companyIds = isHq(v) ? [...new Set(rows.map((r) => r.groupCompanyId).filter((x): x is string => !!x))] : [];
  const companies = new Map((companyIds.length ? await db.groupCompany.findMany({ where: { id: { in: companyIds } }, select: { id: true, name: true } }) : []).map((g) => [g.id, g.name]));
  const byCustomer = new Map(customers.map((c) => [c.id, { name: c.name, tver: campaigns.filter((t) => t.advertiser.name === c.name && t.advertiser.branchId === c.branchId) }]));
  const phase = (r: (typeof rows)[number]) => {
    const tv = r.customerId ? byCustomer.get(r.customerId)?.tver ?? [] : [];
    if (!tv.length) return null;
    if (tv.some((t) => r.periodStart <= t.endDate && r.periodEnd >= t.startDate)) return "配信中";
    return tv.some((t) => r.periodEnd < t.startDate) && !tv.some((t) => r.periodStart > t.endDate) ? "配信前" : "配信後";
  };

  return {
    rows: rows.map((r) => ({
      site: r.customerId ? `広告主: ${byCustomer.get(r.customerId)?.name ?? "（不明）"}` : "自社サイト",
      customerId: r.customerId,
      period: `${ymd(r.periodStart)}〜${ymd(r.periodEnd)}`,
      tverPhase: phase(r),
      sessions: r.sessions, users: r.users, pageViews: r.pageViews, inquiries: r.inquiries, phoneTaps: r.phoneTaps,
      source: r.source, note: r.note, by: r.createdByName, ...(isHq(v) ? { company: r.groupCompanyId ? companies.get(r.groupCompanyId) ?? null : "本部" } : {}),
    })),
    tverDeliveries: [...byCustomer.values()].filter((c) => c.tver.length).map((c) => ({ customer: c.name, deliveries: c.tver.map((t) => `${ymd(t.startDate)}〜${ymd(t.endDate)}`) })),
    note: "数字は各社が入れたもの（出どころは source）。TVerの配信期間は広告主名が顧客名と一致するものだけ並べています。効果を言い切らず「配信前と比べて」の目安として使う",
  };
}
