// Pure curriculum rollup maths. NO Prisma, NO React, NO server runtime —
// this module takes already-fetched rows and returns numbers, so it can be
// unit-tested without a database. Prisma queries live in
// actions/curriculum.ts and hand their results here.

export type LessonState = { articleId: string; completed: boolean }
export type ProblemState = { problemId: string; solved: boolean }

export type ModuleRollup = {
    moduleId: string
    lessonsDone: number
    lessonsTotal: number
    problemsDone: number
    problemsTotal: number
    percent: number
}

export type TrackRollup = {
    lessonsDone: number
    lessonsTotal: number
    problemsDone: number
    problemsTotal: number
    percent: number
}

/**
 * Percent of a (done, total) pair. Problems share the denominator with
 * lessons — the learn hub shows "13/37 lessons" beside "38%" on the same
 * track, and 13/37 is 35%, so problems must be counted in.
 *
 * An empty unit is 0%, never NaN.
 */
function percentOf(done: number, total: number): number {
    if (total <= 0) return 0
    return Math.round((done / total) * 100)
}

export function rollUpModule(input: {
    moduleId: string
    lessons: LessonState[]
    problems: ProblemState[]
}): ModuleRollup {
    const lessonsDone = input.lessons.filter((l) => l.completed).length
    const problemsDone = input.problems.filter((p) => p.solved).length
    const done = lessonsDone + problemsDone
    const total = input.lessons.length + input.problems.length

    return {
        moduleId: input.moduleId,
        lessonsDone,
        lessonsTotal: input.lessons.length,
        problemsDone,
        problemsTotal: input.problems.length,
        percent: percentOf(done, total),
    }
}

/**
 * Roll modules into a track. Recomputes from the summed totals rather than
 * averaging module percentages — a 1-item complete module next to a
 * 99-item empty one is 1%, not 50%.
 */
export function rollUpTrack(modules: ModuleRollup[]): TrackRollup {
    const lessonsDone = modules.reduce((n, m) => n + m.lessonsDone, 0)
    const lessonsTotal = modules.reduce((n, m) => n + m.lessonsTotal, 0)
    const problemsDone = modules.reduce((n, m) => n + m.problemsDone, 0)
    const problemsTotal = modules.reduce((n, m) => n + m.problemsTotal, 0)

    return {
        lessonsDone,
        lessonsTotal,
        problemsDone,
        problemsTotal,
        percent: percentOf(
            lessonsDone + problemsDone,
            lessonsTotal + problemsTotal,
        ),
    }
}

/**
 * ADVISORY ONLY. This drives the "Locked until 02" affordance in the UI and
 * nothing else. It must never gate a route, reject a server action, or
 * redirect — the design is explicit that skipping ahead is always allowed.
 *
 * `modules` must be in track order.
 */
export function isModuleUnlocked(
    modules: ModuleRollup[],
    index: number,
): boolean {
    if (index < 0 || index >= modules.length) return false
    if (index === 0) return true
    return modules[index - 1].percent === 100
}

/**
 * Monotonic progress write. Reading backwards up a lesson must not undo
 * progress, so the stored value only ever advances.
 */
export function clampProgressPercent(
    existing: number,
    incoming: number,
): number {
    const bounded = Math.min(100, Math.max(0, Math.round(incoming)))
    return Math.max(existing, bounded)
}
