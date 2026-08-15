import { NextResponse } from "next/server"
import { z } from "zod"
import type { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { withAdmin } from "@/lib/api-auth"
import { addCheckpoint, removeCheckpoint } from "@/lib/admin-curriculum"
import {
    getMissingPublishedDialectMapEntries,
    ProblemDiscussionMode,
    ProblemUpdateInput,
} from "@/lib/admin-validation"

type Ctx = { params: Promise<{ slug: string }> }
type LockedProblem = {
    id: string
    status: "DRAFT" | "BETA" | "PUBLISHED" | "ARCHIVED"
    dialects: Array<"DUCKDB" | "POSTGRES">
    solutions: Prisma.JsonValue
    expectedOutputs: Prisma.JsonValue
}

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
    const touchesHiddenValidationInputs =
        input.solutions !== undefined ||
        input.solutionSql !== undefined ||
        input.expectedOutputs !== undefined ||
        input.expectedOutput !== undefined ||
        input.dialects !== undefined ||
        input.ordered !== undefined

    try {
        const txResult = await prisma.$transaction(async (tx) => {
            const lockedProblem = await lockProblemBySlug(tx, slug)
            if (!lockedProblem) throw new Error("PROBLEM_NOT_FOUND")

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

            // Task 11 (SP7) — curriculum placement. Resolved and validated
            // here (inside the transaction, same snapshot as the lock) but
            // NOT written here: `addCheckpoint`/`removeCheckpoint` each run
            // their own `prisma.$transaction`, and Prisma has no true nested
            // transactions — calling them with the global client from
            // inside this callback would just open an unrelated, separately
            // committed transaction, breaking the atomicity this block is
            // trying to preserve. So this only computes WHAT needs to
            // change; the actual add/remove calls happen after this
            // transaction commits (returned alongside the updated problem,
            // rather than closed over in an outer `let`, so there's no
            // question of whether the reassignment inside this closure is
            // visible after `await prisma.$transaction(...)` resolves).
            let checkpointSync: {
                oldArticleSlug: string | null
                newArticleSlug: string | null
            } | null = null
            if (input.curriculumLessonId !== undefined) {
                const currentCheckpoint = await tx.lessonCheckpoint.findUnique({
                    where: { problemId: lockedProblem.id },
                    select: { article: { select: { slug: true } } },
                })
                let targetArticleSlug: string | null = null
                if (input.curriculumLessonId) {
                    const targetArticle = await tx.article.findUnique({
                        where: { id: input.curriculumLessonId },
                        select: { slug: true },
                    })
                    if (!targetArticle) throw new Error("LESSON_NOT_FOUND")
                    targetArticleSlug = targetArticle.slug
                }
                const oldArticleSlug = currentCheckpoint?.article.slug ?? null
                if (oldArticleSlug !== targetArticleSlug) {
                    checkpointSync = { oldArticleSlug, newArticleSlug: targetArticleSlug }
                }
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
                ...(touchesHiddenValidationInputs && {
                    hiddenDataValidatedAt: null,
                    hiddenDataValidationFingerprint: null,
                }),
            }

            // ── Solutions / expectedOutputs back-compat ─────────────
            // When the new per-dialect maps are provided, write them
            // directly AND derive the legacy single fields for read-
            // back-compat. When only legacy fields are provided,
            // replicate them across the existing dialects[] into the
            // new maps. This keeps old and new columns in sync until
            // the cleanup release drops the legacy columns.
            const effectiveDialects = input.dialects ?? lockedProblem.dialects
            const existingSolutions =
                (lockedProblem.solutions as Record<string, string>) ?? {}
            const existingExpectedOutputs =
                (lockedProblem.expectedOutputs as Record<string, string>) ?? {}
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
                    status: input.status ?? lockedProblem.status,
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
                where: { id: lockedProblem.id },
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

            return { problem: result, checkpointSync }
        })
        const { problem: updated, checkpointSync } = txResult

        // Task 11 (SP7) — apply the curriculum reassignment computed inside
        // the transaction above, now that the problem row (and, if it
        // changed, its slug) is committed. Runs OUTSIDE the transaction —
        // see the comment where `checkpointSync` is computed. Order
        // matters: remove the old binding before adding the new one,
        // because `LessonCheckpoint.@@unique([problemId])` means
        // `addCheckpoint` rejects a problem that's still claimed by
        // another lesson. Every write here goes through
        // `addCheckpoint`/`removeCheckpoint` — neither this route nor this
        // file ever touches `LessonCheckpoint.position` directly.
        if (checkpointSync) {
            if (checkpointSync.oldArticleSlug) {
                const removed = await removeCheckpoint(
                    checkpointSync.oldArticleSlug,
                    updated.slug
                )
                if (!removed.ok) {
                    return NextResponse.json(
                        { error: removed.error },
                        { status: removed.status }
                    )
                }
            }
            if (checkpointSync.newArticleSlug) {
                const added = await addCheckpoint(checkpointSync.newArticleSlug, {
                    problemSlug: updated.slug,
                })
                if (!added.ok) {
                    return NextResponse.json(
                        { error: added.error },
                        { status: added.status }
                    )
                }
            }
        }

        return NextResponse.json({ data: updated })
    } catch (e: unknown) {
        const error = e as { code?: string; message?: string }
        if (error.message === "SCHEMA_NOT_FOUND") {
            return NextResponse.json(
                { error: "schemaId does not match any SqlSchema." },
                { status: 400 }
            )
        }
        if (error.message === "LESSON_NOT_FOUND") {
            return NextResponse.json(
                { error: "curriculumLessonId does not match any lesson." },
                { status: 400 }
            )
        }
        if (error.message === "SLUG_TAKEN") {
            return NextResponse.json(
                { error: "A problem with that slug already exists." },
                { status: 409 }
            )
        }
        if (error.message === "PROBLEM_NOT_FOUND") {
            return NextResponse.json({ error: "Not found." }, { status: 404 })
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

async function lockProblemBySlug(tx: Prisma.TransactionClient, slug: string) {
    const rows = await tx.$queryRaw<LockedProblem[]>`
        SELECT "id", "status", to_json("dialects") AS "dialects", "solutions", "expectedOutputs"
        FROM "SQLProblem"
        WHERE "slug" = ${slug}
        FOR UPDATE
    `
    return rows[0] ?? null
}
