// Bounded per-user read for the tracks index: every visible track with a
// rolled-up progress summary and a resume target, in three queries total —
// regardless of how many tracks, modules, lessons or problems exist. Mirrors
// lib/curriculum-read.ts's getTrackCurriculumForUser (the single-track read)
// but batches across every track at once, so the index page doesn't run
// that read once per card (N+1 by track count).
//
// Also owns getTrackBySlugForViewer below: the single-track detail read for
// the track detail page, with the same allowDraft staff-preview gate as the
// index read above.
//
// NOT a "use server" module, deliberately — same reasoning as
// lib/curriculum-read.ts. This takes an explicit userId/allowDraft, and
// every export of a "use server" file becomes a client-callable RPC
// endpoint, so exporting this from one would let any client read any other
// user's per-lesson completed state, or pass allowDraft:true to read
// DRAFT/ARCHIVED tracks. Server components import it directly; nothing
// client-side needs to call it. actions/tracks.ts's getTrackBySlug is the
// thin, session-resolving "use server" wrapper in front of
// getTrackBySlugForViewer.

import { cache } from "react"
import type { TrackStatus } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { excludeLockedProblems } from "@/lib/contest-locks"
import {
    rollUpModule,
    rollUpTrack,
    type ModuleRollup,
    type TrackRollup,
} from "@/lib/curriculum-progress"
import { findResume, type ResumeTarget } from "@/lib/learn/tracks-model"

/**
 * Rollup for a track authored under the older TrackItem model: every item is
 * a problem, there are no lessons, so the percentage is purely problems
 * solved. Shaped as a TrackRollup so callers need no special case.
 */
export function rollUpItems(
    items: Array<{ problem: { id: string } }>,
    solved: Set<string>,
): TrackRollup {
    const problemsTotal = items.length
    const problemsDone = items.filter((i) => solved.has(i.problem.id)).length
    return {
        lessonsDone: 0,
        lessonsTotal: 0,
        problemsDone,
        problemsTotal,
        percent:
            problemsTotal === 0
                ? 0
                : Math.round((problemsDone / problemsTotal) * 100),
    }
}

/**
 * One module's rolled-up progress, for the signed-in home dashboard's
 * ModuleProgress card. `position` is 0-indexed straight from the DB —
 * render it through `modulePrefix` (components/learn/reader/lesson-nav.ts)
 * rather than restating the +1 to display it; a previous SP6 task shipped
 * a bug where a panel that hand-rolled `position + 1` disagreed with the
 * reader's own modulePrefix for the same module.
 */
export type ModuleProgressSummary = {
    id: string
    slug: string
    position: number
    name: string
    /** Free — Module.description, added to the existing select alongside
     *  the fields below. Consumed by the signed-out home's path preview
     *  (components/home/marketing/PathPreview.tsx) for its row subtext. */
    description: string
    percent: number
    /** Free — rollUpModule already computes these in the loop below; this
     *  just exposes them instead of discarding them. Same reasoning as
     *  `percent` itself. */
    lessonsTotal: number
    problemsTotal: number
}

export type TrackSummary = {
    slug: string
    name: string
    summary: string
    difficulty: string
    estimatedMinutes: number
    lessonsTotal: number
    problemsTotal: number
    rollup: TrackRollup
    /** Lesson to resume: first incomplete across modules in order, or null.
     *  NOT a completion signal by itself — see lib/learn/tracks-model.ts's
     *  doc on findResume and TrackSummaryCard's `isComplete`. */
    resume: ResumeTarget
    /** First unsolved problem on a track with no modules (older TrackItem
     *  model); null whenever the track has modules. */
    nextItemSlug: string | null
    /** Per-module rollups, in track order. Empty for an item-only track
     *  (no modules) or a modules-track with none yet — the dashboard's
     *  ModuleProgress card renders nothing on empty, not six empty cards.
     *  Computed from rows this query already fetches (modules -> lessons ->
     *  checkpoints -> problem); no additional query. */
    modules: ModuleProgressSummary[]
}

/**
 * Every visible track (PUBLISHED, plus DRAFT — and ARCHIVED — when
 * allowDraft, matching getTrackCurriculumForUser's visibility rule) with
 * this viewer's rolled-up progress and resume target, for the tracks index
 * card grid.
 *
 * Three queries regardless of track count:
 *   1. tracks -> modules -> lessons -> article -> checkpoints -> problem
 *      (one query, arbitrarily deep via Prisma's nested `select`);
 *   2. the viewer's completed LessonProgress rows for every article id
 *      collected from (1), one batched `IN` query;
 *   3. the viewer's ACCEPTED submissions for every problem id collected
 *      from (1), one batched `IN` query, deduped with `distinct`.
 * Rollup is then pure in-memory maths via rollUpModule/rollUpTrack — no
 * further queries as track/module/lesson count grows.
 *
 * Pass userId: null for anonymous viewers — everything reports incomplete,
 * which sends resume at the very first lesson of the first track that has
 * one, same as the signed-out reader.
 *
 * Two deliberate divergences from getTrackCurriculumForUser's notion of
 * "visible problem," both worth stating in full since a partial account of
 * a set of divergences reads as an exhaustive one:
 *
 *   - MATCHES it on publish status: checkpoints are filtered to
 *     `problem.status === "PUBLISHED"` inside the same nested select (no
 *     extra query), exactly like getTrackCurriculumForUser's
 *     `visibleProblemIds` check. A DRAFT/BETA/ARCHIVED problem is excluded
 *     from problemsTotal/rollup here exactly as it is there, so the tracks
 *     index and the track detail page report the same percentage for the
 *     same track and user.
 *   - DIVERGES on contest locks: this does NOT run the contest-lock
 *     exclusion query (excludeLockedProblems) — that queries SQLProblem
 *     separately and would make this a fourth query, defeating the
 *     bounded-query-count claim this function exists to prove. A
 *     contest-locked (but otherwise published) problem still counts toward
 *     problemsTotal/rollup here; only the single-track read enforces the
 *     lock.
 */
export const getTrackSummariesForUser = cache(
    async (
        userId: string | null,
        allowDraft = false,
    ): Promise<TrackSummary[]> => {
        const tracks = await prisma.track.findMany({
            where: allowDraft ? {} : { status: "PUBLISHED" },
            orderBy: [{ createdAt: "desc" }, { name: "asc" }],
            select: {
                slug: true,
                name: true,
                summary: true,
                difficulty: true,
                estimatedMinutes: true,
                modules: {
                    orderBy: { position: "asc" },
                    select: {
                        id: true,
                        slug: true,
                        name: true,
                        description: true,
                        position: true,
                        lessons: {
                            where: { article: { status: "PUBLISHED" } },
                            orderBy: { position: "asc" },
                            select: {
                                article: {
                                    select: {
                                        id: true,
                                        slug: true,
                                        checkpoints: {
                                            where: { problem: { status: "PUBLISHED" } },
                                            select: {
                                                problem: { select: { id: true } },
                                            },
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
                // TrackItem predates the curriculum spine. Production still
                // has published tracks built entirely from items with zero
                // modules, so the index must be able to count them — see the
                // fallback in the map below.
                items: {
                    orderBy: { position: "asc" },
                    where: { problem: { status: "PUBLISHED" } },
                    select: { problem: { select: { id: true, slug: true } } },
                },
            },
        })

        const articleIds = tracks.flatMap((t) =>
            t.modules.flatMap((m) => m.lessons.map((l) => l.article.id)),
        )
        const problemIds = [
            ...tracks.flatMap((t) =>
                t.modules.flatMap((m) =>
                    m.lessons.flatMap((l) =>
                        l.article.checkpoints.map((c) => c.problem.id),
                    ),
                ),
            ),
            ...tracks.flatMap((t) => t.items.map((i) => i.problem.id)),
        ]

        const completedArticleIds = new Set<string>()
        const solvedProblemIds = new Set<string>()

        if (userId) {
            if (articleIds.length) {
                const progress = await prisma.lessonProgress.findMany({
                    where: {
                        userId,
                        articleId: { in: articleIds },
                        completedAt: { not: null },
                    },
                    select: { articleId: true },
                })
                for (const row of progress) completedArticleIds.add(row.articleId)
            }
            if (problemIds.length) {
                const accepted = await prisma.submission.findMany({
                    where: {
                        userId,
                        status: "ACCEPTED",
                        problemId: { in: problemIds },
                    },
                    select: { problemId: true },
                    distinct: ["problemId"],
                })
                for (const row of accepted) solvedProblemIds.add(row.problemId)
            }
        }

        return tracks.map((track) => {
            const moduleRollups: ModuleRollup[] = []
            const moduleSummaries: ModuleProgressSummary[] = []
            const modulesForResume: Array<{
                slug: string
                lessons: Array<{ slug: string; completed: boolean }>
            }> = []

            for (const module of track.modules) {
                const lessons = module.lessons.map((l) => ({
                    articleId: l.article.id,
                    slug: l.article.slug,
                    completed: completedArticleIds.has(l.article.id),
                    problems: l.article.checkpoints.map((c) => ({
                        problemId: c.problem.id,
                        solved: solvedProblemIds.has(c.problem.id),
                    })),
                }))

                const moduleRollup = rollUpModule({
                    moduleId: module.id,
                    lessons: lessons.map((l) => ({
                        articleId: l.articleId,
                        completed: l.completed,
                    })),
                    problems: lessons.flatMap((l) => l.problems),
                })
                moduleRollups.push(moduleRollup)

                moduleSummaries.push({
                    id: module.id,
                    slug: module.slug,
                    position: module.position,
                    name: module.name,
                    description: module.description,
                    percent: moduleRollup.percent,
                    lessonsTotal: moduleRollup.lessonsTotal,
                    problemsTotal: moduleRollup.problemsTotal,
                })

                modulesForResume.push({
                    slug: module.slug,
                    lessons: lessons.map((l) => ({
                        slug: l.slug,
                        completed: l.completed,
                    })),
                })
            }

            // A track with no modules is authored under the older TrackItem
            // model, which the detail page still renders. Before this
            // fallback the index reported 0/0 and "No lessons yet" for such a
            // track while its own page listed a full study sequence — every
            // published track on production was in exactly that state.
            const rollup =
                track.modules.length > 0
                    ? rollUpTrack(moduleRollups)
                    : rollUpItems(track.items, solvedProblemIds)

            return {
                slug: track.slug,
                name: track.name,
                summary: track.summary,
                difficulty: track.difficulty,
                estimatedMinutes: track.estimatedMinutes,
                lessonsTotal: rollup.lessonsTotal,
                problemsTotal: rollup.problemsTotal,
                rollup,
                resume:
                    track.modules.length > 0
                        ? findResume(modulesForResume)
                        : null,
                /** First unsolved item, for an item-only track. */
                nextItemSlug:
                    track.modules.length > 0
                        ? null
                        : (track.items.find(
                              (i) => !solvedProblemIds.has(i.problem.id),
                          )?.problem.slug ?? null),
                modules: moduleSummaries,
            }
        })
    },
)

export type TrackDetail = {
    id: string
    slug: string
    name: string
    summary: string
    difficulty: "EASY" | "MEDIUM" | "HARD" | "MIXED"
    /**
     * Only ever anything but PUBLISHED for a staff viewer — the where-clause
     * in getTrackBySlugForViewer below filters unpublished tracks out for
     * everyone else, same as lib/curriculum-read.ts's TrackCurriculum. The
     * page uses it to show its "Draft — not visible to learners" banner.
     */
    status: TrackStatus
    estimatedMinutes: number
    coverImageUrl: string | null
    description: string
    items: Array<{
        id: string
        position: number
        problem: {
            id: string
            number: number
            slug: string
            title: string
            difficulty: "EASY" | "MEDIUM" | "HARD"
        }
    }>
    createdAt: Date
    updatedAt: Date
}

/**
 * One track's full detail — description, cover image, and its legacy
 * TrackItem list — for the track detail page.
 *
 * `allowDraft` mirrors getTrackCurriculumForUser's (lib/curriculum-read.ts)
 * and getTrackSummariesForUser's (above) staff gate: a DRAFT/ARCHIVED track
 * is invisible to learners (404), but staff can preview it. Callers that
 * don't pass it get the learner-only, PUBLISHED-only behavior this function
 * always had.
 *
 * This gate exists specifically so the tracks index and the detail page
 * agree on who can open a track: getTrackSummariesForUser renders a card
 * for a DRAFT track to a staff viewer, and without this param that card's
 * title link 404s here even though the lesson reader and module screen both
 * honor staff preview for the same track.
 */
export async function getTrackBySlugForViewer(
    slug: string,
    allowDraft = false,
): Promise<TrackDetail | null> {
    const track = await prisma.track.findFirst({
        where: { slug, ...(allowDraft ? {} : { status: "PUBLISHED" }) },
        select: {
            id: true,
            slug: true,
            name: true,
            summary: true,
            description: true,
            difficulty: true,
            status: true,
            estimatedMinutes: true,
            coverImageUrl: true,
            createdAt: true,
            updatedAt: true,
            items: {
                where: {
                    problem: excludeLockedProblems({ status: "PUBLISHED" }),
                },
                orderBy: { position: "asc" },
                select: {
                    id: true,
                    position: true,
                    problem: {
                        select: {
                            id: true,
                            number: true,
                            slug: true,
                            title: true,
                            difficulty: true,
                        },
                    },
                },
            },
        },
    })
    if (!track) return null

    return track
}
