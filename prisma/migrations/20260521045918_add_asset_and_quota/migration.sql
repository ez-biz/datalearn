-- CreateEnum
CREATE TYPE "AssetStatus" AS ENUM ('PENDING', 'ACTIVE', 'DELETING', 'DELETED');

-- CreateTable
CREATE TABLE "Asset" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "blobUrl" TEXT,
    "blobKey" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "bytes" INTEGER NOT NULL,
    "status" "AssetStatus" NOT NULL DEFAULT 'PENDING',
    "pendingExpiresAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "deletionAttempts" INTEGER NOT NULL DEFAULT 0,
    "lastDeletionError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Asset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserAssetQuota" (
    "userId" TEXT NOT NULL,
    "reservedBytes" BIGINT NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserAssetQuota_pkey" PRIMARY KEY ("userId")
);

-- CreateIndex
CREATE UNIQUE INDEX "Asset_blobUrl_key" ON "Asset"("blobUrl");

-- CreateIndex
CREATE UNIQUE INDEX "Asset_blobKey_key" ON "Asset"("blobKey");

-- CreateIndex
CREATE INDEX "Asset_ownerId_status_idx" ON "Asset"("ownerId", "status");

-- CreateIndex
CREATE INDEX "Asset_status_deletedAt_idx" ON "Asset"("status", "deletedAt");

-- CreateIndex
CREATE INDEX "Asset_status_pendingExpiresAt_idx" ON "Asset"("status", "pendingExpiresAt");

-- AddForeignKey
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserAssetQuota" ADD CONSTRAINT "UserAssetQuota_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
