export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import type { UserRole } from "@/types/roles";

// ---------------------------------------------------------------
// 47都道府県 Branch マスタ
// ---------------------------------------------------------------
const PREFECTURES = [
  { id: "pref_hokkaido",  name: "北海道",   code: "P01" },
  { id: "pref_aomori",    name: "青森県",   code: "P02" },
  { id: "pref_iwate",     name: "岩手県",   code: "P03" },
  { id: "pref_miyagi",    name: "宮城県",   code: "P04" },
  { id: "pref_akita",     name: "秋田県",   code: "P05" },
  { id: "pref_yamagata",  name: "山形県",   code: "P06" },
  { id: "pref_fukushima", name: "福島県",   code: "P07" },
  { id: "pref_ibaraki",   name: "茨城県",   code: "P08" },
  { id: "pref_tochigi",   name: "栃木県",   code: "P09" },
  { id: "pref_gunma",     name: "群馬県",   code: "P10" },
  { id: "pref_saitama",   name: "埼玉県",   code: "P11" },
  { id: "pref_chiba",     name: "千葉県",   code: "P12" },
  { id: "pref_tokyo",     name: "東京都",   code: "P13" },
  { id: "pref_kanagawa",  name: "神奈川県", code: "P14" },
  { id: "pref_niigata",   name: "新潟県",   code: "P15" },
  { id: "pref_toyama",    name: "富山県",   code: "P16" },
  { id: "pref_ishikawa",  name: "石川県",   code: "P17" },
  { id: "pref_fukui",     name: "福井県",   code: "P18" },
  { id: "pref_yamanashi", name: "山梨県",   code: "P19" },
  { id: "pref_nagano",    name: "長野県",   code: "P20" },
  { id: "pref_gifu",      name: "岐阜県",   code: "P21" },
  { id: "pref_shizuoka",  name: "静岡県",   code: "P22" },
  { id: "pref_aichi",     name: "愛知県",   code: "P23" },
  { id: "pref_mie",       name: "三重県",   code: "P24" },
  { id: "pref_shiga",     name: "滋賀県",   code: "P25" },
  { id: "pref_kyoto",     name: "京都府",   code: "P26" },
  { id: "pref_osaka",     name: "大阪府",   code: "P27" },
  { id: "pref_hyogo",     name: "兵庫県",   code: "P28" },
  { id: "pref_nara",      name: "奈良県",   code: "P29" },
  { id: "pref_wakayama",  name: "和歌山県", code: "P30" },
  { id: "pref_tottori",   name: "鳥取県",   code: "P31" },
  { id: "pref_shimane",   name: "島根県",   code: "P32" },
  { id: "pref_okayama",   name: "岡山県",   code: "P33" },
  { id: "pref_hiroshima", name: "広島県",   code: "P34" },
  { id: "pref_yamaguchi", name: "山口県",   code: "P35" },
  { id: "pref_tokushima", name: "徳島県",   code: "P36" },
  { id: "pref_kagawa",    name: "香川県",   code: "P37" },
  { id: "pref_ehime",     name: "愛媛県",   code: "P38" },
  { id: "pref_kochi",     name: "高知県",   code: "P39" },
  { id: "pref_fukuoka",   name: "福岡県",   code: "P40" },
  { id: "pref_saga",      name: "佐賀県",   code: "P41" },
  { id: "pref_nagasaki",  name: "長崎県",   code: "P42" },
  { id: "pref_kumamoto",  name: "熊本県",   code: "P43" },
  { id: "pref_oita",      name: "大分県",   code: "P44" },
  { id: "pref_miyazaki",  name: "宮崎県",   code: "P45" },
  { id: "pref_kagoshima", name: "鹿児島県", code: "P46" },
  { id: "pref_okinawa",   name: "沖縄県",   code: "P47" },
];

// ---------------------------------------------------------------
// GET /api/run-migration
// ---------------------------------------------------------------
export async function GET(_req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const role = (session.user.role ?? "USER") as UserRole;
  if (role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const results: string[] = [];

  try {
    // ── 1. branchId2 カラム追加 ──────────────────────────────────
    await db.$executeRawUnsafe(`
      ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "branchId2" TEXT
    `);
    results.push("branchId2 カラム追加 OK");

    await db.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "users_branchId2_idx" ON "users"("branchId2")
    `);
    results.push("users_branchId2_idx インデックス OK");

    await db.$executeRawUnsafe(`
      DO $$ BEGIN
        ALTER TABLE "users"
          ADD CONSTRAINT "users_branchId2_fkey"
          FOREIGN KEY ("branchId2") REFERENCES "branches"("id")
          ON DELETE SET NULL ON UPDATE CASCADE;
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$
    `);
    results.push("users_branchId2_fkey FK OK");

    // ── 2. 既存14拠点の確保（なければ作成）──────────────────────
    const LEGACY_BRANCHES = [
      { id: "branch_hq",  name: "本部",          code: "HQ"  },
      { id: "branch_isk", name: "石川",           code: "ISK" },
      { id: "branch_kgo", name: "香川・岡山",     code: "KGO" },
      { id: "branch_kyt", name: "京都",           code: "KYT" },
      { id: "branch_tky", name: "東京（片桐）",   code: "TKY" },
      { id: "branch_ymc", name: "山口・広島",     code: "YMC" },
      { id: "branch_hkd", name: "北海道",         code: "HKD" },
      { id: "branch_tk2", name: "東京（白石）",   code: "TK2" },
      { id: "branch_kns", name: "関西（宮本）",   code: "KNS" },
      { id: "branch_okn", name: "沖縄",           code: "OKN" },
      { id: "branch_tks", name: "徳島",           code: "TKS" },
      { id: "branch_ibk", name: "茨城",           code: "IBK" },
      { id: "branch_fku", name: "福岡",           code: "FKU" },
      { id: "branch_knw", name: "神奈川",         code: "KNW" },
    ];

    for (const b of LEGACY_BRANCHES) {
      await db.$executeRawUnsafe(`
        INSERT INTO "branches" ("id","name","code","isActive","createdAt","updatedAt")
        VALUES ($1,$2,$3,true,NOW(),NOW())
        ON CONFLICT ("id") DO NOTHING
      `, b.id, b.name, b.code);
    }
    results.push(`既存14拠点 確保 OK`);

    // ── 3. 47都道府県を Branch に追加（なければ作成）─────────────
    let prefCount = 0;
    for (const p of PREFECTURES) {
      await db.$executeRawUnsafe(`
        INSERT INTO "branches" ("id","name","code","isActive","createdAt","updatedAt")
        VALUES ($1,$2,$3,true,NOW(),NOW())
        ON CONFLICT ("id") DO NOTHING
      `, p.id, p.name, p.code);
      prefCount++;
    }
    results.push(`47都道府県 Branch 追加 OK (${prefCount}件)`);

    // ── 4. VideoAchievement（既存マイグレーション・冪等）────────
    await db.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "VideoAchievement" (
        "id" TEXT NOT NULL,
        "companyName" TEXT NOT NULL,
        "prefecture" TEXT NOT NULL,
        "industry" TEXT NOT NULL DEFAULT '不明',
        "productionCompany" TEXT NOT NULL,
        "videoType" TEXT NOT NULL DEFAULT '不明',
        "referenceUrl" TEXT,
        "contentSummary" TEXT,
        "sourceUrl" TEXT,
        "publishedAt" TEXT,
        "isProcessed" BOOLEAN NOT NULL DEFAULT false,
        "createdById" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "VideoAchievement_pkey" PRIMARY KEY ("id")
      )
    `);
    await db.$executeRawUnsafe(`
      CREATE UNIQUE INDEX IF NOT EXISTS "VideoAchievement_companyName_productionCompany_key"
        ON "VideoAchievement"("companyName","productionCompany")
    `);
    await db.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "VideoAchievement_prefecture_idx" ON "VideoAchievement"("prefecture")
    `);
    await db.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "VideoAchievement_industry_idx" ON "VideoAchievement"("industry")
    `);
    await db.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "VideoAchievement_isProcessed_idx" ON "VideoAchievement"("isProcessed")
    `);
    await db.$executeRawUnsafe(`
      DO $$ BEGIN
        ALTER TABLE "VideoAchievement"
          ADD CONSTRAINT "VideoAchievement_createdById_fkey"
          FOREIGN KEY ("createdById") REFERENCES "users"("id")
          ON DELETE SET NULL ON UPDATE CASCADE;
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$
    `);
    await db.$executeRawUnsafe(`
      ALTER TABLE "VideoAchievement" ADD COLUMN IF NOT EXISTS "publishedAt" TEXT
    `);
    results.push("VideoAchievement テーブル OK");

    return NextResponse.json({ ok: true, results });
  } catch (e) {
    console.error("[run-migration]", e);
    return NextResponse.json({ error: String(e), results }, { status: 500 });
  }
}
