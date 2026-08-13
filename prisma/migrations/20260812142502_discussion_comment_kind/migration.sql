-- CreateEnum
CREATE TYPE "DiscussionCommentKind" AS ENUM ('COMMENT', 'APPROACH');

-- AlterTable
ALTER TABLE "DiscussionComment" ADD COLUMN     "kind" "DiscussionCommentKind" NOT NULL DEFAULT 'COMMENT',
ADD COLUMN     "sql" TEXT,
ADD COLUMN     "strategy" TEXT;

-- CreateIndex
CREATE INDEX "DiscussionComment_problemId_kind_status_score_createdAt_idx" ON "DiscussionComment"("problemId", "kind", "status", "score", "createdAt");
