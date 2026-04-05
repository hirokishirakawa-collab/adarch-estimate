import { config } from "dotenv";
config({ path: ".env.local" });

import { PrismaClient, MediaType } from "../../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const url = process.env.DATABASE_URL as string;
const adapter = new PrismaPg({ connectionString: url });
const db = new PrismaClient({ adapter });

// タイトルに含まれるキーワード → MediaType
const KEYWORD_MAP: { keyword: string; mediaType: MediaType }[] = [
  { keyword: "TVer", mediaType: "TVER" },
  { keyword: "シネアド", mediaType: "CINE_AD" },
  { keyword: "イオンシネマ", mediaType: "CINE_AD" },
  { keyword: "タクシー", mediaType: "TAXI" },
  { keyword: "デジタルサイネージ", mediaType: "DIGITAL_SIGNAGE" },
  { keyword: "アパホテル", mediaType: "APA_HOTEL" },
  { keyword: "大学", mediaType: "UNIVERSITY" },
  { keyword: "すかいらーく", mediaType: "SKYLARK" },
  { keyword: "ゴルフカート", mediaType: "GOLF_CART" },
  { keyword: "Golfcart", mediaType: "GOLF_CART" },
];

async function main() {
  console.log("Course mediaType update start...");

  const courses = await db.learningCourse.findMany({
    select: { id: true, title: true, category: true, mediaType: true },
  });

  for (const course of courses) {
    if (course.mediaType) {
      console.log(`  SKIP (already set): ${course.title} → ${course.mediaType}`);
      continue;
    }

    // オンボードカテゴリは媒体紐付けなし
    if (course.category === "onboard") {
      console.log(`  SKIP (onboard): ${course.title}`);
      continue;
    }

    // タイトルからマッピング
    const match = KEYWORD_MAP.find((m) => course.title.includes(m.keyword));
    if (!match) {
      console.log(`  NO MATCH: ${course.title} (manual設定が必要)`);
      continue;
    }

    await db.learningCourse.update({
      where: { id: course.id },
      data: { mediaType: match.mediaType },
    });
    console.log(`  OK: ${course.title} → ${match.mediaType}`);
  }

  console.log("Done!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
