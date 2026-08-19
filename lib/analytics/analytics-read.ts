import { prisma } from "@/lib/prisma"
import { toDayKey } from "@/lib/profile-stats"
import { findDrift, type DriftReport } from "./counter-drift"
import {
    dailySeries,
    type DayBucket,
    windowBounds,
} from "./metric-windows"

export interface PlatformSeries {
    signups: DayBucket[]
    submissions: DayBucket[]
    accepted: DayBucket[]
    practiceActive: DayBucket[]
    lessonsCompleted: DayBucket[]
    learnActiveInWindow: number
}

export interface RetentionInputs {
    cohorts: Map<string, string[]>
    activityByUser: Map<string, Set<string>>
}

export interface FunnelCounts {
    signedUp: number
    submitted: number
    accepted: number
}

export interface ProblemPerformanceRow {
    problemId: string
    number: number
    title: string
    slug: string
    attempts: number
    accepted: number
    distinctSolvers: number
    firstTryAccepted: number
    distinctAttempters: number
}

function addActivity(
    activityByUser: Map<string, Set<string>>,
    userId: string,
    occurredAt: Date
): void {
    const days = activityByUser.get(userId) ?? new Set<string>()
    days.add(toDayKey(occurredAt))
    activityByUser.set(userId, days)
}

export async function getPlatformSeries(
    windowDays: number,
    endDay: Date
): Promise<PlatformSeries> {
    const { start, end } = windowBounds(windowDays, endDay)
    const [users, submissions, lessonCompletions, learnActivity] =
        await Promise.all([
            prisma.user.findMany({
                where: { createdAt: { gte: start, lt: end } },
                select: { createdAt: true },
            }),
            prisma.submission.findMany({
                where: { createdAt: { gte: start, lt: end } },
                select: { createdAt: true, status: true, userId: true },
            }),
            prisma.lessonProgress.findMany({
                where: { completedAt: { gte: start, lt: end } },
                select: { completedAt: true },
            }),
            prisma.lessonProgress.findMany({
                where: { updatedAt: { gte: start, lt: end } },
                distinct: ["userId"],
                select: { userId: true },
            }),
        ])

    const practiceActivity = new Map<string, Date>()
    for (const submission of submissions) {
        const day = toDayKey(submission.createdAt)
        practiceActivity.set(`${day}:${submission.userId}`, submission.createdAt)
    }

    return {
        signups: dailySeries(
            users.map((user) => user.createdAt),
            windowDays,
            endDay
        ),
        submissions: dailySeries(
            submissions.map((submission) => submission.createdAt),
            windowDays,
            endDay
        ),
        accepted: dailySeries(
            submissions
                .filter((submission) => submission.status === "ACCEPTED")
                .map((submission) => submission.createdAt),
            windowDays,
            endDay
        ),
        practiceActive: dailySeries(
            [...practiceActivity.values()],
            windowDays,
            endDay
        ),
        lessonsCompleted: dailySeries(
            lessonCompletions.flatMap((progress) =>
                progress.completedAt ? [progress.completedAt] : []
            ),
            windowDays,
            endDay
        ),
        learnActiveInWindow: learnActivity.length,
    }
}

export async function getRetentionInputs(
    windowDays: number,
    endDay: Date
): Promise<RetentionInputs> {
    const { start, end } = windowBounds(windowDays, endDay)
    const users = await prisma.user.findMany({
        where: { createdAt: { gte: start, lt: end } },
        select: { id: true, createdAt: true },
    })

    const cohorts = new Map<string, string[]>()
    for (const user of users) {
        const cohortDay = toDayKey(user.createdAt)
        const cohort = cohorts.get(cohortDay) ?? []
        cohort.push(user.id)
        cohorts.set(cohortDay, cohort)
    }

    const userIds = users.map((user) => user.id)
    if (userIds.length === 0) {
        return { cohorts, activityByUser: new Map() }
    }

    const [submissions, lessonProgress] = await Promise.all([
        prisma.submission.findMany({
            where: { userId: { in: userIds } },
            select: { userId: true, createdAt: true },
        }),
        prisma.lessonProgress.findMany({
            where: { userId: { in: userIds } },
            select: { userId: true, updatedAt: true },
        }),
    ])

    const activityByUser = new Map<string, Set<string>>()
    for (const submission of submissions) {
        addActivity(activityByUser, submission.userId, submission.createdAt)
    }
    for (const progress of lessonProgress) {
        addActivity(activityByUser, progress.userId, progress.updatedAt)
    }

    return { cohorts, activityByUser }
}

export async function getFunnelCounts(
    windowDays: number,
    endDay: Date
): Promise<FunnelCounts> {
    const { start, end } = windowBounds(windowDays, endDay)
    const users = await prisma.user.findMany({
        where: { createdAt: { gte: start, lt: end } },
        select: { id: true },
    })

    if (users.length === 0) {
        return { signedUp: 0, submitted: 0, accepted: 0 }
    }

    const userIds = users.map((user) => user.id)
    const [submittingUsers, acceptedUsers] = await Promise.all([
        prisma.submission.findMany({
            where: { userId: { in: userIds } },
            distinct: ["userId"],
            select: { userId: true },
        }),
        prisma.submission.findMany({
            where: { userId: { in: userIds }, status: "ACCEPTED" },
            distinct: ["userId"],
            select: { userId: true },
        }),
    ])

    return {
        signedUp: users.length,
        submitted: submittingUsers.length,
        accepted: acceptedUsers.length,
    }
}

export async function getProblemPerformance(): Promise<
    ProblemPerformanceRow[]
> {
    const [problems, submissions] = await Promise.all([
        prisma.sQLProblem.findMany({
            where: { status: "PUBLISHED" },
            select: { id: true, number: true, title: true, slug: true },
            orderBy: { number: "asc" },
        }),
        prisma.submission.findMany({
            select: {
                id: true,
                problemId: true,
                userId: true,
                status: true,
                createdAt: true,
            },
            orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        }),
    ])

    const metricsByProblem = new Map<
        string,
        {
            attempts: number
            accepted: number
            solvers: Set<string>
            attempters: Set<string>
            firstTryAccepted: number
        }
    >()
    const firstAttempts = new Set<string>()

    for (const submission of submissions) {
        const metrics = metricsByProblem.get(submission.problemId) ?? {
            attempts: 0,
            accepted: 0,
            solvers: new Set<string>(),
            attempters: new Set<string>(),
            firstTryAccepted: 0,
        }
        metrics.attempts += 1
        metrics.attempters.add(submission.userId)
        if (submission.status === "ACCEPTED") {
            metrics.accepted += 1
            metrics.solvers.add(submission.userId)
        }

        const attemptKey = `${submission.problemId}:${submission.userId}`
        if (!firstAttempts.has(attemptKey)) {
            firstAttempts.add(attemptKey)
            if (submission.status === "ACCEPTED") {
                metrics.firstTryAccepted += 1
            }
        }
        metricsByProblem.set(submission.problemId, metrics)
    }

    return problems.map((problem) => {
        const metrics = metricsByProblem.get(problem.id)
        return {
            problemId: problem.id,
            number: problem.number,
            title: problem.title,
            slug: problem.slug,
            attempts: metrics?.attempts ?? 0,
            accepted: metrics?.accepted ?? 0,
            distinctSolvers: metrics?.solvers.size ?? 0,
            firstTryAccepted: metrics?.firstTryAccepted ?? 0,
            distinctAttempters: metrics?.attempters.size ?? 0,
        }
    })
}

export async function getCounterDriftReport(): Promise<DriftReport> {
    const [problems, submissions] = await Promise.all([
        prisma.sQLProblem.findMany({
            select: {
                id: true,
                number: true,
                title: true,
                attemptCount: true,
                acceptedCount: true,
            },
        }),
        prisma.submission.groupBy({
            by: ["problemId", "status"],
            _count: { _all: true },
        }),
    ])

    const truth = new Map<string, { attempts: number; accepted: number }>()
    for (const submission of submissions) {
        const counts = truth.get(submission.problemId) ?? {
            attempts: 0,
            accepted: 0,
        }
        counts.attempts += submission._count._all
        if (submission.status === "ACCEPTED") {
            counts.accepted += submission._count._all
        }
        truth.set(submission.problemId, counts)
    }

    return findDrift(
        problems.map((problem) => ({
            problemId: problem.id,
            number: problem.number,
            title: problem.title,
            attemptCount: problem.attemptCount,
            acceptedCount: problem.acceptedCount,
        })),
        truth
    )
}

export async function writeDailySnapshot(day: string): Promise<void> {
    // Keep the aggregate vector internally consistent even while mutable
    // platform state changes. The upsert stays outside this transaction so
    // concurrent retries retain ordinary first-write-wins behavior.
    const [
        registeredUsers,
        publishedProblems,
        publishedArticles,
        publishedTracks,
        lessonsInProgress,
    ] = await prisma.$transaction(
        [
            prisma.user.count(),
            prisma.sQLProblem.count({ where: { status: "PUBLISHED" } }),
            prisma.article.count({ where: { status: "PUBLISHED" } }),
            prisma.track.count({ where: { status: "PUBLISHED" } }),
            prisma.lessonProgress.count({
                where: { completedAt: null, percent: { gt: 0 } },
            }),
        ],
        { isolationLevel: "RepeatableRead" }
    )

    const data = {
        registeredUsers,
        publishedProblems,
        publishedArticles,
        publishedTracks,
        lessonsInProgress,
    }

    await prisma.metricSnapshot.upsert({
        where: { day },
        create: { day, ...data },
        update: {},
    })
}

export interface TrackCompletionRow {
    trackId: string
    name: string
    slug: string
    lessonCount: number
    learnersStarted: number
    learnersCompleted: number
}

/**
 * Per-track completion for published tracks.
 *
 * "Completed" means the learner has a completedAt on every lesson in the
 * track, not merely on some. A track with no lessons yet reports
 * lessonCount 0 and zero learners rather than a vacuous 100% — the caller
 * renders that as "No lessons yet".
 *
 * One LessonProgress query covers every track: doing it per track would be
 * an N+1 against the operational database.
 */
export async function getTrackCompletion(): Promise<TrackCompletionRow[]> {
    const tracks = await prisma.track.findMany({
        where: { status: "PUBLISHED" },
        select: {
            id: true,
            name: true,
            slug: true,
            modules: { select: { lessons: { select: { articleId: true } } } },
        },
        orderBy: { name: "asc" },
    })

    const articleIdsByTrack = new Map<string, Set<string>>()
    const allArticleIds = new Set<string>()
    for (const track of tracks) {
        const ids = new Set(
            track.modules.flatMap((module) =>
                module.lessons.map((lesson) => lesson.articleId)
            )
        )
        articleIdsByTrack.set(track.id, ids)
        for (const id of ids) allArticleIds.add(id)
    }

    const progress =
        allArticleIds.size === 0
            ? []
            : await prisma.lessonProgress.findMany({
                  where: { articleId: { in: [...allArticleIds] } },
                  select: { userId: true, articleId: true, completedAt: true },
              })

    return tracks.map((track) => {
        const articleIds = articleIdsByTrack.get(track.id) ?? new Set<string>()

        const started = new Set<string>()
        const completedPerUser = new Map<string, Set<string>>()

        for (const row of progress) {
            if (!articleIds.has(row.articleId)) continue
            started.add(row.userId)
            if (!row.completedAt) continue
            const done = completedPerUser.get(row.userId) ?? new Set<string>()
            done.add(row.articleId)
            completedPerUser.set(row.userId, done)
        }

        let learnersCompleted = 0
        if (articleIds.size > 0) {
            for (const done of completedPerUser.values()) {
                if (done.size >= articleIds.size) learnersCompleted++
            }
        }

        return {
            trackId: track.id,
            name: track.name,
            slug: track.slug,
            lessonCount: articleIds.size,
            learnersStarted: started.size,
            learnersCompleted,
        }
    })
}
