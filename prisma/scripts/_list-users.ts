import { config } from "dotenv";
config({ path: ".env.local" });

import { PrismaClient } from "../../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const url = process.env.DATABASE_URL as string;
const adapter = new PrismaPg({ connectionString: url });
const db = new PrismaClient({ adapter });

async function main() {
  const users = await db.user.findMany({
    select: {
      name: true,
      branch: { select: { name: true } },
    },
    orderBy: { name: "asc" },
  });
  for (const u of users) {
    console.log((u.name || "(名前なし)") + " | " + (u.branch?.name || "本部"));
  }
}

main().then(() => process.exit(0));
