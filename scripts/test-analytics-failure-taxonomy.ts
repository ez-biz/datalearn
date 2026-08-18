// Unit tests for categorizing stable SQL validator failure reasons.
// No React, DOM, database, or framework dependencies.
//
// Run: node --import tsx --test scripts/test-analytics-failure-taxonomy.ts

import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { compareResults } from "../lib/sql-validator"
import {
    FAILURE_CATEGORIES,
    FAILURE_LABELS,
    classifyFailure,
    tallyFailures,
} from "../lib/analytics/failure-taxonomy"

function failedReason(
    user: unknown,
    expected: unknown,
    opts: { ordered: boolean }
): string {
    const result = compareResults(user, expected, opts)

    assert.equal(result.ok, false, "fixture must fail validation")
    if (result.ok) {
        throw new Error("fixture unexpectedly passed validation")
    }

    return result.reason
}

const expectedRows = [
    { id: 1, value: "one" },
    { id: 2, value: "two" },
]

describe("classifyFailure", () => {
    it("maps real validator failures to the corresponding analytics categories", () => {
        const rowCountReason = failedReason(
            [{ id: 1, value: "one" }],
            expectedRows,
            { ordered: true }
        )
        const columnMismatchReason = failedReason(
            [
                { id: 1, label: "one" },
                { id: 2, label: "two" },
            ],
            expectedRows,
            { ordered: true }
        )
        const orderedRowContentReason = failedReason(
            [
                { id: 1, value: "wrong" },
                { id: 2, value: "two" },
            ],
            expectedRows,
            { ordered: true }
        )
        const unorderedRowContentReason = failedReason(
            [
                { id: 1, value: "one" },
                { id: 2, value: "wrong" },
            ],
            expectedRows,
            { ordered: false }
        )
        const malformedResultReason = failedReason("not rows", expectedRows, {
            ordered: true,
        })
        const problemDefectReason = failedReason(expectedRows, "not rows", {
            ordered: true,
        })

        assert.equal(classifyFailure(rowCountReason), "ROW_COUNT")
        assert.equal(classifyFailure(columnMismatchReason), "COLUMN_MISMATCH")
        assert.equal(classifyFailure(orderedRowContentReason), "ROW_CONTENT")
        assert.equal(classifyFailure(unorderedRowContentReason), "ROW_CONTENT")
        assert.equal(classifyFailure(malformedResultReason), "MALFORMED_RESULT")
        assert.equal(classifyFailure(problemDefectReason), "PROBLEM_DEFECT")
        assert.equal(classifyFailure("A future validator error"), "OTHER")
        assert.equal(classifyFailure(null), "OTHER")
    })
})

describe("failure taxonomy metadata", () => {
    it("exports every category once with a label", () => {
        const categories = [...FAILURE_CATEGORIES]

        assert.equal(new Set(categories).size, categories.length)
        assert.deepEqual(categories.sort(), [
            "COLUMN_MISMATCH",
            "MALFORMED_RESULT",
            "OTHER",
            "PROBLEM_DEFECT",
            "ROW_CONTENT",
            "ROW_COUNT",
        ])
        assert.deepEqual(FAILURE_LABELS, {
            ROW_COUNT: "Wrong number of rows",
            COLUMN_MISMATCH: "Wrong columns",
            ROW_CONTENT: "Wrong values",
            MALFORMED_RESULT: "Result not a row set",
            PROBLEM_DEFECT: "Problem's expected output is malformed",
            OTHER: "Unclassified",
        })
    })
})

describe("tallyFailures", () => {
    it("initializes zero-count categories and counts repeated validator failures", () => {
        const rowCountReason = failedReason(
            [{ id: 1, value: "one" }],
            expectedRows,
            { ordered: true }
        )

        assert.deepEqual(tallyFailures([rowCountReason, rowCountReason, null]), {
            ROW_COUNT: 2,
            COLUMN_MISMATCH: 0,
            ROW_CONTENT: 0,
            MALFORMED_RESULT: 0,
            PROBLEM_DEFECT: 0,
            OTHER: 1,
        })
    })
})
