// ==============================================================
// 旧コーポレートサイトの制作実績（works.json）を ClientWork に取り込む
//
//   npx tsx prisma/scripts/import-client-works.ts [--dry]
//
//   - サムネイルは public/works/ に置いてある前提（Git 管理）
//   - クライアント名を顧客管理と突合し、一致したら customerId を付ける
//   - 一致しないクライアントは 本部（branch_hq）の顧客として登録する
//     （source="WORKS_ARCHIVE"・notes に出所を書く＝後から見分けて消せる）
//   - 何度実行しても同じ結果（sourceId で upsert）
// ==============================================================

import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { PrismaClient } from "../../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { normalizeCompanyName, isSameCompany } from "../../src/lib/clients/normalize";

const WORKS_JSON = "/Users/hirokishirakawa/adarch-corporate/works.json";
const PUBLIC_WORKS = path.join(process.cwd(), "public", "works");
const HQ_BRANCH_ID = "branch_hq";
const DRY = process.argv.includes("--dry");

/** 実績ページの表記 → 顧客管理で使う社名（同じ会社の別表記） */
const ALIASES: Record<string, string> = {
  "RENOFA YAMAGUCHI FC": "レノファ山口",
  "TV Asahi": "ABC朝日放送",
};

/** 実績ページに書かれたクライアント名から、登録する社名（先頭1社）を決める */
function primaryClient(raw: string): string | null {
  const first = raw.split(/\s*[|｜/／]\s*/)[0]?.trim() ?? "";
  if (!first) return null;
  return ALIASES[first] ?? first;
}

interface Work { id: string; title: string; titleJp: string | null; client: string; category: string; year: number; thumbnail: string; video: string | null }

async function main() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
  const db = new PrismaClient({ adapter });

  const works: Work[] = JSON.parse(readFileSync(WORKS_JSON, "utf8"));
  const customers = await db.customer.findMany({ select: { id: true, name: true, branchId: true } });

  const created = new Map<string, string>(); // 正規化社名 → customerId（この実行で作ったもの）
  let linked = 0, made = 0, skipped = 0, upserted = 0;

  for (const w of works) {
    const client = primaryClient(w.client);
    const thumbFile = path.basename(w.thumbnail);
    const thumbnail = `/works/${thumbFile}`;
    if (!existsSync(path.join(PUBLIC_WORKS, thumbFile))) {
      console.warn(`サムネ無し: ${w.id} ${w.thumbnail}`);
    }

    let customerId: string | null = null;
    if (client) {
      const key = normalizeCompanyName(client);
      const hit = customers.find((c) => isSameCompany(c.name, client));
      if (hit) {
        customerId = hit.id;
        linked++;
      } else if (created.has(key)) {
        customerId = created.get(key)!;
      } else if (!DRY) {
        const c = await db.customer.create({
          data: {
            name: client,
            branchId: HQ_BRANCH_ID,
            status: "ACTIVE",
            rank: "B",
            source: "WORKS_ARCHIVE",
            notes: `旧コーポレートサイトの制作実績（${w.year}年「${w.titleJp ?? w.title}」）から登録`,
            staffName: "本部（実績取込）",
          },
          select: { id: true },
        });
        created.set(key, c.id);
        customerId = c.id;
        made++;
        console.log(`＋ 顧客を新規登録: ${client}`);
      } else {
        created.set(key, "dry");
        made++;
        console.log(`(dry) 新規登録予定: ${client}`);
      }
    } else {
      skipped++;
    }

    if (!DRY) {
      await db.clientWork.upsert({
        where: { sourceId: w.id },
        create: {
          sourceId: w.id, clientName: w.client, title: w.title, titleJp: w.titleJp,
          category: w.category, year: w.year, thumbnail, videoUrl: w.video, customerId,
        },
        update: { clientName: w.client, title: w.title, titleJp: w.titleJp, category: w.category, year: w.year, thumbnail, videoUrl: w.video, customerId },
      });
      upserted++;
    }
  }

  console.log(`実績 ${works.length}本 → 取込 ${upserted}／既存顧客に紐づけ ${linked}／顧客を新規登録 ${made}／クライアント名なし ${skipped}${DRY ? "（dry run）" : ""}`);
  await db.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
