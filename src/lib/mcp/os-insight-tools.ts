// ==============================================================
// MCP: 営業の「勝ち筋」ツール（scope = os:read）
//   find_similar_wins : 受注商談の「決め手」＋アプローチ事例を、業種・県・パッケージで横断して引く
//                       ＝46拠点の経験を全員の武器にする（フィジカルネットワークをデータの障壁に）
//   draft_proposal    : 提案書を書くのに要る材料（顧客の履歴・パッケージ・ブランドキット・類似の勝ち事例・
//                       財源になる補助金・TVerプラン）を1コールで束ねてAIに渡す
//   決まり: 金額は他拠点分を出さない（os-read-tools と同じ線引き）。パッケージ価格表とTVerの売値は出す
// ==============================================================

import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { stripSensitiveLines } from "@/lib/brand-kit/common";
import { buildAllMaterials } from "@/lib/brand-kit/all-materials";
import { ARCHIVE_BRANCH_ID } from "@/lib/data/customers";
import { canSeeAmount, getPackage, tverAreaPlan, type McpViewer } from "./os-read-tools";
import { listActivities } from "./os-write-tools";

const day = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : null);
const clampLimit = (n: number | undefined, def = 8, max = 20) => Math.min(max, Math.max(1, Math.floor(n ?? def)));
const prefBase = (s: string) => (s.startsWith("北海道") ? "北海道" : s.trim().replace(/[都府県]$/, ""));
const excerpt = (s: string | null | undefined, n: number) => {
  const t = stripSensitiveLines(s ?? "").replace(/\s+/g, " ").trim();
  return t.length > n ? `${t.slice(0, n)}…` : t;
};

const RESULT_LABEL: Record<string, string> = { DEAL: "商談化", REPLIED_OK: "返信あり（前向き）", REPLIED_NG: "返信あり（不成立）", NO_REPLY: "未返信", REJECTED: "拒否" };
const METHOD_LABEL: Record<string, string> = { EMAIL: "メール", FORM: "問い合わせフォーム", DM: "DM", PHONE: "電話", VISIT: "訪問", OTHER: "その他" };

// ---- 類似の勝ち事例 -----------------------------------------------------------

export interface FindSimilarWinsInput {
  industry?: string;
  prefecture?: string;
  packageSlug?: string;
  query?: string;
  limit?: number;
}

export async function findSimilarWins(v: McpViewer, input: FindSimilarWinsInput) {
  const take = clampLimit(input.limit);
  const industry = input.industry?.trim() || null;
  const pref = input.prefecture?.trim() ? prefBase(input.prefecture) : null;
  const query = input.query?.trim() || null;

  // 受注商談＝決め手が残っているものを優先。決め手が無いものも「何が売れたか」の参考に少数
  const dealWhere: Prisma.DealWhereInput = { status: "CLOSED_WON", NOT: { branchId: ARCHIVE_BRANCH_ID } };
  const and: Prisma.DealWhereInput[] = [];
  if (industry) and.push({ customer: { industry: { contains: industry, mode: "insensitive" } } });
  if (pref) and.push({ customer: { prefecture: { contains: pref } } });
  if (query) and.push({ OR: [{ title: { contains: query, mode: "insensitive" } }, { closingFactor: { contains: query, mode: "insensitive" } }, { notes: { contains: query, mode: "insensitive" } }] });
  if (and.length) dealWhere.AND = and;

  const pkg = input.packageSlug ? await db.salesPackage.findUnique({ where: { slug: input.packageSlug }, select: { id: true, name: true } }) : null;

  const approachWhere: Prisma.SalesApproachWhereInput = { result: { in: ["DEAL", "REPLIED_OK"] } };
  const aand: Prisma.SalesApproachWhereInput[] = [];
  if (industry) aand.push({ industry: { contains: industry, mode: "insensitive" } });
  if (pkg) aand.push({ packageId: pkg.id });
  if (pref) aand.push({ groupCompany: { prefecture: { contains: pref } } });
  if (query) aand.push({ OR: [{ messageBody: { contains: query, mode: "insensitive" } }, { learnings: { contains: query, mode: "insensitive" } }, { targetDesc: { contains: query, mode: "insensitive" } }] });
  if (aand.length) approachWhere.AND = aand;

  const [withFactor, withoutFactor, approaches] = await Promise.all([
    db.deal.findMany({
      where: { ...dealWhere, closingFactor: { not: null } },
      orderBy: { closedAt: "desc" },
      take,
      select: {
        id: true, title: true, closingFactor: true, closedAt: true, branchId: true,
        customer: { select: { industry: true, prefecture: true } }, branch: { select: { name: true } },
        dealLogs: { orderBy: { createdAt: "desc" }, take: 5, select: { type: true, content: true, createdAt: true } },
      },
    }),
    db.deal.findMany({
      where: { ...dealWhere, closingFactor: null },
      orderBy: { closedAt: "desc" },
      take: Math.min(5, take),
      select: { id: true, title: true, closedAt: true, branchId: true, customer: { select: { industry: true, prefecture: true } }, branch: { select: { name: true } } },
    }),
    db.salesApproach.findMany({
      where: approachWhere,
      orderBy: [{ result: "asc" }, { createdAt: "desc" }],
      take,
      select: { id: true, industry: true, targetDesc: true, method: true, messageBody: true, result: true, learnings: true, createdAt: true, groupCompany: { select: { name: true, prefecture: true } }, package: { select: { name: true, slug: true } } },
    }),
  ]);

  return {
    criteria: { industry, prefecture: input.prefecture ?? null, package: pkg?.name ?? null, query },
    wins: withFactor.map((d) => ({
      dealId: d.id, title: d.title, industry: d.customer.industry, prefecture: d.customer.prefecture, branch: d.branch.name, isMine: canSeeAmount(v, d.branchId), closedAt: day(d.closedAt),
      closingFactor: stripSensitiveLines(d.closingFactor ?? ""),
      recentLogs: d.dealLogs.map((l) => ({ type: l.type, at: day(l.createdAt), content: excerpt(l.content, 200) })),
    })),
    winsWithoutFactor: withoutFactor.map((d) => ({ dealId: d.id, title: d.title, industry: d.customer.industry, prefecture: d.customer.prefecture, branch: d.branch.name, closedAt: day(d.closedAt) })),
    approaches: approaches.map((a) => ({
      id: a.id, industry: a.industry, target: excerpt(a.targetDesc, 160), method: METHOD_LABEL[a.method] ?? a.method, result: RESULT_LABEL[a.result] ?? a.result,
      package: a.package?.name ?? null, company: a.groupCompany.name, prefecture: a.groupCompany.prefecture, at: day(a.createdAt),
      message: excerpt(a.messageBody, 600), learnings: excerpt(a.learnings, 400),
    })),
    howToUse:
      "決め手（closingFactor）と、前向きな返信を取った文面（approaches.message）を「型」として借りる。固有名詞・金額は写さない。" +
      "自分の受注が出たら set_closing_factor で決め手を残すと、次の人の武器になる。",
    counts: { wins: withFactor.length, winsWithoutFactor: withoutFactor.length, approaches: approaches.length },
  };
}

// ---- 提案書の材料を1コールで束ねる ---------------------------------------------------

export interface DraftProposalInput {
  customerId: string;
  packageSlug?: string;
  materialIds?: string[];
  tverPrefecture?: string;
  tverCity?: string;
}

const MATERIAL_CHAR_CAP = 12000;

export async function draftProposal(v: McpViewer, input: DraftProposalInput) {
  const c = await db.customer.findFirst({
    where: { id: input.customerId, NOT: { branchId: ARCHIVE_BRANCH_ID } },
    select: { id: true, name: true, industry: true, prefecture: true, address: true, contactName: true, website: true, notes: true, status: true, rank: true, branchId: true, branch: { select: { name: true } } },
  });
  if (!c) return { error: "顧客が見つかりません（search_customers で id を確認してください）" };

  const [activities, deals, pkg, kit, wins, subsidies] = await Promise.all([
    listActivities(v, { customerId: c.id, limit: 15 }),
    db.deal.findMany({
      where: { customerId: c.id, status: { notIn: ["CLOSED_LOST"] } },
      orderBy: { updatedAt: "desc" },
      take: 5,
      select: { id: true, title: true, status: true, probability: true, expectedCloseDate: true, notes: true, closingFactor: true },
    }),
    input.packageSlug ? getPackage(v, input.packageSlug) : Promise.resolve(null),
    buildAllMaterials(v.email),
    findSimilarWins(v, { industry: c.industry ?? undefined, prefecture: c.prefecture ?? undefined, packageSlug: input.packageSlug, limit: 5 }),
    db.subsidy.findMany({
      where: {
        isActive: true,
        adCostFit: { in: ["CONFIRMED", "LIKELY"] },
        ...(c.prefecture ? { targetAreas: { hasSome: [c.prefecture, "全国"] } } : {}),
        ...(c.industry ? { OR: [{ industry: { contains: c.industry } }, { industry: null }, { industry: "" }] } : {}),
        AND: [{ OR: [{ acceptanceEnd: null }, { acceptanceEnd: { gte: new Date() } }] }],
      },
      orderBy: [{ acceptanceEnd: "asc" }],
      take: 5,
      select: { id: true, title: true, institutionName: true, industry: true, acceptanceEnd: true, fitReason: true, detailUrl: true },
    }),
  ]);

  // ブランドキット: 既定＝決まり・会社紹介・営業の言い回し・（指定があれば）そのパッケージ。materialIds で差し替え可
  const wantIds = input.materialIds?.length ? input.materialIds : ["brand-rules", "company", "sales", ...(input.packageSlug ? [`pkg-${input.packageSlug}`] : [])];
  const materials = kit.materials
    .filter((m) => wantIds.includes(m.id))
    .map((m) => ({ id: m.id, label: m.label, version: m.version, body: m.body.length > MATERIAL_CHAR_CAP ? `${m.body.slice(0, MATERIAL_CHAR_CAP)}\n…（長いため途中まで。全文は get_material("${m.id}")）` : m.body }));

  const tver = input.tverPrefecture ? tverAreaPlan({ prefecture: input.tverPrefecture, city: input.tverCity }) : null;

  return {
    customer: {
      id: c.id, name: c.name, industry: c.industry, prefecture: c.prefecture, address: c.address, contactName: c.contactName, website: c.website, status: c.status, rank: c.rank,
      notes: stripSensitiveLines(c.notes) || null, branch: c.branch.name, isMine: canSeeAmount(v, c.branchId),
    },
    activities: "activities" in activities ? activities.activities : [],
    deals: deals.map((d) => ({ id: d.id, title: d.title, status: d.status, probability: d.probability, expectedCloseDate: day(d.expectedCloseDate), notes: excerpt(d.notes, 600), closingFactor: excerpt(d.closingFactor, 400) })),
    package: pkg,
    tverPlan: tver,
    materials,
    similarWins: { wins: wins.wins, approaches: wins.approaches.slice(0, 3) },
    fundingOptions: subsidies.map((s) => ({ id: s.id, title: s.title, institution: s.institutionName, industry: s.industry, acceptanceEnd: day(s.acceptanceEnd), why: s.fitReason, url: s.detailUrl })),
    sender: kit.sender,
    writingGuide: [
      "materials の「ブランドの決まり」に沿った構成・言い回しで書く（色・書体・写真の扱いは資料の型に従う）",
      "activities（過去のやり取り）に出た相手の言葉・困りごとを冒頭の課題に使う。無ければ業種の一般的な課題を1つに絞る",
      "package の内容物・納期・価格表を使い、数字には必ず「目安・税抜」を添える。価格の正本はOS",
      "similarWins の決め手・文面は「型」として借り、固有名詞と金額は写さない",
      "fundingOptions があれば「財源」として1段落添える（締切日を明記）",
      "tverPlan があれば商圏の視聴者数と標準プランを1枚に。金額は税抜・推計と明記",
      "長さ: 提案文なら400〜800字、資料なら見出し5〜7枚分。締めに次の一手（面談・見積）を1つ",
    ],
  };
}
