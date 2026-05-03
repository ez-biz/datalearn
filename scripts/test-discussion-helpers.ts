import assert from "node:assert/strict"
import { tierForScore } from "../lib/discussions/reputation"

const settings = {
    trustedMinReputation: 20,
    highTrustMinReputation: 100,
}

assert.equal(tierForScore(0, settings), "NEW")
assert.equal(tierForScore(20, settings), "TRUSTED")
assert.equal(tierForScore(99, settings), "TRUSTED")
assert.equal(tierForScore(100, settings), "HIGH_TRUST")

console.log("discussion helper tests passed")
