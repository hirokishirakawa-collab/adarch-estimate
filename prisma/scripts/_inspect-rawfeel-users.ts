import { config } from "dotenv";
config({ path: ".env.local" });

import { PrismaClient } from "../../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const url = process.env.DATABASE_URL as string;
const adapter = new PrismaPg({ connectionString: url });
const db = new PrismaClient({ adapter });

const TARGETS = ["rawfeel_tominaga@adarch.co.jp", "tomohito@adarch.co.jp"];

async function main() {
  for (const email of TARGETS) {
    const u = await db.user.findUnique({
      where: { email },
      include: { branch: true, branch2: true, groupCompany: true },
    });
    console.log("\n==================================================");
    console.log("email:", email);
    if (!u) {
      console.log("  → 該当ユーザーなし（既に存在しない）");
      continue;
    }
    console.log("  id:", u.id);
    console.log("  name:", u.name);
    console.log("  role:", u.role, "| isActive:", u.isActive);
    console.log("  branch:", u.branch?.name || "本部", "| branch2:", u.branch2?.name || "-");
    console.log("  groupCompany:", u.groupCompany?.name || "-");

    const id = u.id;
    const counts: Record<string, number> = {
      assignedDeals: await db.deal.count({ where: { assignedToId: id } }),
      createdDeals: await db.deal.count({ where: { createdById: id } }),
      lockedCustomers: await db.customer.count({ where: { lockedByUserId: id } }),
      revenueReports: await db.revenueReport.count({ where: { createdById: id } }),
      invoiceRequests: await db.invoiceRequest.count({ where: { createdById: id } }),
      paymentStatements: await db.paymentStatement.count({ where: { createdById: id } }),
      groupInvoices: await db.groupInvoice.count({ where: { createdById: id } }),
      mediaRequests: await db.mediaRequest.count({ where: { createdById: id } }),
      leadsAssigned: await db.lead.count({ where: { assigneeId: id } }),
      leadsCreated: await db.lead.count({ where: { createdById: id } }),
      notifications: await db.notification.count({ where: { userId: id } }),
      learningEnrollments: await db.learningEnrollment.count({ where: { userId: id } }),
    };
    console.log("  --- 紐づくレコード件数 ---");
    let total = 0;
    for (const [k, v] of Object.entries(counts)) {
      if (v > 0) console.log(`    ${k}: ${v}`);
      total += v;
    }
    console.log(`  === 主要リレーション合計: ${total} 件 ===`);
  }
}

main()
  .catch((e) => {
    console.error("ERROR:", e.message);
    process.exit(1);
  })
  .then(() => process.exit(0));
