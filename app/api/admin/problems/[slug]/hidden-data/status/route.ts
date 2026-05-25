import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { withAdmin } from "@/lib/api-auth"
import {
    computeHiddenFingerprint,
    schemaHashesFor,
} from "@/lib/contest-hidden-validator"

type Ctx = { params: Promise<{ slug: string }> }

export const GET = withAdmin(async (_req, _principal, ctx: Ctx) => {
    const { slug } = await ctx.params
    const row = await prisma.sQLProblem.findUnique({
        where: { slug },
        select: {
            id: true,
            slug: true,
            dialects: true,
            solutions: true,
            ordered: true,
            hiddenSchemas: true,
            hiddenExpectedOutputs: true,
            hiddenDataValidatedAt: true,
            hiddenDataValidationFingerprint: true,
        },
    })
    if (!row) {
        return NextResponse.json({ error: "Not found." }, { status: 404 })
    }

    const hiddenSchemas = (row.hiddenSchemas ?? {}) as Record<string, string>
    const hiddenExpectedOutputs = (row.hiddenExpectedOutputs ?? {}) as Record<
        string,
        Record<string, unknown>[]
    >
    const solutions = (row.solutions ?? {}) as Record<string, string>
    const presentDialects: string[] = []
    const completeSchemas: Record<string, string> = {}
    const missing: Array<{
        dialect: string
        missing: "schema" | "expected" | "both"
    }> = []

    for (const dialect of row.dialects as string[]) {
        const hasSchema =
            typeof hiddenSchemas[dialect] === "string" &&
            hiddenSchemas[dialect].length > 0
        const hasExpected = Array.isArray(hiddenExpectedOutputs[dialect])
        if (hasSchema && hasExpected) {
            presentDialects.push(dialect)
            completeSchemas[dialect] = hiddenSchemas[dialect]
        } else {
            missing.push({
                dialect,
                missing:
                    !hasSchema && !hasExpected
                        ? "both"
                        : !hasSchema
                            ? "schema"
                            : "expected",
            })
        }
    }

    let validationStale = false
    if (row.hiddenDataValidationFingerprint) {
        const currentFingerprint = computeHiddenFingerprint({
            hiddenSchemas,
            hiddenExpectedOutputs,
            solutions,
            dialects: row.dialects,
            ordered: row.ordered,
        })
        validationStale =
            currentFingerprint !== row.hiddenDataValidationFingerprint
    } else {
        validationStale = presentDialects.length > 0
    }

    return NextResponse.json({
        data: {
            id: row.id,
            slug: row.slug,
            dialects: row.dialects,
            presentDialects,
            schemaHashes: schemaHashesFor(completeSchemas),
            missing,
            validatedAt: row.hiddenDataValidatedAt,
            validationStale,
        },
    })
})
