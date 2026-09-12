import { config } from "dotenv";
config({ path: ".env.local" });
import { PrismaClient } from "../../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL as string }) });

const TARGETS = [
  { label: "森下 user", table: "users", id: "cmm1cm8yg00000cukt50ow1b7" },
  { label: "森下 company", table: "group_companies", id: "cmmawj56f0009azblevvty71q" },
  { label: "有地 user", table: "users", id: "cmm36ljyr00010cryrovqem6i" },
  { label: "有地 company", table: "group_companies", id: "cmmawj6pl000cazblq12z9bw4" },
];
async function main() {
  const fks: any[] = await db.$queryRawUnsafe(`
    SELECT tc.table_name, kcu.column_name, ccu.table_name AS ref_table, rc.delete_rule
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu ON tc.constraint_name=kcu.constraint_name
    JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name=ccu.constraint_name
    JOIN information_schema.referential_constraints rc ON tc.constraint_name=rc.constraint_name
    WHERE tc.constraint_type='FOREIGN KEY' AND tc.table_schema='public' AND ccu.table_schema='public' AND ccu.table_name IN ('users','group_companies')`);
  for (const t of TARGETS) {
    console.log("\n=====", t.label, t.id);
    for (const fk of fks.filter(f => f.ref_table === t.table)) {
      const r: any[] = await db.$queryRawUnsafe(`SELECT count(*)::int AS n FROM "${fk.table_name}" WHERE "${fk.column_name}" = $1`, t.id);
      if (r[0].n > 0) console.log(`  ${fk.table_name}.${fk.column_name} = ${r[0].n} (${fk.delete_rule})`);
    }
  }
}
main().then(() => db.$disconnect()).then(() => process.exit(0));
