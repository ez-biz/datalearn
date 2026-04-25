-- AlterTable
ALTER TABLE "SQLProblem" ADD COLUMN     "schemaId" TEXT;

-- CreateTable
CREATE TABLE "SqlSchema" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sql" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SqlSchema_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SqlSchema_name_key" ON "SqlSchema"("name");

-- AddForeignKey
ALTER TABLE "SQLProblem" ADD CONSTRAINT "SQLProblem_schemaId_fkey" FOREIGN KEY ("schemaId") REFERENCES "SqlSchema"("id") ON DELETE SET NULL ON UPDATE CASCADE;
