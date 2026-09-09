-- CreateTable
CREATE TABLE "lead_scoring_basis" (
    "day" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "summary" TEXT NOT NULL,
    "ruleCount" INTEGER NOT NULL DEFAULT 0,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lead_scoring_basis_pkey" PRIMARY KEY ("day")
);
