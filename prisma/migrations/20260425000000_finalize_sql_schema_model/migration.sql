-- Make schemaId NOT NULL (all rows already have a non-null value from Task 3)
ALTER TABLE "SQLProblem" ALTER COLUMN "schemaId" SET NOT NULL;

-- Drop the legacy sqlSchema text column
ALTER TABLE "SQLProblem" DROP COLUMN "sqlSchema";

-- Update FK constraint to use SET DEFAULT (or RESTRICT) instead of SET NULL
ALTER TABLE "SQLProblem" DROP CONSTRAINT "SQLProblem_schemaId_fkey";
ALTER TABLE "SQLProblem" ADD CONSTRAINT "SQLProblem_schemaId_fkey" FOREIGN KEY ("schemaId") REFERENCES "SqlSchema"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
