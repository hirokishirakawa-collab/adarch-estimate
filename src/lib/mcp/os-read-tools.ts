// ==============================================================
// MCP: OS読み取りツール（scope = os:read）
//   顧客・商談・見積はグループ全社分を読める（2026-09-08 代表決定「他拠点の売上だけ見えなければ、あとは全部連携」）。
//   隠すのは「他拠点の売上・金額」だけ＝商談金額・見積の金額は 本部(ADMIN) か その記録の拠点の人 にだけ出す。
//   月次報告の額は本部のみ。本部向けの内部項目（原価・値引き・本部メモ・口座 等）も本部以外に出さない。
//   自拠点の判定は session.ts の getBranchFilter（第2拠点・旧拠点IDも含む）に統一。書き込みは os-write-tools.ts。
// ==============================================================

import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { getBranchFilter } from "@/lib/session";
import { stripSensitiveLines } from "@/lib/brand-kit/common";
import { ARCHIVE_BRANCH_ID } from "@/lib/data/customers";
import { formatPackagePrice, parseDeliverables, parseOptions } from "@/lib/packages/types";
import { estimateArea, municipalitiesOf, prefectureOptions, resolveArea } from "@/lib/packages/tver-area";
import { searchKnowledge } from "@/lib/knowledge/search";
import { KNOWLEDGE_USE_RULES, ORIGIN_SHORT } from "@/lib/knowledge/rules";
import { searchWikiArticles } from "@/lib/wiki-search";
import { nextAnniversary } from "@/lib/anniversary/calc";
import { PHONE_CANDIDATE, OUTREACH_PREPARED } from "@/lib/constants/leads";
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

// 日付は日本時間で出す（toISOString だとUTCになり、JSTの0時は前日に見えてしまう）
const day = (d: Date | null | undefined) =>
  d ? new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit" }).format(d) : null;
const yen = (n: number | Prisma.Decimal | null | undefined) => (n == null ? null : `¥${Number(n).toLocaleString("ja-JP")}`);
const clampLimit = (n: number | undefined, def = 20, max = 50) => Math.min(max, Math.max(1, Math.floor(n ?? def)));
const HQ_ONLY = "（本部のみ）";
const OTHER_BRANCH = "（他拠点のため非表示）";
const isHq = (v: McpViewer) => v.role === "ADMIN";

/** 自拠点の拠点ID（第2拠点・旧拠点IDを含む）。本部は空＝全部自分の範囲 */
export function ownBranchIds(v: McpViewer): string[] {
  const f = getBranchFilter(v) as { branchId?: string | { in: string[] } };
  if (!f.branchId) return [];
  return typeof f.branchId === "string" ? [f.branchId] : f.branchId.in;
}
/** 金額を見せてよいか＝本部 か その記録が自拠点 */
export const canSeeAmount = (v: McpViewer, branchId: string) => isHq(v) || ownBranchIds(v).includes(branchId);
const amountOrMask = (v: McpViewer, branchId: string, n: number | Prisma.Decimal | null | undefined) => (canSeeAmount(v, branchId) ? yen(n) : OTHER_BRANCH);
const branchSel = { select: { id: true, name: true } } as const;

// ---- 顧客 -------------------------------------------------------------------

export async function searchCustomers(v: McpViewer, input: { query?: string; status?: string; limit?: number }) {
  // 全社分（拠点の壁なし）。書庫拠点だけ除く
  const where: Prisma.CustomerWhereInput = { NOT: { branchId: ARCHIVE_BRANCH_ID } };
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
      website: true, prefecture: true, address: true, notes: true, staffName: true, updatedAt: true, branchId: true, branch: branchSel,
      _count: { select: { deals: true } },
    },
    orderBy: { updatedAt: "desc" },
    take: clampLimit(input.limit),
  });
  return rows.map((c) => ({
    id: c.id, name: c.name, nameKana: c.nameKana, industry: c.industry, status: c.status, rank: c.rank,
    contactName: c.contactName, email: c.email, phone: c.phone, website: c.website, prefecture: c.prefecture, address: c.address,
    notes: stripSensitiveLines(c.notes) || null, staffName: c.staffName, dealCount: c._count.deals, updatedAt: day(c.updatedAt),
    branch: c.branch.name, isMine: canSeeAmount(v, c.branchId),
  }));
}

// ---- 商談 -------------------------------------------------------------------

export async function listDeals(v: McpViewer, input: { query?: string; status?: string; customerId?: string; limit?: number }) {
  const where: Prisma.DealWhereInput = {}; // 全社分。金額だけ拠点で出し分け
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
    include: { customer: { select: { id: true, name: true } }, assignedTo: { select: { name: true } }, branch: branchSel },
    orderBy: { updatedAt: "desc" },
    take: clampLimit(input.limit),
  });
  return rows.map((d) => ({
    id: d.id, title: d.title, customer: d.customer.name, customerId: d.customer.id, status: d.status,
    amount: amountOrMask(v, d.branchId, d.amount), probability: d.probability, expectedCloseDate: day(d.expectedCloseDate), closedAt: day(d.closedAt),
    assignedTo: d.assignedTo?.name ?? null, isRegular: d.isRegular, regularMonthlyAmount: canSeeAmount(v, d.branchId) ? yen(d.regularMonthlyAmount) : null,
    branch: d.branch.name, isMine: canSeeAmount(v, d.branchId), updatedAt: day(d.updatedAt),
  }));
}

export async function getDeal(v: McpViewer, id: string) {
  const d = await db.deal.findFirst({
    where: { id },
    include: {
      customer: { select: { id: true, name: true, contactName: true, phone: true, email: true } },
      assignedTo: { select: { name: true } },
      branch: branchSel,
      dealLogs: { orderBy: { createdAt: "desc" }, take: 20, select: { type: true, content: true, staffName: true, createdAt: true } },
    },
  });
  if (!d) return null;
  return {
    id: d.id, title: d.title, status: d.status, customer: d.customer, assignedTo: d.assignedTo?.name ?? null, branch: d.branch.name, isMine: canSeeAmount(v, d.branchId),
    amount: amountOrMask(v, d.branchId, d.amount), probability: d.probability, expectedCloseDate: day(d.expectedCloseDate), closedAt: day(d.closedAt),
    closingFactor: d.closingFactor, notes: stripSensitiveLines(d.notes) || null, isRegular: d.isRegular,
    logs: d.dealLogs.map((l) => ({ type: l.type, content: stripSensitiveLines(l.content), staffName: l.staffName, at: day(l.createdAt) })),
  };
}

// ---- 見積 -------------------------------------------------------------------

export async function listEstimates(v: McpViewer, input: { query?: string; status?: string; limit?: number }) {
  const where: Prisma.EstimationWhereInput = {}; // 全社分。金額だけ拠点で出し分け
  if (input.query) {
    where.OR = [
      { title: { contains: input.query, mode: "insensitive" } },
      { customer: { name: { contains: input.query, mode: "insensitive" } } },
    ];
  }
  if (input.status) where.status = input.status as Prisma.EstimationWhereInput["status"];
  const rows = await db.estimation.findMany({
    where,
    include: { customer: { select: { name: true } }, items: { select: { amount: true } }, branch: branchSel },
    orderBy: { updatedAt: "desc" },
    take: clampLimit(input.limit),
  });
  return rows.map((e) => {
    const subtotal = e.items.reduce((s, i) => s + Number(i.amount ?? 0), 0);
    return { id: e.id, title: e.title, customer: e.customer?.name ?? null, status: e.status, estimateDate: day(e.estimateDate), validUntil: day(e.validUntil), subtotalExclTax: amountOrMask(v, e.branchId, subtotal), staffName: e.staffName, branch: e.branch.name, isMine: canSeeAmount(v, e.branchId) };
  });
}

export async function getEstimate(v: McpViewer, id: string) {
  const e = await db.estimation.findFirst({
    where: { id },
    include: { customer: { select: { name: true } }, items: { orderBy: { sortOrder: "asc" } }, branch: branchSel },
  });
  if (!e) return null;
  const subtotal = e.items.reduce((s, i) => s + Number(i.amount ?? 0), 0);
  const discount = Number(e.discountAmount ?? 0);
  const discounted = Math.max(0, subtotal - discount);
  const tax = Math.round(discounted * 0.1);
  const hq = isHq(v);
  const mine = canSeeAmount(v, e.branchId);
  const head = { id: e.id, title: e.title, customer: e.customer?.name ?? null, status: e.status, estimateDate: day(e.estimateDate), validUntil: day(e.validUntil), staffName: e.staffName, notes: stripSensitiveLines(e.notes) || null, branch: e.branch.name, isMine: mine };
  if (!mine) {
    // 他拠点の見積: 品目と数量だけ。金額は出さない
    return { ...head, items: e.items.map((i) => ({ name: i.name, spec: i.spec, quantity: Number(i.quantity), unit: i.unit })), amounts: OTHER_BRANCH };
  }
  return {
    ...head,
    // 原価は本部だけ（自拠点でも原価は本部向け項目）
    items: e.items.map((i) => ({ name: i.name, spec: i.spec, quantity: Number(i.quantity), unit: i.unit, unitPrice: yen(i.unitPrice), amount: yen(i.amount), ...(hq ? { costPrice: yen(i.costPrice) } : {}) })),
    subtotalExclTax: yen(subtotal),
    // 値引きの内訳は本部向け項目。自拠点には税・合計だけ
    ...(hq ? { discountAmount: yen(discount), discountReason: e.discountReason } : {}),
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

export function tverAreaPlan(input: { prefecture?: string; city?: string; allCities?: boolean }) {
  const prefs = prefectureOptions();
  if (input.prefecture && !prefs.includes(input.prefecture)) {
    return { error: `都道府県名が一致しません。例: ${prefs.slice(0, 5).join("、")} …（「県」「府」まで含めて）` };
  }
  const munis = input.prefecture ? municipalitiesOf(input.prefecture) : [];

  // 県内の全市区町村をまとめて返す（どの市から当たるかを決めるとき。1件ずつ呼ばない）
  if (input.allCities) {
    if (!input.prefecture) return { error: "allCities には prefecture が要ります（例: 香川県）" };
    const rows = munis
      .map((m) => {
        const est = estimateArea(input.prefecture!, m.code);
        if (!est) return null;
        const p = est.plan;
        // 単独で出すと月額が1万円を切って「¥0」に丸まる商圏がある（例: 直島町）。
        // 金額を出さず「近隣とまとめる」先として返す
        const tooSmall = Math.round(p.monthly) < 10_000;
        return {
          city: m.name,
          population: p.population,
          tverViewers: Math.round(p.viewers),
          standardMonthlyExclTax: tooSmall ? null : yen(p.monthly),
          standardReach: Math.round(p.reach),
          ...(tooSmall ? { note: "単独では小さすぎる商圏。近隣の市町とまとめて提案する" } : {}),
        };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null)
      .sort((a, b) => b.population - a.population);
    return {
      prefecture: input.prefecture,
      cities: rows.length,
      order: "人口の多い順。standard は『3人に1人に届ける』標準プランの月額（税抜・推計）。金額が null の市町は単独では小さすぎる＝近隣とまとめて出す",
      areas: rows,
      note: "金額は税抜・推計。お客様に出す前にOSのTVerシミュレーターで組み直してください（正本はOS）",
    };
  }
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

// ---- 資料ライブラリ（OSの頭脳・NotebookLM相当） ---------------------------------------
//   自社=そのまま応用可／他社・媒体=仕組みは参考・価格は卸値・実績は他社分。hqOnly は本部だけ

const KNOWLEDGE_PART_CHARS = 12_000;

export async function searchKnowledgeTool(v: McpViewer, input: { query: string; origin?: string; limit?: number }) {
  const origin = input.origin === "OWN" ? "OWN" : input.origin === "EXTERNAL" ? "EXTERNAL" : undefined;
  const hits = await searchKnowledge(input.query, clampLimit(input.limit, 5, 10), { isAdmin: isHq(v), origin });
  return {
    rules: KNOWLEDGE_USE_RULES,
    results: hits.map((h) => ({
      id: h.id,
      origin: h.origin,
      originLabel: ORIGIN_SHORT[h.origin],
      title: h.title,
      publisher: h.publisher,
      publishedAt: h.publishedAt,
      pageCount: h.pageCount,
      summary: h.summary,
      digest: h.digest,
      excerpt: h.excerpt,
      url: `/dashboard/knowledge/${h.id}`,
      next: "全文は get_knowledge(id, part)",
    })),
    note: hits.length === 0 ? "当たる資料がありません。媒体名・商品名・エリア名など別の語で。目次は list_knowledge" : undefined,
  };
}

export async function listKnowledge(v: McpViewer, input: { origin?: string; limit?: number }) {
  const origin = input.origin === "OWN" ? "OWN" : input.origin === "EXTERNAL" ? "EXTERNAL" : undefined;
  const rows = await db.knowledgeSource.findMany({
    where: { status: "READY", ...(isHq(v) ? {} : { hqOnly: false }), ...(origin ? { origin } : {}) },
    orderBy: { createdAt: "desc" },
    take: clampLimit(input.limit, 50, 100),
    select: { id: true, title: true, origin: true, publisher: true, publishedAt: true, pageCount: true, summary: true, createdAt: true },
  });
  return {
    rules: KNOWLEDGE_USE_RULES,
    items: rows.map((r) => ({ id: r.id, origin: r.origin, originLabel: ORIGIN_SHORT[r.origin], title: r.title, publisher: r.publisher, publishedAt: r.publishedAt, pageCount: r.pageCount, summary: r.summary, createdAt: day(r.createdAt) })),
  };
}

export async function getKnowledge(v: McpViewer, id: string, part?: number) {
  const r = await db.knowledgeSource.findUnique({
    where: { id },
    select: { id: true, title: true, origin: true, publisher: true, publishedAt: true, pageCount: true, summary: true, digest: true, note: true, content: true, hqOnly: true, status: true },
  });
  if (!r || r.status !== "READY" || (r.hqOnly && !isHq(v))) return null;
  const parts = Math.max(1, Math.ceil(r.content.length / KNOWLEDGE_PART_CHARS));
  const p = Math.min(parts, Math.max(1, Math.floor(part ?? 1)));
  const text = r.content.slice((p - 1) * KNOWLEDGE_PART_CHARS, p * KNOWLEDGE_PART_CHARS);
  return {
    id: r.id,
    origin: r.origin,
    originLabel: ORIGIN_SHORT[r.origin],
    title: r.title,
    publisher: r.publisher,
    publishedAt: r.publishedAt,
    pageCount: r.pageCount,
    summary: r.summary,
    digest: r.digest,
    note: r.note,
    part: p,
    parts,
    content: text,
    rules: KNOWLEDGE_USE_RULES,
    next: p < parts ? `続きは get_knowledge(id, part=${p + 1})` : undefined,
  };
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
    note: hq ? "月次報告は提出分の集計。商談件数は拠点の分" : "商談件数は貴社拠点の分。月次報告の売上額は本部のみ",
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

// ---- リード（全社分。OS画面のリード管理と同じ除外条件） ------------------------------

export async function listLeads(v: McpViewer, input: { query?: string; status?: string; mine?: boolean; waitingReply?: boolean; phoneCandidates?: boolean; limit?: number }) {
  const where: Prisma.LeadWhereInput = {
    status: { notIn: ["SKIPPED", "ARCHIVED"] },
    NOT: { source: "PR_TIMES_TVCM", assigneeId: null }, // 未claimのTVerプール案件はプール画面だけ
  };
  if (input.query) {
    where.OR = [
      { name: { contains: input.query, mode: "insensitive" } },
      { address: { contains: input.query, mode: "insensitive" } },
      { memo: { contains: input.query, mode: "insensitive" } },
    ];
  }
  if (input.status) where.status = input.status as Prisma.LeadWhereInput["status"];
  if (input.mine) {
    const mineOr: Prisma.LeadWhereInput[] = [{ assigneeId: v.id }, { createdById: v.id }];
    if (where.OR) {
      where.AND = [{ OR: where.OR }, { OR: mineOr }];
      delete where.OR;
    } else {
      where.OR = mineOr;
    }
  }
  if (input.waitingReply) Object.assign(where, { sentAt: { not: null }, outreachResult: null });
  // 電話候補＝メール・フォームが使えず電話に回した先（record_lead_result の phoneCandidate）
  if (input.phoneCandidates) Object.assign(where, { outreachResult: null, logs: { some: { action: PHONE_CANDIDATE } } });
  const rows = await db.lead.findMany({
    where,
    orderBy: [{ updatedAt: "desc" }],
    take: clampLimit(input.limit),
    select: {
      id: true, name: true, address: true, phone: true, email: true, websiteUrl: true, industry: true, area: true, prefecture: true, status: true, source: true,
      memo: true, sentAt: true, outreachResult: true, outreachResultAt: true, signalKind: true, signalAt: true, updatedAt: true,
      assignee: { select: { id: true, name: true } }, convertedCustomerId: true,
    },
  });
  return rows.map((l) => ({
    id: l.id, name: l.name, address: l.address, phone: l.phone, email: l.email, website: l.websiteUrl, industry: l.industry, area: l.area ?? l.prefecture,
    status: l.status, source: l.source, memo: stripSensitiveLines(l.memo) || null, sentAt: day(l.sentAt), outreachResult: l.outreachResult, outreachResultAt: day(l.outreachResultAt),
    signal: l.signalKind ? { kind: l.signalKind, at: day(l.signalAt) } : null, assignee: l.assignee?.name ?? null, isMine: l.assignee?.id === v.id,
    convertedCustomerId: l.convertedCustomerId, updatedAt: day(l.updatedAt),
  }));
}

// ---- 今日の一手 -----------------------------------------------------------------
//   「今日何する」に答える材料。呼んだ本人の拠点（本部は本部拠点）に絞る。金額は返さない。
//   4〜6 はダッシュボード「今週の当たり先」(components/dashboard/sales-boost.tsx) と同じ判定＝画面と数が一致する。

const DAY_MS = 24 * 60 * 60 * 1000;
const OPEN_DEAL: Prisma.DealWhereInput = { status: { in: ["PROSPECTING", "QUALIFYING", "PROPOSAL", "NEGOTIATION"] } };
/** 都道府県の末尾（都府県）を落とす。北海道はそのまま。sales-boost.tsx と同じ */
const prefBase = (s: string) => (s.startsWith("北海道") ? "北海道" : s.trim().replace(/[都府県]$/, ""));
const daysSince = (d: Date, now: Date) => Math.floor((now.getTime() - d.getTime()) / DAY_MS);

export async function myNextActions(v: McpViewer, input: { limit?: number }) {
  const take = clampLimit(input.limit, 5, 10);
  const now = new Date();
  const branch = getBranchFilter(v);
  const company = v.groupCompanyId ? await db.groupCompany.findUnique({ where: { id: v.groupCompanyId }, select: { name: true, prefecture: true } }) : null;
  const pref = !isHq(v) && company?.prefecture ? company.prefecture : null;
  const base = pref ? prefBase(pref) : null;
  const prefFilter: Prisma.LeadWhereInput = base ? { prefecture: { contains: base } } : {};
  const leadAlive: Prisma.LeadWhereInput = { status: { notIn: ["SKIPPED", "ARCHIVED", "DEAL_CONVERTED"] } };
  // リードは「自分の担当」か「担当なし（自県）」。本部は自分の担当だけ
  const leadMine: Prisma.LeadWhereInput = isHq(v) ? { assigneeId: v.id } : { OR: [{ assigneeId: v.id }, { assigneeId: null, ...prefFilter }] };

  const [waiting, overdue, openDeals, foundedLeads, subsidies, signals, phoneCandidates, prepared] = await Promise.all([
    // 1. 返事待ちが7日超（送付済み・結果未入力）
    db.lead.findMany({
      where: { ...leadAlive, ...leadMine, sentAt: { not: null, lt: new Date(now.getTime() - 7 * DAY_MS) }, outreachResult: null },
      orderBy: { sentAt: "asc" },
      take,
      select: { id: true, name: true, industry: true, sentAt: true },
    }),
    // 2. 見込み日を過ぎた商談
    db.deal.findMany({
      where: { ...branch, ...OPEN_DEAL, expectedCloseDate: { lt: new Date(now.getFullYear(), now.getMonth(), now.getDate()) } },
      orderBy: { expectedCloseDate: "asc" },
      take,
      select: { id: true, title: true, status: true, expectedCloseDate: true, customer: { select: { name: true } } },
    }),
    // 3. 30日動いていない商談（提案中/交渉中/検討中）＝最終ログか更新日で判定
    db.deal.findMany({
      where: { ...branch, status: { in: ["QUALIFYING", "PROPOSAL", "NEGOTIATION"] }, updatedAt: { lt: new Date(now.getTime() - 30 * DAY_MS) } },
      orderBy: { updatedAt: "asc" },
      take: take * 2,
      select: { id: true, title: true, status: true, updatedAt: true, customer: { select: { name: true } }, dealLogs: { orderBy: { createdAt: "desc" }, take: 1, select: { createdAt: true } } },
    }),
    // 4. 3か月以内に周年（自県のリード・創業年あり）
    base
      ? db.lead.findMany({
          where: { ...leadAlive, ...prefFilter, foundedYear: { not: null } },
          select: { id: true, name: true, industry: true, foundedYear: true, foundedMonth: true, assignee: { select: { name: true } } },
        })
      : Promise.resolve([]),
    // 5. 使える補助金（有効・広告費OK・自県か全国）
    db.subsidy.findMany({
      where: { isActive: true, adCostFit: { in: ["CONFIRMED", "LIKELY"] }, ...(pref ? { targetAreas: { hasSome: [pref, "全国"] } } : {}), OR: [{ acceptanceEnd: null }, { acceptanceEnd: { gte: now } }] },
      orderBy: [{ acceptanceEnd: "asc" }],
      take,
      select: { id: true, title: true, institutionName: true, industry: true, acceptanceEnd: true, fitReason: true, detailUrl: true },
    }),
    // 6. 今週シグナルが立った会社（自県）
    base
      ? db.lead.findMany({
          where: { ...leadAlive, ...prefFilter, signalAt: { gte: new Date(now.getTime() - 7 * DAY_MS) } },
          orderBy: { signalAt: "desc" },
          take,
          select: { id: true, name: true, industry: true, signalAt: true, signalKind: true, assignee: { select: { name: true } } },
        })
      : Promise.resolve([]),
    // 7. 電話候補（メール・フォームが使えず、まだ結果が入っていない先）
    db.lead.findMany({
      where: { ...leadAlive, ...leadMine, outreachResult: null, logs: { some: { action: PHONE_CANDIDATE } } },
      orderBy: { updatedAt: "desc" },
      take,
      select: { id: true, name: true, industry: true, phone: true, area: true, prefecture: true, logs: { where: { action: PHONE_CANDIDATE }, orderBy: { createdAt: "desc" }, take: 1, select: { detail: true, createdAt: true } } },
    }),
    // 8. 下書きを作ったまま「送った」が確定していない先（送付日も台帳も動いていない）
    db.lead.findMany({
      where: { ...leadAlive, ...leadMine, logs: { some: { action: OUTREACH_PREPARED } } },
      orderBy: { updatedAt: "desc" },
      take,
      select: { id: true, name: true, industry: true, email: true, websiteUrl: true, logs: { where: { action: OUTREACH_PREPARED }, orderBy: { createdAt: "desc" }, take: 1, select: { createdAt: true } } },
    }),
  ]);

  const stalled = openDeals
    .map((d) => ({ d, last: d.dealLogs[0]?.createdAt ?? d.updatedAt }))
    .filter((x) => daysSince(x.last, now) >= 30)
    .sort((a, b) => a.last.getTime() - b.last.getTime())
    .slice(0, take);

  const anniversaries = foundedLeads
    .map((l) => ({ l, a: nextAnniversary(l.foundedYear as number, l.foundedMonth ?? null, now) }))
    .filter((x): x is { l: (typeof foundedLeads)[number]; a: NonNullable<ReturnType<typeof nextAnniversary>> } => x.a !== null && x.a.monthsAway <= 3)
    .sort((x, y) => x.a.monthsAway - y.a.monthsAway)
    .slice(0, take);

  return {
    for: { name: v.name, company: company?.name ?? (isHq(v) ? "本部" : null), prefecture: pref },
    asOf: day(now),
    order: "1→8 の順に優先。1〜3 と 8 は今日中に動く（8は下書きを送ったかどうかの確定）。4〜7 は声をかける先の候補（7は電話でしか当たれない先）",
    sections: [
      {
        no: 1,
        title: "返事待ちが7日超",
        count: waiting.length,
        next: "返事が来ていれば record_lead_result(leadId, result)。来ていなければ追い連絡→ log_activity",
        items: waiting.map((l) => ({ leadId: l.id, name: l.name, industry: l.industry, sentAt: day(l.sentAt), daysWaiting: l.sentAt ? daysSince(l.sentAt, now) : null })),
      },
      {
        no: 2,
        title: "見込み日を過ぎた商談",
        count: overdue.length,
        next: "結果が出ていれば update_deal(status) か受注ならOS画面。延びたなら update_deal(expectedCloseDate)",
        items: overdue.map((d) => ({ dealId: d.id, customer: d.customer.name, title: d.title, status: d.status, expectedCloseDate: day(d.expectedCloseDate), daysOver: d.expectedCloseDate ? daysSince(d.expectedCloseDate, now) : null })),
      },
      {
        no: 3,
        title: "30日以上動いていない商談",
        count: stalled.length,
        next: "動かすなら連絡→ log_activity。動かないなら update_deal(status: DORMANT か CLOSED_LOST)",
        items: stalled.map(({ d, last }) => ({ dealId: d.id, customer: d.customer.name, title: d.title, status: d.status, lastMoved: day(last), daysIdle: daysSince(last, now) })),
      },
      {
        no: 4,
        title: "3か月以内に周年（自県のリード）",
        count: anniversaries.length,
        next: "記念広告・記念動画の切り口で声をかける。着手したら log_activity か create_deal",
        items: anniversaries.map(({ l, a }) => ({ leadId: l.id, name: l.name, industry: l.industry, anniversary: `${a.years}周年`, monthsAway: a.monthsAway, assignee: l.assignee?.name ?? null })),
      },
      {
        no: 5,
        title: "広告費に使える補助金",
        count: subsidies.length,
        next: "対象業種の顧客・リードに「財源」として添える",
        items: subsidies.map((s) => ({ subsidyId: s.id, title: s.title, institution: s.institutionName, industry: s.industry, acceptanceEnd: day(s.acceptanceEnd), why: s.fitReason, url: s.detailUrl })),
      },
      {
        no: 6,
        title: "今週シグナルが立った会社（自県）",
        count: signals.length,
        next: "買う気配が立った直後に当たる。連絡したら log_activity",
        items: signals.map((l) => ({ leadId: l.id, name: l.name, industry: l.industry, signal: l.signalKind, signalAt: day(l.signalAt), assignee: l.assignee?.name ?? null })),
      },
      {
        no: 7,
        title: "電話候補（メール・フォームが使えない先）",
        count: phoneCandidates.length,
        next: "電話をかける。話せたら log_activity、結果は record_lead_result(leadId, result)",
        items: phoneCandidates.map((l) => ({
          leadId: l.id, name: l.name, industry: l.industry, phone: l.phone, area: l.area ?? l.prefecture,
          why: stripSensitiveLines(l.logs[0]?.detail ?? "") || null, since: day(l.logs[0]?.createdAt),
        })),
      },
      {
        no: 8,
        title: "下書きのまま確定していない先（送りましたか？）",
        count: prepared.length,
        next: "送っていれば confirm_sent(leadIds)＝ここで送付日と全社の送付台帳に載る。送っていなければ confirm_sent(leadIds, sent: false) で取りやめ（他の拠点が当たれるようになります）",
        items: prepared.map((l) => ({
          leadId: l.id, name: l.name, industry: l.industry,
          channel: l.email ? "メール" : l.websiteUrl ? "フォーム" : "—",
          preparedAt: day(l.logs[0]?.createdAt),
          daysWaiting: l.logs[0]?.createdAt ? daysSince(l.logs[0].createdAt, now) : null,
        })),
      },
    ],
  };
}

// ---- Wiki（一覧・全文） ----------------------------------------------------------------

const wikiVisible = (v: McpViewer): Prisma.WikiArticleWhereInput => (isHq(v) ? {} : { NOT: { OR: [{ title: { contains: "ADMIN向け" } }, { title: { contains: "ADMIN専用" } }, { title: { contains: "本部のみ" } }] } });

export async function listWiki(v: McpViewer, input: { tag?: string; limit?: number }) {
  const rows = await db.wikiArticle.findMany({
    where: { ...wikiVisible(v), ...(input.tag ? { tags: { some: { name: { contains: input.tag } } } } : {}) },
    orderBy: { updatedAt: "desc" },
    take: clampLimit(input.limit, 50, 100),
    select: { id: true, title: true, updatedAt: true, tags: { select: { name: true } }, body: true },
  });
  return rows.map((a) => ({ id: a.id, title: a.title, tags: a.tags.map((t) => t.name), updatedAt: day(a.updatedAt), chars: a.body.length, lead: a.body.replace(/\s+/g, " ").slice(0, 120) }));
}

export async function getWiki(v: McpViewer, id: string) {
  const a = await db.wikiArticle.findFirst({ where: { id, ...wikiVisible(v) }, select: { id: true, title: true, body: true, authorName: true, updatedAt: true, tags: { select: { name: true } } } });
  if (!a) return { error: "記事が見つからないか、閲覧できません" };
  return { id: a.id, title: a.title, tags: a.tags.map((t) => t.name), author: a.authorName, updatedAt: day(a.updatedAt), body: a.body };
}
