// Unit tests for denormalized analytics counter reconciliation.
// No React, DOM, database, or framework dependencies.
//
// Run: node --import tsx --test scripts/test-analytics-counter-drift.ts

import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { findDrift } from "../lib/analytics/counter-drift"
import type { ProblemCounters, TrueCounts } from "../lib/analytics/counter-drift"

function counter(
    problemId: string,
    attemptCount: number,
    acceptedCount: number
): ProblemCounters {
    return {
        problemId,
        number: Number(problemId),
        title: `Problem ${problemId}`,
        attemptCount,
        acceptedCount,
    }
}

function trueCounts(
    entries: Array<[string, TrueCounts]>
): Map<string, TrueCounts> {
    return new Map(entries)
}

describe("findDrift", () => {
    it("returns no drift for an exact counter match", () => {
        const report = findDrift(
            [counter("1", 7, 3)],
            trueCounts([["1", { attempts: 7, accepted: 3 }]])
        )

        assert.deepEqual(report, { checked: 1, drifted: [] })
    })

    it("reports counters ahead of truth as positive drift", () => {
        const report = findDrift(
            [counter("1", 10, 5)],
            trueCounts([["1", { attempts: 7, accepted: 4 }]])
        )

        assert.deepEqual(report.drifted, [
            {
                problemId: "1",
                number: 1,
                title: "Problem 1",
                attemptDrift: 3,
                acceptedDrift: 1,
            },
        ])
    })

    it("reports counters behind truth as negative drift", () => {
        const report = findDrift(
            [counter("1", 4, 2)],
            trueCounts([["1", { attempts: 7, accepted: 3 }]])
        )

        assert.deepEqual(report.drifted, [
            {
                problemId: "1",
                number: 1,
                title: "Problem 1",
                attemptDrift: -3,
                acceptedDrift: -1,
            },
        ])
    })

    it("treats an absent truth row as zero submissions", () => {
        const report = findDrift([counter("1", 2, 1)], new Map())

        assert.deepEqual(report.drifted, [
            {
                problemId: "1",
                number: 1,
                title: "Problem 1",
                attemptDrift: 2,
                acceptedDrift: 1,
            },
        ])
    })

    it("does not flag an untouched counter without a truth row", () => {
        const report = findDrift([counter("1", 0, 0)], new Map())

        assert.deepEqual(report, { checked: 1, drifted: [] })
    })

    it("reports accepted-only drift", () => {
        const report = findDrift(
            [counter("1", 9, 5)],
            trueCounts([["1", { attempts: 9, accepted: 3 }]])
        )

        assert.deepEqual(report.drifted, [
            {
                problemId: "1",
                number: 1,
                title: "Problem 1",
                attemptDrift: 0,
                acceptedDrift: 2,
            },
        ])
    })

    it("counts every supplied clean counter", () => {
        const report = findDrift(
            [counter("1", 1, 1), counter("2", 0, 0), counter("3", 4, 2)],
            trueCounts([
                ["1", { attempts: 1, accepted: 1 }],
                ["3", { attempts: 4, accepted: 2 }],
            ])
        )

        assert.deepEqual(report, { checked: 3, drifted: [] })
    })

    it("orders drift rows by descending total absolute magnitude", () => {
        const report = findDrift(
            [counter("1", 6, 2), counter("2", 2, 0), counter("3", 3, 1)],
            trueCounts([
                ["1", { attempts: 5, accepted: 2 }],
                ["2", { attempts: 5, accepted: 1 }],
                ["3", { attempts: 3, accepted: 4 }],
            ])
        )

        assert.deepEqual(
            report.drifted.map(({ problemId }) => problemId),
            ["2", "3", "1"]
        )
    })
})
