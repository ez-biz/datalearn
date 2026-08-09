"use server"

import { auth } from "@/lib/auth"
import { getTrackCurriculumForUser } from "@/lib/curriculum-read"
import {
    recordLessonProgressForUser,
    type LessonProgressResult,
} from "@/lib/curriculum-write"

export type {
    CurriculumCheckpoint,
    CurriculumLesson,
    CurriculumModule,
    TrackCurriculum,
} from "@/lib/curriculum-read"

/**
 * The whole ordered curriculum for one track, with the signed-in viewer's
 * state folded in. Anonymous callers get everything back reporting
 * incomplete, which is exactly what the signed-out reader should render.
 *
 * `unlocked` is ADVISORY. It drives the "Locked until 02" affordance and
 * nothing else — no caller may use it to gate access.
 *
 * Thin session-resolving wrapper — the real logic lives in
 * `lib/curriculum-read.ts` (not a server action, since it takes an explicit
 * userId).
 */
export async function getTrackCurriculum(trackSlug: string) {
    // `auth()` throws synchronously (not a rejected promise) when called
    // outside a request scope — e.g. from a test harness — so this must be
    // a try/catch, not a `.catch()` chained onto the call. Matches the
    // established fail-closed pattern in `recordLessonProgress` below.
    let userId: string | null = null
    let allowDraft = false
    try {
        const session = await auth()
        userId = session?.user?.id ?? null
        const role = session?.user?.role
        // Same staff gate as app/admin/layout.tsx, so draft preview and the
        // admin portal agree on who is staff.
        allowDraft = role === "ADMIN" || role === "MODERATOR"
    } catch {
        userId = null
        allowDraft = false
    }
    return getTrackCurriculumForUser(trackSlug, userId, { allowDraft })
}

/**
 * Record how far the signed-in reader has scrolled through a lesson.
 * Monotonic — the stored percent never decreases. Auto-completes at 100.
 * Anonymous callers are a silent no-op: reading is free, nothing persists.
 *
 * Thin session-resolving wrapper — the real logic lives in
 * `lib/curriculum-write.ts` (not a server action, since it takes an explicit
 * userId).
 */
export async function recordLessonProgress(
    articleSlug: string,
    percent: number,
): Promise<LessonProgressResult> {
    // `auth()` throws synchronously (not a rejected promise) when called
    // outside a request scope — e.g. from a test harness — so this must be
    // a try/catch, not a `.catch()` chained onto the call. Matches the
    // established fail-closed pattern in actions/tracks.ts.
    let userId: string | undefined
    try {
        const session = await auth()
        userId = session?.user?.id
    } catch {
        userId = undefined
    }
    if (!userId) return { ok: false, percent: 0, completed: false }
    return recordLessonProgressForUser(userId, articleSlug, percent)
}
