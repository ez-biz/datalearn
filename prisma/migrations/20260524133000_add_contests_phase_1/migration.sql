-- CreateEnum
CREATE TYPE "ContestKind" AS ENUM ('WEEKLY', 'BIWEEKLY', 'SPECIAL', 'USER_CUSTOM');

-- CreateEnum
CREATE TYPE "ContestStatus" AS ENUM ('SCHEDULED', 'LIVE', 'CLOSED', 'FINALIZED', 'CANCELLED');

-- AlterTable
ALTER TABLE "SQLProblem" ADD COLUMN "hiddenExpectedOutputs" JSONB,
ADD COLUMN "hiddenSchemas" JSONB;

-- CreateTable
CREATE TABLE "Contest" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "kind" "ContestKind" NOT NULL,
    "status" "ContestStatus" NOT NULL DEFAULT 'SCHEDULED',
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "durationMinutes" INTEGER NOT NULL,
    "rated" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT NOT NULL,
    "visibility" TEXT NOT NULL DEFAULT 'PUBLIC',
    "inviteTokenHash" TEXT,
    "maxParticipants" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Contest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContestProblem" (
    "contestId" TEXT NOT NULL,
    "problemId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "points" INTEGER NOT NULL,

    CONSTRAINT "ContestProblem_pkey" PRIMARY KEY ("contestId","problemId")
);

-- CreateTable
CREATE TABLE "ContestRegistration" (
    "contestId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "registeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ratedAtStart" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "ContestRegistration_pkey" PRIMARY KEY ("contestId","userId")
);

-- CreateTable
CREATE TABLE "ContestProblemLock" (
    "problemId" TEXT NOT NULL,
    "contestId" TEXT NOT NULL,
    "lockedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "unlocksAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContestProblemLock_pkey" PRIMARY KEY ("problemId")
);

-- CreateIndex
CREATE UNIQUE INDEX "Contest_slug_key" ON "Contest"("slug");

-- CreateIndex
CREATE INDEX "Contest_status_startsAt_idx" ON "Contest"("status", "startsAt");

-- CreateIndex
CREATE INDEX "Contest_kind_startsAt_idx" ON "Contest"("kind", "startsAt");

-- CreateIndex
CREATE UNIQUE INDEX "ContestProblem_contestId_position_key" ON "ContestProblem"("contestId", "position");

-- CreateIndex
CREATE INDEX "ContestProblemLock_unlocksAt_idx" ON "ContestProblemLock"("unlocksAt");

-- AddForeignKey
ALTER TABLE "Contest" ADD CONSTRAINT "Contest_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContestProblem" ADD CONSTRAINT "ContestProblem_contestId_fkey" FOREIGN KEY ("contestId") REFERENCES "Contest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContestProblem" ADD CONSTRAINT "ContestProblem_problemId_fkey" FOREIGN KEY ("problemId") REFERENCES "SQLProblem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContestRegistration" ADD CONSTRAINT "ContestRegistration_contestId_fkey" FOREIGN KEY ("contestId") REFERENCES "Contest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContestRegistration" ADD CONSTRAINT "ContestRegistration_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContestProblemLock" ADD CONSTRAINT "ContestProblemLock_problemId_fkey" FOREIGN KEY ("problemId") REFERENCES "SQLProblem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContestProblemLock" ADD CONSTRAINT "ContestProblemLock_contestId_fkey" FOREIGN KEY ("contestId") REFERENCES "Contest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
