-- CreateEnum
CREATE TYPE "SqlLevel" AS ENUM ('NEW', 'INTERMEDIATE', 'ADVANCED');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "onboardingCompletedAt" TIMESTAMP(3),
ADD COLUMN     "onboardingStartedAt" TIMESTAMP(3),
ADD COLUMN     "sqlLevel" "SqlLevel";

-- Existing users are already onboarded. Without this, every account created
-- before V17 meets a first-run flow on its next visit to "/", where the copy
-- is wrong and it reads as a regression. Idempotent: the WHERE clause makes a
-- re-run a no-op.
UPDATE "User"
SET "onboardingCompletedAt" = "createdAt"
WHERE "onboardingCompletedAt" IS NULL;
