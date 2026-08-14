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
// directly and passes the shaped result in as `daily`, so the plan's
// lesson/daily/problem ordering and de-duplication live in exactly one
// place (buildTodayPlan) rather than being partly re-derived by a
// dashboard component.

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
    /** Whole-catalog totals, counted from the same `catalog` array
     *  `nextProblem` is chosen from — so the dashboard's "X of Y solved"
     *  and per-difficulty progress always agree with what /practice itself
     *  shows (same read, same exclusions: PUBLISHED only, contest-locked
     *  problems already excluded by getCatalogProblems's query). Free —
     *  the array is already in memory for `nextProblem`, this just counts
     *  it. */
    catalogTotals: {
        total: number
        byDifficulty: { EASY: number; MEDIUM: number; HARD: number }
    }
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
 * Same window actions/profile.ts's getProfileData uses for its heatmap
 * (its `HEATMAP_DAYS`). Not imported from there — a "use server" file may
 * only export async functions, so that constant isn't reusable — but kept
 * numerically in sync deliberately: `streak` here must agree with the
 * `/profile` page's streak for the same user, and a narrower window here
 * would silently cap `current`/`longest` below what `/profile` reports.
 * If actions/profile.ts's HEATMAP_DAYS ever changes, change this too.
 */
const HEATMAP_WINDOW_DAYS = 365

/**
 * Everything the signed-in home dashboard renders, in a bounded number of
 * queries regardless of curriculum size: the tracks-index read, the catalog
 * read, at most one extra curriculum read to resolve a resume target, and
 * two Submission.findMany calls (recent 40 for weak spots, and a single
 * 365-day window — matching /profile's own — that feeds both `streak` and
 * `week`).
 *
 * `week` and `streak` come from the same buildHeatmap(dates, 365, today)
 * series rather than two separate queries: `streak` is computeStreaks of
 * the whole series (so it agrees with /profile's streak for the same user
 * by construction — identical window, identical function), and `week` is
 * `heatmap.slice(-7)`, the tail of that same array. There is deliberately
 * no second, narrower source for the week grid — a provable slice of the
 * streak's own series cannot drift from it the way two independent queries
 * could.
 *
 * `daily` is the caller's already-fetched getDailyStatusForCurrentUser()
 * result (actions/daily.ts stays a separate session-resolving action), so
 * the whole plan — lesson, daily, problem, including the de-duplication
 * rule that drops the problem row when it matches the daily's slug — is
 * composed in exactly one place: buildTodayPlan. Pass null for a signed-out
 * caller or a day with no daily problem.
 *
 * Pass `today` to pin "now" for tests and for callers that need a stable
 * day boundary; defaults to `new Date()`. Never reaches buildHeatmap
 * un-pinned — the parameter is threaded through, not re-read from
 * `new Date()` at the call site.
 */
export async function getHomeData(
    userId: string,
    daily: PlanInput["daily"],
    today: Date = new Date()
): Promise<HomeData> {
    const heatmapWindowStart = utcMidnightDaysBefore(
        today,
        HEATMAP_WINDOW_DAYS - 1
    )

    const [tracks, catalog, weakSpotSubmissions, heatmapSubmissions] =
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
                where: { userId, createdAt: { gte: heatmapWindowStart } },
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

    const catalogTotals = {
        total: catalog.length,
        byDifficulty: { EASY: 0, MEDIUM: 0, HARD: 0 },
    }
    for (const p of catalog) {
        catalogTotals.byDifficulty[p.difficulty]++
    }

    const plan = buildTodayPlan({ resume, daily, nextProblem })

    const weakSpots = computeWeakSpots(
        weakSpotSubmissions.map((s) => ({
            accepted: s.status === "ACCEPTED",
            tags: s.problem.tags,
        }))
    )

    const heatmap = buildHeatmap(
        heatmapSubmissions.map((s) => s.createdAt),
        HEATMAP_WINDOW_DAYS,
        today
    )
    const streak = computeStreaks(heatmap)
    // buildHeatmap returns oldest-first, so the last 7 entries are the
    // trailing 7 days ending `today` — exactly what the week grid wants.
    const week = heatmap.slice(-7)

    return { plan, weakSpots, streak, week, activeTrack, catalogTotals }
}
