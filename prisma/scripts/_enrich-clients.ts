// 取引先マップの補完を手元から一括で回す（本番DB・Railway の API キーを環境変数で渡す）
//   GOOGLE_PLACES_API_KEY=... GBIZINFO_API_TOKEN=... DATABASE_URL=... npx tsx prisma/scripts/_enrich-clients.ts [limit] [--force]
import { runClientEnrich } from "../../src/lib/clients/enrich";

const limit = Number(process.argv[2]) || 500;
const force = process.argv.includes("--force");
const idsArg = process.argv.find((a) => a.startsWith("--ids="));
const customerIds = idsArg ? idsArg.slice(6).split(",").filter(Boolean) : undefined;
const only = process.argv.includes("--places") ? "places" : process.argv.includes("--profile") ? "profile" : undefined;
runClientEnrich({ limit, force, only, customerIds, concurrency: 3, log: (l) => console.log(l) })
  .then((s) => { console.log("DONE", JSON.stringify(s)); process.exit(0); })
  .catch((e) => { console.error(e); process.exit(1); });
