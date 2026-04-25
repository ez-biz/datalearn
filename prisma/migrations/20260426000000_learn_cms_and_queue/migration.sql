-- Learn v1a — CMS + approval queue + cross-linking
--
-- Migration order matters because of the data backfills:
--   1. Create the new ArticleStatus enum
--   2. Add columns and backfill data
--   3. Drop the legacy `published` column
--   4. Add foreign key constraints (after data is correct)
--   5. Add indexes and join tables

-- 1. ArticleStatus enum
CREATE TYPE "ArticleStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'PUBLISHED', 'ARCHIVED');

-- 2. Add new columns to Article
ALTER TABLE "Article"
    ADD COLUMN "status" "ArticleStatus" NOT NULL DEFAULT 'DRAFT',
    ADD COLUMN "summary" TEXT,
    ADD COLUMN "readingMinutes" INTEGER,
    ADD COLUMN "reviewNotes" TEXT,
    ADD COLUMN "reviewedAt" TIMESTAMP(3),
    ADD COLUMN "reviewedBy" TEXT;

-- 3. Backfill status from the legacy `published` boolean
UPDATE "Article" SET "status" = 'PUBLISHED' WHERE "published" = true;

-- 4. Backfill authorId — replace the legacy 'system' sentinel with the
--    seeded admin's real user id. Done before the FK constraint is added.
--    If the admin id changes (different env), this UPDATE is a no-op.
UPDATE "Article"
SET "authorId" = (SELECT "id" FROM "User" WHERE "email" = 'anchitgupt2012@gmail.com' LIMIT 1)
WHERE "authorId" = 'system'
  AND EXISTS (SELECT 1 FROM "User" WHERE "email" = 'anchitgupt2012@gmail.com');

-- 5. Drop the legacy `published` column (data already migrated to `status`)
ALTER TABLE "Article" DROP COLUMN "published";

-- 6. Foreign key on authorId → User
ALTER TABLE "Article"
    ADD CONSTRAINT "Article_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- 7. Indexes
CREATE INDEX "Article_status_idx" ON "Article"("status");
CREATE INDEX "Article_topicId_status_idx" ON "Article"("topicId", "status");
CREATE INDEX "Article_authorId_idx" ON "Article"("authorId");

-- 8. ArticleVersion (snapshot table)
CREATE TABLE "ArticleVersion" (
    "id"                  TEXT PRIMARY KEY,
    "articleId"           TEXT NOT NULL,
    "versionNumber"       INTEGER NOT NULL,
    "title"               TEXT NOT NULL,
    "slug"                TEXT NOT NULL,
    "content"             TEXT NOT NULL,
    "summary"             TEXT,
    "topicId"             TEXT NOT NULL,
    "tagSlugs"            TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "relatedProblemSlugs" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "publishedById"       TEXT,
    "capturedAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ArticleVersion_articleId_fkey" FOREIGN KEY ("articleId")
        REFERENCES "Article"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "ArticleVersion_articleId_versionNumber_key"
    ON "ArticleVersion"("articleId", "versionNumber");
CREATE INDEX "ArticleVersion_articleId_capturedAt_idx"
    ON "ArticleVersion"("articleId", "capturedAt");

-- 9. M:N: Article ↔ Tag
CREATE TABLE "_ArticleTags" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_ArticleTags_A_fkey" FOREIGN KEY ("A")
        REFERENCES "Article"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "_ArticleTags_B_fkey" FOREIGN KEY ("B")
        REFERENCES "Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "_ArticleTags_AB_unique" ON "_ArticleTags"("A", "B");
CREATE INDEX "_ArticleTags_B_index" ON "_ArticleTags"("B");

-- 10. M:N: Article ↔ SQLProblem
CREATE TABLE "_ArticleProblems" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_ArticleProblems_A_fkey" FOREIGN KEY ("A")
        REFERENCES "Article"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "_ArticleProblems_B_fkey" FOREIGN KEY ("B")
        REFERENCES "SQLProblem"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "_ArticleProblems_AB_unique" ON "_ArticleProblems"("A", "B");
CREATE INDEX "_ArticleProblems_B_index" ON "_ArticleProblems"("B");
