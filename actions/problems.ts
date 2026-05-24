"use server"

import { prisma } from "@/lib/prisma"
import { excludeLockedProblems } from "@/lib/contest-locks"

/**
 * Public problem listing — only PUBLISHED problems.
 *
 * SECURITY: explicit `select` to keep `expectedOutput` (the answer key)
 * and `solutionSql` (the canonical answer query) off the wire.
 * Anything in this projection is shipped to the browser via the page's
 * server-rendered HTML, so the field list is the public contract.
 *
 * Admin views go through /api/admin/problems instead.
 */
export async function getProblems() {
    try {
        const problems = await prisma.sQLProblem.findMany({
            where: excludeLockedProblems({ status: "PUBLISHED" }),
            orderBy: { number: "asc" },
            select: {
                id: true,
                number: true,
                slug: true,
                title: true,
                description: true,
                difficulty: true,
                dialects: true,
                tags: {
                    select: { slug: true, name: true, kind: true },
                    orderBy: { name: "asc" },
                },
            },
        })
        return { success: true, data: problems }
    } catch {
        return { success: false, data: [] }
    }
}

/**
 * Public problem detail — only PUBLISHED problems are exposed by slug.
 * Returns null for DRAFT/BETA/ARCHIVED so user-facing pages 404.
 *
 * SECURITY: `expectedOutput` is included server-side only — the page
 * parses it into a small column/row preview that gets passed to the
 * client. The full string is never serialized into the React tree.
 * `solutionSql` is intentionally excluded entirely.
 */
/**
 * Resolve a problem's slug from its stable display number. Used for the
 * `/practice/<n>` shortcut, which redirects to `/practice/<slug>`.
 * Returns null for non-published or unknown numbers so the page 404s.
 */
export async function getSlugByNumber(number: number): Promise<string | null> {
    try {
        const problem = await prisma.sQLProblem.findUnique({
            where: { number },
            select: { slug: true, status: true },
        })
        if (!problem || problem.status !== "PUBLISHED") return null
        return problem.slug
    } catch {
        return null
    }
}

export async function getProblem(slug: string) {
    try {
        const problem = await prisma.sQLProblem.findUnique({
            where: { slug },
            select: {
                id: true,
                number: true,
                slug: true,
                title: true,
                description: true,
                difficulty: true,
                status: true,
                schemaDescription: true,
                schemaId: true,
                schema: { select: { id: true, name: true, sql: true } },
                expectedOutput: true,
                expectedOutputs: true,
                ordered: true,
                hints: true,
                dialects: true,
                createdAt: true,
                updatedAt: true,
                relatedArticles: {
                    where: { status: "PUBLISHED" },
                    select: {
                        id: true,
                        slug: true,
                        title: true,
                        summary: true,
                        readingMinutes: true,
                        topic: { select: { slug: true } },
                    },
                    take: 4,
                },
                contestLock: {
                    select: {
                        unlocksAt: true,
                        contest: {
                            select: {
                                slug: true,
                                title: true,
                                endsAt: true,
                            },
                        },
                    },
                },
            },
        })
        if (!problem || problem.status !== "PUBLISHED") {
            return { success: true, data: null }
        }
        return { success: true, data: problem }
    } catch {
        return { success: false, data: null }
    }
}

export type PublicTagSummary = {
    slug: string
    name: string
    kind: "TOPIC" | "COMPANY"
    problemCount: number
}

/**
 * Tags that have at least one PUBLISHED problem, sorted by published
 * problem count (desc) then name (asc). Drives the `/practice/tags`
 * index. Tags with zero PUBLISHED problems are excluded so the index
 * never shows ghost entries (a DRAFT-only tag would be confusing for
 * learners and create dead pages for SEO crawlers).
 *
 * NOTE: counts only published. If the catalog grows past ~500 problems
 * and this becomes a hotspot, denormalize `publishedProblemCount` onto
 * `Tag`. Not pre-optimizing.
 */
export async function getPublicTags(): Promise<PublicTagSummary[]> {
    try {
        const tags = await prisma.tag.findMany({
            select: {
                slug: true,
                name: true,
                kind: true,
                _count: {
                    select: {
                        problems: {
                            where: excludeLockedProblems({
                                status: "PUBLISHED",
                            }),
                        },
                    },
                },
            },
        })
        return tags
            .map((t) => ({
                slug: t.slug,
                name: t.name,
                kind: t.kind,
                problemCount: t._count.problems,
            }))
            .filter((t) => t.problemCount > 0)
            .sort((a, b) => {
                if (b.problemCount !== a.problemCount) {
                    return b.problemCount - a.problemCount
                }
                return a.name.localeCompare(b.name)
            })
    } catch {
        return []
    }
}

export async function getPublicTagsByKind(
    kind: "TOPIC" | "COMPANY",
): Promise<PublicTagSummary[]> {
    const tags = await getPublicTags()
    return tags.filter((tag) => tag.kind === kind)
}

export type PublicProblemSummary = {
    id: string
    number: number
    slug: string
    title: string
    description: string | null
    difficulty: "EASY" | "MEDIUM" | "HARD"
    dialects: ("DUCKDB" | "POSTGRES")[]
    tags: { slug: string; name: string; kind: "TOPIC" | "COMPANY" }[]
}

/**
 * Tag detail data — the tag metadata plus its PUBLISHED problems in
 * stable number-asc order (same ordering invariant as `getProblems`).
 *
 * Returns `{ tag: null, problems: [] }` when:
 *   - the slug doesn't match any tag
 *   - the tag exists but has zero PUBLISHED problems
 * The caller treats both as 404 so we never render an empty tag page.
 */
export async function getProblemsByTag(slug: string): Promise<{
    tag: { slug: string; name: string; kind: "TOPIC" | "COMPANY" } | null
    problems: PublicProblemSummary[]
}> {
    try {
        const tag = await prisma.tag.findUnique({
            where: { slug },
            select: {
                slug: true,
                name: true,
                kind: true,
                problems: {
                    where: excludeLockedProblems({ status: "PUBLISHED" }),
                    orderBy: { number: "asc" },
                    select: {
                        id: true,
                        number: true,
                        slug: true,
                        title: true,
                        description: true,
                        difficulty: true,
                        dialects: true,
                        tags: {
                            select: { slug: true, name: true, kind: true },
                            orderBy: { name: "asc" },
                        },
                    },
                },
            },
        })
        if (!tag || tag.problems.length === 0) {
            return { tag: null, problems: [] }
        }
        return {
            tag: { slug: tag.slug, name: tag.name, kind: tag.kind },
            problems: tag.problems,
        }
    } catch {
        return { tag: null, problems: [] }
    }
}
