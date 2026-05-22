-- CreateEnum
CREATE TYPE "TopicLane" AS ENUM ('SQL', 'DATA_ENGINEERING');

-- AlterTable
ALTER TABLE "Topic" ADD COLUMN     "displayOrder" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "lane" "TopicLane" NOT NULL DEFAULT 'SQL';

-- CreateIndex
CREATE INDEX "Topic_lane_displayOrder_idx" ON "Topic"("lane", "displayOrder");
