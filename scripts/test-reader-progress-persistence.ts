// Unit tests for client-side lesson-progress write acknowledgement. No DOM.
//
// Run: node --import tsx --test scripts/test-reader-progress-persistence.ts

import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { ProgressWriteQueue } from "../lib/reader-progress-write-queue"

function queue(initialPercent: number): ProgressWriteQueue {
    return new ProgressWriteQueue(initialPercent)
}

describe("ProgressWriteQueue", () => {
    it("does not acknowledge a write until the server confirms it", () => {
        const writes = queue(0)
        const request = writes.flush(40)
        assert.equal(request?.percent, 40)
        assert.equal(writes.acknowledged, 0)
        assert.equal(
            writes.acknowledge(request!, { ok: true, percent: 40 }).next,
            null,
        )
        assert.equal(writes.acknowledged, 40)
    })

    it("keeps a failed write pending for a later flush", () => {
        const writes = queue(0)
        const request = writes.flush(40)
        assert.equal(request?.percent, 40)
        assert.equal(
            writes.acknowledge(request!, { ok: false, percent: 0 }).next,
            null,
        )
        assert.equal(writes.acknowledged, 0)
        assert.equal(writes.flush(40, true)?.percent, 40)
    })

    it("coalesces a higher boundary behind the acknowledged request", () => {
        const writes = queue(0)
        const first = writes.flush(40)
        assert.equal(first?.percent, 40)
        assert.equal(writes.flush(50), null)
        const second = writes.acknowledge(first!, { ok: true, percent: 40 }).next
        assert.equal(second?.percent, 50)
        assert.equal(writes.acknowledged, 40)
        assert.equal(
            writes.acknowledge(second!, { ok: true, percent: 50 }).next,
            null,
        )
        assert.equal(writes.acknowledged, 50)
    })

    it("resets pending and acknowledged state for a different article", () => {
        const writes = queue(40)
        assert.equal(writes.flush(100)?.percent, 100)
        writes.reset(10)
        assert.equal(writes.acknowledged, 10)
        assert.equal(writes.flush(15), null)
        assert.equal(writes.flush(20)?.percent, 20)
    })

    it("ignores an old A acknowledgement after navigating A to B to A", () => {
        const writes = queue(0)
        const oldA = writes.flush(40)
        writes.reset(0)
        writes.reset(0)
        const currentA = writes.flush(50)

        const stale = writes.acknowledge(oldA!, { ok: true, percent: 40 })
        assert.equal(stale.accepted, false)

        const current = writes.acknowledge(currentA!, { ok: true, percent: 50 })
        assert.equal(current.accepted, true)
        assert.equal(writes.acknowledged, 50)
    })
})
