-- CreateTable
CREATE TABLE "MetricSnapshot" (
    "day" TEXT NOT NULL,
    "registeredUsers" INTEGER NOT NULL,
    "publishedProblems" INTEGER NOT NULL,
    "publishedArticles" INTEGER NOT NULL,
    "publishedTracks" INTEGER NOT NULL,
    "lessonsInProgress" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MetricSnapshot_pkey" PRIMARY KEY ("day")
);

-- CreateIndex
CREATE INDEX "LessonProgress_completedAt_idx" ON "LessonProgress"("completedAt");

-- CreateIndex
CREATE INDEX "LessonProgress_updatedAt_idx" ON "LessonProgress"("updatedAt");

-- CreateIndex
CREATE INDEX "Submission_createdAt_idx" ON "Submission"("createdAt");

-- CreateIndex
CREATE INDEX "Submission_problemId_status_idx" ON "Submission"("problemId", "status");

-- CreateIndex
CREATE INDEX "User_createdAt_idx" ON "User"("createdAt");
