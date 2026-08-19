// 補助金ファインダーの同期を手で回す（cronを待たずに実行したいとき）
//   npx dotenv-cli -e .env.local -- npx tsx scripts/_run-subsidy-sync.ts
// 1回の実行でAI判定は120件まで。未判定分は次回に持ち越されるので、
// 初回は数回繰り返すと母集団が一通り埋まる。
import { runSubsidySync } from "@/lib/subsidy/sync";

runSubsidySync()
  .then((s) => {
    console.log("=== 同期結果 ===");
    console.log(JSON.stringify(s, null, 2));
    process.exit(0);
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
