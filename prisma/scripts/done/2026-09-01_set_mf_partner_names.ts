import { config } from "dotenv";
config({ path: ".env.local" });
import { PrismaClient } from "../../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL as string }) });
// MF請求CSV（2026_09_01_seikyusho.csv）の取引先名称↔担当者氏名から確定した対応
const map: [string, string][] = [
  ["高橋 摩也斗", "HALO合同会社"], ["大城 崇", "HITO Film株式会社"], ["森下 智司", "Rocks合同会社"], ["横山 将明", "TooN合同会社"],
  ["山口 亜弓", "山口亜弓"], ["木本 一心", "木本一心"], ["坂東 正朗", "株式会社B-STYLE"], ["一村 篤", "株式会社OneVilection"],
  ["七條 敬一", "株式会社QUEST"], ["歌丸 翔馬", "株式会社U.create"], ["倉田 大輔", "株式会社オーセントライク"], ["瀬野 詠介", "株式会社ジツカ"],
  ["濱口 和朋", "株式会社デザインフューチャー"], ["吉原 悠真", "株式会社ヨシハラ総合企画"], ["片桐 脩一郎", "片桐脩一郎"], ["金山 恵美", "金山 恵美"], ["齋藤 慧介", "齋藤慧介"],
];
(async () => {
  let n = 0;
  for (const [nm, mf] of map) {
    const r = await db.groupCompany.updateMany({ where: { name: { startsWith: nm } }, data: { mfPartnerName: mf } });
    if (r.count !== 1) console.log("WARN", nm, r.count); else n++;
  }
  console.log("mfPartnerName set:", n);
  await db.$disconnect();
})();
