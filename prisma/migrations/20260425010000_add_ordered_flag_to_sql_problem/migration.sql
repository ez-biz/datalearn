-- Add ordered flag (default false). Used by the SQL validator to decide
-- whether row order is part of correctness for a given problem.
ALTER TABLE "SQLProblem" ADD COLUMN "ordered" BOOLEAN NOT NULL DEFAULT false;
