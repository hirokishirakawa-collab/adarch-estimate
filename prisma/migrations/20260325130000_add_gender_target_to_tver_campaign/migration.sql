-- CreateEnum
CREATE TYPE "TverGenderTarget" AS ENUM ('ALL', 'MALE', 'FEMALE');

-- AlterTable
ALTER TABLE "tver_campaigns" ADD COLUMN "genderTarget" "TverGenderTarget" NOT NULL DEFAULT 'ALL';
