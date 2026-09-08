// ==============================================================
// MCP: OS読み取りツール（scope = os:read）
//   各代表のAIが「自分の拠点の分だけ」読める。書き込みは一切しない。
//   拠点の絞り込みは session.ts の getBranchFilter（第2拠点・旧拠点IDも含む）に統一。
//   売上の数字（商談金額・見積の金額・月次報告の額）と本部向けの内部項目（原価・値引き・本部メモ・口座 等）は
//   ADMIN（本部）以外に出さない（2026-09-08 代表決定「売り上げは皆に見えないように」）。
// ==============================================================

import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { getBranchFilter } from "@/lib/session";
import { stripSensitiveLines } from "@/lib/brand-kit/common";
import { ARCHIVE_BRANCH_ID } from "@/lib/data/customers";
import { formatPackagePrice, parseDeliverables, parseOptions } from "@/lib/packages/types";
import { estimateArea, municipalitiesOf, prefectureOptions, resolveArea } from "@/lib/packages/tver-area";
import { searchWikiArticles } from "@/lib/wiki-search";
import type { UserRole } from "@/types/roles";

export interface McpViewer {
  id: string;
  email: string;
  name: string | null;
  role: UserRole;
  branchId: string | null;
  branchId2: string | null;
  groupCompanyId: string | null;
}

export async function loadViewer(email: string): Promise<McpViewer | null> {
  const u = await db.user.findUnique({
    where: { email },
    select: { id: true, email: true, name: true, role: true, branchId: true, branchId2: true, groupCompanyId: true, isActive: true },
  });
  if (!u || !u.isActive) return null;
  return { id: u.id, email: u.email, name: u.name, role: u.role as UserRole, branchId: u.branchId, branchId2: u.branchId2, groupCompanyId: u.groupCompanyId };
}

const day = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : null);
const yen = (n: number | Prisma.Decimal | null | undefined) => (n == null ? null : `¥${Number(n).toLocaleString("ja-JP")}`);
const clampLimit = (n: number | undefined, def = 20, max = 50) => Math.min(max, Math.max(1, Math.floor(n ?? def)));
const HQ_ONLY = "（本部のみ）";
const isHq = (v: McpViewer) => v.role === "ADMIN";

// ---- 顧客 -------------------------------------------------------------------

export async function searchCustomers(v: McpViewer, input: { query?: string; status?: string; limit?: number }) {
  const where: Prisma.CustomerWhereInput = { ...getBranchFilter(v), NOT: { branchId: ARCHIVE_BRANCH_ID } };
  if (input.query) {
    where.OR = [
      { name: { contains: input.query, mode: "insensitive" } },
      { nameKana: { contains: input.query, mode: "insensitive" } },
      { contactName: { contains: input.query, mode: "insensitive" } },
      { industry: { contains: input.query, mode: "insensitive" } },
    ];
  }
  if (input.status) where.status = input.status as Prisma.CustomerWhereInput["status"];
  const rows = await db.customer.findMany({
    where,
    select: {
      id: true, name: true, nameKana: true, industry: true, status: true, rank: true, contactName: true, email: true, phone: true,
      website: true, prefecture: true, address: true, notes: true, staffName: true, updatedAt: true,
      _count: { select: { deals: true } },
    },
    orderBy: { updatedAt: "desc" },
    take: clampLimit(input.limit),
  });
  return rows.map((c) => ({
    id: c.id, name: c.name, nameKana: c.nameKana, industry: c.industry, status: c.status, rank: c.rank,
    contactName: c.contactName, email: c.email, phone: c.phone, website: c.website, prefecture: c.prefecture, address: c.address,
    notes: stripSensitiveLines(c.notes) || null, staffName: c.staffName, dealCount: c._count.deals, updatedAt: day(c.updatedAt),
  }));
}

// ---- 商談 -------------------------------------------------------------------

export async function listDeals(v: McpViewer, input: { query?: string; status?: string; customerId?: string; limit?: number }) {
  const where: Prisma.DealWhereInput = { ...getBranchFilter(v) };
  if (input.query) {
    where.OR = [
      { title: { contains: input.query, mode: "insensitive" } },
      { customer: { name: { contains: input.query, mode: "insensitive" } } },
    ];
  }
  if (input.status) where.status = input.status as Prisma.DealWhereInput["status"];
  if (input.customerId) where.customerId = input.customerId;
  const rows = await db.deal.findMany({
    where,
    include: { customer: { select: { id: true, name: true } }, assignedTo: { select: { name: true } } },
    orderBy: { updatedAt: "desc" },
    take: clampLimit(input.limit),
  });
  const showAmount = isHq(v);
  return rows.map((d) => ({
    id: d.id, title: d.title, customer: d.customer.name, customerId: d.customer.id, status: d.status,
    amount: showAmount ? yen(d.amount) : HQ_ONLY, probability: d.probability, expectedCloseDate: day(d.expectedCloseDate), closedAt: day(d.closedAt),
    assignedTo: d.assignedTo?.name ?? null, isRegular: d.isRegular, regularMonthlyAmount: showAmount ? yen(d.regularMonthlyAmount) : null,
    updatedAt: day(d.updatedAt),
  }));
}

export async function getDeal(v: McpViewer, id: string) {
  const d = await db.deal.findFirst({
    where: { id, ...getBranchFilter(v) },
    include: {
      customer: { select: { id: true, name: true, contactName: true, phone: true, email: true } },
      assignedTo: { select: { name: true } },
      dealLogs: { orderBy: { createdAt: "desc" }, take: 20, select: { type: true, content: true, staffName: true, createdAt: true } },
    },
  });
  if (!d) return null;
  const showAmount = isHq(v);
  return {
    id: d.id, title: d.title, status: d.status, customer: d.customer, assignedTo: d.assignedTo?.name ?? null,
    amount: showAmount ? yen(d.amount) : HQ_ONLY, probability: d.probability, expectedCloseDate: day(d.expectedCloseDate), closedAt: day(d.closedAt),
    closingFactor: d.closingFactor, notes: stripSensitiveLines(d.notes) || null, isRegular: d.isRegular,
    logs: d.dealLogs.map((l) => ({ type: l.type, content: stripSensitiveLines(l.content), staffName: l.staffName, at: day(l.createdAt) })),
  };
}

// ---- 見積 -------------------------------------------------------------------

export async function listEstimates(v: McpViewer, input: { query?: string; status?: string; limit?: number }) {
  const where: Prisma.EstimationWhereInput = { ...getBranchFilter(v) };
  if (input.query) {
    where.OR = [
      { title: { contains: input.query, mode: "insensitive" } },
      { customer: { name: { contains: input.query, mode: "insensitive" } } },
    ];
  }
  if (input.status) where.status = input.status as Prisma.EstimationWhereInput["status"];
  const rows = await db.estimation.findMany({
    where,
    include: { customer: { select: { name: true } }, items: { select: { amount: true } } },
    orderBy: { updatedAt: "desc" },
    take: clampLimit(input.limit),
  });
  return rows.map((e) => {
    const subtotal = e.items.reduce((s, i) => s + Number(i.amount ?? 0), 0);
    return { id: e.id, title: e.title, customer: e.customer?.name ?? null, status: e.status, estimateDate: day(e.estimateDate), validUntil: day(e.validUntil), subtotalExclTax: isHq(v) ? yen(subtotal) : HQ_ONLY, staffName: e.staffName };
  });
}

export async function getEstimate(v: McpViewer, id: string) {
  const e = await db.estimation.findFirst({
    where: { id, ...getBranchFilter(v) },
    include: { customer: { select: { name: true } }, items: { orderBy: { sortOrder: "asc" } } },
  });
  if (!e) return null;
  const subtotal = e.items.reduce((s, i) => s + Number(i.amount ?? 0), 0);
  const discount = Number(e.discountAmount ?? 0);
  const discounted = Math.max(0, subtotal - discount);
  const tax = Math.round(discounted * 0.1);
  const hq = isHq(v);
  const head = { id: e.id, title: e.title, customer: e.customer?.name ?? null, status: e.status, estimateDate: day(e.estimateDate), validUntil: day(e.validUntil), staffName: e.staffName, notes: stripSensitiveLines(e.notes) || null };
  if (!hq) {
    // 本部以外: 品目と数量だけ。金額は出さない
    return { ...head, items: e.items.map((i) => ({ name: i.name, spec: i.spec, quantity: Number(i.quantity), unit: i.unit })), amounts: HQ_ONLY };
  }
  return {
    ...head,
    items: e.items.map((i) => ({ name: i.name, spec: i.spec, quantity: Number(i.quantity), unit: i.unit, unitPrice: yen(i.unitPrice), amount: yen(i.amount), costPrice: yen(i.costPrice) })),
    subtotalExclTax: yen(subtotal),
    discountAmount: yen(discount),
    discountReason: e.discountReason,
    taxAmount: yen(tax),
    totalInclTax: yen(discounted + tax),
  };
}

// ---- パッケージ台帳（グループ共通） -------------------------------------------

export async function listPackagesLite() {
  const rows = await db.salesPackage.findMany({
    where: { status: "ACTIVE" },
    orderBy: [{ category: "asc" }, { name: "asc" }],
    select: { slug: true, name: true, tagline: true, category: true, priceType: true, initialPrice: true, monthlyPrice: true, targetIndustries: true, leadTime: true },
  });
  return rows.map((p) => ({ slug: p.slug, name: p.name, tagline: p.tagline, category: p.category, price: formatPackagePrice(p), targetIndustries: p.targetIndustries, leadTime: p.leadTime }));
}

export async function getPackage(v: McpViewer, slug: string) {
  const p = await db.salesPackage.findUnique({ where: { slug } });
  if (!p || (p.status !== "ACTIVE" && v.role !== "ADMIN")) return null;
  const s = (t: string | null) => stripSensitiveLines(t) || null;
  return {
    slug: p.slug, name: p.name, tagline: p.tagline, category: p.category, status: p.status, price: formatPackagePrice(p), priceNote: s(p.priceNote),
    targetIndustries: p.targetIndustries, painPoints: s(p.painPoints), summary: s(p.summary),
    deliverables: parseDeliverables(p.deliverables), options: parseOptions(p.options), leadTime: p.leadTime,
    pitchText: s(p.pitchText), talkTrack: s(p.talkTrack), rules: s(p.rules), caseStudies: s(p.caseStudies),
    calculator: p.calculator,
  };
}

// ---- TVer エリア別プラン ---------------------------------------------------

export function tverAreaPlan(input: { prefecture?: string; city?: string }) {
  const prefs = prefectureOptions();
  if (input.prefecture && !prefs.includes(input.prefecture)) {
    return { error: `都道府県名が一致しません。例: ${prefs.slice(0, 5).join("、")} …（「県」「府」まで含めて）` };
  }
  const munis = input.prefecture ? municipalitiesOf(input.prefecture) : [];
  let code: string | null = null;
  if (input.city) {
    const hit = munis.find((m) => m.name === input.city || m.name.startsWith(input.city!) || m.code === input.city);
    if (!hit) return { error: `市区町村が見つかりません。${input.prefecture}の候補: ${munis.slice(0, 30).map((m) => m.name).join("、")}` };
    code = hit.code;
  }
  const area = resolveArea({ pref: input.prefecture, city: code });
  const est = area.city ? estimateArea(area.pref, area.city) : null;
  if (!est) return { error: "プランを計算できませんでした" };
  const plan = est.plan;
  return {
    prefecture: plan.prefName,
    area: plan.areaLabel,
    population: plan.population,
    tverViewers: Math.round(plan.viewers),
    unitPricePerReach: yen(plan.unit),
    standard: { months: 3, reach: Math.round(plan.reach), total3mExclTax: yen(plan.total), monthlyExclTax: yen(plan.monthly) },
    tiers: est.tiers.map((t) => ({ monthlyExclTax: yen(t.monthly), impressions: Math.round(t.impressions), reach: Math.round(t.reach), pctResidents: Math.round(t.pctResidents * 10) / 10, pctViewers: Math.round(t.pctViewers * 10) / 10, isFull: t.isFull })),
    note: "金額は税抜・推計。お客様に出す前にOSのTVerシミュレーターで組み直してください（正本はOS）",
  };
}

// ---- Wiki ---------------------------------------------------------------------

export async function searchWiki(v: McpViewer, input: { query: string; limit?: number }) {
  const rows = await searchWikiArticles(input.query, clampLimit(input.limit, 5, 10), { isAdmin: v.role === "ADMIN" });
  return rows.map((a) => ({ id: a.id, title: a.title, body: a.body.slice(0, 4000) }));
}

// ---- 自分の数字 -----------------------------------------------------------------

export async function mySummary(v: McpViewer, input: { months?: number }) {
  const months = clampLimit(input.months, 3, 12);
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth() - (months - 1), 1);
  const branch = getBranchFilter(v);
  const reportWhere: Prisma.RevenueReportWhereInput = { targetMonth: { gte: from } };
  const hq = isHq(v);
  const [dealCounts, reports, company] = await Promise.all([
    db.deal.groupBy({ by: ["status"], where: branch, _count: true }),
    hq ? db.revenueReport.findMany({ where: reportWhere, orderBy: { targetMonth: "desc" }, select: { targetMonth: true, amount: true, selfAmount: true, hqAmount: true, projectName: true, memo: true } }) : Promise.resolve([]),
    v.groupCompanyId ? db.groupCompany.findUnique({ where: { id: v.groupCompanyId }, select: { name: true, prefecture: true, ownerName: true } }) : Promise.resolve(null),
  ]);
  const byMonth = new Map<string, { total: number; self: number; hq: number; projects: string[] }>();
  for (const r of reports) {
    const k = r.targetMonth.toISOString().slice(0, 7);
    const m = byMonth.get(k) ?? { total: 0, self: 0, hq: 0, projects: [] };
    m.total += Number(r.amount ?? 0);
    m.self += Number(r.selfAmount ?? 0);
    m.hq += Number(r.hqAmount ?? 0);
    if (r.projectName) m.projects.push(r.projectName);
    byMonth.set(k, m);
  }
  return {
    company,
    deals: dealCounts.map((d) => ({ status: d.status, count: d._count })),
    monthlyReports: hq ? [...byMonth.entries()].map(([month, m]) => ({ month, totalExclTax: yen(m.total), selfExclTax: yen(m.self), hqExclTax: yen(m.hq), projects: m.projects })) : HQ_ONLY,
    note: hq ? "月次報告は提出分の集計。商談件数は拠点の分" : "商談件数は貴社拠点の分。売上の数字は本部のみ",
  };
}

// ---- 拠点一覧 -------------------------------------------------------------------

export async function listGroupCompanies() {
  // 公開プロフィール相当の項目だけ（本部メモ・口座・ロイヤリティ条件は出さない）
  const rows = await db.groupCompany.findMany({
    where: { isActive: true },
    select: { id: true, name: true, ownerName: true, prefecture: true, genre: true, specialty: true, websiteUrl: true },
    orderBy: { name: "asc" },
  });
  return rows.map((c) => ({ id: c.id, name: c.name, ownerName: c.ownerName, prefecture: c.prefecture, genre: c.genre, specialty: c.specialty, websiteUrl: c.websiteUrl }));
}
