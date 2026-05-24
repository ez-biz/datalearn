import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { deriveContestStatus } from "../lib/contest-status"

const startsAt = new Date("2026-06-01T10:00:00Z")
const endsAt = new Date("2026-06-01T11:30:00Z")

describe("deriveContestStatus", () => {
    it("returns SCHEDULED before start", () => {
        assert.equal(
            deriveContestStatus(
                startsAt,
                endsAt,
                "SCHEDULED",
                new Date("2026-06-01T09:59:59Z")
            ),
            "SCHEDULED"
        )
    })

    it("returns LIVE during the contest window", () => {
        assert.equal(
            deriveContestStatus(
                startsAt,
                endsAt,
                "SCHEDULED",
                new Date("2026-06-01T10:30:00Z")
            ),
            "LIVE"
        )
    })

    it("returns CLOSED after the contest ends", () => {
        assert.equal(
            deriveContestStatus(
                startsAt,
                endsAt,
                "LIVE",
                new Date("2026-06-01T11:30:00Z")
            ),
            "CLOSED"
        )
    })

    it("keeps CLOSED, FINALIZED, and CANCELLED closed", () => {
        assert.equal(
            deriveContestStatus(
                startsAt,
                endsAt,
                "CLOSED",
                new Date("2026-06-01T10:30:00Z")
            ),
            "CLOSED"
        )
        assert.equal(
            deriveContestStatus(
                startsAt,
                endsAt,
                "FINALIZED",
                new Date("2026-06-01T10:30:00Z")
            ),
            "CLOSED"
        )
        assert.equal(
            deriveContestStatus(
                startsAt,
                endsAt,
                "CANCELLED",
                new Date("2026-06-01T10:30:00Z")
            ),
            "CLOSED"
        )
    })
})
