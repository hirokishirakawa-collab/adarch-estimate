-- CreateTable: revenue_reports
CREATE TABLE "revenue_reports" (
  "id"          TEXT        NOT NULL,
  "amount"      DECIMAL(15,0) NOT NULL,
  "targetMonth" TIMESTAMP(3) NOT NULL,
  "memo"        TEXT,
  "projectId"   TEXT,
  "createdById" TEXT        NOT NULL,
  "branchId"    TEXT        NOT NULL,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL,

  CONSTRAINT "revenue_reports_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "revenue_reports_projectId_fkey"
    FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "revenue_reports_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "revenue_reports_branchId_fkey"
    FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "revenue_reports_branchId_idx"    ON "revenue_reports"("branchId");
CREATE INDEX "revenue_reports_targetMonth_idx" ON "revenue_reports"("targetMonth");
CREATE INDEX "revenue_reports_createdById_idx" ON "revenue_reports"("createdById");
