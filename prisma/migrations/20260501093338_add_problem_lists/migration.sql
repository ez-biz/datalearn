-- AlterTable
ALTER TABLE "ArticleVersion" ALTER COLUMN "tagSlugs" DROP DEFAULT,
ALTER COLUMN "relatedProblemSlugs" DROP DEFAULT;

-- AlterTable
ALTER TABLE "_ArticleProblems" ADD CONSTRAINT "_ArticleProblems_AB_pkey" PRIMARY KEY ("A", "B");

-- DropIndex
DROP INDEX "_ArticleProblems_AB_unique";

-- AlterTable
ALTER TABLE "_ArticleTags" ADD CONSTRAINT "_ArticleTags_AB_pkey" PRIMARY KEY ("A", "B");

-- DropIndex
DROP INDEX "_ArticleTags_AB_unique";

-- CreateTable
CREATE TABLE "ProblemList" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProblemList_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProblemListItem" (
    "listId" TEXT NOT NULL,
    "problemId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProblemListItem_pkey" PRIMARY KEY ("listId","problemId")
);

-- CreateIndex
CREATE INDEX "ProblemList_ownerId_updatedAt_idx" ON "ProblemList"("ownerId", "updatedAt");

-- CreateIndex
CREATE INDEX "ProblemListItem_listId_position_idx" ON "ProblemListItem"("listId", "position");

-- CreateIndex
CREATE INDEX "ProblemListItem_problemId_idx" ON "ProblemListItem"("problemId");

-- AddForeignKey
ALTER TABLE "ProblemList" ADD CONSTRAINT "ProblemList_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProblemListItem" ADD CONSTRAINT "ProblemListItem_listId_fkey" FOREIGN KEY ("listId") REFERENCES "ProblemList"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProblemListItem" ADD CONSTRAINT "ProblemListItem_problemId_fkey" FOREIGN KEY ("problemId") REFERENCES "SQLProblem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
