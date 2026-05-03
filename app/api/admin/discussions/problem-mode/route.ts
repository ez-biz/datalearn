import { NextResponse } from "next/server"
import { z } from "zod"
import { AuthFailure } from "@/lib/api-auth"
import { ProblemDiscussionMode, SlugSchema } from "@/lib/admin-validation"
import { prisma } from "@/lib/prisma"
import { requireDiscussionModerator } from "@/lib/discussions/api-auth"
import { userHasDiscussionPermission } from "@/lib/discussions/permissions"

const ProblemModeInput = z.object({
    problemSlug: SlugSchema,
    mode: ProblemDiscussionMode,
})

type ProblemMode = z.infer<typeof ProblemDiscussionMode>

export async function PATCH(req: Request) {
    try {
        const principal = await requireDiscussionModerator(req)

        let body: unknown
        try {
            body = await req.json()
        } catch {
            return NextResponse.json(
                { error: "Invalid JSON body." },
                { status: 400 }
            )
        }

        const parsed = ProblemModeInput.safeParse(body)
        if (!parsed.success) {
            return NextResponse.json(
                {
                    error: "Validation failed",
                    details: z.treeifyError(parsed.error),
                },
                { status: 400 }
            )
        }

        const { problemSlug, mode } = parsed.data
        if (principal.role !== "ADMIN") {
            if (principal.role !== "MODERATOR") {
                return NextResponse.json(
                    { error: "Moderator access required." },
                    { status: 403 }
                )
            }
            const allowed = await canSetProblemMode(
                { userId: principal.userId, role: "MODERATOR" },
                mode
            )
            if (!allowed) {
                return NextResponse.json(
                    { error: "Permission denied." },
                    { status: 403 }
                )
            }
        }

        const result = await prisma.$transaction(async (tx) => {
            const problem = await tx.sQLProblem.findUnique({
                where: { slug: problemSlug },
                select: { id: true, slug: true },
            })
            if (!problem) {
                return {
                    ok: false as const,
                    status: 404,
                    error: "Problem not found.",
                }
            }

            const currentState = await tx.problemDiscussionState.findUnique({
                where: { problemId: problem.id },
                select: { mode: true },
            })
            const oldMode = currentState?.mode ?? "OPEN"

            const state = await tx.problemDiscussionState.upsert({
                where: { problemId: problem.id },
                update: {
                    mode,
                    updatedById: principal.userId,
                },
                create: {
                    problemId: problem.id,
                    mode,
                    updatedById: principal.userId,
                },
            })

            if (oldMode !== mode) {
                await tx.discussionModerationLog.create({
                    data: {
                        actorId: principal.userId,
                        action: "SET_PROBLEM_MODE",
                        targetType: "PROBLEM",
                        targetId: problem.id,
                        note: `Problem discussion mode changed from ${oldMode} to ${mode}.`,
                    },
                })
            }

            return {
                ok: true as const,
                problem,
                mode: state.mode,
                previousMode: oldMode,
            }
        })

        if (!result.ok) {
            return NextResponse.json(
                { error: result.error },
                { status: result.status }
            )
        }

        return NextResponse.json({
            data: {
                problemSlug: result.problem.slug,
                mode: result.mode,
                previousMode: result.previousMode,
            },
        })
    } catch (e) {
        if (e instanceof AuthFailure) {
            return NextResponse.json(e.body, { status: e.status })
        }
        console.error("Set problem discussion mode failed:", e)
        return NextResponse.json(
            { error: "Internal server error." },
            { status: 500 }
        )
    }
}

async function canSetProblemMode(
    principal: { userId: string; role: "MODERATOR" },
    mode: ProblemMode
) {
    if (mode === "LOCKED") {
        return userHasDiscussionPermission(
            { id: principal.userId, role: principal.role },
            "LOCK_PROBLEM_DISCUSSION"
        )
    }
    if (mode === "HIDDEN") {
        return userHasDiscussionPermission(
            { id: principal.userId, role: principal.role },
            "HIDE_PROBLEM_DISCUSSION"
        )
    }

    const [canLock, canHide] = await Promise.all([
        userHasDiscussionPermission(
            { id: principal.userId, role: principal.role },
            "LOCK_PROBLEM_DISCUSSION"
        ),
        userHasDiscussionPermission(
            { id: principal.userId, role: principal.role },
            "HIDE_PROBLEM_DISCUSSION"
        ),
    ])
    return canLock || canHide
}
