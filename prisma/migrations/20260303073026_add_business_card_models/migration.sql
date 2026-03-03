-- CreateEnum
CREATE TYPE "DisclosureStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "business_cards" (
    "id" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "department" TEXT,
    "title" TEXT,
    "lastName" TEXT NOT NULL,
    "firstName" TEXT,
    "lastNameKana" TEXT,
    "firstNameKana" TEXT,
    "prefecture" TEXT,
    "companyPhone" TEXT,
    "url" TEXT,
    "exchangeDate" TIMESTAMP(3),
    "tags" TEXT,
    "wantsCollab" BOOLEAN NOT NULL DEFAULT false,
    "isOrdered" BOOLEAN NOT NULL DEFAULT false,
    "isCompetitor" BOOLEAN NOT NULL DEFAULT false,
    "isCreator" BOOLEAN NOT NULL DEFAULT false,
    "regionHokkaido" BOOLEAN NOT NULL DEFAULT false,
    "regionTohoku" BOOLEAN NOT NULL DEFAULT false,
    "regionKitakanto" BOOLEAN NOT NULL DEFAULT false,
    "regionSaitama" BOOLEAN NOT NULL DEFAULT false,
    "regionChiba" BOOLEAN NOT NULL DEFAULT false,
    "regionTokyo" BOOLEAN NOT NULL DEFAULT false,
    "regionKanagawa" BOOLEAN NOT NULL DEFAULT false,
    "regionChubu" BOOLEAN NOT NULL DEFAULT false,
    "regionKansai" BOOLEAN NOT NULL DEFAULT false,
    "regionChugoku" BOOLEAN NOT NULL DEFAULT false,
    "regionShikoku" BOOLEAN NOT NULL DEFAULT false,
    "regionKyushu" BOOLEAN NOT NULL DEFAULT false,
    "aiIndustry" TEXT,
    "aiSummary" TEXT,
    "aiTags" TEXT,
    "email" TEXT,
    "directPhone" TEXT,
    "mobilePhone" TEXT,
    "fax" TEXT,
    "postalCode" VARCHAR(8),
    "address" TEXT,
    "sharedMemoTitle" TEXT,
    "exchangePlace" TEXT,
    "workHistory" TEXT,
    "personality" TEXT,
    "textMemo" TEXT,
    "cardImageUrl" TEXT,
    "ownerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "business_cards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "disclosure_requests" (
    "id" TEXT NOT NULL,
    "businessCardId" TEXT NOT NULL,
    "requesterId" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "status" "DisclosureStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedById" TEXT,
    "reviewNote" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "disclosure_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_matching_cache" (
    "id" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "matchResultJson" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_matching_cache_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "business_cards_ownerId_idx" ON "business_cards"("ownerId");

-- CreateIndex
CREATE INDEX "business_cards_companyName_idx" ON "business_cards"("companyName");

-- CreateIndex
CREATE INDEX "business_cards_aiIndustry_idx" ON "business_cards"("aiIndustry");

-- CreateIndex
CREATE INDEX "business_cards_prefecture_idx" ON "business_cards"("prefecture");

-- CreateIndex
CREATE UNIQUE INDEX "business_cards_companyName_lastName_firstName_key" ON "business_cards"("companyName", "lastName", "firstName");

-- CreateIndex
CREATE INDEX "disclosure_requests_businessCardId_idx" ON "disclosure_requests"("businessCardId");

-- CreateIndex
CREATE INDEX "disclosure_requests_requesterId_idx" ON "disclosure_requests"("requesterId");

-- CreateIndex
CREATE INDEX "disclosure_requests_status_idx" ON "disclosure_requests"("status");

-- CreateIndex
CREATE UNIQUE INDEX "disclosure_requests_businessCardId_requesterId_key" ON "disclosure_requests"("businessCardId", "requesterId");

-- CreateIndex
CREATE UNIQUE INDEX "ai_matching_cache_companyName_key" ON "ai_matching_cache"("companyName");

-- AddForeignKey
ALTER TABLE "business_cards" ADD CONSTRAINT "business_cards_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "disclosure_requests" ADD CONSTRAINT "disclosure_requests_businessCardId_fkey" FOREIGN KEY ("businessCardId") REFERENCES "business_cards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "disclosure_requests" ADD CONSTRAINT "disclosure_requests_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "disclosure_requests" ADD CONSTRAINT "disclosure_requests_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
