-- Backfill the pass-rate counters from existing submissions.
--
-- A separate migration from the ALTER TABLE deliberately: that one was
-- already applied locally, and editing an applied migration breaks Prisma's
-- checksum. Idempotent — re-running recomputes the same absolute values
-- rather than incrementing, so a partial apply cannot double-count.
--
-- Both statuses count toward attempts; only ACCEPTED counts toward the
-- numerator. scripts/verify-pass-rate-backfill.ts recomputes the aggregate
-- and compares values afterwards; checking the columns are merely non-zero
-- would pass even for a double-counting backfill.
UPDATE "SQLProblem" p SET
  "attemptCount"  = COALESCE(s.attempts, 0),
  "acceptedCount" = COALESCE(s.accepted, 0)
FROM (
  SELECT "problemId",
         COUNT(*)                                      AS attempts,
         COUNT(*) FILTER (WHERE "status" = 'ACCEPTED')  AS accepted
  FROM "Submission"
  GROUP BY "problemId"
) s
WHERE s."problemId" = p."id";
