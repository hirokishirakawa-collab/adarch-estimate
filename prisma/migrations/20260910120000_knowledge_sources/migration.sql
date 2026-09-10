-- CreateEnum
CREATE TYPE "KnowledgeOrigin" AS ENUM ('OWN', 'EXTERNAL');

-- CreateEnum
CREATE TYPE "KnowledgeKind" AS ENUM ('FILE', 'URL', 'TEXT');

-- CreateEnum
CREATE TYPE "KnowledgeStatus" AS ENUM ('PENDING', 'READY', 'FAILED');

-- CreateTable
CREATE TABLE "knowledge_sources" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "origin" "KnowledgeOrigin" NOT NULL DEFAULT 'EXTERNAL',
    "kind" "KnowledgeKind" NOT NULL,
    "publisher" TEXT,
    "publishedAt" TEXT,
    "fileUrl" TEXT,
    "fileName" TEXT,
    "mimeType" TEXT,
    "fileSize" INTEGER,
    "sourceUrl" TEXT,
    "hqOnly" BOOLEAN NOT NULL DEFAULT false,
    "status" "KnowledgeStatus" NOT NULL DEFAULT 'PENDING',
    "errorMessage" TEXT,
    "content" TEXT NOT NULL DEFAULT '',
    "summary" TEXT,
    "digest" TEXT,
    "keywords" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "pageCount" INTEGER,
    "charCount" INTEGER NOT NULL DEFAULT 0,
    "createdByName" TEXT NOT NULL,
    "createdByEmail" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "knowledge_sources_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "knowledge_sources_status_idx" ON "knowledge_sources"("status");
CREATE INDEX "knowledge_sources_origin_idx" ON "knowledge_sources"("origin");
CREATE INDEX "knowledge_sources_createdAt_idx" ON "knowledge_sources"("createdAt");
