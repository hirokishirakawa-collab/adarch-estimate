[dotenv@17.3.1] injecting env (10) from .env.local -- tip: ⚙️  write to custom object with { processEnv: myObject }
[dotenv@17.3.1] injecting env (0) from .env -- tip: 🛡️ auth for agents: https://vestauth.com
-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('CONFIRMED', 'CANCELLED');

-- CreateTable
CREATE TABLE "booking_hosts" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 100,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "calendarId" TEXT NOT NULL DEFAULT 'primary',
    "googleEmail" TEXT,
    "googleRefreshToken" TEXT,
    "connectToken" TEXT,
    "connectedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "booking_hosts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "booking_types" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "durationMinutes" INTEGER NOT NULL DEFAULT 60,
    "slotStepMinutes" INTEGER NOT NULL DEFAULT 30,
    "bufferMinutes" INTEGER NOT NULL DEFAULT 15,
    "minNoticeHours" INTEGER NOT NULL DEFAULT 24,
    "maxDaysAhead" INTEGER NOT NULL DEFAULT 14,
    "businessHours" JSONB NOT NULL,
    "questions" JSONB NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "booking_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "booking_type_hosts" (
    "id" TEXT NOT NULL,
    "bookingTypeId" TEXT NOT NULL,
    "hostId" TEXT NOT NULL,

    CONSTRAINT "booking_type_hosts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bookings" (
    "id" TEXT NOT NULL,
    "bookingTypeId" TEXT NOT NULL,
    "hostId" TEXT NOT NULL,
    "status" "BookingStatus" NOT NULL DEFAULT 'CONFIRMED',
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "name" TEXT NOT NULL,
    "company" TEXT,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "answers" JSONB,
    "googleEventId" TEXT,
    "meetUrl" TEXT,
    "cancelToken" TEXT NOT NULL,
    "cancelledAt" TIMESTAMP(3),
    "leadId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bookings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "booking_hosts_email_key" ON "booking_hosts"("email");

-- CreateIndex
CREATE UNIQUE INDEX "booking_hosts_connectToken_key" ON "booking_hosts"("connectToken");

-- CreateIndex
CREATE UNIQUE INDEX "booking_types_slug_key" ON "booking_types"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "booking_type_hosts_bookingTypeId_hostId_key" ON "booking_type_hosts"("bookingTypeId", "hostId");

-- CreateIndex
CREATE UNIQUE INDEX "bookings_cancelToken_key" ON "bookings"("cancelToken");

-- CreateIndex
CREATE INDEX "bookings_startAt_idx" ON "bookings"("startAt");

-- CreateIndex
CREATE INDEX "bookings_hostId_status_idx" ON "bookings"("hostId", "status");

-- AddForeignKey
ALTER TABLE "booking_type_hosts" ADD CONSTRAINT "booking_type_hosts_bookingTypeId_fkey" FOREIGN KEY ("bookingTypeId") REFERENCES "booking_types"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_type_hosts" ADD CONSTRAINT "booking_type_hosts_hostId_fkey" FOREIGN KEY ("hostId") REFERENCES "booking_hosts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_bookingTypeId_fkey" FOREIGN KEY ("bookingTypeId") REFERENCES "booking_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_hostId_fkey" FOREIGN KEY ("hostId") REFERENCES "booking_hosts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

