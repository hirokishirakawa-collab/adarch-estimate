import { PrismaClient } from "../../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
const url = process.env.TEST_DB_URL!;
if (!url.includes("localhost")) throw new Error("local only");
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
async function main() {
  const br = await db.branch.upsert({ where: { id: "branch_test" }, update: {}, create: { id: "branch_test", name: "テスト拠点（佐賀）", code: "TST" } });
  const gc = await db.groupCompany.upsert({ where: { id: "gc_test" }, update: {}, create: { id: "gc_test", name: "テスト映像合同会社", ownerName: "試験 太郎", chatSpaceId: "x", prefecture: "佐賀県", websiteUrl: "https://example.com" } });
  await db.user.upsert({ where: { email: "demo@adarch.co.jp" }, update: { role: "MANAGER", branchId: br.id, groupCompanyId: gc.id, isActive: true }, create: { email: "demo@adarch.co.jp", name: "Demo User", role: "MANAGER", branchId: br.id, groupCompanyId: gc.id } });
  const other = await db.branch.upsert({ where: { id: "branch_other" }, update: {}, create: { id: "branch_other", name: "他拠点", code: "OTH" } });
  const c1 = await db.customer.create({ data: { name: "唐津製菓株式会社", industry: "食品", branchId: br.id, prefecture: "佐賀県", notes: "担当は営業部長。\n仕入れ値は非公開\n次回は9月末" } });
  const c2 = await db.customer.create({ data: { name: "よその会社", industry: "建設", branchId: other.id } });
  await db.deal.create({ data: { title: "TVer 秋キャンペーン", customerId: c1.id, branchId: br.id, amount: 450000, status: "PROPOSAL", probability: 60 } });
  await db.deal.create({ data: { title: "見えてはいけない商談", customerId: c2.id, branchId: other.id, amount: 999999, status: "NEGOTIATION" } });
  const est = await db.estimation.create({ data: { title: "TVer 秋キャンペーン 見積", branchId: br.id, customerId: c1.id, status: "DRAFT", discountAmount: 10000, discountReason: "初回", createdByEmail: "demo@adarch.co.jp" } });
  await db.estimationItem.create({ data: { name: "TVer配信（15秒）", quantity: 1, unitPrice: 300000, amount: 300000, costPrice: 100000, estimationId: est.id, sortOrder: 1 } });
  await db.salesPackage.upsert({ where: { slug: "tver-area" }, update: {}, create: { slug: "tver-area", name: "TVer エリア別網羅プラン", category: "動画広告", status: "ACTIVE", priceType: "MONTHLY", monthlyPrice: 100000, tagline: "商圏の3人に1人に届ける", rules: "値引きは10%まで\n卸値は言わない" } });
  await db.wikiArticle.create({ data: { title: "TVer提案の進め方", body: "まず商圏を決める。次にプランを出す。", authorName: "本部", branchId: br.id } });
  await db.wikiArticle.create({ data: { title: "本部のみ: ロイヤリティ運用", body: "秘密", authorName: "本部", branchId: br.id } });
  console.log("seeded");
}
main().finally(() => db.$disconnect());
