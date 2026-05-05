-- CreateTable
CREATE TABLE "DiscussionVoteAction" (
    "id" TEXT NOT NULL,
    "commentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "value" "DiscussionVoteValue",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DiscussionVoteAction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DiscussionVoteAction_userId_createdAt_idx" ON "DiscussionVoteAction"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "DiscussionVoteAction_commentId_userId_createdAt_idx" ON "DiscussionVoteAction"("commentId", "userId", "createdAt");

-- AddForeignKey
ALTER TABLE "DiscussionVoteAction" ADD CONSTRAINT "DiscussionVoteAction_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "DiscussionComment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiscussionVoteAction" ADD CONSTRAINT "DiscussionVoteAction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
