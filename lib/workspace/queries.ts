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
import { excludeLockedProblems } from "@/lib/contest-locks"
import type { PanelProblem } from "./problems-panel-model"
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
 * Which module a lesson belongs to, for display.
 *
 * A lesson can sit in more than one module. SP3 settled the tiebreak for
 * the reader's breadcrumb — lowest module position wins — and the workspace
 * uses the same rule so one problem never reports two different modules.
 *
 * Only PUBLISHED tracks count for learners; a DRAFT track is invisible, and
 * its problems fall into the panel's "Not in a track" bucket rather than
 * leaking an unpublished module name.
 */
function lowestModule(
    moduleLessons: Array<{
        module: {
            id: string
            name: string
            position: number
            track: { status: string }
        }
    }>,
    allowDraft: boolean
): { id: string; name: string; position: number } | null {
    const visible = moduleLessons
        .filter((ml) => allowDraft || ml.module.track.status === "PUBLISHED")
        .map((ml) => ml.module)
    if (visible.length === 0) return null
    return visible.reduce((lowest, m) => (m.position < lowest.position ? m : lowest))
}

/**
 * Every published problem, with the module it belongs to and whether this
 * user has solved it — the whole catalog, because the panel groups by module
 * but is not scoped to one track.
 *
 * Contest-locked problems are excluded via the shared helper, so a locked
 * problem cannot be reached from the panel while it is locked.
 */
export const getWorkspaceProblemsPanel = cache(
    async (
        userId: string | null,
        allowDraft = false
    ): Promise<PanelProblem[]> => {
        const problems = await prisma.sQLProblem.findMany({
            where: excludeLockedProblems({ status: "PUBLISHED" }),
            orderBy: { number: "asc" },
            select: {
                id: true,
                number: true,
                slug: true,
                title: true,
                difficulty: true,
                attemptCount: true,
                acceptedCount: true,
                tags: { select: { slug: true }, orderBy: { slug: "asc" } },
                lessonCheckpoint: {
                    select: {
                        article: {
                            select: {
                                status: true,
                                moduleLessons: {
                                    select: {
                                        module: {
                                            select: {
                                                id: true,
                                                name: true,
                                                position: true,
                                                track: { select: { status: true } },
                                            },
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
            },
        })

        const solved = new Set<string>()
        if (userId && problems.length > 0) {
            const accepted = await prisma.submission.findMany({
                where: {
                    userId,
                    status: "ACCEPTED",
                    problemId: { in: problems.map((p) => p.id) },
                },
                select: { problemId: true },
                distinct: ["problemId"],
            })
            for (const row of accepted) solved.add(row.problemId)
        }

        return problems.map((p) => {
            const article = p.lessonCheckpoint?.article
            const module =
                article && (allowDraft || article.status === "PUBLISHED")
                    ? lowestModule(article.moduleLessons, allowDraft)
                    : null
            return {
                number: p.number,
                slug: p.slug,
                title: p.title,
                difficulty: p.difficulty as PanelProblem["difficulty"],
                solved: solved.has(p.id),
                moduleId: module?.id ?? null,
                modulePosition: module?.position ?? null,
                moduleTitle: module?.name ?? null,
                tags: p.tags.map((t) => t.slug),
                attemptCount: p.attemptCount,
                acceptedCount: p.acceptedCount,
            }
        })
    }
)

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

        const owning = article.moduleLessons
            .filter((ml) => allowDraft || ml.module.track.status === "PUBLISHED")
            .map((ml) => ml.module)
        if (owning.length === 0) return null
        const module = owning.reduce((lowest, m) =>
            m.position < lowest.position ? m : lowest
        )

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
            trackSlug: module.track?.slug ?? "",
            moduleTitle: module.name,
            modulePosition: module.position,
        }
    }
)
