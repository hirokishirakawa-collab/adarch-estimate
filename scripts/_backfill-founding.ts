// 未調査リードの設立・創業年を一気に埋める（初回の母集団づくり用）
//   npx dotenv-cli -e .env.local -- npx tsx scripts/_backfill-founding.ts
// 日次同期は80件ずつだが、これは残りが無くなるまで回し続ける。
// 1件ずつ保存しているので、途中で止めても進んだ分は残る。
import { runFoundingCrawl } from "@/lib/anniversary/crawl";
import { db } from "@/lib/db";

async function main() {
  let round = 0;
  for (;;) {
    round++;
    const stats = await runFoundingCrawl(300, 6);
    if (stats.targeted === 0) {
      console.log("未調査なし。完了。");
      break;
    }
    const remaining = await db.lead.count({
      where: { foundedCheckedAt: null, websiteUrl: { not: null } },
    });
    const filled = await db.lead.count({ where: { foundedYear: { not: null } } });
    console.log(
      `[${round}周目] 巡回${stats.targeted} / 取得${stats.found} / 記載なし${stats.notFound} ` +
        `→ 累計 設立年あり${filled}社・残り${remaining}社`
    );
  }
}
main()
  .catch((e) => console.error(e))
  .finally(() => db.$disconnect());
