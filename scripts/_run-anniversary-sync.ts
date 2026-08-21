// 周年ファインダーの同期を手で回す（cronを待たずに実行したいとき）
//   npx dotenv-cli -e .env.local -- npx tsx scripts/_run-anniversary-sync.ts
// 1回の実行でサイト巡回は80件まで。未確認分は次回に持ち越されるので、
// 初回は何度か繰り返すと母集団が一通り埋まる。
import { runAnniversarySync } from "@/lib/anniversary/sync";

runAnniversarySync()
  .then((s) => {
    console.log("=== 同期結果 ===");
    console.log(JSON.stringify(s, null, 2));
    process.exit(0);
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
