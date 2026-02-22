-- CreateTable
CREATE TABLE "deal_logs" (
    "id"        TEXT NOT NULL,
    "type"      "ActivityType" NOT NULL DEFAULT 'OTHER',
    "content"   TEXT NOT NULL,
    "staffName" TEXT NOT NULL,
    "dealId"    TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "deal_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "deal_logs_dealId_idx" ON "deal_logs"("dealId");
CREATE INDEX "deal_logs_createdAt_idx" ON "deal_logs"("createdAt");

-- AddForeignKey
ALTER TABLE "deal_logs" ADD CONSTRAINT "deal_logs_dealId_fkey"
    FOREIGN KEY ("dealId") REFERENCES "deals"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
