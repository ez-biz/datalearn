import { NextResponse } from "next/server"
import { z } from "zod"
import type { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { withAdmin } from "@/lib/api-auth"
import { HiddenDataPutInput } from "@/lib/admin-validation"
import { recordAdminAction } from "@/lib/admin-audit-log"
import { validateHiddenDataset } from "@/lib/contest-hidden-validator"

type Ctx = { params: Promise<{ slug: string }> }

export const GET = withAdmin(async (req, principal, ctx: Ctx) => {
    const { slug } = await ctx.params
    const confirm = new URL(req.url).searchParams.get("confirm")
    if (confirm !== "yes") {
        return NextResponse.json(
            {
                error: "Hidden test data is gated. Re-call with ?confirm=yes to acknowledge.",
            },
            { status: 428 }
        )
    }

    if (principal.kind !== "session") {
        return NextResponse.json(
            {
                error: "Reveal endpoint is for human session callers only. Use /hidden-data/status for automated readiness checks.",
            },
            { status: 403 }
        )
    }

    const row = await prisma.sQLProblem.findUnique({
        where: { slug },
        select: {
            id: true,
            slug: true,
            hiddenSchemas: true,
            hiddenExpectedOutputs: true,
            hiddenDataValidatedAt: true,
            hiddenDataValidationFingerprint: true,
        },
    })
    if (!row) {
        return NextResponse.json({ error: "Not found." }, { status: 404 })
    }

    await recordAdminAction(prisma, {
        actorId: principal.userId,
        action: "REVEAL_HIDDEN_TEST",
        targetType: "SQLProblem",
        targetId: row.id,
        metadata: { via: "session", slug },
    })

    return NextResponse.json({ data: row })
})

export const PUT = withAdmin(async (req, principal, ctx: Ctx) => {
    const { slug } = await ctx.params
    const problem = await prisma.sQLProblem.findUnique({
        where: { slug },
        select: { id: true },
    })
    if (!problem) {
        return NextResponse.json({ error: "Problem not found." }, { status: 404 })
    }

    let body: unknown
    try {
        body = await req.json()
    } catch {
        return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 })
    }

    const parsed = HiddenDataPutInput.safeParse(body)
    if (!parsed.success) {
        return NextResponse.json(
            { error: "Validation failed", details: z.treeifyError(parsed.error) },
            { status: 400 }
        )
    }

    const validation = await validateHiddenDataset({
        problemId: problem.id,
        hiddenSchemas: parsed.data.hiddenSchemas,
        hiddenExpectedOutputs: parsed.data.hiddenExpectedOutputs,
    })
    if (!validation.ok) {
        return NextResponse.json(
            {
                error: "Hidden dataset validation failed - canonical solution does not produce expected output.",
                details: validation.errors,
            },
            { status: 422 }
        )
    }

    const updated = await prisma.$transaction(async (tx) => {
        const row = await tx.sQLProblem.update({
            where: { id: problem.id },
            data: {
                hiddenSchemas: parsed.data.hiddenSchemas as Prisma.InputJsonValue,
                hiddenExpectedOutputs: parsed.data
                    .hiddenExpectedOutputs as Prisma.InputJsonValue,
                hiddenDataValidatedAt: new Date(),
                hiddenDataValidationFingerprint: validation.fingerprint,
            },
            select: {
                id: true,
                slug: true,
                updatedAt: true,
                hiddenDataValidatedAt: true,
                hiddenDataValidationFingerprint: true,
            },
        })

        await recordAdminAction(tx, {
            actorId: principal.userId,
            action: "WRITE_HIDDEN_TEST",
            targetType: "SQLProblem",
            targetId: problem.id,
            metadata: {
                via: principal.kind,
                slug,
                dialects: validation.dialects,
                schemaHashes: validation.schemaHashes,
                fingerprint: validation.fingerprint,
            },
        })

        return row
    })

    return NextResponse.json({ data: updated })
})
