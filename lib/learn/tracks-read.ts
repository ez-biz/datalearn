// Bounded per-user read for the tracks index: every visible track with a
// rolled-up progress summary and a resume target, in three queries total —
// regardless of how many tracks, modules, lessons or problems exist. Mirrors
// lib/curriculum-read.ts's getTrackCurriculumForUser (the single-track read)
// but batches across every track at once, so the index page doesn't run
// that read once per card (N+1 by track count).
//
// NOT a "use server" module, deliberately — same reasoning as
// lib/curriculum-read.ts. This takes an explicit userId, and every export of
// a "use server" file becomes a client-callable RPC endpoint, so exporting
// this from one would let any client read any other user's per-lesson
// completed state. Server components import it directly; nothing
// client-side needs to call it.

import { cache } from "react"
import { prisma } from "@/lib/prisma"
import {
    rollUpModule,
    rollUpTrack,
    type ModuleRollup,
    type TrackRollup,
} from "@/lib/curriculum-progress"
import { findResume, type ResumeTarget } from "@/lib/learn/tracks-model"

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
            },
        })

        const articleIds = tracks.flatMap((t) =>
            t.modules.flatMap((m) => m.lessons.map((l) => l.article.id)),
        )
        const problemIds = tracks.flatMap((t) =>
            t.modules.flatMap((m) =>
                m.lessons.flatMap((l) =>
                    l.article.checkpoints.map((c) => c.problem.id),
                ),
            ),
        )

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

                moduleRollups.push(
                    rollUpModule({
                        moduleId: module.id,
                        lessons: lessons.map((l) => ({
                            articleId: l.articleId,
                            completed: l.completed,
                        })),
                        problems: lessons.flatMap((l) => l.problems),
                    }),
                )

                modulesForResume.push({
                    slug: module.slug,
                    lessons: lessons.map((l) => ({
                        slug: l.slug,
                        completed: l.completed,
                    })),
                })
            }

            const rollup = rollUpTrack(moduleRollups)

            return {
                slug: track.slug,
                name: track.name,
                summary: track.summary,
                difficulty: track.difficulty,
                estimatedMinutes: track.estimatedMinutes,
                lessonsTotal: rollup.lessonsTotal,
                problemsTotal: rollup.problemsTotal,
                rollup,
                resume: findResume(modulesForResume),
            }
        })
    },
)
