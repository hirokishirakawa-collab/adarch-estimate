// ローカル検証専用: 勝ち筋検索・提案書束ね・夜間バッチ用のデータを足す
import { PrismaClient } from "../../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
const url = process.env.TEST_DB_URL!;
if (!url.includes("localhost")) throw new Error("local only");
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
async function main() {
  const me = await db.user.findUniqueOrThrow({ where: { email: "demo@adarch.co.jp" } });
  const c1 = await db.customer.findFirstOrThrow({ where: { name: "唐津製菓株式会社" } });
  const other = await db.branch.findUniqueOrThrow({ where: { id: "branch_other" } });
  const oc = await db.customer.create({ data: { name: "福岡歯科クリニック", industry: "歯科", branchId: other.id, prefecture: "福岡県" } });
  await db.deal.create({ data: { title: "周年動画＋TVer", customerId: oc.id, branchId: other.id, amount: 800000, status: "CLOSED_WON", closedAt: new Date("2026-08-20"), closingFactor: "院長の30周年を切り口に、地元TVerで『地域の人に見える』を強調。見積は3案出し真ん中を選ばれた", dealLogs: { create: [{ type: "MEETING", content: "初回訪問。周年の話で盛り上がる", staffName: "他拠点 太郎" }] } } });
  await db.deal.create({ data: { title: "食品メーカー 新商品PR", customerId: c1.id, branchId: me.branchId!, amount: 300000, status: "CLOSED_WON", closedAt: new Date("2026-07-01"), closingFactor: "補助金（小規模事業者持続化）を財源に提案", allowDuplicate: undefined as never } }).catch(async () => {
    await db.deal.create({ data: { title: "食品メーカー 新商品PR", customerId: c1.id, branchId: me.branchId!, amount: 300000, status: "CLOSED_WON", closedAt: new Date("2026-07-01"), closingFactor: "補助金（小規模事業者持続化）を財源に提案" } });
  });
  // 停止商談（60日・担当なし）と期限超過
  await db.deal.create({ data: { title: "止まっている提案", customerId: c1.id, branchId: me.branchId!, status: "PROPOSAL", probability: 40, updatedAt: new Date(Date.now() - 65 * 86400000), expectedCloseDate: new Date(Date.now() - 10 * 86400000) } });
  const gc = await db.groupCompany.findUniqueOrThrow({ where: { id: "gc_test" } });
  await db.salesApproach.create({ data: { groupCompanyId: gc.id, authorId: me.id, industry: "歯科", targetDesc: "駅前の開業10年目", method: "EMAIL", messageBody: "はじめまして。開院10周年のタイミングで、地域の方に『ここにある』を思い出してもらう動画とTVer配信のご提案です。", result: "REPLIED_OK", learnings: "周年を件名に入れると開封される" } });
  await db.subsidy.create({ data: { title: "小規模事業者持続化補助金（テスト）", institutionName: "中小企業庁", industry: "食品 / 飲食", targetAreas: ["全国"], isActive: true, adCostFit: "CONFIRMED", fitReason: "広告掲載費・動画制作費が対象", acceptanceEnd: new Date(Date.now() + 40 * 86400000), sourceUrl: "https://example.com/s" } }).catch((e) => console.log("subsidy skip:", (e as Error).message.split("\n")[0]));
  console.log("seeded phase2");
}
main().finally(() => db.$disconnect());
