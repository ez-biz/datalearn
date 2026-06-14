// Run: node --import tsx --test scripts/test-time-ist.ts
import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { formatIST, istLocalInputToUtc } from "../lib/time-ist"

describe("istLocalInputToUtc", () => {
    it("interprets a datetime-local string as IST (+5:30) wall-clock", () => {
        // 2026-06-18 18:00 IST == 2026-06-18 12:30 UTC
        assert.equal(
            istLocalInputToUtc("2026-06-18T18:00").toISOString(),
            "2026-06-18T12:30:00.000Z"
        )
    })
})

describe("formatIST", () => {
    it("formats a UTC instant in IST with an IST suffix", () => {
        // 12:30 UTC -> 18:00 IST
        const out = formatIST("2026-06-18T12:30:00.000Z")
        assert.match(out, /Jun 18, 2026/)
        assert.match(out, /6:00\s?PM/i)
        assert.match(out, /IST$/)
    })
})
