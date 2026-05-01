-- CreateEnum
CREATE TYPE "Dialect" AS ENUM ('DUCKDB', 'POSTGRES');

-- AlterTable
ALTER TABLE "SQLProblem" ADD COLUMN     "dialects" "Dialect"[] DEFAULT ARRAY['DUCKDB', 'POSTGRES']::"Dialect"[];
