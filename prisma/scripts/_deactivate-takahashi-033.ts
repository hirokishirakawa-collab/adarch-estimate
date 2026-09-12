import { config } from "dotenv";
config({ path: ".env.local" });
import { writeFileSync } from "fs";
import { PrismaClient } from "../../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL as string }) });

// 高橋摩也斗 #033（HALO合同会社・京都）脱退処理＝鈴木#040と同じ「無効化＋リード解放」（2026-09-09 代表決定）
const USER_ID = "cmlyqu1l500010cmmx5x8d34j";
const GC_ID = "cmmawj2440003azblkq3z1qig";
const BACKUP_DIR = process.env.HOME + "/Desktop/03_契約・法務/高橋033_脱退整理/os_backup";
const MEMO = "脱退（2026-09-07 本人申出・合意解約書送付済／2026-09-09 OS無効化・リード12件解放）";

async function main() {
  const user = await db.user.findUnique({ where: { id: USER_ID } });
  const gc = await db.groupCompany.findUnique({ where: { id: GC_ID } });
  const leads = await db.lead.findMany({ where: { assigneeId: USER_ID } });
  if (!user || !gc) throw new Error("対象が見つかりません");
  if (user.email !== "mtakahashi@adarch.co.jp" || gc.ownerName !== "高橋 摩也斗") throw new Error("対象確認に失敗");

  writeFileSync(`${BACKUP_DIR}/before_deactivate_20260909.json`, JSON.stringify({ user, groupCompany: gc, leads }, null, 2));
  console.log("バックアップ保存:", leads.length, "件のリード /", user.name, "/", gc.name);

  const releasedAt = new Date();
  const result = await db.$transaction(async (tx) => {
    const u = await tx.user.update({
      where: { id: USER_ID },
      data: { isActive: false, suspendCount: { increment: 1 }, suspendReason: "OTHER", enabledFeatures: [] },
      select: { isActive: true, suspendReason: true },
    });
    const g = await tx.groupCompany.update({
      where: { id: GC_ID },
      data: { isActive: false, memo: gc.memo ? `${gc.memo}\n${MEMO}` : MEMO },
      select: { isActive: true },
    });
    const l = await tx.lead.updateMany({
      where: { assigneeId: USER_ID },
      data: { assigneeId: null, releasedFromName: user.name ?? "高橋 摩也斗", releasedAt },
    });
    return { u, g, released: l.count };
  });
  console.log("結果:", result);

  const active = await db.groupCompany.count({ where: { isActive: true } });
  const total = await db.groupCompany.count();
  console.log(`稼働 ${active} 社 / 全体 ${total} 社`);
  const remain = await db.lead.count({ where: { assigneeId: USER_ID } });
  console.log("残担当リード:", remain);
}
main().then(() => db.$disconnect()).then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
