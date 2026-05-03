ALTER TABLE "DiscussionSettings" ALTER COLUMN "globalEnabled" SET DEFAULT true;

UPDATE "DiscussionSettings"
SET "globalEnabled" = true
WHERE "id" = 'global'
AND "updatedById" IS NULL;
