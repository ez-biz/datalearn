-- Add `number` column to SQLProblem with a stable, monotonic display id
-- (`#247.` LeetCode-style). Atomic three-step migration:
--
--   1. ADD COLUMN number INT (nullable for the moment so existing rows survive).
--   2. Backfill: assign 1..N by createdAt ASC via a window function.
--   3. ALTER COLUMN to NOT NULL + add UNIQUE constraint.
--
-- Numbers are minted at create-time by the application (MAX(number)+1 in a
-- transaction) and are never recycled, even after archive. The unique
-- constraint guarantees DB-side correctness if two creates race.

BEGIN;

ALTER TABLE "SQLProblem" ADD COLUMN "number" INTEGER;

UPDATE "SQLProblem"
SET "number" = sub.rn
FROM (
  SELECT id, ROW_NUMBER() OVER (ORDER BY "createdAt" ASC, id ASC) AS rn
  FROM "SQLProblem"
) sub
WHERE "SQLProblem".id = sub.id;

ALTER TABLE "SQLProblem" ALTER COLUMN "number" SET NOT NULL;
ALTER TABLE "SQLProblem" ADD CONSTRAINT "SQLProblem_number_key" UNIQUE ("number");

COMMIT;
