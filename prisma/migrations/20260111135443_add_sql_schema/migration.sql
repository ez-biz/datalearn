/*
  Warnings:

  - Added the required column `sqlSchema` to the `SQLProblem` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "SQLProblem" ADD COLUMN     "sqlSchema" TEXT NOT NULL;
