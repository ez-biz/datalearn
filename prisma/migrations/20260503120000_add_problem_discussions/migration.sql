-- AlterEnum
ALTER TYPE "UserRole" ADD VALUE 'MODERATOR' BEFORE 'ADMIN';

-- CreateEnum
CREATE TYPE "DiscussionCommentStatus" AS ENUM ('VISIBLE', 'HIDDEN', 'DELETED', 'SPAM');

-- CreateEnum
CREATE TYPE "DiscussionVoteValue" AS ENUM ('UP', 'DOWN');

-- CreateEnum
CREATE TYPE "DiscussionReportReason" AS ENUM ('SPAM', 'ABUSE', 'SPOILER', 'OFF_TOPIC', 'OTHER');

-- CreateEnum
CREATE TYPE "DiscussionReportStatus" AS ENUM ('OPEN', 'DISMISSED', 'CONFIRMED');

-- CreateEnum
CREATE TYPE "ProblemDiscussionMode" AS ENUM ('OPEN', 'LOCKED', 'HIDDEN');

-- CreateEnum
CREATE TYPE "UserReputationEventKind" AS ENUM ('ACCEPTED_SOLVE', 'COMMENT_UPVOTE_RECEIVED', 'COMMENT_DOWNVOTE_RECEIVED', 'COMMENT_HIDDEN', 'COMMENT_SPAM_CONFIRMED', 'ACCOUNT_AGE_BONUS');

-- CreateEnum
CREATE TYPE "ModeratorPermissionKey" AS ENUM ('VIEW_DISCUSSION_QUEUE', 'HIDE_COMMENT', 'RESTORE_COMMENT', 'DISMISS_REPORT', 'MARK_SPAM', 'LOCK_PROBLEM_DISCUSSION', 'HIDE_PROBLEM_DISCUSSION');

-- CreateEnum
CREATE TYPE "DiscussionModerationActionKind" AS ENUM ('HIDE_COMMENT', 'RESTORE_COMMENT', 'DISMISS_REPORT', 'MARK_SPAM', 'SET_PROBLEM_MODE', 'UPDATE_SETTINGS', 'GRANT_MODERATOR_PERMISSION', 'REVOKE_MODERATOR_PERMISSION');

-- CreateTable
CREATE TABLE "DiscussionComment" (
    "id" TEXT NOT NULL,
    "problemId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "parentId" TEXT,
    "bodyMarkdown" TEXT NOT NULL,
    "status" "DiscussionCommentStatus" NOT NULL DEFAULT 'VISIBLE',
    "upvotes" INTEGER NOT NULL DEFAULT 0,
    "downvotes" INTEGER NOT NULL DEFAULT 0,
    "score" INTEGER NOT NULL DEFAULT 0,
    "reportCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "editedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "hiddenAt" TIMESTAMP(3),
    "hiddenById" TEXT,

    CONSTRAINT "DiscussionComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiscussionVote" (
    "commentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "value" "DiscussionVoteValue" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DiscussionVote_pkey" PRIMARY KEY ("commentId","userId")
);

-- CreateTable
CREATE TABLE "DiscussionReport" (
    "id" TEXT NOT NULL,
    "commentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "reason" "DiscussionReportReason" NOT NULL,
    "message" TEXT NOT NULL,
    "status" "DiscussionReportStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "resolvedById" TEXT,

    CONSTRAINT "DiscussionReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiscussionSettings" (
    "id" TEXT NOT NULL DEFAULT 'global',
    "globalEnabled" BOOLEAN NOT NULL DEFAULT false,
    "reportThreshold" INTEGER NOT NULL DEFAULT 3,
    "editWindowMinutes" INTEGER NOT NULL DEFAULT 15,
    "duplicateCooldownSeconds" INTEGER NOT NULL DEFAULT 300,
    "bodyMaxChars" INTEGER NOT NULL DEFAULT 4000,
    "trustedMinReputation" INTEGER NOT NULL DEFAULT 20,
    "highTrustMinReputation" INTEGER NOT NULL DEFAULT 100,
    "newTopLevelPerHour" INTEGER NOT NULL DEFAULT 3,
    "newRepliesPerHour" INTEGER NOT NULL DEFAULT 6,
    "newPerProblemPerDay" INTEGER NOT NULL DEFAULT 5,
    "newMinSecondsBetween" INTEGER NOT NULL DEFAULT 60,
    "newVotesPerHour" INTEGER NOT NULL DEFAULT 20,
    "trustedTopLevelPerHour" INTEGER NOT NULL DEFAULT 10,
    "trustedRepliesPerHour" INTEGER NOT NULL DEFAULT 20,
    "trustedPerProblemPerDay" INTEGER NOT NULL DEFAULT 15,
    "trustedMinSecondsBetween" INTEGER NOT NULL DEFAULT 20,
    "trustedVotesPerHour" INTEGER NOT NULL DEFAULT 60,
    "highTopLevelPerHour" INTEGER NOT NULL DEFAULT 30,
    "highRepliesPerHour" INTEGER NOT NULL DEFAULT 60,
    "highPerProblemPerDay" INTEGER NOT NULL DEFAULT 40,
    "highMinSecondsBetween" INTEGER NOT NULL DEFAULT 5,
    "highVotesPerHour" INTEGER NOT NULL DEFAULT 200,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedById" TEXT,

    CONSTRAINT "DiscussionSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProblemDiscussionState" (
    "problemId" TEXT NOT NULL,
    "mode" "ProblemDiscussionMode" NOT NULL DEFAULT 'OPEN',
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedById" TEXT,

    CONSTRAINT "ProblemDiscussionState_pkey" PRIMARY KEY ("problemId")
);

-- CreateTable
CREATE TABLE "UserReputationEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" "UserReputationEventKind" NOT NULL,
    "points" INTEGER NOT NULL,
    "sourceId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserReputationEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModeratorPermission" (
    "userId" TEXT NOT NULL,
    "permission" "ModeratorPermissionKey" NOT NULL,
    "grantedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ModeratorPermission_pkey" PRIMARY KEY ("userId","permission")
);

-- CreateTable
CREATE TABLE "DiscussionModerationLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "action" "DiscussionModerationActionKind" NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DiscussionModerationLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DiscussionComment_problemId_parentId_status_score_createdAt_idx" ON "DiscussionComment"("problemId", "parentId", "status", "score", "createdAt");

-- CreateIndex
CREATE INDEX "DiscussionComment_problemId_status_createdAt_idx" ON "DiscussionComment"("problemId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "DiscussionComment_userId_createdAt_idx" ON "DiscussionComment"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "DiscussionComment_parentId_createdAt_idx" ON "DiscussionComment"("parentId", "createdAt");

-- CreateIndex
CREATE INDEX "DiscussionVote_userId_updatedAt_idx" ON "DiscussionVote"("userId", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "DiscussionReport_commentId_userId_key" ON "DiscussionReport"("commentId", "userId");

-- CreateIndex
CREATE INDEX "DiscussionReport_commentId_status_idx" ON "DiscussionReport"("commentId", "status");

-- CreateIndex
CREATE INDEX "DiscussionReport_commentId_userId_idx" ON "DiscussionReport"("commentId", "userId");

-- CreateIndex
CREATE INDEX "DiscussionReport_status_createdAt_idx" ON "DiscussionReport"("status", "createdAt");

-- CreateIndex
CREATE INDEX "UserReputationEvent_userId_createdAt_idx" ON "UserReputationEvent"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "UserReputationEvent_userId_kind_sourceId_idx" ON "UserReputationEvent"("userId", "kind", "sourceId");

-- CreateIndex
CREATE INDEX "ModeratorPermission_userId_permission_idx" ON "ModeratorPermission"("userId", "permission");

-- CreateIndex
CREATE INDEX "DiscussionModerationLog_actorId_createdAt_idx" ON "DiscussionModerationLog"("actorId", "createdAt");

-- CreateIndex
CREATE INDEX "DiscussionModerationLog_targetType_targetId_createdAt_idx" ON "DiscussionModerationLog"("targetType", "targetId", "createdAt");

-- AddForeignKey
ALTER TABLE "DiscussionComment" ADD CONSTRAINT "DiscussionComment_problemId_fkey" FOREIGN KEY ("problemId") REFERENCES "SQLProblem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiscussionComment" ADD CONSTRAINT "DiscussionComment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiscussionComment" ADD CONSTRAINT "DiscussionComment_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "DiscussionComment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiscussionComment" ADD CONSTRAINT "DiscussionComment_hiddenById_fkey" FOREIGN KEY ("hiddenById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiscussionVote" ADD CONSTRAINT "DiscussionVote_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "DiscussionComment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiscussionVote" ADD CONSTRAINT "DiscussionVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiscussionReport" ADD CONSTRAINT "DiscussionReport_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "DiscussionComment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiscussionReport" ADD CONSTRAINT "DiscussionReport_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiscussionReport" ADD CONSTRAINT "DiscussionReport_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProblemDiscussionState" ADD CONSTRAINT "ProblemDiscussionState_problemId_fkey" FOREIGN KEY ("problemId") REFERENCES "SQLProblem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserReputationEvent" ADD CONSTRAINT "UserReputationEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModeratorPermission" ADD CONSTRAINT "ModeratorPermission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModeratorPermission" ADD CONSTRAINT "ModeratorPermission_grantedById_fkey" FOREIGN KEY ("grantedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiscussionModerationLog" ADD CONSTRAINT "DiscussionModerationLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- SeedData
INSERT INTO "DiscussionSettings" ("id", "globalEnabled", "reportThreshold", "editWindowMinutes", "duplicateCooldownSeconds", "bodyMaxChars", "updatedAt")
VALUES ('global', false, 3, 15, 300, 4000, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;
