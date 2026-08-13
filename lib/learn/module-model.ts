// Pure model for the module screen's resume and facts. No React, no Prisma,
// no DOM — so it unit-tests without a database, the same way
// lib/workspace/problems-panel-model.ts does for the workspace panel.
//
// Everything that decides the module screen's state lives here; the screen
// component only renders the result.

import type { CurriculumLesson, CurriculumModule } from "@/lib/curriculum-read"

export type LessonState = "done" | "in-progress" | "todo"

/**
 * Determine the state of a lesson in the module screen.
 *
 * A lesson is "done" when the user has completed it. It is "in-progress"
 * when it is the current resume target (the lesson to continue from). It is
 * "todo" otherwise.
 */
export function lessonState(
    lesson: CurriculumLesson,
    isResumeTarget: boolean,
): LessonState {
    if (lesson.completed) return "done"
    if (isResumeTarget) return "in-progress"
    return "todo"
}

/**
 * Find the lesson the module screen's "Resume" button should point at.
 *
 * Returns the first lesson with completed === false (progress partway through
 * the module). If all lessons are complete, returns lessons[0] so "Resume"
 * re-reads the module. Returns null if there are no lessons.
 */
export function resumeLesson(module: CurriculumModule): CurriculumLesson | null {
    if (module.lessons.length === 0) return null

    const incomplete = module.lessons.find((l) => !l.completed)
    return incomplete ?? module.lessons[0]
}

export type ModuleFacts = {
    readingMinutes: number
    problemCount: number
}

/**
 * Compute aggregate facts about a module for display.
 *
 * Sums reading minutes across all lessons (treating null as zero), and
 * counts the total number of checkpoint problems across all lessons.
 */
export function moduleFacts(module: CurriculumModule): ModuleFacts {
    let readingMinutes = 0
    let problemCount = 0

    for (const lesson of module.lessons) {
        readingMinutes += lesson.readingMinutes ?? 0
        problemCount += lesson.checkpoints.length
    }

    return { readingMinutes, problemCount }
}
