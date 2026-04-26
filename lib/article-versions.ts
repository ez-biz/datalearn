import type { Prisma, PrismaClient } from "@prisma/client"

type Tx = PrismaClient | Prisma.TransactionClient

/**
 * Capture an immutable snapshot of an article at the moment of publish.
 * Called when the status transitions to PUBLISHED. Must run inside the
 * same transaction as the status update so a half-applied publish can't
 * race the snapshot.
 */
export async function snapshotArticleVersion(
    tx: Tx,
    articleId: string,
    publishedById: string | null
): Promise<void> {
    const article = await tx.article.findUnique({
        where: { id: articleId },
        include: {
            tags: { select: { slug: true } },
            relatedProblems: { select: { slug: true } },
        },
    })
    if (!article) return

    const last = await tx.articleVersion.findFirst({
        where: { articleId },
        orderBy: { versionNumber: "desc" },
        select: { versionNumber: true },
    })
    const nextVersion = (last?.versionNumber ?? 0) + 1

    await tx.articleVersion.create({
        data: {
            articleId,
            versionNumber: nextVersion,
            title: article.title,
            slug: article.slug,
            content: article.content,
            summary: article.summary,
            topicId: article.topicId,
            tagSlugs: article.tags.map((t) => t.slug),
            relatedProblemSlugs: article.relatedProblems.map((p) => p.slug),
            publishedById,
        },
    })
}
