-- AlterTable
ALTER TABLE "Article" ADD COLUMN     "hasVisualBlocks" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "Article_hasVisualBlocks_idx" ON "Article"("hasVisualBlocks");
