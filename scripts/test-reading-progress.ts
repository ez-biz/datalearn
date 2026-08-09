// Unit tests for reading-progress maths. No DOM — these are pure numbers.
//
// Run: node --import tsx --test scripts/test-reading-progress.ts

import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { scrollPercent, shouldPersist } from "../lib/reading-progress"

describe("scrollPercent", () => {
    it("is 0 at the top of a scrollable article", () => {
        assert.equal(scrollPercent(0, 3000, 800), 0)
    })

    it("is 100 at the bottom of a scrollable article", () => {
        assert.equal(scrollPercent(2200, 3000, 800), 100)
    })

    it("is the ratio of scrolled to scrollable distance in between", () => {
        assert.equal(scrollPercent(1100, 3000, 800), 50)
    })

    it("is 100 when there is nothing to scroll", () => {
        // Every seeded lesson is 4-5 minutes. In a tall window the content
        // fits entirely, so scrollHeight === clientHeight and there is no
        // scrollable distance. Without this branch the lesson could never
        // be completed.
        assert.equal(scrollPercent(0, 800, 800), 100)
    })

    it("is 100 when the viewport is taller than the content", () => {
        assert.equal(scrollPercent(0, 600, 800), 100)
    })

    it("clamps overscroll to 100", () => {
        // iOS rubber-banding reports scrollTop past the maximum.
        assert.equal(scrollPercent(2600, 3000, 800), 100)
    })

    it("clamps negative overscroll to 0", () => {
        assert.equal(scrollPercent(-120, 3000, 800), 0)
    })
})

describe("shouldPersist", () => {
    it("writes when a new ten-percent boundary is crossed", () => {
        assert.equal(shouldPersist(9, 10), true)
        assert.equal(shouldPersist(0, 40), true)
    })

    it("does not write inside the same bucket", () => {
        assert.equal(shouldPersist(10, 19), false)
        assert.equal(shouldPersist(40, 45), false)
    })

    it("writes on reaching 100 from the nineties", () => {
        assert.equal(shouldPersist(95, 100), true)
    })

    it("does not write again once 100 is recorded", () => {
        assert.equal(shouldPersist(100, 100), false)
    })

    it("never writes backwards", () => {
        // The caller keeps a monotonic max, but guard anyway: LessonProgress
        // is documented as never decreasing.
        assert.equal(shouldPersist(60, 20), false)
    })
})
