import { config } from "dotenv";
config({ path: ".env.local" });
import { PrismaClient } from "../../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL as string }) });

async function main() {
  for (const email of ["morishita_rocks@adarch.co.jp", "arichi_rocks@adarch.co.jp"]) {
    console.log("\n=====", email);
    const u = await db.user.findUnique({ where: { email }, include: { branch: true, branch2: true, groupCompany: true } });
    if (!u) { console.log("users: なし"); }
    else {
      console.log("users:", { id: u.id, name: u.name, role: u.role, isActive: u.isActive, suspendReason: u.suspendReason, enabledFeatures: u.enabledFeatures, branch: u.branch?.name, branch2: u.branch2?.name, groupCompany: u.groupCompany ? { id: u.groupCompany.id, name: u.groupCompany.name, isActive: u.groupCompany.isActive } : null });
      const counts: Record<string, number> = {};
      counts.leadsAssigned = await db.lead.count({ where: { assigneeId: u.id } }).catch(() => -1);
      counts.leadsCreated = await db.lead.count({ where: { createdById: u.id } }).catch(() => -1);
      counts.dealsAssigned = await db.deal.count({ where: { assignedToId: u.id } }).catch(() => -1);
      counts.dealsCreated = await db.deal.count({ where: { createdById: u.id } }).catch(() => -1);
      counts.revenueReports = await db.revenueReport.count({ where: { userId: u.id } }).catch(() => -1);
      counts.invoiceRequests = await db.invoiceRequest.count({ where: { userId: u.id } }).catch(() => -1);
      counts.paymentStatements = await db.paymentStatement.count({ where: { userId: u.id } }).catch(() => -1);
      counts.groupInvoices = await db.groupInvoice.count({ where: { userId: u.id } }).catch(() => -1);
      counts.businessCards = await db.businessCard.count({ where: { ownerId: u.id } }).catch(() => -1);
      console.log("関連件数:", counts);
    }
    const name = email.startsWith("morishita") ? "森下" : "有地";
    const gcs = await db.groupCompany.findMany({ where: { OR: [{ ownerName: { contains: name } }, { name: { contains: name } }] } });
    console.log("group_companies:", gcs.map(g => ({ id: g.id, name: g.name, owner: g.ownerName, email: g.email, prefecture: (g as any).prefecture, isActive: g.isActive, memo: g.memo })));
    const brs = await db.branch.findMany({ where: { name: { contains: name } } });
    console.log("branches:", brs.map(b => ({ id: b.id, name: b.name, isActive: (b as any).isActive })));
  }
  const act = await db.groupCompany.count({ where: { isActive: true } });
  console.log("\n稼働group_companies:", act, "/ 全", await db.groupCompany.count());
}
main().then(() => db.$disconnect()).then(() => process.exit(0));
