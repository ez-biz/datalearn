-- CreateTable
CREATE TABLE "Module" (
    "id" TEXT NOT NULL,
    "trackId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Module_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModuleLesson" (
    "moduleId" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "ModuleLesson_pkey" PRIMARY KEY ("moduleId","articleId")
);

-- CreateTable
CREATE TABLE "LessonCheckpoint" (
    "articleId" TEXT NOT NULL,
    "problemId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "LessonCheckpoint_pkey" PRIMARY KEY ("articleId","problemId")
);

-- CreateTable
CREATE TABLE "LessonProgress" (
    "userId" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "percent" INTEGER NOT NULL DEFAULT 0,
    "completedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LessonProgress_pkey" PRIMARY KEY ("userId","articleId")
);

-- CreateIndex
CREATE INDEX "Module_trackId_idx" ON "Module"("trackId");

-- CreateIndex
CREATE UNIQUE INDEX "Module_trackId_slug_key" ON "Module"("trackId", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "Module_trackId_position_key" ON "Module"("trackId", "position");

-- CreateIndex
CREATE INDEX "ModuleLesson_articleId_idx" ON "ModuleLesson"("articleId");

-- CreateIndex
CREATE UNIQUE INDEX "ModuleLesson_moduleId_position_key" ON "ModuleLesson"("moduleId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "LessonCheckpoint_problemId_key" ON "LessonCheckpoint"("problemId");

-- CreateIndex
CREATE UNIQUE INDEX "LessonCheckpoint_articleId_position_key" ON "LessonCheckpoint"("articleId", "position");

-- CreateIndex
CREATE INDEX "LessonProgress_userId_completedAt_idx" ON "LessonProgress"("userId", "completedAt");

-- AddForeignKey
ALTER TABLE "Module" ADD CONSTRAINT "Module_trackId_fkey" FOREIGN KEY ("trackId") REFERENCES "Track"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModuleLesson" ADD CONSTRAINT "ModuleLesson_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "Module"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModuleLesson" ADD CONSTRAINT "ModuleLesson_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "Article"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LessonCheckpoint" ADD CONSTRAINT "LessonCheckpoint_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "Article"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LessonCheckpoint" ADD CONSTRAINT "LessonCheckpoint_problemId_fkey" FOREIGN KEY ("problemId") REFERENCES "SQLProblem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LessonProgress" ADD CONSTRAINT "LessonProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LessonProgress" ADD CONSTRAINT "LessonProgress_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "Article"("id") ON DELETE CASCADE ON UPDATE CASCADE;
