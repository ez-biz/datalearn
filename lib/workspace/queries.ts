// Server-side reads for the workspace. Prisma lives here; the pure shaping
// lives in problems-panel-model.ts and checkpoint-context.ts.
//
// NOT a "use server" module, deliberately — same reasoning as
// lib/curriculum-read.ts. These take an explicit `userId`, and every export
// of a "use server" file becomes a client-callable RPC endpoint, so
// exporting them from one would let any client read any other user's
// solved state. The practice page is a server component and imports these
// directly; nothing client-side needs to call them.

import { cache } from "react"
import { prisma } from "@/lib/prisma"
import { lowestModule } from "@/lib/practice/catalog-read"
import {
    resolveCheckpointPosition,
    type CheckpointPosition,
} from "./checkpoint-context"

export type CheckpointContext = CheckpointPosition & {
    lessonSlug: string
    lessonTitle: string
    trackSlug: string
    moduleTitle: string
    /** 0-indexed, as stored. Render with modulePrefix(). */
    modulePosition: number
}

/**
 * Where this problem sits in its lesson, for the context bar — or null when
 * it has no curriculum link, in which case no bar renders.
 */
export const getCheckpointContext = cache(
    async (
        problemId: string,
        allowDraft = false
    ): Promise<CheckpointContext | null> => {
        const checkpoint = await prisma.lessonCheckpoint.findUnique({
            where: { problemId },
            select: {
                problem: { select: { slug: true } },
                article: {
                    select: {
                        slug: true,
                        title: true,
                        status: true,
                        checkpoints: {
                            orderBy: { position: "asc" },
                            select: {
                                position: true,
                                problem: { select: { slug: true } },
                            },
                        },
                        moduleLessons: {
                            select: {
                                module: {
                                    select: {
                                        id: true,
                                        name: true,
                                        position: true,
                                        track: {
                                            select: { slug: true, status: true },
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
            },
        })
        if (!checkpoint) return null

        const article = checkpoint.article
        if (!allowDraft && article.status !== "PUBLISHED") return null

        const mod = lowestModule(article.moduleLessons, allowDraft)
        if (!mod) return null

        const position = resolveCheckpointPosition(
            article.checkpoints.map((c) => ({
                problemSlug: c.problem.slug,
                position: c.position,
            })),
            checkpoint.problem.slug
        )
        if (!position) return null

        return {
            ...position,
            lessonSlug: article.slug,
            lessonTitle: article.title,
            trackSlug: mod.track?.slug ?? "",
            moduleTitle: mod.name,
            modulePosition: mod.position,
        }
    }
)
