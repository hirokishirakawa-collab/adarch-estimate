import { config } from "dotenv";
config({ path: ".env.local" });

import { PrismaClient } from "../../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const url = process.env.DATABASE_URL as string;
const adapter = new PrismaPg({ connectionString: url });
const db = new PrismaClient({ adapter });

async function main() {
  const companies = await db.groupCompany.findMany({
    where: { isActive: true },
    select: { id: true, name: true, ownerName: true, linkedUsers: { select: { branchId: true, branchId2: true } } },
  });

  const allBranchIds = [
    ...new Set(
      companies.flatMap((c) =>
        c.linkedUsers.flatMap((u) => [u.branchId, u.branchId2]).filter(Boolean) as string[]
      )
    ),
  ];

  const [lc, ld, lp] = allBranchIds.length > 0
    ? await Promise.all([
        db.customer.groupBy({ by: ["branchId"], where: { branchId: { in: allBranchIds } }, _max: { updatedAt: true } }),
        db.deal.groupBy({ by: ["branchId"], where: { branchId: { in: allBranchIds } }, _max: { updatedAt: true } }),
        db.project.groupBy({ by: ["branchId"], where: { branchId: { in: allBranchIds } }, _max: { updatedAt: true } }),
      ])
    : [[], [], []];

  const branchLatest = new Map<string, Date>();
  for (const list of [lc, ld, lp]) {
    for (const row of list) {
      const d = row._max.updatedAt;
      if (!d) continue;
      const prev = branchLatest.get(row.branchId);
      if (!prev || d.getTime() > prev.getTime()) branchLatest.set(row.branchId, d);
    }
  }

  const results = companies.map((c) => {
    const bids = c.linkedUsers.flatMap((u) => [u.branchId, u.branchId2]).filter(Boolean) as string[];
    const dates = bids.map((b) => branchLatest.get(b)).filter(Boolean) as Date[];
    const latest = dates.length > 0 ? new Date(Math.max(...dates.map((d) => d.getTime()))) : null;
    return { name: c.ownerName, latest };
  });

  results.sort((a, b) => {
    if (a.latest && b.latest) return b.latest.getTime() - a.latest.getTime();
    if (a.latest) return -1;
    if (b.latest) return 1;
    return a.name.localeCompare(b.name, "ja");
  });

  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    console.log(`${i + 1}. ${r.name} | ${r.latest ? r.latest.toISOString().slice(0, 10) : "活動なし"}`);
  }
}

main().then(() => process.exit(0));
