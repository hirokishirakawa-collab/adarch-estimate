-- CreateTable
CREATE TABLE "wiki_articles" (
    "id"         TEXT NOT NULL,
    "title"      TEXT NOT NULL,
    "body"       TEXT NOT NULL,
    "authorName" TEXT NOT NULL,
    "branchId"   TEXT NOT NULL,
    "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"  TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wiki_articles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "wiki_articles_branchId_idx" ON "wiki_articles"("branchId");

-- AddForeignKey
ALTER TABLE "wiki_articles" ADD CONSTRAINT "wiki_articles_branchId_fkey"
    FOREIGN KEY ("branchId") REFERENCES "branches"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
