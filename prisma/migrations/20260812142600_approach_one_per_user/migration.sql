-- One APPROACH per user per problem.
--
-- Deliberately a PARTIAL unique index, not @@unique([problemId, userId, kind]):
-- a plain composite would also cap ordinary COMMENTs at one per user per
-- problem, which would silently break discussions. Prisma cannot express a
-- WHERE clause on an index, so this lives in SQL.
--
-- userId is nullable and set to NULL when a User is deleted. Postgres treats
-- NULLs as distinct in unique indexes, so orphaned approaches never collide
-- with each other — which is what we want; they are history, not slots.
CREATE UNIQUE INDEX "DiscussionComment_one_approach_per_user"
  ON "DiscussionComment" ("problemId", "userId")
  WHERE "kind" = 'APPROACH';
