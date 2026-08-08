// Pure reading-progress maths. No DOM, no React — the caller reads the
// scroll numbers off #app-scroll and hands them here, so this unit-tests
// without a browser.

/**
 * How far through the scrollable distance the reader is, 0-100.
 *
 * When there is no scrollable distance the lesson counts as fully read.
 * This is not a defensive edge case: every seeded lesson is 4-5 minutes,
 * and in a tall window the content fits without scrolling at all. Without
 * this branch those lessons would be permanently uncompletable and the
 * failure would be silent.
 */
export function scrollPercent(
    scrollTop: number,
    scrollHeight: number,
    clientHeight: number,
): number {
    const denom = scrollHeight - clientHeight
    if (denom <= 0) return 100
    const raw = Math.round((scrollTop / denom) * 100)
    return Math.min(100, Math.max(0, raw))
}

/**
 * Whether a progress write is due. Writes fire on ten-percent boundaries,
 * capping a full read at ~10 round trips. Never fires backwards —
 * LessonProgress.percent is documented as monotonic.
 */
export function shouldPersist(lastWritten: number, current: number): boolean {
    if (current <= lastWritten) return false
    return Math.floor(current / 10) > Math.floor(lastWritten / 10)
}
