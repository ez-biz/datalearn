// The signed-in home's single per-user read: everything the dashboard
// renders, gathered by composing reads that already exist rather than
// writing new queries where one is already available.
//
// NOT a "use server" module, deliberately — same reasoning as
// lib/curriculum-read.ts, lib/practice/catalog-read.ts and
// lib/learn/tracks-read.ts. This takes an explicit userId, and every export
// of a "use server" file becomes a client-callable RPC endpoint, so
// exporting this from one would let any client read any other user's
// progress, streak or weak spots. app/page.tsx (a server component) calls
// this directly; nothing client-side needs to.
//
// getDailyStatusForCurrentUser (actions/daily.ts) stays a separate "use
// server" action that resolves its own session — the page calls it
// directly, and this read does not fold the daily problem into `plan`.

import { prisma } from "@/lib/prisma"
import { computeWeakSpots, type WeakSpot } from "@/lib/home/weak-spots"
import { buildTodayPlan, type PlanInput, type PlanRow } from "@/lib/home/today-plan"
import {
    getTrackSummariesForUser,
    type TrackSummary,
} from "@/lib/learn/tracks-read"
import { getTrackCurriculumForUser } from "@/lib/curriculum-read"
import { getCatalogProblems } from "@/lib/practice/catalog-read"
import { buildHeatmap, computeStreaks, type DayBucket, type StreakInfo } from "@/lib/profile-stats"

export type HomeData = {
    plan: PlanRow[]
    weakSpots: WeakSpot[]
    streak: StreakInfo
    /** Exactly 7 buckets, oldest first, for the week grid. */
    week: DayBucket[]
    /** Track with the most progress, or null when there are no tracks. */
    activeTrack: TrackSummary | null
}

/**
 * The track to feature on the dashboard: whichever visible track has the
 * most progress. Ties keep the earlier one in getTrackSummariesForUser's
 * order (newest-created first, then name). A learner with no progress on
 * any track still gets one featured — the first in that same order — so the
 * dashboard always has something to anchor on rather than showing nothing
 * until progress exists. Returns null only when there are no visible tracks
 * at all.
 */
function pickActiveTrack(tracks: TrackSummary[]): TrackSummary | null {
    if (tracks.length === 0) return null
    const withProgress = tracks.filter((t) => t.rollup.percent > 0)
    if (withProgress.length === 0) return tracks[0]
    return withProgress.reduce((best, t) =>
        t.rollup.percent > best.rollup.percent ? t : best
    )
}

/**
 * Bridge TrackSummary.resume — { moduleSlug, lessonSlug } — to the fuller
 * shape buildTodayPlan needs: lessonTitle, moduleTitle, modulePosition.
 * Those live in the curriculum, not the tracks-index summary, so this makes
 * one extra read (getTrackCurriculumForUser) only when there is an active
 * track with something to resume.
 *
 * Degrades to null — never a placeholder string — whenever the target can't
 * be resolved: no active track, the track has nothing left to resume, or
 * (a rare race) the module/lesson named by `resume` is no longer in the
 * curriculum by the time this runs. buildTodayPlan already treats a null
 * resume as "no lesson row," which is the correct degraded behavior for a
 * learner with no curriculum at all — the shape production actually ships.
 */
async function resolvePlanResume(
    activeTrack: TrackSummary | null,
    userId: string
): Promise<PlanInput["resume"]> {
    if (!activeTrack || !activeTrack.resume) return null
    const { moduleSlug, lessonSlug } = activeTrack.resume

    const curriculum = await getTrackCurriculumForUser(activeTrack.slug, userId)
    if (!curriculum) return null

    const module = curriculum.modules.find((m) => m.slug === moduleSlug)
    if (!module) return null

    const lesson = module.lessons.find((l) => l.slug === lessonSlug)
    if (!lesson) return null

    return {
        trackSlug: activeTrack.slug,
        lessonSlug: lesson.slug,
        lessonTitle: lesson.title,
        moduleTitle: module.name,
        modulePosition: module.position,
    }
}

/** UTC midnight `daysBack` days before `today`. Matches buildHeatmap's own
 *  UTC-midnight anchoring, so the query window and the bucket window agree
 *  on where "day 0" falls. */
function utcMidnightDaysBefore(today: Date, daysBack: number): Date {
    return new Date(
        Date.UTC(
            today.getUTCFullYear(),
            today.getUTCMonth(),
            today.getUTCDate() - daysBack
        )
    )
}

/**
 * Everything the signed-in home dashboard renders, in a bounded number of
 * queries regardless of curriculum size: the tracks-index read, the catalog
 * read, at most one extra curriculum read to resolve a resume target, and
 * two Submission.findMany calls (recent 40 for weak spots, last 7 days for
 * the week grid and streak).
 *
 * Pass `today` to pin "now" for tests and for callers that need a stable
 * day boundary; defaults to `new Date()`.
 */
export async function getHomeData(
    userId: string,
    today: Date = new Date()
): Promise<HomeData> {
    const windowStart = utcMidnightDaysBefore(today, 6)

    const [tracks, catalog, weakSpotSubmissions, weekSubmissions] =
        await Promise.all([
            getTrackSummariesForUser(userId),
            getCatalogProblems(userId),
            prisma.submission.findMany({
                where: { userId },
                orderBy: { createdAt: "desc" },
                take: 40,
                select: {
                    status: true,
                    problem: {
                        select: {
                            tags: {
                                where: { kind: "TOPIC" },
                                select: { slug: true, name: true },
                            },
                        },
                    },
                },
            }),
            prisma.submission.findMany({
                where: { userId, createdAt: { gte: windowStart } },
                select: { createdAt: true },
            }),
        ])

    const activeTrack = pickActiveTrack(tracks)
    const resume = await resolvePlanResume(activeTrack, userId)

    const nextCatalogProblem = catalog.find((p) => !p.solved) ?? null
    const nextProblem = nextCatalogProblem
        ? {
              slug: nextCatalogProblem.slug,
              title: nextCatalogProblem.title,
              difficulty: nextCatalogProblem.difficulty,
          }
        : null

    const plan = buildTodayPlan({ resume, daily: null, nextProblem })

    const weakSpots = computeWeakSpots(
        weakSpotSubmissions.map((s) => ({
            accepted: s.status === "ACCEPTED",
            tags: s.problem.tags,
        }))
    )

    const week = buildHeatmap(
        weekSubmissions.map((s) => s.createdAt),
        7,
        today
    )
    const streak = computeStreaks(week)

    return { plan, weakSpots, streak, week, activeTrack }
}
