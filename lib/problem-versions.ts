import type { Prisma, PrismaClient } from "@prisma/client"

type Tx = PrismaClient | Prisma.TransactionClient

/**
 * Capture an immutable snapshot of a problem at its current state.
 * Called when a problem transitions to PUBLISHED. Must run inside the
 * same transaction as the status update so we don't race a half-applied
 * publish.
 */
export async function snapshotProblemVersion(
    tx: Tx,
    problemId: string,
    publishedById: string | null
): Promise<void> {
    const problem = await tx.sQLProblem.findUnique({
        where: { id: problemId },
        include: {
            schema: { select: { sql: true } },
            tags: { select: { slug: true } },
        },
    })
    if (!problem) return

    const last = await tx.problemVersion.findFirst({
        where: { problemId },
        orderBy: { versionNumber: "desc" },
        select: { versionNumber: true },
    })
    const nextVersion = (last?.versionNumber ?? 0) + 1

    await tx.problemVersion.create({
        data: {
            problemId,
            versionNumber: nextVersion,
            title: problem.title,
            description: problem.description,
            schemaDescription: problem.schemaDescription,
            schemaSql: problem.schema.sql,
            expectedOutput: problem.expectedOutput,
            solutionSql: problem.solutionSql,
            ordered: problem.ordered,
            hints: problem.hints,
            tagSlugs: problem.tags.map((t) => t.slug),
            publishedById,
        },
    })
}
