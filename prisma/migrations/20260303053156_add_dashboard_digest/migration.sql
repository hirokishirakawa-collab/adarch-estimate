-- CreateTable
CREATE TABLE "dashboard_digests" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "content" TEXT NOT NULL,
    "dataJson" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dashboard_digests_pkey" PRIMARY KEY ("id")
);
