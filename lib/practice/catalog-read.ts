// Server-side read for "the whole published problem catalog, with per-viewer
// state". Prisma lives here; consumers (the practice catalog page, the
// workspace's problems panel) do their own pure shaping on top of this.
//
// NOT a "use server" module, deliberately — same reasoning as
// lib/curriculum-read.ts. This takes an explicit `userId`, and every export
// of a "use server" file becomes a client-callable RPC endpoint, so
// exporting this from one would let any client read any other user's solved
// or attempted state. Server components import it directly; nothing
// client-side needs to call it.

import { cache } from "react"
import { prisma } from "@/lib/prisma"
import { excludeLockedProblems } from "@/lib/contest-locks"

export type CatalogProblem = {
    number: number
    slug: string
    title: string
    difficulty: "EASY" | "MEDIUM" | "HARD"
    solved: boolean
    /** True when the viewer has any submission, accepted or not. */
    attempted: boolean
    moduleId: string | null
    modulePosition: number | null
    moduleTitle: string | null
    /** Tag slugs split by kind, for the two facet groups. */
    topicTags: string[]
    companyTags: string[]
    dialects: ("DUCKDB" | "POSTGRES")[]
    attemptCount: number
    acceptedCount: number
    createdAt: Date
}

/**
 * Which module a lesson belongs to, for display.
 *
 * A lesson can sit in more than one module. SP3 settled the tiebreak for
 * the reader's breadcrumb — lowest module position wins — and every other
 * consumer (the catalog, the workspace panel, the workspace's checkpoint
 * context bar) uses this same function so one problem never reports two
 * different modules depending on which screen you're looking at.
 *
 * Only PUBLISHED tracks count for learners; a DRAFT track is invisible, and
 * its problems fall into the "not in a track" bucket rather than leaking an
 * unpublished module name.
 *
 * Generic over the module shape so callers that need extra fields (the
 * checkpoint context bar needs `track.slug`, the catalog/panel do not) get
 * them back typed, without a second copy of the tiebreak logic.
 */
export function lowestModule<M extends { position: number; track: { status: string } }>(
    moduleLessons: Array<{ module: M }>,
    allowDraft: boolean
): M | null {
    const visible = moduleLessons
        .filter((ml) => allowDraft || ml.module.track.status === "PUBLISHED")
        .map((ml) => ml.module)
    if (visible.length === 0) return null
    return visible.reduce((lowest, m) => (m.position < lowest.position ? m : lowest))
}

/**
 * Every published problem, with the module it belongs to and this viewer's
 * solved/attempted state — the whole catalog, because both the practice
 * catalog page and the workspace panel render the same list, just grouped
 * and filtered differently.
 *
 * Contest-locked problems are excluded via the shared helper, so a locked
 * problem cannot be reached from either screen while it is locked.
 */
export const getCatalogProblems = cache(
    async (
        userId: string | null,
        allowDraft = false
    ): Promise<CatalogProblem[]> => {
        const problems = await prisma.sQLProblem.findMany({
            where: excludeLockedProblems({ status: "PUBLISHED" }),
            orderBy: { number: "asc" },
            select: {
                id: true,
                number: true,
                slug: true,
                title: true,
                difficulty: true,
                dialects: true,
                createdAt: true,
                attemptCount: true,
                acceptedCount: true,
                tags: {
                    select: { slug: true, kind: true },
                    orderBy: { slug: "asc" },
                },
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
        const attempted = new Set<string>()
        if (userId && problems.length > 0) {
            const problemIds = problems.map((p) => p.id)
            const [accepted, anySubmission] = await Promise.all([
                prisma.submission.findMany({
                    where: {
                        userId,
                        status: "ACCEPTED",
                        problemId: { in: problemIds },
                    },
                    select: { problemId: true },
                    distinct: ["problemId"],
                }),
                prisma.submission.findMany({
                    where: {
                        userId,
                        problemId: { in: problemIds },
                    },
                    select: { problemId: true },
                    distinct: ["problemId"],
                }),
            ])
            for (const row of accepted) solved.add(row.problemId)
            for (const row of anySubmission) attempted.add(row.problemId)
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
                difficulty: p.difficulty as CatalogProblem["difficulty"],
                solved: solved.has(p.id),
                attempted: attempted.has(p.id),
                moduleId: module?.id ?? null,
                modulePosition: module?.position ?? null,
                moduleTitle: module?.name ?? null,
                topicTags: p.tags
                    .filter((t) => t.kind !== "COMPANY")
                    .map((t) => t.slug),
                companyTags: p.tags
                    .filter((t) => t.kind === "COMPANY")
                    .map((t) => t.slug),
                dialects: p.dialects as CatalogProblem["dialects"],
                attemptCount: p.attemptCount,
                acceptedCount: p.acceptedCount,
                createdAt: p.createdAt,
            }
        })
    }
)
