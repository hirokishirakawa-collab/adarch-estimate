// Google Drive 実績フォルダ → ClientWork。本体は src/lib/clients/drive-import.ts（毎朝の cron と同じ処理）
//   DATABASE_URL=… npx tsx prisma/scripts/import-drive-works.ts [--dry]
import { importDriveWorks } from "../../src/lib/clients/drive-import";
importDriveWorks({ dry: process.argv.includes("--dry") })
  .then((s) => { console.log(JSON.stringify(s)); process.exit(0); })
  .catch((e) => { console.error(e); process.exit(1); });
