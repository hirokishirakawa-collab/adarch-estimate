import Anthropic from "@anthropic-ai/sdk";
import { db } from "@/lib/db";

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24時間
const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;

// 動画実績攻略案件を除外するフィルタ
const EXCLUDE_ATTACK_DEALS = { title: { not: { startsWith: "【動画実績攻略】" } } };

export interface DigestResult {
  content: string;
  updatedAt: Date;
}

/**
 * ダッシュボードダイジェストを取得（キャッシュ or 新規生成）。
 * エラー時は null を返し、ユーザー体験をブロックしない。
 */
export async function getOrGenerateDigest(): Promise<DigestResult | null> {
  try {
    // 1. キャッシュ確認
    const cached = await db.dashboardDigest.findUnique({
      where: { id: "singleton" },
    });

    if (cached && Date.now() - cached.updatedAt.getTime() < CACHE_TTL_MS) {
      return { content: cached.content, updatedAt: cached.updatedAt };
    }

    // 2. 直近3日間 + 前回3日間のデータ集計
    const now = Date.now();
    const since = new Date(now - THREE_DAYS_MS);
    const prevStart = new Date(now - THREE_DAYS_MS * 2);
    const [data, prevData] = await Promise.all([
      collectStats(since),
      collectBasicStats(prevStart, since),
    ]);

    // 3. AI サマリー生成
    const content = await generateSummary(data, prevData);
    if (!content) return cached ? { content: cached.content, updatedAt: cached.updatedAt } : null;

    // 4. DB に保存（upsert）
    const saved = await db.dashboardDigest.upsert({
      where: { id: "singleton" },
      create: { id: "singleton", content, dataJson: JSON.stringify(data) },
      update: { content, dataJson: JSON.stringify(data) },
    });

    return { content: saved.content, updatedAt: saved.updatedAt };
  } catch {
    return null;
  }
}

// ----------------------------------------------------------------
// 型定義
// ----------------------------------------------------------------
interface BranchActivity {
  name: string;
  count: number;
}

interface TopUser {
  name: string;
  actions: number;
}

interface NotableDeal {
  customerName: string;
  title: string;
  status: string;
  amount: number | null;
}

interface BasicStats {
  newCustomers: number;
  newDeals: number;
  newProjects: number;
}

interface DigestStats {
  newCustomers: number;
  newDeals: number;
  dealsByStatus: Record<string, number>;
  dealTotalAmount: number;
  newProjects: number;
  updatedProjects: number;
  newEstimations: number;
  newInvoiceRequests: number;
  newTverCampaigns: number;
  newCollaborations: number;
  newRevenueReports: number;
  revenueTotalAmount: number;
  activeBranches: BranchActivity[];
  topUsers: TopUser[];
  notableDeals: NotableDeal[];
}

// ----------------------------------------------------------------
// 前回期間の基本統計（比較用）
// ----------------------------------------------------------------
async function collectBasicStats(from: Date, to: Date): Promise<BasicStats> {
  const [newCustomers, newDeals, newProjects] = await Promise.all([
    db.customer.count({ where: { createdAt: { gte: from, lt: to } } }),
    db.deal.count({ where: { createdAt: { gte: from, lt: to }, ...EXCLUDE_ATTACK_DEALS } }),
    db.project.count({ where: { createdAt: { gte: from, lt: to } } }),
  ]);
  return { newCustomers, newDeals, newProjects };
}

// ----------------------------------------------------------------
// メイン集計
// ----------------------------------------------------------------
async function collectStats(since: Date): Promise<DigestStats> {
  const [
    newCustomers,
    deals,
    newProjects,
    updatedProjects,
    newEstimations,
    newInvoiceRequests,
    newTverCampaigns,
    newCollaborations,
    revenueReports,
    branchCustomers,
    branchDeals,
    branchProjects,
    // 活躍ユーザー用
    dealsByCreator,
    activityLogs,
    // 注目案件
    notableDealsRaw,
  ] = await Promise.all([
    db.customer.count({ where: { createdAt: { gte: since } } }),
    db.deal.findMany({
      where: { createdAt: { gte: since }, ...EXCLUDE_ATTACK_DEALS },
      select: { status: true, amount: true },
    }),
    db.project.count({ where: { createdAt: { gte: since } } }),
    db.project.count({ where: { updatedAt: { gte: since }, createdAt: { lt: since } } }),
    db.estimation.count({ where: { createdAt: { gte: since } } }),
    db.invoiceRequest.count({ where: { createdAt: { gte: since } } }),
    db.tverCampaign.count({ where: { createdAt: { gte: since } } }),
    db.groupCollaborationRequest.count({ where: { createdAt: { gte: since } } }),
    db.revenueReport.findMany({
      where: { createdAt: { gte: since } },
      select: { amount: true },
    }),
    // 拠点別
    db.customer.groupBy({
      by: ["branchId"],
      where: { createdAt: { gte: since } },
      _count: true,
    }),
    db.deal.groupBy({
      by: ["branchId"],
      where: { createdAt: { gte: since }, ...EXCLUDE_ATTACK_DEALS },
      _count: true,
    }),
    db.project.groupBy({
      by: ["branchId"],
      where: { updatedAt: { gte: since } },
      _count: true,
    }),
    // 活躍ユーザー: 商談作成者別
    db.deal.findMany({
      where: { createdAt: { gte: since }, createdById: { not: null }, ...EXCLUDE_ATTACK_DEALS },
      select: { createdBy: { select: { name: true } } },
    }),
    // 活躍ユーザー: 活動ログ（staffName別）
    db.activityLog.findMany({
      where: { createdAt: { gte: since } },
      select: { staffName: true },
    }),
    // 注目案件: 直近の受注・大型商談
    db.deal.findMany({
      where: { createdAt: { gte: since }, ...EXCLUDE_ATTACK_DEALS },
      select: {
        title: true,
        status: true,
        amount: true,
        customer: { select: { name: true } },
      },
      orderBy: { amount: { sort: "desc", nulls: "last" } },
      take: 5,
    }),
  ]);

  // 商談集計
  const dealsByStatus: Record<string, number> = {};
  let dealTotalAmount = 0;
  for (const d of deals) {
    dealsByStatus[d.status] = (dealsByStatus[d.status] ?? 0) + 1;
    if (d.amount) dealTotalAmount += Number(d.amount);
  }

  // 売上集計
  let revenueTotalAmount = 0;
  for (const r of revenueReports) {
    revenueTotalAmount += Number(r.amount);
  }

  // 拠点別アクション集計
  const branchMap = new Map<string, number>();
  for (const g of branchCustomers) { branchMap.set(g.branchId, (branchMap.get(g.branchId) ?? 0) + g._count); }
  for (const g of branchDeals) { branchMap.set(g.branchId, (branchMap.get(g.branchId) ?? 0) + g._count); }
  for (const g of branchProjects) { branchMap.set(g.branchId, (branchMap.get(g.branchId) ?? 0) + g._count); }

  const branchIds = Array.from(branchMap.keys());
  const branches = branchIds.length > 0
    ? await db.branch.findMany({ where: { id: { in: branchIds } }, select: { id: true, name: true } })
    : [];
  const branchNameMap = new Map(branches.map((b) => [b.id, b.name]));

  const activeBranches: BranchActivity[] = Array.from(branchMap.entries())
    .map(([id, count]) => ({ name: branchNameMap.get(id) ?? id, count }))
    .sort((a, b) => b.count - a.count);

  // 活躍ユーザー集計（商談作成 + 活動ログ）
  const userActionMap = new Map<string, number>();
  for (const d of dealsByCreator) {
    const name = d.createdBy?.name;
    if (name) userActionMap.set(name, (userActionMap.get(name) ?? 0) + 1);
  }
  for (const a of activityLogs) {
    if (a.staffName) userActionMap.set(a.staffName, (userActionMap.get(a.staffName) ?? 0) + 1);
  }
  const topUsers: TopUser[] = Array.from(userActionMap.entries())
    .map(([name, actions]) => ({ name, actions }))
    .sort((a, b) => b.actions - a.actions)
    .slice(0, 3);

  // 注目案件
  const notableDeals: NotableDeal[] = notableDealsRaw.map((d) => ({
    customerName: d.customer.name,
    title: d.title,
    status: d.status,
    amount: d.amount ? Number(d.amount) : null,
  }));

  return {
    newCustomers,
    newDeals: deals.length,
    dealsByStatus,
    dealTotalAmount,
    newProjects,
    updatedProjects,
    newEstimations,
    newInvoiceRequests,
    newTverCampaigns,
    newCollaborations,
    newRevenueReports: revenueReports.length,
    revenueTotalAmount,
    activeBranches,
    topUsers,
    notableDeals,
  };
}

// ----------------------------------------------------------------
// AI サマリー生成
// ----------------------------------------------------------------
const STATUS_LABELS: Record<string, string> = {
  PROSPECTING: "見込み",
  QUALIFYING: "検討中",
  PROPOSAL: "提案中",
  NEGOTIATION: "交渉中",
  CLOSED_WON: "受注",
  CLOSED_LOST: "失注",
};

function compareTrend(current: number, prev: number): string {
  if (prev === 0 && current === 0) return "変動なし";
  if (prev === 0) return `${current}件（前回0→新規発生）`;
  const diff = current - prev;
  const pct = Math.round((diff / prev) * 100);
  if (diff > 0) return `${current}件（前回比 +${pct}% 増加）`;
  if (diff < 0) return `${current}件（前回比 ${pct}% 減少）`;
  return `${current}件（前回と同水準）`;
}

async function generateSummary(data: DigestStats, prev: BasicStats): Promise<string | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  const client = new Anthropic({ apiKey });

  const branchText = data.activeBranches.length > 0
    ? data.activeBranches.map((b) => `${b.name}（${b.count}件）`).join("、")
    : "動きなし";

  const topUsersText = data.topUsers.length > 0
    ? data.topUsers.map((u) => `${u.name}さん（${u.actions}アクション）`).join("、")
    : "なし";

  const notableDealsText = data.notableDeals.length > 0
    ? data.notableDeals.map((d) => {
      const status = STATUS_LABELS[d.status] ?? d.status;
      const amount = d.amount ? `${Math.round(d.amount / 10000)}万円` : "";
      return `${d.customerName}「${d.title}」${status}${amount ? ` ${amount}` : ""}`;
    }).join(" / ")
    : "なし";

  const prompt = `以下はアドアーチグループの直近3日間の業務データです。グループ全体の活動状況を3〜5行で簡潔にまとめてください。

【トーンの指示】
- ポジティブで前向きなトーン。チームや個人の頑張りを称え、勢いや成長を感じられる表現にしてください。
- 活躍しているメンバーの名前を自然に織り込んでください（「○○さんが精力的に活動中」等）。
- 注目案件があれば顧客名に触れてリアリティを出してください。
- 前回比で増えている指標があれば勢いを強調、減っている場合も「次の一手に期待」等前向きに。
- 数値が0の項目は省略し、動きがあった部分にフォーカス。
- どの拠点が活発かを必ず言及。
- データがすべて0の場合は「新しい動きの準備期間」といった前向きなメッセージに。

【集計データ（直近3日間）】
- 新規顧客: ${compareTrend(data.newCustomers, prev.newCustomers)}
- 新規商談: ${compareTrend(data.newDeals, prev.newDeals)}（合計金額: ${data.dealTotalAmount > 0 ? `${Math.round(data.dealTotalAmount / 10000)}万円` : "—"}）
- 商談ステータス別: ${Object.entries(data.dealsByStatus).map(([k, v]) => `${STATUS_LABELS[k] ?? k}: ${v}件`).join(", ") || "—"}
- 新規PJ: ${compareTrend(data.newProjects, prev.newProjects)} / 更新PJ: ${data.updatedProjects}件
- 見積作成: ${data.newEstimations}件
- 請求依頼: ${data.newInvoiceRequests}件
- TVer配信申請: ${data.newTverCampaigns}件
- グループ連携依頼: ${data.newCollaborations}件
- 売上報告: ${data.newRevenueReports}件（合計: ${data.revenueTotalAmount > 0 ? `${Math.round(data.revenueTotalAmount / 10000)}万円` : "—"}）

【拠点別アクション数】
${branchText}

【活躍メンバー（アクション数上位）】
${topUsersText}

【注目案件】
${notableDealsText}

サマリーのみを出力してください（見出し・箇条書き・絵文字は不要、自然な文章で）。`;

  const response = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 512,
    messages: [{ role: "user", content: prompt }],
  });

  const block = response.content[0];
  if (block.type === "text") return block.text.trim();
  return null;
}
