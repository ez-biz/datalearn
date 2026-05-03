import { NextResponse } from "next/server"
import { z } from "zod"
import type { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { withAdmin } from "@/lib/api-auth"
import {
    getMissingPublishedDialectMapEntries,
    ProblemDiscussionMode,
    ProblemUpdateInput,
} from "@/lib/admin-validation"

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

    const discussionModeParsed = z
        .object({ discussionMode: ProblemDiscussionMode.optional() })
        .safeParse(body)
    if (!discussionModeParsed.success) {
        return NextResponse.json(
            {
                error: "Validation failed",
                details: z.treeifyError(discussionModeParsed.error),
            },
            { status: 400 }
        )
    }

    const parsed = ProblemUpdateInput.safeParse(body)
    if (!parsed.success) {
        return NextResponse.json(
            { error: "Validation failed", details: z.treeifyError(parsed.error) },
            { status: 400 }
        )
    }
    const input = parsed.data
    const discussionMode = discussionModeParsed.data.discussionMode

    const existing = await prisma.sQLProblem.findUnique({
        where: { slug },
        select: {
            id: true,
            status: true,
            dialects: true,
            solutions: true,
            expectedOutputs: true,
        },
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
                ...(input.ordered !== undefined && { ordered: input.ordered }),
                ...(input.dialects !== undefined && { dialects: input.dialects }),
                ...(input.hints !== undefined && { hints: input.hints }),
            }

            // ── Solutions / expectedOutputs back-compat ─────────────
            // When the new per-dialect maps are provided, write them
            // directly AND derive the legacy single fields for read-
            // back-compat. When only legacy fields are provided,
            // replicate them across the existing dialects[] into the
            // new maps. This keeps old and new columns in sync until
            // the cleanup release drops the legacy columns.
            const effectiveDialects = input.dialects ?? existing.dialects
            const existingSolutions =
                (existing.solutions as Record<string, string>) ?? {}
            const existingExpectedOutputs =
                (existing.expectedOutputs as Record<string, string>) ?? {}
            let finalSolutions = existingSolutions
            let finalExpectedOutputs = existingExpectedOutputs

            if (input.solutions !== undefined) {
                data.solutions = input.solutions
                finalSolutions = input.solutions
                // Sync legacy field from the first listed dialect.
                const firstDialect = effectiveDialects[0]
                if (firstDialect && input.solutions[firstDialect] !== undefined) {
                    data.solutionSql = input.solutions[firstDialect]
                }
            } else if (input.solutionSql !== undefined) {
                data.solutionSql = input.solutionSql
                // Replicate legacy → per-dialect across current dialects.
                if (input.solutionSql !== null) {
                    const merged = { ...existingSolutions }
                    for (const d of effectiveDialects) {
                        merged[d] = input.solutionSql
                    }
                    data.solutions = merged
                    finalSolutions = merged
                }
            }

            if (input.expectedOutputs !== undefined) {
                data.expectedOutputs = input.expectedOutputs
                finalExpectedOutputs = input.expectedOutputs
                const firstDialect = effectiveDialects[0]
                if (
                    firstDialect &&
                    input.expectedOutputs[firstDialect] !== undefined
                ) {
                    data.expectedOutput = input.expectedOutputs[firstDialect]
                }
            } else if (input.expectedOutput !== undefined) {
                data.expectedOutput = input.expectedOutput
                const merged = { ...existingExpectedOutputs }
                for (const d of effectiveDialects) {
                    merged[d] = input.expectedOutput
                }
                data.expectedOutputs = merged
                finalExpectedOutputs = merged
            }

            const missingPublishedEntries =
                getMissingPublishedDialectMapEntries({
                    status: input.status ?? existing.status,
                    dialects: effectiveDialects,
                    solutions: finalSolutions,
                    expectedOutputs: finalExpectedOutputs,
                })
            if (missingPublishedEntries.length > 0) {
                throw new Error(
                    `PUBLISHED_DIALECT_MAP_INCOMPLETE:${missingPublishedEntries.join(",")}`
                )
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

            if (discussionMode !== undefined) {
                const currentState = await tx.problemDiscussionState.findUnique({
                    where: { problemId: result.id },
                    select: { mode: true },
                })
                const oldMode = currentState?.mode ?? "OPEN"

                await tx.problemDiscussionState.upsert({
                    where: { problemId: result.id },
                    update: {
                        mode: discussionMode,
                        updatedById: _principal.userId,
                    },
                    create: {
                        problemId: result.id,
                        mode: discussionMode,
                        updatedById: _principal.userId,
                    },
                })

                if (oldMode !== discussionMode) {
                    await tx.discussionModerationLog.create({
                        data: {
                            actorId: _principal.userId,
                            action: "SET_PROBLEM_MODE",
                            targetType: "PROBLEM",
                            targetId: result.id,
                            note: `Problem discussion mode changed from ${oldMode} to ${discussionMode}.`,
                        },
                    })
                }
            }

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
        if (
            typeof error.message === "string" &&
            error.message.startsWith("PUBLISHED_DIALECT_MAP_INCOMPLETE:")
        ) {
            const missing = error.message.slice(
                "PUBLISHED_DIALECT_MAP_INCOMPLETE:".length
            )
            return NextResponse.json(
                {
                    error:
                        "PUBLISHED problems require non-empty solutions and expectedOutputs for every listed dialect.",
                    missing: missing.split(",").filter(Boolean),
                },
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
