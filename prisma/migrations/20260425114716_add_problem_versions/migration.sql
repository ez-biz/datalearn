-- CreateTable
CREATE TABLE "ProblemVersion" (
    "id" TEXT NOT NULL,
    "problemId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "schemaDescription" TEXT NOT NULL,
    "schemaSql" TEXT NOT NULL,
    "expectedOutput" TEXT NOT NULL,
    "solutionSql" TEXT,
    "ordered" BOOLEAN NOT NULL,
    "hints" TEXT[],
    "tagSlugs" TEXT[],
    "publishedById" TEXT,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProblemVersion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProblemVersion_problemId_capturedAt_idx" ON "ProblemVersion"("problemId", "capturedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ProblemVersion_problemId_versionNumber_key" ON "ProblemVersion"("problemId", "versionNumber");

-- AddForeignKey
ALTER TABLE "ProblemVersion" ADD CONSTRAINT "ProblemVersion_problemId_fkey" FOREIGN KEY ("problemId") REFERENCES "SQLProblem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
