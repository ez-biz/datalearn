import { NextResponse } from "next/server"
import { z } from "zod"
import type { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { withAdmin } from "@/lib/api-auth"
import { ProblemUpdateInput } from "@/lib/admin-validation"

type Ctx = { params: Promise<{ slug: string }> }

export const GET = withAdmin(async (_req, _principal, ctx: Ctx) => {
    const { slug } = await ctx.params
    const problem = await prisma.sQLProblem.findUnique({
        where: { slug },
        include: {
            schema: { select: { id: true, name: true, sql: true } },
            tags: { select: { id: true, name: true, slug: true } },
            _count: { select: { submissions: true } },
        },
    })
    if (!problem) {
        return NextResponse.json({ error: "Not found." }, { status: 404 })
    }
    return NextResponse.json({ data: problem })
})

export const PATCH = withAdmin(async (req, _principal, ctx: Ctx) => {
    const { slug } = await ctx.params
    let body: unknown
    try {
        body = await req.json()
    } catch {
        return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 })
    }

    const parsed = ProblemUpdateInput.safeParse(body)
    if (!parsed.success) {
        return NextResponse.json(
            { error: "Validation failed", details: z.treeifyError(parsed.error) },
            { status: 400 }
        )
    }
    const input = parsed.data

    const existing = await prisma.sQLProblem.findUnique({
        where: { slug },
        select: { id: true },
    })
    if (!existing) {
        return NextResponse.json({ error: "Not found." }, { status: 404 })
    }

    try {
        const updated = await prisma.$transaction(async (tx) => {
            if (input.schemaId) {
                const ok = await tx.sqlSchema.findUnique({
                    where: { id: input.schemaId },
                    select: { id: true },
                })
                if (!ok) throw new Error("SCHEMA_NOT_FOUND")
            }

            if (input.slug && input.slug !== slug) {
                const slugOwner = await tx.sQLProblem.findUnique({
                    where: { slug: input.slug },
                    select: { id: true },
                })
                if (slugOwner) throw new Error("SLUG_TAKEN")
            }

            const data: Prisma.SQLProblemUpdateInput = {
                ...(input.title !== undefined && { title: input.title }),
                ...(input.slug !== undefined && { slug: input.slug }),
                ...(input.difficulty !== undefined && { difficulty: input.difficulty }),
                ...(input.status !== undefined && { status: input.status }),
                ...(input.description !== undefined && { description: input.description }),
                ...(input.schemaDescription !== undefined && {
                    schemaDescription: input.schemaDescription,
                }),
                ...(input.schemaId !== undefined && { schemaId: input.schemaId }),
                ...(input.expectedOutput !== undefined && {
                    expectedOutput: input.expectedOutput,
                }),
                ...(input.solutionSql !== undefined && {
                    solutionSql: input.solutionSql,
                }),
                ...(input.ordered !== undefined && { ordered: input.ordered }),
                ...(input.dialects !== undefined && { dialects: input.dialects }),
                ...(input.hints !== undefined && { hints: input.hints }),
            }

            if (input.tagSlugs !== undefined) {
                const tags = await tx.tag.findMany({
                    where: { slug: { in: input.tagSlugs } },
                    select: { id: true, slug: true },
                })
                const found = new Set(tags.map((tag) => tag.slug))
                const missing = input.tagSlugs.filter(
                    (tagSlug) => !found.has(tagSlug)
                )
                if (missing.length > 0) {
                    throw new Error(`TAGS_NOT_FOUND:${missing.join(",")}`)
                }
                data.tags = {
                    set: tags.map((tag) => ({ id: tag.id })),
                }
            }

            const result = await tx.sQLProblem.update({
                where: { id: existing.id },
                data,
                include: {
                    schema: { select: { id: true, name: true, sql: true } },
                    tags: { select: { id: true, name: true, slug: true } },
                    _count: { select: { submissions: true } },
                },
            })
            return result
        })
        return NextResponse.json({ data: updated })
    } catch (e: unknown) {
        const error = e as { code?: string; message?: string }
        if (error.message === "SCHEMA_NOT_FOUND") {
            return NextResponse.json(
                { error: "schemaId does not match any SqlSchema." },
                { status: 400 }
            )
        }
        if (error.message === "SLUG_TAKEN") {
            return NextResponse.json(
                { error: "A problem with that slug already exists." },
                { status: 409 }
            )
        }
        if (
            typeof error.message === "string" &&
            error.message.startsWith("TAGS_NOT_FOUND:")
        ) {
            const missing = error.message.slice("TAGS_NOT_FOUND:".length)
            return NextResponse.json(
                { error: `Unknown tag slug(s): ${missing}.` },
                { status: 400 }
            )
        }
        if (error.code === "P2002") {
            return NextResponse.json(
                { error: "A problem with that slug already exists." },
                { status: 409 }
            )
        }
        console.error("Update problem failed:", e)
        return NextResponse.json(
            { error: "Failed to update problem." },
            { status: 500 }
        )
    }
})

export const DELETE = withAdmin(async (_req, _principal, ctx: Ctx) => {
    const { slug } = await ctx.params
    try {
        await prisma.sQLProblem.delete({ where: { slug } })
        return NextResponse.json({ ok: true })
    } catch (e: unknown) {
        const error = e as { code?: string }
        if (error.code === "P2025") {
            return NextResponse.json({ error: "Not found." }, { status: 404 })
        }
        console.error("Delete problem failed:", e)
        return NextResponse.json(
            { error: "Failed to delete problem." },
            { status: 500 }
        )
    }
})
