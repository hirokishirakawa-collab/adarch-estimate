import Anthropic from "@anthropic-ai/sdk";
import { db } from "@/lib/db";

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24時間
const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;

/**
 * ダッシュボードダイジェストを取得（キャッシュ or 新規生成）。
 * エラー時は null を返し、ユーザー体験をブロックしない。
 */
export async function getOrGenerateDigest(): Promise<string | null> {
  try {
    // 1. キャッシュ確認
    const cached = await db.dashboardDigest.findUnique({
      where: { id: "singleton" },
    });

    if (cached && Date.now() - cached.updatedAt.getTime() < CACHE_TTL_MS) {
      return cached.content;
    }

    // 2. 直近3日間のデータ集計
    const since = new Date(Date.now() - THREE_DAYS_MS);
    const data = await collectStats(since);

    // 3. AI サマリー生成
    const content = await generateSummary(data);
    if (!content) return cached?.content ?? null;

    // 4. DB に保存（upsert）
    await db.dashboardDigest.upsert({
      where: { id: "singleton" },
      create: { id: "singleton", content, dataJson: JSON.stringify(data) },
      update: { content, dataJson: JSON.stringify(data) },
    });

    return content;
  } catch {
    return null;
  }
}

// ----------------------------------------------------------------
// データ集計
// ----------------------------------------------------------------
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
}

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
  ] = await Promise.all([
    db.customer.count({ where: { createdAt: { gte: since } } }),
    db.deal.findMany({
      where: { createdAt: { gte: since } },
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
  ]);

  const dealsByStatus: Record<string, number> = {};
  let dealTotalAmount = 0;
  for (const d of deals) {
    dealsByStatus[d.status] = (dealsByStatus[d.status] ?? 0) + 1;
    if (d.amount) dealTotalAmount += Number(d.amount);
  }

  let revenueTotalAmount = 0;
  for (const r of revenueReports) {
    revenueTotalAmount += Number(r.amount);
  }

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
  };
}

// ----------------------------------------------------------------
// AI サマリー生成
// ----------------------------------------------------------------
async function generateSummary(data: DigestStats): Promise<string | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  const client = new Anthropic({ apiKey });

  const prompt = `以下はアドアーチグループの直近3日間の業務データです。グループ全体の活動状況を3〜5行で簡潔にまとめてください。
数値が0の項目は省略し、注目すべき動きや傾向を中心にまとめてください。自然な日本語で、ビジネスチーム向けのトーンでお願いします。

【データ】
- 新規顧客登録: ${data.newCustomers}件
- 新規商談: ${data.newDeals}件（合計金額: ${data.dealTotalAmount > 0 ? `${Math.round(data.dealTotalAmount / 10000)}万円` : "なし"}）
- 商談ステータス別: ${Object.entries(data.dealsByStatus).map(([k, v]) => `${k}: ${v}件`).join(", ") || "なし"}
- 新規プロジェクト: ${data.newProjects}件 / 更新プロジェクト: ${data.updatedProjects}件
- 見積作成: ${data.newEstimations}件
- 請求依頼: ${data.newInvoiceRequests}件
- TVer配信申請: ${data.newTverCampaigns}件
- グループ連携依頼: ${data.newCollaborations}件
- 売上報告: ${data.newRevenueReports}件（合計: ${data.revenueTotalAmount > 0 ? `${Math.round(data.revenueTotalAmount / 10000)}万円` : "なし"}）

サマリーのみを出力してください（見出しや箇条書きは不要）。`;

  const response = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 512,
    messages: [{ role: "user", content: prompt }],
  });

  const block = response.content[0];
  if (block.type === "text") return block.text.trim();
  return null;
}
