import { prisma } from "@/lib/prisma"
import { clampProgressPercent } from "@/lib/curriculum-progress"

export type LessonProgressResult = {
    ok: boolean
    percent: number
    completed: boolean
}

/**
 * Record how far a specific user has read a lesson. Monotonic — the stored
 * percent never decreases — and `completedAt` is set once, when 100 is first
 * reached, then never unset.
 *
 * NOT a server action, deliberately: it takes an explicit userId, so exporting
 * it from a "use server" module would let any client write progress as any
 * user. `actions/curriculum.ts` resolves the session and delegates here.
 */
export async function recordLessonProgressForUser(
    userId: string,
    articleSlug: string,
    percent: number,
): Promise<LessonProgressResult> {
    // `percent` is untrusted input arriving from a "use server" action —
    // NaN or +/-Infinity would otherwise flow straight through
    // clampProgressPercent (Math.round/Math.max/Math.min all propagate NaN)
    // into a Prisma Int column and throw a 500 instead of failing cleanly.
    if (!Number.isFinite(percent)) {
        return { ok: false, percent: 0, completed: false }
    }

    const article = await prisma.article.findUnique({
        where: { slug: articleSlug },
        select: { id: true },
    })
    if (!article) return { ok: false, percent: 0, completed: false }

    const existing = await prisma.lessonProgress.findUnique({
        where: { userId_articleId: { userId, articleId: article.id } },
        select: { percent: true, completedAt: true },
    })

    const next = clampProgressPercent(existing?.percent ?? 0, percent)
    const completedAt =
        existing?.completedAt ?? (next >= 100 ? new Date() : null)

    await prisma.lessonProgress.upsert({
        where: { userId_articleId: { userId, articleId: article.id } },
        create: {
            userId,
            articleId: article.id,
            percent: next,
            completedAt,
        },
        update: { percent: next, completedAt },
    })

    return { ok: true, percent: next, completed: completedAt !== null }
}
