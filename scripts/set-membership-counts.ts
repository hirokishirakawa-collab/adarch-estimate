// 複数拠点パートナーの県（branchLabels）と、ロイヤリティ最低保証/免除を設定する一回限りのスクリプト。
//
// 使い方:
//   確認のみ:  npx tsx scripts/set-membership-counts.ts
//   実際に更新: npx tsx scripts/set-membership-counts.ts --apply
//
// ※ 先に `npx prisma db push` で対象列を追加しておくこと。
// ※ 名前(ownerName/name)に候補語を含むGroupCompanyを探し、ちょうど1件のときだけ更新する。
import { config } from "dotenv";
// DATABASE_URL は .env.local に入っている（.env は空）。.env.local を優先で読む。
config({ path: ".env.local" });
config();
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

// 複数拠点（県名）
const BRANCH_TARGETS = [
  { keys: ["歌丸"], labels: ["山口", "広島"] },
  { keys: ["七條"], labels: ["岡山", "香川"] },
  { keys: ["高澤"], labels: ["宮城", "福島"] },
];

// ロイヤリティ最低保証の個別設定／免除
const ROYALTY_OVERRIDES: { keys: string[]; note: string; royaltyMinExclTax?: number; royaltyExempt?: boolean }[] = [
  { keys: ["冨永", "富永", "Tominaga", "Rawfeel"], note: "最低保証3万", royaltyMinExclTax: 30000 },
  { keys: ["藤原", "Fujiwara"], note: "ロイヤリティ免除", royaltyExempt: true },
];

const apply = process.argv.includes("--apply");

async function findOne(keys: string[]) {
  const matches = await prisma.groupCompany.findMany({
    where: { OR: keys.flatMap((k) => [{ ownerName: { contains: k } }, { name: { contains: k } }]) },
    select: { id: true, name: true, ownerName: true, prefecture: true, branchLabels: true, royaltyMinExclTax: true, royaltyExempt: true, isActive: true },
  });
  // 重複除去
  const uniq = Array.from(new Map(matches.map((m) => [m.id, m])).values());
  return uniq;
}

async function main() {
  console.log(apply ? "=== APPLY モード（実際に更新します） ===\n" : "=== 確認モード（--apply を付けると更新） ===\n");

  console.log("【複数拠点の県設定】");
  for (const t of BRANCH_TARGETS) {
    const key = t.keys.join("/");
    const ms = await findOne(t.keys);
    const note = t.labels.join("＋");
    if (ms.length === 0) { console.log(`❌ ${key}（${note}）: 該当なし`); continue; }
    if (ms.length > 1) {
      console.log(`⚠️  ${key}（${note}）: ${ms.length}件ヒット → 自動更新せず:`);
      ms.forEach((m) => console.log(`     - ${m.name} / ${m.ownerName} / 現[${m.branchLabels.join("、")}]`));
      continue;
    }
    const m = ms[0];
    console.log(`✅ ${key}（${note}）: ${m.name} / ${m.ownerName} / 現[${m.branchLabels.join("、")}] → [${t.labels.join("、")}]`);
    if (apply) await prisma.groupCompany.update({ where: { id: m.id }, data: { branchLabels: t.labels, membershipCount: t.labels.length } });
  }

  console.log("\n【ロイヤリティ最低保証・免除】");
  for (const o of ROYALTY_OVERRIDES) {
    const key = o.keys.join("/");
    const ms = await findOne(o.keys);
    if (ms.length === 0) { console.log(`❌ ${key}（${o.note}）: 該当なし`); continue; }
    if (ms.length > 1) {
      console.log(`⚠️  ${key}（${o.note}）: ${ms.length}件ヒット → 自動更新せず:`);
      ms.forEach((m) => console.log(`     - ${m.name} / ${m.ownerName} / 現[最低¥${m.royaltyMinExclTax ?? "既定5万"}${m.royaltyExempt ? "・免除" : ""}]`));
      continue;
    }
    const m = ms[0];
    const target = o.royaltyExempt ? "免除" : `最低保証¥${o.royaltyMinExclTax?.toLocaleString()}`;
    console.log(`✅ ${key}（${o.note}）: ${m.name} / ${m.ownerName} → ${target}`);
    if (apply) {
      await prisma.groupCompany.update({
        where: { id: m.id },
        data: {
          ...(o.royaltyMinExclTax !== undefined ? { royaltyMinExclTax: o.royaltyMinExclTax } : {}),
          ...(o.royaltyExempt !== undefined ? { royaltyExempt: o.royaltyExempt } : {}),
        },
      });
    }
  }

  console.log(apply ? "\n更新を完了しました。" : "\n（まだ更新していません。問題なければ --apply を付けて再実行してください）");
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
