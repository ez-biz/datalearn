// Run: node --import tsx --test scripts/test-custom-contests.ts
import { describe, it } from "node:test"
import assert from "node:assert/strict"
import {
    canCreateCustomContest,
    validateCustomContestInput,
} from "../lib/contests/custom"

describe("canCreateCustomContest", () => {
    it("allows only when the user has no active custom contest", () => {
        assert.equal(canCreateCustomContest(0), true)
        assert.equal(canCreateCustomContest(1), false)
        assert.equal(canCreateCustomContest(3), false)
    })
})

describe("validateCustomContestInput", () => {
    const base = {
        title: "Friday Night SQL",
        problemIds: ["a"],
        startsAt: new Date("2026-06-18T12:30:00.000Z"),
        endsAt: new Date("2026-06-18T13:30:00.000Z"),
        maxParticipants: 20,
    }
    it("accepts a well-formed input", () => {
        assert.equal(validateCustomContestInput(base).ok, true)
    })
    it("rejects empty problems, bad duration, and out-of-range participants", () => {
        assert.equal(validateCustomContestInput({ ...base, problemIds: [] }).ok, false)
        assert.equal(
            validateCustomContestInput({
                ...base,
                endsAt: new Date("2026-06-18T12:35:00.000Z"), // 5 min < 10 min min
            }).ok,
            false
        )
        assert.equal(
            validateCustomContestInput({ ...base, maxParticipants: 1000 }).ok,
            false
        )
        assert.equal(validateCustomContestInput({ ...base, title: "ab" }).ok, false)
    })
})
