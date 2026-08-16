// "Today's plan" composition for the signed-in home dashboard. Pure — no
// React, no Prisma, no DOM — so it unit-tests without a database, the same
// way lib/home/weak-spots.ts does for the weak-spots card.
//
// Up to three rows, in fixed priority order: resume the in-progress lesson,
// then the daily problem (if unsolved today), then the next unsolved
// problem from the catalog. A learner with no curriculum still gets rows
// 2 and 3 — see the "degraded paths" describe block in
// scripts/test-today-plan.ts, which is the case that actually ships today
// since production has zero modules and zero lessons.

import { modulePrefix } from "@/components/learn/reader/lesson-nav"

export type PlanRow = {
    kind: "lesson" | "daily" | "problem"
    title: string
    /** Mono meta line, e.g. "Module 04 · Window functions" or "Daily · Medium". */
    meta: string
    href: string
    done: boolean
}

export type PlanInput = {
    /** Curriculum resume target, or null when the learner has no track. */
    resume: {
        trackSlug: string
        lessonSlug: string
        lessonTitle: string
        moduleTitle: string
        modulePosition: number
    } | null
    daily: {
        slug: string
        title: string
        difficulty: string
        solvedToday: boolean
    } | null
    /** Next unsolved problem from the catalog, or null. */
    nextProblem: { slug: string; title: string; difficulty: string } | null
}

/** "MEDIUM" -> "Medium". Difficulty strings arrive all-caps from Prisma's enum. */
function titleCase(value: string): string {
    return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase()
}

/**
 * Build the signed-in home's "Today's plan" rows.
 *
 * Rules, in order:
 *  1. Fixed row order — lesson, daily, problem — each included only when
 *     its input is non-null.
 *  2. The lesson's module number is `modulePrefix(modulePosition)`, imported
 *     rather than restated: Module.position is 0-indexed, so the displayed
 *     number is position + 1. Two copies of that convention would let this
 *     card and the reader disagree about the same module.
 *  3. `done` is true only for a daily already solved today — it stays in
 *     the plan as a tick rather than disappearing, so the learner sees
 *     evidence they did the thing.
 *  4. The next-problem row is dropped when its slug equals the daily's,
 *     otherwise the same problem would render twice.
 *  5. Never mutates the input.
 */
export function buildTodayPlan(input: PlanInput): PlanRow[] {
    const rows: PlanRow[] = []

    if (input.resume) {
        const { trackSlug, lessonSlug, lessonTitle, moduleTitle, modulePosition } =
            input.resume
        rows.push({
            kind: "lesson",
            title: lessonTitle,
            meta: `Module ${modulePrefix(modulePosition)} · ${moduleTitle}`,
            href: `/learn/tracks/${trackSlug}/${lessonSlug}`,
            done: false,
        })
    }

    if (input.daily) {
        rows.push({
            kind: "daily",
            title: input.daily.title,
            meta: `Daily · ${titleCase(input.daily.difficulty)}`,
            href: `/practice/${input.daily.slug}`,
            done: input.daily.solvedToday,
        })
    }

    if (input.nextProblem && input.nextProblem.slug !== input.daily?.slug) {
        rows.push({
            kind: "problem",
            title: input.nextProblem.title,
            meta: `Practice · ${titleCase(input.nextProblem.difficulty)}`,
            href: `/practice/${input.nextProblem.slug}`,
            done: false,
        })
    }

    return rows
}
