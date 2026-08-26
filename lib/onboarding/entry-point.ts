/**
 * Where a learner starts, given the level they declared during onboarding.
 *
 * Pure and Prisma-free so the maths unit-tests without a database. The input
 * types are structural on purpose — `CurriculumModule` from
 * `lib/curriculum-read.ts` satisfies `ModuleLike` without this module
 * importing it, which keeps Prisma out of the dependency graph entirely.
 *
 * Placement is ADVISORY, exactly like `isModuleUnlocked` in
 * `lib/curriculum-progress.ts`. It picks a starting point and gates nothing;
 * a learner who wants module 01 clicks module 01.
 */

export type SqlLevel = "NEW" | "INTERMEDIATE" | "ADVANCED"

export type LessonLike = {
    slug: string
    title: string
    readingMinutes: number | null
}

export type ModuleLike = {
    slug: string
    name: string
    position: number
    lessons: LessonLike[]
}

export type EntryPoint = {
    moduleSlug: string
    moduleName: string
    modulePosition: number
    lessonSlug: string
    lessonTitle: string
    lessonCount: number
    readingMinutes: number | null
}

/**
 * Target index per level, clamped to the track's length.
 *
 * An index, not a slug map: module slugs and names are admin-editable and
 * module order is mutable through `reorderModules`, so a literal
 * `{ INTERMEDIATE: "aggregation" }` would silently resolve to nothing the
 * first time someone renames or reorders. ADVANCED targets index 3 rather
 * than the last module deliberately — landing on the final module leaves
 * nowhere to go next.
 */
const TARGET_INDEX: Record<SqlLevel, number> = {
    NEW: 0,
    INTERMEDIATE: 2,
    ADVANCED: 3,
}

export function entryModuleIndex(
    level: SqlLevel,
    moduleCount: number,
): number | null {
    if (moduleCount <= 0) return null
    return Math.min(TARGET_INDEX[level], moduleCount - 1)
}

/**
 * The first module at or after `start` that actually has a lesson, else the
 * nearest one before it. An admin can create a module and not fill it yet;
 * recommending an empty module would render "0 lessons", which the project's
 * fallback rule forbids.
 */
function firstModuleWithLessons(
    modules: ModuleLike[],
    start: number,
): ModuleLike | null {
    for (let i = start; i < modules.length; i += 1) {
        if (modules[i].lessons.length > 0) return modules[i]
    }
    for (let i = start - 1; i >= 0; i -= 1) {
        if (modules[i].lessons.length > 0) return modules[i]
    }
    return null
}

export function resolveEntryPoint(
    level: SqlLevel,
    modules: ModuleLike[],
): EntryPoint | null {
    const start = entryModuleIndex(level, modules.length)
    if (start === null) return null

    const target = firstModuleWithLessons(modules, start)
    if (!target) return null

    const lesson = target.lessons[0]
    return {
        moduleSlug: target.slug,
        moduleName: target.name,
        modulePosition: target.position,
        lessonSlug: lesson.slug,
        lessonTitle: lesson.title,
        lessonCount: target.lessons.length,
        readingMinutes: lesson.readingMinutes,
    }
}
