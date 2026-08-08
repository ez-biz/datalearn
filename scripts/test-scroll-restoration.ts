// Unit tests for the pure pop-vs-push decision logic behind
// components/layout/console/MainScrollRestoration.tsx. No React, no DOM.
//
// Run: node --import tsx --test scripts/test-scroll-restoration.ts

import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { isCrossRoutePop, resolveRestoreScrollTop } from "../lib/scroll-restoration"

describe("isCrossRoutePop", () => {
    // This is the exact case the code review's Finding 1 was about: a
    // `popstate` fired by pressing Back after clicking a `#anchor` hash
    // link (e.g. TableOfContents, or /profile#submissions from UserMenu)
    // does not change the pathname. The previous implementation had no
    // equivalent guard — it treated *every* popstate as a pop, equivalent
    // to a function that always returns true regardless of its arguments.
    // This assertion fails against that old behavior (it would return
    // true), which is how we know this test actually exercises the fix
    // rather than restating it.
    it("returns false for a same-pathname popstate (hash-only Back)", () => {
        assert.equal(isCrossRoutePop("/learn/sql-basics/what-is-etl", "/learn/sql-basics/what-is-etl"), false)
    })

    it("returns true for a genuine cross-route popstate", () => {
        assert.equal(isCrossRoutePop("/practice/simple-select", "/practice"), true)
    })

    it("returns true regardless of direction (Back or Forward both count)", () => {
        assert.equal(isCrossRoutePop("/learn", "/practice"), true)
        assert.equal(isCrossRoutePop("/practice", "/learn"), true)
    })
})

describe("resolveRestoreScrollTop", () => {
    it("restores the saved position on a pop", () => {
        assert.equal(resolveRestoreScrollTop(true, 700), 700)
    })

    it("starts at the top on an ordinary push, even with a saved position", () => {
        // This is the second half of Finding 1: once isCrossRoutePop stops
        // a same-pathname popstate from leaking, the *next* ordinary push
        // must still ignore whatever is sitting in the positions map.
        assert.equal(resolveRestoreScrollTop(false, 700), 0)
    })

    it("falls back to the top on a pop with no saved position", () => {
        assert.equal(resolveRestoreScrollTop(true, undefined), 0)
    })

    it("starts at the top on a push with no saved position", () => {
        assert.equal(resolveRestoreScrollTop(false, undefined), 0)
    })
})
