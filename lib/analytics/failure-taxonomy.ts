export type FailureCategory =
    | "ROW_COUNT"
    | "COLUMN_MISMATCH"
    | "ROW_CONTENT"
    | "MALFORMED_RESULT"
    | "PROBLEM_DEFECT"
    | "OTHER"

export const FAILURE_CATEGORIES = [
    "ROW_COUNT",
    "COLUMN_MISMATCH",
    "ROW_CONTENT",
    "MALFORMED_RESULT",
    "PROBLEM_DEFECT",
    "OTHER",
] as const satisfies readonly FailureCategory[]

export const FAILURE_LABELS: Record<FailureCategory, string> = {
    ROW_COUNT: "Wrong number of rows",
    COLUMN_MISMATCH: "Wrong columns",
    ROW_CONTENT: "Wrong values",
    MALFORMED_RESULT: "Result not a row set",
    PROBLEM_DEFECT: "Problem's expected output is malformed",
    OTHER: "Unclassified",
}

export function classifyFailure(reason: string | null): FailureCategory {
    if (reason === null) return "OTHER"

    if (reason.startsWith("Expected output is malformed")) {
        return "PROBLEM_DEFECT"
    }
    if (reason.startsWith("Row count mismatch")) {
        return "ROW_COUNT"
    }
    if (reason.startsWith("Column mismatch")) {
        return "COLUMN_MISMATCH"
    }
    if (reason.startsWith("Your result is not an array of rows")) {
        return "MALFORMED_RESULT"
    }
    if (
        /^Row \d+ differs from expected\./.test(reason) ||
        reason.startsWith("Rows do not match")
    ) {
        return "ROW_CONTENT"
    }

    return "OTHER"
}

export function tallyFailures(
    reasons: (string | null)[]
): Record<FailureCategory, number> {
    const tally: Record<FailureCategory, number> = {
        ROW_COUNT: 0,
        COLUMN_MISMATCH: 0,
        ROW_CONTENT: 0,
        MALFORMED_RESULT: 0,
        PROBLEM_DEFECT: 0,
        OTHER: 0,
    }

    for (const reason of reasons) {
        tally[classifyFailure(reason)] += 1
    }

    return tally
}
