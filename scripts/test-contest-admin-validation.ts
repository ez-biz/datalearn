import { describe, it } from "node:test"
import assert from "node:assert/strict"
import {
    ContestCreateInput,
    ContestProblemAttachInput,
    ContestUpdateInput,
} from "../lib/admin-validation"

describe("ContestCreateInput", () => {
    const valid = {
        slug: "weekly-1",
        title: "Weekly Contest 1",
        description: "First contest",
        kind: "WEEKLY",
        startsAt: "2026-06-01T10:00:00.000Z",
        endsAt: "2026-06-01T11:30:00.000Z",
        rated: true,
    }

    it("accepts a well-formed input", () => {
        const parsed = ContestCreateInput.safeParse(valid)
        assert.equal(parsed.success, true)
    })

    it("rejects endsAt before startsAt", () => {
        const parsed = ContestCreateInput.safeParse({
            ...valid,
            endsAt: "2026-06-01T09:00:00.000Z",
        })
        assert.equal(parsed.success, false)
    })

    it("rejects a contest shorter than 5 minutes", () => {
        const parsed = ContestCreateInput.safeParse({
            ...valid,
            endsAt: "2026-06-01T10:04:00.000Z",
        })
        assert.equal(parsed.success, false)
    })

    it("rejects non-kebab slug", () => {
        const parsed = ContestCreateInput.safeParse({
            ...valid,
            slug: "Weekly_1",
        })
        assert.equal(parsed.success, false)
    })

    it("rejects USER_CUSTOM in admin input", () => {
        const parsed = ContestCreateInput.safeParse({
            ...valid,
            kind: "USER_CUSTOM",
        })
        assert.equal(parsed.success, false)
    })
})

describe("ContestUpdateInput", () => {
    it("allows partial update", () => {
        const parsed = ContestUpdateInput.safeParse({ title: "Renamed" })
        assert.equal(parsed.success, true)
    })

    it("rejects status field", () => {
        const parsed = ContestUpdateInput.safeParse({ status: "LIVE" })
        assert.equal(parsed.success, false)
    })
})

describe("ContestProblemAttachInput", () => {
    it("accepts a valid attach", () => {
        const parsed = ContestProblemAttachInput.safeParse({
            problemId: "ckxxxxxxxxxxxxxxxxxxxxxxx",
            position: 1,
            points: 3,
        })
        assert.equal(parsed.success, true)
    })

    it("rejects points <= 0", () => {
        const parsed = ContestProblemAttachInput.safeParse({
            problemId: "ckxxxxxxxxxxxxxxxxxxxxxxx",
            position: 1,
            points: 0,
        })
        assert.equal(parsed.success, false)
    })
})
