// Unit tests for the per-problem attempt distribution.
// No React, no DOM, no database.
//
// Run: node --import tsx --test scripts/test-analytics-attempt-distribution.ts

import { describe, it } from "node:test"
import assert from "node:assert/strict"
import {
    attemptsToFirstSolve,
    firstTryAcceptedCount,
} from "../lib/analytics/attempt-distribution"

const sub = (userId: string, accepted: boolean) => ({ userId, accepted })

describe("attemptsToFirstSolve", () => {
    it("buckets a first-attempt solve at one", () => {
        assert.deepEqual(attemptsToFirstSolve([sub("u1", true)]), [
            { attempts: 1, solvers: 1 },
        ])
    })

    it("counts the attempts up to and including the first acceptance", () => {
        const buckets = attemptsToFirstSolve([
            sub("u1", false),
            sub("u1", false),
            sub("u1", true),
        ])
        assert.deepEqual(buckets, [{ attempts: 3, solvers: 1 }])
    })

    // Someone who keeps practising after solving must not inflate their own
    // difficulty — the question is how hard it was to solve the first time.
    it("ignores submissions made after the first acceptance", () => {
        const buckets = attemptsToFirstSolve([
            sub("u1", false),
            sub("u1", true),
            sub("u1", false),
            sub("u1", true),
        ])
        assert.deepEqual(buckets, [{ attempts: 2, solvers: 1 }])
    })

    it("excludes users who never solved it — they have no first solve", () => {
        const buckets = attemptsToFirstSolve([
            sub("u1", false),
            sub("u1", false),
            sub("u2", true),
        ])
        assert.deepEqual(buckets, [{ attempts: 1, solvers: 1 }])
    })

    it("groups users who took the same number of attempts", () => {
        const buckets = attemptsToFirstSolve([
            sub("u1", false),
            sub("u1", true),
            sub("u2", false),
            sub("u2", true),
        ])
        assert.deepEqual(buckets, [{ attempts: 2, solvers: 2 }])
    })

    it("orders buckets by attempt count ascending", () => {
        const buckets = attemptsToFirstSolve([
            sub("slow", false),
            sub("slow", false),
            sub("slow", true),
            sub("fast", true),
            sub("mid", false),
            sub("mid", true),
        ])
        assert.deepEqual(buckets, [
            { attempts: 1, solvers: 1 },
            { attempts: 2, solvers: 1 },
            { attempts: 3, solvers: 1 },
        ])
    })

    it("interleaves users correctly rather than counting globally", () => {
        // u1: fail, fail, accept (3). u2: fail, accept (2). Interleaved, so a
        // naive global counter would mis-attribute the attempts.
        const buckets = attemptsToFirstSolve([
            sub("u1", false),
            sub("u2", false),
            sub("u1", false),
            sub("u2", true),
            sub("u1", true),
        ])
        assert.deepEqual(buckets, [
            { attempts: 2, solvers: 1 },
            { attempts: 3, solvers: 1 },
        ])
    })

    it("returns an empty array when nobody has solved it", () => {
        assert.deepEqual(attemptsToFirstSolve([sub("u1", false)]), [])
    })

    it("returns an empty array for no submissions", () => {
        assert.deepEqual(attemptsToFirstSolve([]), [])
    })
})

describe("firstTryAcceptedCount", () => {
    it("counts only users whose very first submission was accepted", () => {
        const count = firstTryAcceptedCount([
            sub("u1", true),
            sub("u2", false),
            sub("u2", true),
        ])
        assert.equal(count, 1)
    })

    it("does not count a later acceptance as a first-try solve", () => {
        assert.equal(firstTryAcceptedCount([sub("u1", false), sub("u1", true)]), 0)
    })

    it("counts each user once no matter how many times they resubmit", () => {
        const count = firstTryAcceptedCount([
            sub("u1", true),
            sub("u1", true),
            sub("u1", true),
        ])
        assert.equal(count, 1)
    })

    it("returns zero for no submissions", () => {
        assert.equal(firstTryAcceptedCount([]), 0)
    })
})
