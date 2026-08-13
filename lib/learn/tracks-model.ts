// Pure model for the tracks index's resume target. No React, no Prisma, no
// DOM — same contract as lib/learn/module-model.ts: this decides what the
// index card's "Resume" link points at, lib/learn/tracks-read.ts only
// supplies the already-fetched rows.
//
// Extracted out of tracks-read.ts (which imports Prisma at module scope) so
// this can be unit-tested without a database — see scripts/test-tracks-model.ts.

export type ResumeModule = {
    slug: string
    lessons: Array<{ slug: string; completed: boolean }>
}

export type ResumeTarget = { moduleSlug: string; lessonSlug: string } | null

/**
 * First incomplete lesson, scanning modules in track order and then lessons
 * in module order.
 *
 * Deliberately NOT resumeLesson() from lib/learn/module-model.ts, even
 * though the traversal looks similar: that helper is for a single already-
 * chosen module, and falls back to the module's first lesson when every
 * lesson in it is complete, so the module screen's "Resume" button always
 * has somewhere to send a learner who finished it. At the track level that
 * fallback is wrong — once every lesson in the whole track is complete we
 * need null, not a target to re-read, and a per-module fallback would
 * incorrectly stop the cross-module scan at the first complete module
 * instead of continuing to the next one.
 *
 * `null` here means one of two different things to a caller — no lessons at
 * all, or every lesson already complete — and does NOT by itself mean "the
 * track is complete": a track can have every lesson read and a checkpoint
 * problem still unsolved, and this still returns null. Callers that need a
 * "complete" verdict must check the rollup's percent (lessons + problems),
 * never `findResume(...) === null` alone — see the doc on
 * components/learn/tracks/TrackSummaryCard.tsx's `isComplete`.
 */
export function findResume(modules: ResumeModule[]): ResumeTarget {
    for (const module of modules) {
        const lesson = module.lessons.find((l) => !l.completed)
        if (lesson) return { moduleSlug: module.slug, lessonSlug: lesson.slug }
    }
    return null
}
