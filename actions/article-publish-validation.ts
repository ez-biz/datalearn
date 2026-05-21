import "server-only"
import { prisma } from "@/lib/prisma"
import {
    validateArticleDirectivesSyntactic,
    type ArticleDirectiveError,
} from "@/lib/admin-validation"

export interface PublishValidationOk {
    ok: true
    hasVisualBlocks: boolean
}

export interface PublishValidationErr {
    ok: false
    errors: ArticleDirectiveError[]
}

export type PublishValidationResult =
    | PublishValidationOk
    | PublishValidationErr

export async function validateArticleDirectivesForPublish(
    content: string,
    articleAuthorId: string
): Promise<PublishValidationResult> {
    const syntactic = validateArticleDirectivesSyntactic(content)
    if (!syntactic.ok) return { ok: false, errors: syntactic.errors }

    const blobUrls = syntactic.figureUrls.filter(
        (url) => !url.startsWith("/learn/")
    )
    if (blobUrls.length === 0) {
        return { ok: true, hasVisualBlocks: syntactic.hasVisualBlocks }
    }

    const assets = await prisma.asset.findMany({
        where: { blobUrl: { in: blobUrls } },
        select: { blobUrl: true, status: true, ownerId: true },
    })
    const byUrl = new Map(
        assets
            .filter((asset) => asset.blobUrl)
            .map((asset) => [asset.blobUrl!, asset])
    )

    const errors: ArticleDirectiveError[] = []
    for (const url of blobUrls) {
        const asset = byUrl.get(url)
        if (!asset) {
            errors.push({
                directive: "figure",
                index: -1,
                message: `figure src "${url}" has no Asset row in this app (foreign Blob rejected)`,
            })
            continue
        }
        if (asset.status !== "ACTIVE") {
            errors.push({
                directive: "figure",
                index: -1,
                message: `figure src "${url}" is ${asset.status}, not ACTIVE`,
            })
            continue
        }
        if (asset.ownerId !== articleAuthorId) {
            errors.push({
                directive: "figure",
                index: -1,
                message: `figure src "${url}" is owned by a different user; admin override is not permitted in v1`,
            })
        }
    }

    if (errors.length > 0) return { ok: false, errors }
    return { ok: true, hasVisualBlocks: syntactic.hasVisualBlocks }
}
