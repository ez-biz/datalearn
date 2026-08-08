import { prisma } from "@/lib/prisma"
import { excludeLockedProblems } from "@/lib/contest-locks"
import {
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
 *
 * NOT a server action, deliberately: it takes an explicit userId, so
 * exporting it from a "use server" module would let any client read any
 * other user's per-lesson `completed` and per-problem `solved` state.
 * `actions/curriculum.ts` resolves the session and delegates here.
 */
export async function getTrackCurriculumForUser(
    trackSlug: string,
    userId: string | null,
    options: { allowDraft?: boolean } = {},
): Promise<TrackCurriculum | null> {
    // An unpublished track is invisible to learners. Staff get a preview so
    // a track can be reviewed before the deliberate human act of publishing
    // it — see app/admin/layout.tsx for the matching ADMIN/MODERATOR gate.
    // `findFirst` (not `findUnique`) because `status` makes the where-clause
    // non-unique.
    const track = await prisma.track.findFirst({
        where: {
            slug: trackSlug,
            ...(options.allowDraft ? {} : { status: "PUBLISHED" }),
        },
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
                        where: { article: { status: "PUBLISHED" } },
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
