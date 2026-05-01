import assert from "node:assert/strict"
import test from "node:test"
import {
    addUtcDays,
    normalizeDailyDate,
    parseDailyDateKey,
    selectAutoDailyCandidate,
    toDailyKey,
    type DailyProblemCandidate,
} from "../lib/daily-utils"

test("normalizeDailyDate returns UTC midnight", () => {
    const d = new Date("2026-05-01T23:45:30.123Z")
    assert.equal(normalizeDailyDate(d).toISOString(), "2026-05-01T00:00:00.000Z")
})

test("toDailyKey formats the normalized UTC date", () => {
    assert.equal(toDailyKey(new Date("2026-05-01T23:45:30.123Z")), "2026-05-01")
})

test("parseDailyDateKey accepts valid calendar dates", () => {
    assert.equal(parseDailyDateKey("2026-05-01").toISOString(), "2026-05-01T00:00:00.000Z")
})

test("parseDailyDateKey rejects malformed date keys", () => {
    assert.throws(() => parseDailyDateKey("2026-5-1"), /YYYY-MM-DD/)
})

test("parseDailyDateKey rejects impossible calendar dates", () => {
    assert.throws(() => parseDailyDateKey("2026-02-31"), /valid calendar date/)
    assert.throws(() => parseDailyDateKey("2026-13-01"), /valid calendar date/)
})

test("addUtcDays shifts from UTC midnight across month and year boundaries", () => {
    assert.equal(addUtcDays(new Date("2026-12-31T23:00:00.000Z"), 1).toISOString(), "2027-01-01T00:00:00.000Z")
    assert.equal(addUtcDays(new Date("2026-03-01T12:00:00.000Z"), -1).toISOString(), "2026-02-28T00:00:00.000Z")
})

test("selectAutoDailyCandidate prefers never-used problems", () => {
    const rows: DailyProblemCandidate[] = [
        { id: "old", number: 1, lastDailyAt: new Date("2026-04-01T00:00:00.000Z") },
        { id: "never-high", number: 5, lastDailyAt: null },
        { id: "never-low", number: 2, lastDailyAt: null },
    ]
    assert.equal(selectAutoDailyCandidate(rows)?.id, "never-low")
})

test("selectAutoDailyCandidate prefers oldest-used problem when all were used", () => {
    const rows: DailyProblemCandidate[] = [
        { id: "recent", number: 1, lastDailyAt: new Date("2026-04-20T00:00:00.000Z") },
        { id: "old", number: 3, lastDailyAt: new Date("2026-04-01T00:00:00.000Z") },
        { id: "old-low", number: 2, lastDailyAt: new Date("2026-04-01T00:00:00.000Z") },
    ]
    assert.equal(selectAutoDailyCandidate(rows)?.id, "old-low")
})

test("selectAutoDailyCandidate returns null for an empty candidate set", () => {
    assert.equal(selectAutoDailyCandidate([]), null)
})

test("selectAutoDailyCandidate does not mutate the input array", () => {
    const rows: DailyProblemCandidate[] = [
        { id: "b", number: 2, lastDailyAt: null },
        { id: "a", number: 1, lastDailyAt: null },
    ]
    selectAutoDailyCandidate(rows)
    assert.deepEqual(rows.map((r) => r.id), ["b", "a"])
})
