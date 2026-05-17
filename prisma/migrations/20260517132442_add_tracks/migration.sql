-- CreateEnum
CREATE TYPE "TrackDifficulty" AS ENUM ('EASY', 'MEDIUM', 'HARD', 'MIXED');

-- CreateEnum
CREATE TYPE "TrackStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateTable
CREATE TABLE "Track" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "difficulty" "TrackDifficulty" NOT NULL DEFAULT 'MEDIUM',
    "status" "TrackStatus" NOT NULL DEFAULT 'DRAFT',
    "estimatedMinutes" INTEGER NOT NULL DEFAULT 60,
    "coverImageUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Track_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrackItem" (
    "id" TEXT NOT NULL,
    "trackId" TEXT NOT NULL,
    "problemId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "TrackItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Track_slug_key" ON "Track"("slug");

-- CreateIndex
CREATE INDEX "Track_status_idx" ON "Track"("status");

-- CreateIndex
CREATE INDEX "TrackItem_trackId_idx" ON "TrackItem"("trackId");

-- CreateIndex
CREATE UNIQUE INDEX "TrackItem_trackId_problemId_key" ON "TrackItem"("trackId", "problemId");

-- CreateIndex
CREATE UNIQUE INDEX "TrackItem_trackId_position_key" ON "TrackItem"("trackId", "position");

-- AddForeignKey
ALTER TABLE "TrackItem" ADD CONSTRAINT "TrackItem_trackId_fkey" FOREIGN KEY ("trackId") REFERENCES "Track"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrackItem" ADD CONSTRAINT "TrackItem_problemId_fkey" FOREIGN KEY ("problemId") REFERENCES "SQLProblem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
