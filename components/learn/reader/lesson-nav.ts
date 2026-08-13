// Pure lesson-navigation maths over an already-fetched TrackCurriculum.
// NO Prisma, NO React, NO server runtime — so it unit-tests without a
// database. Same contract as lib/curriculum-progress.ts.

import type {
    CurriculumCheckpoint,
    TrackCurriculum,
} from "@/lib/curriculum-read"

export type FlatLesson = {
    articleId: string
    slug: string
    title: string
    readingMinutes: number | null
    completed: boolean
    checkpoints: CurriculumCheckpoint[]
    moduleId: string
    moduleSlug: string
    moduleName: string
    /** 0-indexed, as stored. */
    modulePosition: number
    /** 0-indexed position within its module. */
    lessonInModule: number
    /** 0-indexed position across the whole track. */
    flatIndex: number
}

/**
 * Every lesson in track order.
 *
 * An article may legally appear in two modules of one track —
 * ModuleLesson's @@id([moduleId, articleId]) permits it. Both occurrences
 * are kept: the curriculum rail genuinely lists the lesson under both
 * modules, so the "14 / 37" counter must count it twice. URL resolution
 * is what needs to be deterministic, and that is findLesson's job.
 */
export function flattenCurriculum(curriculum: TrackCurriculum): FlatLesson[] {
    const flat: FlatLesson[] = []
    for (const mod of curriculum.modules) {
        mod.lessons.forEach((lesson, lessonInModule) => {
            flat.push({
                articleId: lesson.articleId,
                slug: lesson.slug,
                title: lesson.title,
                readingMinutes: lesson.readingMinutes,
                completed: lesson.completed,
                checkpoints: lesson.checkpoints,
                moduleId: mod.id,
                moduleSlug: mod.slug,
                moduleName: mod.name,
                modulePosition: mod.position,
                lessonInModule,
                flatIndex: flat.length,
            })
        })
    }
    return flat
}

/**
 * Resolve a lesson slug to its flat entry. When one article sits in two
 * modules, the LOWEST module position wins — deterministic, and
 * reordering cannot change the answer except by changing the intended
 * order. `modules` arrives ordered by position, so the first match is
 * already the lowest.
 */
export function findLesson(
    flat: FlatLesson[],
    slug: string,
): FlatLesson | null {
    return flat.find((lesson) => lesson.slug === slug) ?? null
}

export function lessonNeighbors(
    flat: FlatLesson[],
    index: number,
): { prev: FlatLesson | null; next: FlatLesson | null } {
    if (index < 0 || index >= flat.length) return { prev: null, next: null }
    return {
        prev: index > 0 ? flat[index - 1] : null,
        next: index < flat.length - 1 ? flat[index + 1] : null,
    }
}

/**
 * A module's display number. `position` is 0-indexed in the database; the
 * breadcrumb shows a 1-based, zero-padded number. Derived at render time
 * so reordering never breaks a URL — see the schema comment on
 * Module.slug.
 */
export function modulePrefix(position: number): string {
    return String(position + 1).padStart(2, "0")
}

export function lessonBreadcrumb(
    trackSlug: string,
    lesson: FlatLesson,
): { track: string; module: string; lesson: string } {
    return {
        track: trackSlug,
        module: `${modulePrefix(lesson.modulePosition)}-${lesson.moduleSlug}`,
        lesson: lesson.slug,
    }
}
