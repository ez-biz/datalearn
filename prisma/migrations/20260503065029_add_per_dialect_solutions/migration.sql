-- AlterTable
ALTER TABLE "SQLProblem" ADD COLUMN     "expectedOutputs" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN     "solutions" JSONB NOT NULL DEFAULT '{}';

-- Backfill: copy legacy expectedOutput / solutionSql into the new
-- per-dialect maps, keyed by every entry of `dialects`. NULL solutionSql
-- becomes an empty string for that key — the PUBLISHED gate at the API
-- layer rejects empty values for new transitions but tolerates
-- already-PUBLISHED rows with empty entries (so this migration doesn't
-- silently invalidate live problems).
UPDATE "SQLProblem"
SET "solutions" = (
        SELECT COALESCE(
            jsonb_object_agg(d, COALESCE("solutionSql", '')),
            '{}'::jsonb
        )
        FROM unnest("dialects") AS d
    ),
    "expectedOutputs" = (
        SELECT COALESCE(
            jsonb_object_agg(d, "expectedOutput"),
            '{}'::jsonb
        )
        FROM unnest("dialects") AS d
    );
