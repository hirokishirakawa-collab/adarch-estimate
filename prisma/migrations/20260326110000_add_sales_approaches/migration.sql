-- CreateEnum
CREATE TYPE "SalesApproachResult" AS ENUM ('DEAL', 'REPLIED_NG', 'NO_REPLY', 'REJECTED');
CREATE TYPE "SalesApproachMethod" AS ENUM ('EMAIL', 'FORM', 'DM', 'PHONE', 'VISIT', 'OTHER');

-- CreateTable
CREATE TABLE "sales_approaches" (
    "id" TEXT NOT NULL,
    "groupCompanyId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "industry" TEXT NOT NULL,
    "targetDesc" TEXT,
    "method" "SalesApproachMethod" NOT NULL,
    "messageBody" TEXT NOT NULL,
    "result" "SalesApproachResult" NOT NULL,
    "learnings" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sales_approaches_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "sales_approaches_groupCompanyId_idx" ON "sales_approaches"("groupCompanyId");
CREATE INDEX "sales_approaches_result_idx" ON "sales_approaches"("result");
CREATE INDEX "sales_approaches_industry_idx" ON "sales_approaches"("industry");
CREATE INDEX "sales_approaches_createdAt_idx" ON "sales_approaches"("createdAt" DESC);

-- AddForeignKey
ALTER TABLE "sales_approaches" ADD CONSTRAINT "sales_approaches_groupCompanyId_fkey" FOREIGN KEY ("groupCompanyId") REFERENCES "group_companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "sales_approaches" ADD CONSTRAINT "sales_approaches_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
