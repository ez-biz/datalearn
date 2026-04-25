-- CreateEnum
CREATE TYPE "ProblemStatus" AS ENUM ('DRAFT', 'BETA', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ProblemReportKind" AS ENUM ('WRONG_ANSWER', 'UNCLEAR_DESCRIPTION', 'BROKEN_SCHEMA', 'TYPO', 'OTHER');

-- AlterTable
ALTER TABLE "SQLProblem" ADD COLUMN     "status" "ProblemStatus" NOT NULL DEFAULT 'PUBLISHED';

-- CreateTable
CREATE TABLE "ProblemReport" (
    "id" TEXT NOT NULL,
    "problemId" TEXT NOT NULL,
    "userId" TEXT,
    "kind" "ProblemReportKind" NOT NULL,
    "message" TEXT NOT NULL,
    "resolvedAt" TIMESTAMP(3),
    "resolvedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProblemReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProblemReport_resolvedAt_idx" ON "ProblemReport"("resolvedAt");

-- CreateIndex
CREATE INDEX "ProblemReport_problemId_createdAt_idx" ON "ProblemReport"("problemId", "createdAt");

-- CreateIndex
CREATE INDEX "SQLProblem_status_idx" ON "SQLProblem"("status");

-- AddForeignKey
ALTER TABLE "ProblemReport" ADD CONSTRAINT "ProblemReport_problemId_fkey" FOREIGN KEY ("problemId") REFERENCES "SQLProblem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProblemReport" ADD CONSTRAINT "ProblemReport_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
