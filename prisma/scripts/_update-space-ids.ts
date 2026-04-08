import { config } from "dotenv";
config({ path: ".env.local" });

import { PrismaClient } from "../../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const url = process.env.DATABASE_URL as string;
const adapter = new PrismaPg({ connectionString: url });
const db = new PrismaClient({ adapter });

const mapping = [
  { ownerName: "歌丸 翔馬", spaceId: "spaces/AAQA1ONKAvc" },
  { ownerName: "藤原 靖子", spaceId: "spaces/AAQAtLNqdIc" },
  { ownerName: "吉原 悠真", spaceId: "spaces/AAQAZXqimA4" },
  { ownerName: "高橋 摩也斗", spaceId: "spaces/AAQA-qXB8rI" },
  { ownerName: "白石 亨", spaceId: "spaces/AAQALAC7WwY" },
  { ownerName: "一村 篤", spaceId: "spaces/AAQA5DWfLoE" },
  { ownerName: "片桐 脩一郎", spaceId: "spaces/AAQAglZXyhE" },
  { ownerName: "宮本 貴史", spaceId: "spaces/AAQAAUnoJwE" },
  { ownerName: "早戸禎裕", spaceId: "spaces/AAQAWNECvr8" },
  { ownerName: "森下 智司", spaceId: "spaces/AAQAkbYR4II" },
  { ownerName: "大城 崇", spaceId: "spaces/AAQAT2_JOrs" },
  { ownerName: "鈴木 啓太", spaceId: "spaces/AAQAn5FvUIA" },
  { ownerName: "七條 敬一", spaceId: "spaces/AAQAKs7kuos" },
  { ownerName: "瀬野 詠介", spaceId: "spaces/AAQAc-b0LvA" },
  { ownerName: "濱口 和朋", spaceId: "spaces/AAQAh8Wku14" },
  { ownerName: "三原 淳", spaceId: "spaces/AAQAsGlKn5c" },
  { ownerName: "木本 一心", spaceId: "spaces/AAQAAUMlEc4" },
  { ownerName: "倉田 大輔", spaceId: "spaces/AAQAxtfQtSs" },
  { ownerName: "横山 将明", spaceId: "spaces/AAQARP8u-EQ" },
  { ownerName: "高澤 健太郎", spaceId: "spaces/AAQAR7L5Y0k" },
  { ownerName: "金山 恵美", spaceId: "spaces/AAQAbXme2Us" },
  { ownerName: "齋藤 慧介", spaceId: "spaces/AAQA3TuKvwk" },
  { ownerName: "宮入 瑞志", spaceId: "spaces/AAQAQiXsCUw" },
  { ownerName: "坂東 正朗", spaceId: "spaces/AAQAoR3gb1M" },
  { ownerName: "山口 亜弓", spaceId: "spaces/AAQAmDz98iM" },
  { ownerName: "山田 一真", spaceId: "spaces/AAQACGzXMPM" },
];

async function main() {
  for (const m of mapping) {
    const company = await db.groupCompany.findFirst({
      where: { ownerName: m.ownerName },
    });
    if (company) {
      await db.groupCompany.update({
        where: { id: company.id },
        data: { chatSpaceId: m.spaceId },
      });
      console.log("更新:", company.name, "→", m.spaceId);
    } else {
      console.log("見つからず:", m.ownerName);
    }
  }

  // 有地さんを非アクティブに
  const arichi = await db.groupCompany.findFirst({
    where: { ownerName: "有地 鋭一" },
  });
  if (arichi) {
    await db.groupCompany.update({
      where: { id: arichi.id },
      data: { isActive: false },
    });
    console.log("非アクティブ化:", arichi.name);
  }

  const active = await db.groupCompany.count({ where: { isActive: true } });
  console.log("\nアクティブ企業数:", active);
}

main().then(() => process.exit(0));
