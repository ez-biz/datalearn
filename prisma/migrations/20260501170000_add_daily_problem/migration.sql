-- CreateEnum
CREATE TYPE "DailyProblemSource" AS ENUM ('AUTO', 'MANUAL');

-- CreateTable
CREATE TABLE "DailyProblem" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "problemId" TEXT NOT NULL,
    "source" "DailyProblemSource" NOT NULL DEFAULT 'AUTO',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DailyProblem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DailyProblem_date_key" ON "DailyProblem"("date");

-- CreateIndex
CREATE INDEX "DailyProblem_problemId_idx" ON "DailyProblem"("problemId");

-- AddForeignKey
ALTER TABLE "DailyProblem" ADD CONSTRAINT "DailyProblem_problemId_fkey" FOREIGN KEY ("problemId") REFERENCES "SQLProblem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
