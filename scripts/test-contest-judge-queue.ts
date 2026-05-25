import { beforeEach, describe, it } from "node:test"
import assert from "node:assert/strict"
import {
    JudgeBusyError,
    _queueInternalsForTests,
    _resetQueueForTests,
    enqueue,
} from "../lib/contest-judge-queue"

describe("contest judge queue", () => {
    beforeEach(() => {
        _resetQueueForTests()
    })

    it("never exceeds CONCURRENCY under a burst", async () => {
        const { CONCURRENCY } = _queueInternalsForTests()
        let currentlyInside = 0
        let maxObserved = 0

        const jobs = Array.from({ length: CONCURRENCY * 4 }, () =>
            enqueue(async () => {
                currentlyInside++
                maxObserved = Math.max(maxObserved, currentlyInside)
                await new Promise((resolve) => setTimeout(resolve, 20))
                currentlyInside--
            })
        )

        await Promise.all(jobs)
        assert.ok(
            maxObserved <= CONCURRENCY,
            `maxObserved=${maxObserved}, CONCURRENCY=${CONCURRENCY}`
        )
    })

    it("rejects with JudgeBusyError beyond MAX_QUEUE_DEPTH", async () => {
        const { CONCURRENCY, MAX_QUEUE_DEPTH } = _queueInternalsForTests()
        const total = CONCURRENCY + MAX_QUEUE_DEPTH + 1

        const results = await Promise.allSettled(
            Array.from({ length: total }, () =>
                enqueue(() => new Promise((resolve) => setTimeout(resolve, 20)))
            )
        )

        const rejected = results.filter(
            (result): result is PromiseRejectedResult =>
                result.status === "rejected"
        )
        assert.ok(rejected.length >= 1)
        assert.ok(
            rejected.every((result) => result.reason instanceof JudgeBusyError)
        )
    })
})
