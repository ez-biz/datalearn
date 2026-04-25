import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { withAdmin } from "@/lib/api-auth"

type Ctx = { params: Promise<{ slug: string }> }

export const GET = withAdmin(async (_req, _principal, ctx: Ctx) => {
    const { slug } = await ctx.params
    const problem = await prisma.sQLProblem.findUnique({
        where: { slug },
        select: { id: true },
    })
    if (!problem) {
        return NextResponse.json({ error: "Not found." }, { status: 404 })
    }
    const versions = await prisma.problemVersion.findMany({
        where: { problemId: problem.id },
        orderBy: { versionNumber: "desc" },
        select: {
            id: true,
            versionNumber: true,
            title: true,
            ordered: true,
            tagSlugs: true,
            publishedById: true,
            capturedAt: true,
        },
    })
    return NextResponse.json({ data: versions })
})
