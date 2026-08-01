"use server"

import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { excludeLockedProblems } from "@/lib/contest-locks"
import {
    clampProgressPercent,
    isModuleUnlocked,
    rollUpModule,
    rollUpTrack,
    type ModuleRollup,
    type TrackRollup,
} from "@/lib/curriculum-progress"

export type CurriculumCheckpoint = {
    problemId: string
    number: number
    slug: string
    title: string
    difficulty: "EASY" | "MEDIUM" | "HARD"
    solved: boolean
}

export type CurriculumLesson = {
    articleId: string
    slug: string
    title: string
    readingMinutes: number | null
    completed: boolean
    checkpoints: CurriculumCheckpoint[]
}

export type CurriculumModule = {
    id: string
    slug: string
    name: string
    description: string
    position: number
    unlocked: boolean
    lessons: CurriculumLesson[]
    rollup: ModuleRollup
}

export type TrackCurriculum = {
    trackId: string
    slug: string
    name: string
    modules: CurriculumModule[]
    rollup: TrackRollup
}

/**
 * The whole ordered curriculum for one track, with the viewer's state folded
 * in. Pass `userId: null` for anonymous viewers — everything reports
 * incomplete, which is exactly what the signed-out reader should render.
 *
 * `unlocked` is ADVISORY. It drives the "Locked until 02" affordance and
 * nothing else — no caller may use it to gate access.
 */
export async function getTrackCurriculum(
    trackSlug: string,
    userId: string | null,
): Promise<TrackCurriculum | null> {
    const track = await prisma.track.findUnique({
        where: { slug: trackSlug },
        select: {
            id: true,
            slug: true,
            name: true,
            modules: {
                orderBy: { position: "asc" },
                select: {
                    id: true,
                    slug: true,
                    name: true,
                    description: true,
                    position: true,
                    lessons: {
                        orderBy: { position: "asc" },
                        select: {
                            article: {
                                select: {
                                    id: true,
                                    slug: true,
                                    title: true,
                                    readingMinutes: true,
                                    checkpoints: {
                                        orderBy: { position: "asc" },
                                        select: {
                                            problem: {
                                                select: {
                                                    id: true,
                                                    number: true,
                                                    slug: true,
                                                    title: true,
                                                    difficulty: true,
                                                    status: true,
                                                },
                                            },
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
    if (!track) return null

    const articleIds = track.modules.flatMap((m) =>
        m.lessons.map((l) => l.article.id),
    )
    const allProblemIds = track.modules.flatMap((m) =>
        m.lessons.flatMap((l) => l.article.checkpoints.map((c) => c.problem.id)),
    )

    // Contest-locked problems are hidden from learners, exactly as
    // lib/tracks.ts does for track items.
    const visibleProblems = allProblemIds.length
        ? await prisma.sQLProblem.findMany({
              where: excludeLockedProblems({
                  id: { in: allProblemIds },
                  status: "PUBLISHED",
              }),
              select: { id: true },
          })
        : []
    const visibleProblemIds = new Set(visibleProblems.map((p) => p.id))

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
        if (visibleProblemIds.size) {
            const accepted = await prisma.submission.findMany({
                where: {
                    userId,
                    status: "ACCEPTED",
                    problemId: { in: [...visibleProblemIds] },
                },
                select: { problemId: true },
                distinct: ["problemId"],
            })
            for (const row of accepted) solvedProblemIds.add(row.problemId)
        }
    }

    const rollups: ModuleRollup[] = []
    const modules: Omit<CurriculumModule, "unlocked">[] = track.modules.map(
        (m) => {
            const lessons: CurriculumLesson[] = m.lessons.map((l) => ({
                articleId: l.article.id,
                slug: l.article.slug,
                title: l.article.title,
                readingMinutes: l.article.readingMinutes,
                completed: completedArticleIds.has(l.article.id),
                checkpoints: l.article.checkpoints
                    .filter((c) => visibleProblemIds.has(c.problem.id))
                    .map((c) => ({
                        problemId: c.problem.id,
                        number: c.problem.number,
                        slug: c.problem.slug,
                        title: c.problem.title,
                        difficulty: c.problem.difficulty,
                        solved: solvedProblemIds.has(c.problem.id),
                    })),
            }))

            const rollup = rollUpModule({
                moduleId: m.id,
                lessons: lessons.map((l) => ({
                    articleId: l.articleId,
                    completed: l.completed,
                })),
                problems: lessons.flatMap((l) =>
                    l.checkpoints.map((c) => ({
                        problemId: c.problemId,
                        solved: c.solved,
                    })),
                ),
            })
            rollups.push(rollup)

            return {
                id: m.id,
                slug: m.slug,
                name: m.name,
                description: m.description,
                position: m.position,
                lessons,
                rollup,
            }
        },
    )

    return {
        trackId: track.id,
        slug: track.slug,
        name: track.name,
        modules: modules.map((m, i) => ({
            ...m,
            unlocked: isModuleUnlocked(rollups, i),
        })),
        rollup: rollUpTrack(rollups),
    }
}

/**
 * Record how far the signed-in reader has scrolled through a lesson.
 * Monotonic — the stored percent never decreases. Auto-completes at 100.
 * Anonymous callers are a silent no-op: reading is free, nothing persists.
 */
export async function recordLessonProgress(
    articleSlug: string,
    percent: number,
): Promise<{ ok: boolean; percent: number; completed: boolean }> {
    const session = await auth()
    const userId = session?.user?.id
    if (!userId) return { ok: false, percent: 0, completed: false }

    const article = await prisma.article.findUnique({
        where: { slug: articleSlug },
        select: { id: true },
    })
    if (!article) return { ok: false, percent: 0, completed: false }

    const existing = await prisma.lessonProgress.findUnique({
        where: { userId_articleId: { userId, articleId: article.id } },
        select: { percent: true, completedAt: true },
    })

    const next = clampProgressPercent(existing?.percent ?? 0, percent)
    const completedAt =
        existing?.completedAt ?? (next >= 100 ? new Date() : null)

    await prisma.lessonProgress.upsert({
        where: { userId_articleId: { userId, articleId: article.id } },
        create: {
            userId,
            articleId: article.id,
            percent: next,
            completedAt,
        },
        update: { percent: next, completedAt },
    })

    return { ok: true, percent: next, completed: completedAt !== null }
}
