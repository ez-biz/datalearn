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

    const incoming = clampProgressPercent(0, percent)
    const [stored] = await prisma.$queryRaw<
        Array<{ percent: number; completedAt: Date | null }>
    >`
        INSERT INTO "LessonProgress" ("userId", "articleId", "percent", "completedAt", "updatedAt")
        VALUES (
            ${userId},
            ${article.id},
            ${incoming}::integer,
            CASE WHEN ${incoming}::integer >= 100 THEN now() ELSE NULL END,
            now()
        )
        ON CONFLICT ("userId", "articleId") DO UPDATE
        SET
            "percent" = GREATEST("LessonProgress"."percent", EXCLUDED."percent"),
            "completedAt" = COALESCE(
                "LessonProgress"."completedAt",
                CASE
                    WHEN GREATEST("LessonProgress"."percent", EXCLUDED."percent") >= 100
                    THEN now()
                    ELSE NULL
                END
            ),
            "updatedAt" = now()
        RETURNING "percent", "completedAt"
    `

    if (!stored) return { ok: false, percent: 0, completed: false }
    return {
        ok: true,
        percent: stored.percent,
        completed: stored.completedAt !== null,
    }
}
