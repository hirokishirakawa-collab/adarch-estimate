export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// ---------------------------------------------------------------
// GET /api/run-migration
// Headers: Authorization: Bearer {CRON_SECRET}
// 本番DBに VideoAchievement テーブルを作成する一回限りのエンドポイント
// ---------------------------------------------------------------
export async function GET(_req: NextRequest) {

  try {
    // テーブル作成
    await db.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "VideoAchievement" (
        "id"                TEXT        NOT NULL,
        "companyName"       TEXT        NOT NULL,
        "prefecture"        TEXT        NOT NULL,
        "industry"          TEXT        NOT NULL DEFAULT '不明',
        "productionCompany" TEXT        NOT NULL,
        "videoType"         TEXT        NOT NULL DEFAULT '不明',
        "referenceUrl"      TEXT,
        "contentSummary"    TEXT,
        "sourceUrl"         TEXT,
        "publishedAt"       TEXT,
        "isProcessed"       BOOLEAN     NOT NULL DEFAULT false,
        "createdById"       TEXT,
        "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "VideoAchievement_pkey" PRIMARY KEY ("id")
      )
    `);

    // インデックス
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

    // 外部キー（既存なら無視）
    await db.$executeRawUnsafe(`
      DO $$ BEGIN
        ALTER TABLE "VideoAchievement"
          ADD CONSTRAINT "VideoAchievement_createdById_fkey"
          FOREIGN KEY ("createdById") REFERENCES "users"("id")
          ON DELETE SET NULL ON UPDATE CASCADE;
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$
    `);

    // publishedAt カラム（既存なら無視）
    await db.$executeRawUnsafe(`
      ALTER TABLE "VideoAchievement"
        ADD COLUMN IF NOT EXISTS "publishedAt" TEXT
    `);

    return NextResponse.json({ ok: true, message: "マイグレーション完了" });
  } catch (e) {
    console.error("[run-migration]", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
