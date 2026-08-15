import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { withAdmin } from "@/lib/api-auth"

/**
 * Lessons available to bind a problem to as its checkpoint (Task 11, SP7).
 *
 * A "lesson" here means an `Article` that is actually reachable through the
 * curriculum — i.e. it has at least one `ModuleLesson` placement — not just
 * any Article row. `/learn/tracks/[slug]/[lessonSlug]` requires that
 * placement to resolve at all, so an Article with none would be an inert
 * checkpoint target a learner could never reach. This is a read-only list
 * for the problem-form picker; it does not create or touch any
 * `LessonCheckpoint` row. Every actual write still goes through
 * `addCheckpoint`/`removeCheckpoint` in `lib/admin-curriculum.ts`, called
 * from `app/api/admin/problems/[slug]/route.ts`'s PATCH handler.
 *
 * An Article can appear in more than one Module (reuse across tracks is
 * intentional per the `ModuleLesson` doc comment in schema.prisma) — this
 * picker only needs ONE track/module label to display, so it takes the
 * first placement rather than fanning out into multiple rows per lesson.
 */
export const GET = withAdmin(async () => {
    const lessons = await prisma.article.findMany({
        where: { moduleLessons: { some: {} } },
        orderBy: { title: "asc" },
        select: {
            id: true,
            slug: true,
            title: true,
            status: true,
            moduleLessons: {
                take: 1,
                orderBy: { position: "asc" },
                select: {
                    module: {
                        select: {
                            name: true,
                            track: { select: { slug: true, name: true } },
                        },
                    },
                },
            },
            _count: { select: { checkpoints: true } },
        },
    })

    const data = lessons.map((lesson) => {
        const placement = lesson.moduleLessons[0]?.module
        return {
            id: lesson.id,
            slug: lesson.slug,
            title: lesson.title,
            status: lesson.status,
            trackSlug: placement?.track.slug ?? null,
            trackName: placement?.track.name ?? null,
            moduleName: placement?.name ?? null,
            checkpointCount: lesson._count.checkpoints,
        }
    })

    return NextResponse.json({ data })
})
