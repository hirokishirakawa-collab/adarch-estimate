import { config } from "dotenv";
config({ path: ".env.local" });

import { PrismaClient } from "../../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { writeFileSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const url = process.env.DATABASE_URL as string;
const adapter = new PrismaPg({ connectionString: url });
const db = new PrismaClient({ adapter });

const RAWFEEL_ID = "cmno0lcac0000xzbl68iqzkne";
const BACKUP_DIR = join(
  homedir(),
  "Desktop",
  "03_契約・法務",
  "Rawfeel_解約整理",
  "os_backup",
);

// --dry-run で削除せず件数とバックアップのみ
const DRY_RUN = process.argv.includes("--dry-run");

async function main() {
  const company = await db.groupCompany.findUnique({ where: { id: RAWFEEL_ID } });
  if (!company) {
    console.log("GroupCompany が見つかりません（既に削除済み）:", RAWFEEL_ID);
    return;
  }

  // Cascade で消える子レコードを全件取得
  const [
    weeklySubmissions,
    contactHistories,
    paymentStatements,
    groupInvoices,
    royaltyAdjustments,
    postedRequests,
    applications,
    salesInsights,
    salesApproaches,
    partnerStatuses,
    partnerStatusLogs,
    partnerScores,
    collaborationMembers,
  ] = await Promise.all([
    db.weeklySubmission.findMany({ where: { groupCompanyId: RAWFEEL_ID } }),
    db.contactHistory.findMany({ where: { groupCompanyId: RAWFEEL_ID } }),
    db.paymentStatement.findMany({ where: { groupCompanyId: RAWFEEL_ID } }),
    // schema.prisma に未適用のカラム（cancelledAt 等）があるため生SQLで取得
    db.$queryRaw`SELECT * FROM group_invoices WHERE "groupCompanyId" = ${RAWFEEL_ID}`,
    db.royaltyAdjustment.findMany({ where: { groupCompanyId: RAWFEEL_ID } }),
    db.projectRequest.findMany({ where: { postedByCompanyId: RAWFEEL_ID } }),
    db.projectApplication.findMany({ where: { applicantCompanyId: RAWFEEL_ID } }),
    db.salesInsight.findMany({ where: { groupCompanyId: RAWFEEL_ID } }),
    db.salesApproach.findMany({ where: { groupCompanyId: RAWFEEL_ID } }),
    db.partnerStatus.findMany({ where: { groupCompanyId: RAWFEEL_ID } }),
    db.partnerStatusLog.findMany({ where: { groupCompanyId: RAWFEEL_ID } }),
    db.partnerScore.findMany({ where: { groupCompanyId: RAWFEEL_ID } }),
    db.collaborationHighlightMember.findMany({ where: { groupCompanyId: RAWFEEL_ID } }),
  ]);

  // SetNull（消えずに参照だけ外れる）
  const linkedUsers = await db.user.findMany({
    where: { groupCompanyId: RAWFEEL_ID },
    select: { id: true, email: true, name: true, isActive: true },
  });
  const matchedRequests = await db.projectRequest.findMany({
    where: { matchedCompanyId: RAWFEEL_ID },
    select: { id: true, title: true },
  });
  const violationReports = await db.violationReport.findMany({
    where: { reporterCompanyId: RAWFEEL_ID },
    select: { id: true },
  });

  const payload = {
    exportedAt: new Date().toISOString(),
    company,
    cascadeDeleted: {
      weeklySubmissions,
      contactHistories,
      paymentStatements,
      groupInvoices,
      royaltyAdjustments,
      postedRequests,
      applications,
      salesInsights,
      salesApproaches,
      partnerStatuses,
      partnerStatusLogs,
      partnerScores,
      collaborationMembers,
    },
    setNullOnly: { linkedUsers, matchedRequests, violationReports },
  };

  console.log(`=== ${company.name}（${company.ownerName}）===`);
  console.log("--- 一緒に削除される（Cascade）---");
  for (const [k, v] of Object.entries(payload.cascadeDeleted)) {
    console.log(`  ${k}: ${(v as unknown[]).length} 件`);
  }
  console.log("--- 参照が外れるだけ（SetNull・行は残る）---");
  console.log(`  linkedUsers: ${linkedUsers.length} 名`, linkedUsers.map((u) => u.email).join(", "));
  console.log(`  matchedRequests: ${matchedRequests.length} 件`);
  console.log(`  violationReports: ${violationReports.length} 件`);

  mkdirSync(BACKUP_DIR, { recursive: true });
  const file = join(BACKUP_DIR, "rawfeel_group_company_dump.json");
  writeFileSync(file, JSON.stringify(payload, null, 2), "utf8");
  console.log("\nバックアップ:", file);

  if (DRY_RUN) {
    console.log("\n--dry-run のため削除していません。");
    return;
  }

  await db.groupCompany.delete({ where: { id: RAWFEEL_ID } });
  console.log("\n削除しました:", company.name);

  const remaining = await db.groupCompany.findMany({
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
    select: { name: true, isActive: true },
  });
  console.log(
    "稼働:",
    remaining.filter((c) => c.isActive).length,
    "社 / 全体:",
    remaining.length,
    "社",
  );
}

main()
  .then(() => db.$disconnect())
  .then(() => process.exit(0));
