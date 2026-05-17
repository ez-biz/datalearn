-- CreateEnum
CREATE TYPE "TagKind" AS ENUM ('TOPIC', 'COMPANY');

-- AlterTable
ALTER TABLE "Tag" ADD COLUMN "kind" "TagKind" NOT NULL DEFAULT 'TOPIC';
