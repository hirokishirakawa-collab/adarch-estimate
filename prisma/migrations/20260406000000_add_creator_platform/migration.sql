-- CreateEnum
CREATE TYPE "CreatorStatus" AS ENUM ('ACTIVE', 'BANNED', 'SHADOW_BANNED', 'INACTIVE');
CREATE TYPE "SkillLevel" AS ENUM ('BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'EXPERT');
CREATE TYPE "RepeatIntention" AS ENUM ('EXCELLENT', 'GOOD', 'FAIR', 'POOR');
CREATE TYPE "ConsultationStatus" AS ENUM ('DRAFT', 'SENT', 'CLOSED');

-- CreateTable: creators
CREATE TABLE "creators" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameKana" TEXT,
    "phone" TEXT,
    "prefecture" TEXT NOT NULL,
    "city" TEXT,
    "companyName" TEXT,
    "website" TEXT,
    "bio" TEXT,
    "profileImage" TEXT,
    "yearsOfExp" INTEGER,
    "dayRate" INTEGER,
    "halfDayRate" INTEGER,
    "availability" INTEGER,
    "equipment" TEXT,
    "status" "CreatorStatus" NOT NULL DEFAULT 'ACTIVE',
    "otpCode" TEXT,
    "otpExpiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "creators_pkey" PRIMARY KEY ("id")
);

-- CreateTable: skill_categories
CREATE TABLE "skill_categories" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "skill_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable: creator_skills
CREATE TABLE "creator_skills" (
    "id" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "level" "SkillLevel" NOT NULL,
    "note" TEXT,
    CONSTRAINT "creator_skills_pkey" PRIMARY KEY ("id")
);

-- CreateTable: creator_portfolios
CREATE TABLE "creator_portfolios" (
    "id" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "title" TEXT,
    "description" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "creator_portfolios_pkey" PRIMARY KEY ("id")
);

-- CreateTable: creator_ndas
CREATE TABLE "creator_ndas" (
    "id" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "agreedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ipAddress" TEXT NOT NULL,
    "userAgent" TEXT,
    "ndaVersion" TEXT NOT NULL DEFAULT '1.0',
    "signatureHash" TEXT NOT NULL,
    CONSTRAINT "creator_ndas_pkey" PRIMARY KEY ("id")
);

-- CreateTable: creator_ratings
CREATE TABLE "creator_ratings" (
    "id" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "personality" INTEGER NOT NULL,
    "actualSkill" INTEGER NOT NULL,
    "responseSpeed" INTEGER NOT NULL,
    "deadlineCompliance" INTEGER NOT NULL,
    "repeatIntention" "RepeatIntention" NOT NULL,
    "videoInterviewed" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "ratedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "creator_ratings_pkey" PRIMARY KEY ("id")
);

-- CreateTable: creator_analyses
CREATE TABLE "creator_analyses" (
    "id" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "works" JSONB,
    "genres" TEXT[],
    "clientScale" TEXT,
    "estimatedRate" INTEGER,
    "priceRange" TEXT,
    "equipmentList" TEXT[],
    "snsFollowers" JSONB,
    "lastWorkDate" TIMESTAMP(3),
    "activityScore" INTEGER,
    "scrapedAt" TIMESTAMP(3),
    "scrapeStatus" TEXT,
    "rawHtml" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "creator_analyses_pkey" PRIMARY KEY ("id")
);

-- CreateTable: project_consultations
CREATE TABLE "project_consultations" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "area" TEXT,
    "skillFilter" TEXT,
    "budgetRange" TEXT,
    "shootDate" TEXT,
    "status" "ConsultationStatus" NOT NULL DEFAULT 'DRAFT',
    "sendMode" TEXT,
    "sentAt" TIMESTAMP(3),
    "sentById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "project_consultations_pkey" PRIMARY KEY ("id")
);

-- CreateTable: consultation_recipients
CREATE TABLE "consultation_recipients" (
    "id" TEXT NOT NULL,
    "consultationId" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "emailSentAt" TIMESTAMP(3),
    "opened" BOOLEAN NOT NULL DEFAULT false,
    "responded" BOOLEAN NOT NULL DEFAULT false,
    "responseNote" TEXT,
    CONSTRAINT "consultation_recipients_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "creators_email_key" ON "creators"("email");
CREATE INDEX "creators_status_idx" ON "creators"("status");
CREATE INDEX "creators_prefecture_idx" ON "creators"("prefecture");

CREATE UNIQUE INDEX "skill_categories_name_key" ON "skill_categories"("name");

CREATE UNIQUE INDEX "creator_skills_creatorId_categoryId_key" ON "creator_skills"("creatorId", "categoryId");
CREATE INDEX "creator_skills_categoryId_idx" ON "creator_skills"("categoryId");

CREATE INDEX "creator_portfolios_creatorId_idx" ON "creator_portfolios"("creatorId");

CREATE UNIQUE INDEX "creator_ndas_creatorId_key" ON "creator_ndas"("creatorId");

CREATE INDEX "creator_ratings_creatorId_idx" ON "creator_ratings"("creatorId");

CREATE UNIQUE INDEX "creator_analyses_creatorId_key" ON "creator_analyses"("creatorId");

CREATE UNIQUE INDEX "consultation_recipients_consultationId_creatorId_key" ON "consultation_recipients"("consultationId", "creatorId");
CREATE INDEX "consultation_recipients_creatorId_idx" ON "consultation_recipients"("creatorId");

-- AddForeignKey
ALTER TABLE "creator_skills" ADD CONSTRAINT "creator_skills_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "creators"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "creator_skills" ADD CONSTRAINT "creator_skills_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "skill_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "creator_portfolios" ADD CONSTRAINT "creator_portfolios_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "creators"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "creator_ndas" ADD CONSTRAINT "creator_ndas_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "creators"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "creator_ratings" ADD CONSTRAINT "creator_ratings_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "creators"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "creator_analyses" ADD CONSTRAINT "creator_analyses_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "creators"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "project_consultations" ADD CONSTRAINT "project_consultations_sentById_fkey" FOREIGN KEY ("sentById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "consultation_recipients" ADD CONSTRAINT "consultation_recipients_consultationId_fkey" FOREIGN KEY ("consultationId") REFERENCES "project_consultations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "consultation_recipients" ADD CONSTRAINT "consultation_recipients_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "creators"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Seed: skill_categories
INSERT INTO "skill_categories" ("id", "name", "order") VALUES
  ('cat_shooting',    '撮影（カメラマン）',        1),
  ('cat_editing',     '編集（エディター）',        2),
  ('cat_motion',      'モーショングラフィックス',    3),
  ('cat_color',       'カラーグレーディング',       4),
  ('cat_drone',       'ドローン撮影',             5),
  ('cat_audio',       '音声収録・MA',             6),
  ('cat_narration',   'ナレーション',              7),
  ('cat_direction',   'ディレクション',            8),
  ('cat_planning',    '企画・脚本',               9),
  ('cat_3dcg',        '3DCG・VFX',              10);
