import { NextResponse } from "next/server"
import { withAdmin } from "@/lib/api-auth"
import { snapshotArticleVersion } from "@/lib/article-versions"
import { prisma } from "@/lib/prisma"
import { stripFigureByUrl } from "@/lib/uploads/article-unlink"
import { delBlobWithRetry } from "@/lib/uploads/blob"
import { releaseBytes } from "@/lib/uploads/quota"

export const DELETE = withAdmin(
    async (_req, principal, { params }: { params: Promise<{ id: string }> }) => {
        const { id } = await params
        const asset = await prisma.asset.findUnique({ where: { id } })
        if (!asset) {
            return NextResponse.json({ error: "not-found" }, { status: 404 })
        }
        if (asset.status !== "ACTIVE") {
            return NextResponse.json(
                { error: "bad-status", status: asset.status },
                { status: 409 }
            )
        }
        if (!asset.blobUrl) {
            return NextResponse.json({ error: "no-blob-url" }, { status: 500 })
        }

        const blobUrl = asset.blobUrl
        const referencing = await prisma.article.findMany({
            where: { content: { contains: blobUrl } },
            select: {
                id: true,
                slug: true,
                content: true,
                status: true,
            },
        })

        const affectedArticles: {
            slug: string
            snapshotVersion?: number
        }[] = []

        await prisma.$transaction(async (tx) => {
            await tx.asset.update({
                where: { id },
                data: { status: "DELETING", deletedAt: new Date() },
            })

            for (const article of referencing) {
                const stripped = stripFigureByUrl(article.content, blobUrl)
                if (stripped === article.content) continue

                await tx.article.update({
                    where: { id: article.id },
                    data: { content: stripped },
                })

                if (article.status === "PUBLISHED") {
                    const version = await snapshotArticleVersion(
                        tx,
                        article.id,
                        principal.userId
                    )
                    affectedArticles.push({
                        slug: article.slug,
                        ...(version ? { snapshotVersion: version } : {}),
                    })
                } else {
                    affectedArticles.push({ slug: article.slug })
                }
            }
        })

        try {
            await delBlobWithRetry(blobUrl)
            await prisma.$transaction(async (tx) => {
                await tx.asset.update({
                    where: { id },
                    data: {
                        status: "DELETED",
                        lastDeletionError: null,
                        quotaReleasedAt: new Date(),
                    },
                })
                await releaseBytes(tx, asset.ownerId, asset.bytes)
            })
            return NextResponse.json({
                assetId: id,
                blobDeleted: true,
                status: "DELETED",
                affectedArticles,
            })
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error)
            await prisma.asset.update({
                where: { id },
                data: {
                    deletionAttempts: { increment: 4 },
                    lastDeletionError: message.slice(0, 500),
                },
            })
            return NextResponse.json(
                {
                    assetId: id,
                    blobDeleted: false,
                    status: "DELETING",
                    affectedArticles,
                    retryAttempts: 4,
                    lastError: message,
                },
                { status: 502 }
            )
        }
    }
)
