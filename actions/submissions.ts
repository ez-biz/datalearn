"use server"

import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { compareResults, type ValidationResult } from "@/lib/sql-validator"

const SubmitSchema = z.object({
    problemSlug: z.string().min(1).max(200),
    userResult: z.array(z.record(z.string(), z.unknown())),
})

export async function validateSubmission(input: unknown): Promise<ValidationResult> {
    const parsed = SubmitSchema.safeParse(input)
    if (!parsed.success) {
        return {
            ok: false,
            reason: "Invalid submission shape. Your result must be an array of row objects.",
        }
    }

    const { problemSlug, userResult } = parsed.data

    const problem = await prisma.sQLProblem.findUnique({
        where: { slug: problemSlug },
        select: { expectedOutput: true, ordered: true },
    })

    if (!problem) {
        return { ok: false, reason: "Problem not found." }
    }

    let expected: unknown
    try {
        expected = JSON.parse(problem.expectedOutput)
    } catch {
        return {
            ok: false,
            reason: "Expected output for this problem is malformed. Report this.",
        }
    }

    return compareResults(userResult, expected, { ordered: problem.ordered })
}
