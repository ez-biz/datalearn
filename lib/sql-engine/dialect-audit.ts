export type Dialect = "DUCKDB" | "POSTGRES"

export type DialectAuditProblem = {
    number: number
    slug: string
    ordered: boolean
    dialects: Dialect[]
    solutionSql?: string | null
    expectedOutput?: string | null
    solutions?: unknown
    expectedOutputs?: unknown
    schema?: { sql?: string | null } | null
}

export type DialectAuditPair =
    | {
          ok: true
          label: string
          ordered: boolean
          schemaSql: string
          solutionSql: string
          expectedRows: unknown
      }
    | {
          ok: false
          label: string
          reason: string
      }

export function resolveDialectAuditPair(
    problem: DialectAuditProblem,
    dialect: Dialect
): DialectAuditPair {
    const label = `#${problem.number} ${problem.slug} [${dialect}]`
    const solutions = toStringRecord(problem.solutions)
    const expectedOutputs = toStringRecord(problem.expectedOutputs)

    const solutionSql = solutions[dialect] ?? problem.solutionSql ?? ""
    if (!solutionSql.trim()) {
        return { ok: false, label, reason: "no solution for this dialect" }
    }

    const schemaSql = problem.schema?.sql ?? ""
    if (!schemaSql.trim()) {
        return { ok: false, label, reason: "no schema attached" }
    }

    const expectedRaw = expectedOutputs[dialect] ?? problem.expectedOutput ?? ""
    if (!expectedRaw.trim()) {
        return { ok: false, label, reason: "no expected output for this dialect" }
    }
    let expectedRows: unknown
    try {
        expectedRows = JSON.parse(expectedRaw)
    } catch {
        return { ok: false, label, reason: "expectedOutput is not valid JSON" }
    }

    return {
        ok: true,
        label,
        ordered: problem.ordered,
        schemaSql,
        solutionSql,
        expectedRows,
    }
}

function toStringRecord(value: unknown): Record<string, string> {
    if (value === null || typeof value !== "object" || Array.isArray(value)) {
        return {}
    }

    return Object.fromEntries(
        Object.entries(value).filter(
            (entry): entry is [string, string] => typeof entry[1] === "string"
        )
    )
}
