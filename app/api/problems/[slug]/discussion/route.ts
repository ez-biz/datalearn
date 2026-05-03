import { NextResponse } from "next/server"
import { z } from "zod"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { DiscussionCommentCreateInput } from "@/lib/admin-validation"
import { withDiscussionAuth } from "@/lib/discussions/api-auth"
import { checkDiscussionLimit } from "@/lib/discussions/rate-limit"
import {
    discussionOrderBy,
    parseDiscussionSort,
    publicCommentInclude,
    publicCommentWhere,
    shapePublicComment,
} from "@/lib/discussions/queries"
import { getUserReputation } from "@/lib/discussions/reputation"
import { getDiscussionSettings } from "@/lib/discussions/settings"

type Ctx = { params: Promise<{ slug: string }> }

const MAX_DISCUSSION_PAGE = 10_000

function parsePositiveInt(value: string | null, fallback: number): number {
    if (!value) return fallback
    const parsed = Number(value)
    return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback
}

function clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max)
}

async function readJson(req: Request): Promise<unknown | null> {
    try {
        return await req.json()
    } catch {
        return null
    }
}

export async function GET(req: Request, ctx: Ctx) {
    const { slug } = await ctx.params
    const url = new URL(req.url)
    const sort = parseDiscussionSort(url.searchParams.get("sort"))
    const page = clamp(
        parsePositiveInt(url.searchParams.get("page"), 1),
        1,
        MAX_DISCUSSION_PAGE
    )
    const pageSize = clamp(parsePositiveInt(url.searchParams.get("limit"), 20), 1, 50)
    const skip = (page - 1) * pageSize

    const [settings, session, problem] = await Promise.all([
        getDiscussionSettings(),
        auth(),
        prisma.sQLProblem.findFirst({
            where: { slug, status: "PUBLISHED" },
            select: {
                id: true,
                discussionState: { select: { mode: true } },
            },
        }),
    ])

    if (!problem) {
        return NextResponse.json({ found: false }, { status: 404 })
    }

    const mode = problem.discussionState?.mode ?? "OPEN"

    if (!settings.globalEnabled || mode === "HIDDEN") {
        return NextResponse.json({
            data: { enabled: false, mode, comments: [], total: 0 },
        })
    }

    const viewerUserId = session?.user?.id ?? null
    const where = publicCommentWhere(problem.id)
    const [comments, total] = await Promise.all([
        prisma.discussionComment.findMany({
            where,
            orderBy: discussionOrderBy(sort),
            skip,
            take: pageSize,
            include: publicCommentInclude(viewerUserId),
        }),
        prisma.discussionComment.count({ where }),
    ])

    return NextResponse.json({
        data: {
            enabled: true,
            mode,
            sort,
            page,
            pageSize,
            total,
            comments: comments.map(shapePublicComment),
        },
    })
}

export const POST = withDiscussionAuth(async (req, principal, ctx: Ctx) => {
    const { slug } = await ctx.params
    const settings = await getDiscussionSettings()

    if (!settings.globalEnabled) {
        return NextResponse.json(
            { error: "Discussions are disabled." },
            { status: 403 }
        )
    }

    const parsed = DiscussionCommentCreateInput.safeParse(await readJson(req))
    if (!parsed.success) {
        return NextResponse.json(
            { error: "Validation failed", details: z.treeifyError(parsed.error) },
            { status: 400 }
        )
    }

    const bodyMarkdown = parsed.data.bodyMarkdown.trim()
    if (bodyMarkdown.length > settings.bodyMaxChars) {
        return NextResponse.json(
            {
                error: `Comment must be ${settings.bodyMaxChars} characters or fewer.`,
            },
            { status: 400 }
        )
    }

    const problem = await prisma.sQLProblem.findFirst({
        where: { slug, status: "PUBLISHED" },
        select: {
            id: true,
            discussionState: { select: { mode: true } },
        },
    })

    if (!problem) {
        return NextResponse.json({ error: "Problem not found." }, { status: 404 })
    }

    if ((problem.discussionState?.mode ?? "OPEN") !== "OPEN") {
        return NextResponse.json(
            { error: "Discussion is not open." },
            { status: 403 }
        )
    }

    const reputation = await getUserReputation(principal.userId, settings)
    const limit = await checkDiscussionLimit({
        userId: principal.userId,
        problemId: problem.id,
        bodyMarkdown,
        action: "COMMENT",
        tier: reputation.tier,
        settings,
    })

    if (!limit.ok) {
        return NextResponse.json({ error: limit.error }, { status: 429 })
    }

    const comment = await prisma.discussionComment.create({
        data: {
            problemId: problem.id,
            userId: principal.userId,
            bodyMarkdown,
        },
        include: publicCommentInclude(principal.userId),
    })

    return NextResponse.json(
        { data: shapePublicComment(comment) },
        { status: 201 }
    )
})
