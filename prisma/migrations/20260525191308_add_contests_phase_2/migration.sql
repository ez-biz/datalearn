-- CreateEnum
CREATE TYPE "ContestVerdict" AS ENUM ('ACCEPTED', 'WRONG_ANSWER', 'TIME_LIMIT', 'MEMORY_LIMIT', 'RUNTIME_ERROR', 'COMPILE_ERROR', 'REJECTED', 'INTERNAL_ERROR');

-- AlterTable
ALTER TABLE "SQLProblem" ADD COLUMN     "hiddenDataValidatedAt" TIMESTAMP(3),
ADD COLUMN     "hiddenDataValidationFingerprint" TEXT;

-- CreateTable
CREATE TABLE "ContestSubmission" (
    "id" TEXT NOT NULL,
    "contestId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "problemId" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "sqlHash" TEXT NOT NULL,
    "simhash" TEXT NOT NULL,
    "attemptNumber" INTEGER NOT NULL,
    "verdict" "ContestVerdict" NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ipHash" TEXT NOT NULL,
    "userAgent" TEXT NOT NULL,

    CONSTRAINT "ContestSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContestProblemSolve" (
    "contestId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "problemId" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "acceptedAt" TIMESTAMP(3) NOT NULL,
    "wrongAttemptsBeforeAccept" INTEGER NOT NULL,

    CONSTRAINT "ContestProblemSolve_pkey" PRIMARY KEY ("contestId","userId","problemId")
);

-- CreateTable
CREATE TABLE "ContestLeaderboardEntry" (
    "contestId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "rank" INTEGER NOT NULL DEFAULT 0,
    "points" INTEGER NOT NULL DEFAULT 0,
    "penaltySeconds" INTEGER NOT NULL DEFAULT 0,
    "solvedCount" INTEGER NOT NULL DEFAULT 0,
    "ratingBefore" INTEGER,
    "ratingAfter" INTEGER,
    "ratingDelta" INTEGER,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContestLeaderboardEntry_pkey" PRIMARY KEY ("contestId","userId")
);

-- CreateTable
CREATE TABLE "AdminAuditLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ContestSubmission_submissionId_key" ON "ContestSubmission"("submissionId");

-- CreateIndex
CREATE INDEX "ContestSubmission_contestId_userId_idx" ON "ContestSubmission"("contestId", "userId");

-- CreateIndex
CREATE INDEX "ContestSubmission_contestId_problemId_verdict_idx" ON "ContestSubmission"("contestId", "problemId", "verdict");

-- CreateIndex
CREATE UNIQUE INDEX "ContestSubmission_contestId_userId_idempotencyKey_key" ON "ContestSubmission"("contestId", "userId", "idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "ContestSubmission_contestId_userId_problemId_attemptNumber_key" ON "ContestSubmission"("contestId", "userId", "problemId", "attemptNumber");

-- CreateIndex
CREATE UNIQUE INDEX "ContestProblemSolve_submissionId_key" ON "ContestProblemSolve"("submissionId");

-- CreateIndex
CREATE INDEX "ContestProblemSolve_contestId_problemId_acceptedAt_idx" ON "ContestProblemSolve"("contestId", "problemId", "acceptedAt");

-- CreateIndex
CREATE INDEX "ContestLeaderboardEntry_contestId_points_penaltySeconds_idx" ON "ContestLeaderboardEntry"("contestId", "points", "penaltySeconds");

-- CreateIndex
CREATE INDEX "AdminAuditLog_actorId_createdAt_idx" ON "AdminAuditLog"("actorId", "createdAt");

-- CreateIndex
CREATE INDEX "AdminAuditLog_targetType_targetId_createdAt_idx" ON "AdminAuditLog"("targetType", "targetId", "createdAt");

-- AddForeignKey
ALTER TABLE "ContestSubmission" ADD CONSTRAINT "ContestSubmission_contestId_fkey" FOREIGN KEY ("contestId") REFERENCES "Contest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContestSubmission" ADD CONSTRAINT "ContestSubmission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContestSubmission" ADD CONSTRAINT "ContestSubmission_problemId_fkey" FOREIGN KEY ("problemId") REFERENCES "SQLProblem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContestSubmission" ADD CONSTRAINT "ContestSubmission_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "Submission"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContestProblemSolve" ADD CONSTRAINT "ContestProblemSolve_contestId_fkey" FOREIGN KEY ("contestId") REFERENCES "Contest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContestProblemSolve" ADD CONSTRAINT "ContestProblemSolve_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContestProblemSolve" ADD CONSTRAINT "ContestProblemSolve_problemId_fkey" FOREIGN KEY ("problemId") REFERENCES "SQLProblem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContestProblemSolve" ADD CONSTRAINT "ContestProblemSolve_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "Submission"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContestLeaderboardEntry" ADD CONSTRAINT "ContestLeaderboardEntry_contestId_fkey" FOREIGN KEY ("contestId") REFERENCES "Contest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContestLeaderboardEntry" ADD CONSTRAINT "ContestLeaderboardEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminAuditLog" ADD CONSTRAINT "AdminAuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
