import crypto from "node:crypto"
import { prisma } from "./prisma"
import { submitToJudge } from "./contest-judge"
import { compareResults } from "./sql-validator"

type Dialect = "DUCKDB" | "POSTGRES"

export type HiddenValidationOk = {
    ok: true
    schemaHashes: Record<string, string>
    dialects: string[]
    fingerprint: string
}

export type HiddenValidationFail = {
    ok: false
    errors: Array<{ dialect: string; reason: string }>
}

export type HiddenValidationResult =
    | HiddenValidationOk
    | HiddenValidationFail

export async function validateHiddenDataset(args: {
    problemId: string
    hiddenSchemas: Partial<Record<Dialect, string>>
    hiddenExpectedOutputs: Partial<Record<Dialect, Record<string, unknown>[]>>
}): Promise<HiddenValidationResult> {
    const problem = await prisma.sQLProblem.findUniqueOrThrow({
        where: { id: args.problemId },
        select: { dialects: true, solutions: true, ordered: true },
    })

    const solutions = (problem.solutions ?? {}) as Record<string, string>
    const errors: HiddenValidationFail["errors"] = []
    const schemaHashes: Record<string, string> = {}

    for (const dialect of problem.dialects as Dialect[]) {
        const schemaSql = args.hiddenSchemas[dialect]
        const expected = args.hiddenExpectedOutputs[dialect]
        const solutionSql = solutions[dialect]

        if (!schemaSql) {
            errors.push({ dialect, reason: "missing hidden schema" })
            continue
        }
        if (!expected) {
            errors.push({ dialect, reason: "missing hidden expected output" })
            continue
        }
        if (!solutionSql) {
            errors.push({ dialect, reason: "no canonical solution defined" })
            continue
        }

        schemaHashes[dialect] = sha256(schemaSql)
        const outcome = await submitToJudge({
            dialect,
            userSql: solutionSql,
            hiddenSchemaSql: schemaSql,
            hiddenExpected: expected,
            ordered: problem.ordered,
            timeoutMs: 8_000,
        })

        if (outcome.verdict !== "ACCEPTED") {
            errors.push({
                dialect,
                reason: `canonical solution returned ${outcome.verdict}${outcome.message ? `: ${outcome.message}` : ""}`,
            })
            continue
        }

        const comparison = compareResults(outcome.userRows ?? [], expected, {
            ordered: problem.ordered,
        })
        if (!comparison.ok) {
            errors.push({
                dialect,
                reason: `comparator disagreement: ${comparison.reason}`,
            })
        }
    }

    if (errors.length > 0) {
        return { ok: false, errors }
    }

    return {
        ok: true,
        schemaHashes,
        dialects: problem.dialects,
        fingerprint: computeHiddenFingerprint({
            hiddenSchemas: args.hiddenSchemas,
            hiddenExpectedOutputs: args.hiddenExpectedOutputs,
            solutions,
            dialects: problem.dialects,
            ordered: problem.ordered,
        }),
    }
}

export function computeHiddenFingerprint(input: {
    hiddenSchemas: Partial<Record<Dialect | string, string>>
    hiddenExpectedOutputs: Partial<
        Record<Dialect | string, Record<string, unknown>[]>
    >
    solutions: Record<string, string>
    dialects: string[]
    ordered: boolean
}): string {
    const canonical = JSON.stringify({
        hiddenSchemas: sortKeys(input.hiddenSchemas),
        hiddenExpectedOutputs: sortKeysDeep(input.hiddenExpectedOutputs),
        solutions: sortKeys(input.solutions),
        dialects: [...input.dialects].sort(),
        ordered: input.ordered,
    })
    return sha256(canonical)
}

export function schemaHashesFor(
    hiddenSchemas: Record<string, string>
): Record<string, string> {
    return Object.fromEntries(
        Object.entries(hiddenSchemas).map(([dialect, schemaSql]) => [
            dialect,
            sha256(schemaSql),
        ])
    )
}

function sha256(value: string): string {
    return crypto.createHash("sha256").update(value).digest("hex")
}

function sortKeys<T extends Record<string, unknown>>(value: T): T {
    const out: Record<string, unknown> = {}
    for (const key of Object.keys(value).sort()) {
        out[key] = value[key]
    }
    return out as T
}

function sortKeysDeep(value: unknown): unknown {
    if (Array.isArray(value)) {
        return value.map(sortKeysDeep)
    }
    if (value && typeof value === "object") {
        const record = value as Record<string, unknown>
        const out: Record<string, unknown> = {}
        for (const key of Object.keys(record).sort()) {
            out[key] = sortKeysDeep(record[key])
        }
        return out
    }
    return value
}
