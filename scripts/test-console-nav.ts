// Unit tests for the pure console-nav matching logic and sidebar cookie
// helpers. No React, no DOM, no database.
//
// Run: node --import tsx --test scripts/test-console-nav.ts

import { describe, it } from "node:test"
import assert from "node:assert/strict"
import {
    PRIMARY_NAV,
    FOOTER_NAV,
    TAB_BAR,
    activeNavKey,
    isNavItemActive,
    type NavItem,
} from "../components/layout/console/nav-model"
import {
    SIDEBAR_COOKIE,
    parseSidebarState,
    sidebarCookieString,
} from "../components/layout/console/sidebar-cookie"

function find(key: string): NavItem {
    const flat: NavItem[] = []
    for (const item of [...PRIMARY_NAV, ...FOOTER_NAV]) {
        flat.push(item)
        for (const child of item.children ?? []) flat.push(child)
    }
    const hit = flat.find((i) => i.key === key)
    assert.ok(hit, `no nav item with key "${key}"`)
    return hit
}

describe("isNavItemActive — the exclusion case", () => {
    // The rule most likely to regress: /learn/tracks is a prefix match on
    // /learn but must select Tracks, not Learn.
    it("selects Tracks and not Learn for /learn/tracks", () => {
        assert.equal(isNavItemActive(find("tracks"), "/learn/tracks"), true)
        assert.equal(isNavItemActive(find("learn"), "/learn/tracks"), false)
    })

    it("selects Tracks for a track detail page", () => {
        assert.equal(
            isNavItemActive(find("tracks"), "/learn/tracks/analyst-interview-prep"),
            true,
        )
        assert.equal(
            isNavItemActive(find("learn"), "/learn/tracks/analyst-interview-prep"),
            false,
        )
    })

    it("selects Learn and not Tracks for an ordinary topic", () => {
        assert.equal(isNavItemActive(find("learn"), "/learn/sql-basics"), true)
        assert.equal(isNavItemActive(find("tracks"), "/learn/sql-basics"), false)
    })

    it("selects Learn for the learn hub itself", () => {
        assert.equal(isNavItemActive(find("learn"), "/learn"), true)
    })
})

describe("isNavItemActive — exact vs prefix", () => {
    it("matches Home only on the root path", () => {
        assert.equal(isNavItemActive(find("home"), "/"), true)
        assert.equal(isNavItemActive(find("home"), "/learn"), false)
        assert.equal(isNavItemActive(find("home"), "/practice"), false)
    })
})

describe("isNavItemActive — parent and child together", () => {
    // Matching the mockup: on a practice route both Practice and its
    // Coding-problems child light up.
    for (const path of ["/practice", "/practice/tags", "/practice/two-sum"]) {
        it(`selects Practice and Coding problems for ${path}`, () => {
            assert.equal(isNavItemActive(find("practice"), path), true)
            assert.equal(isNavItemActive(find("coding-problems"), path), true)
        })
    }
})

describe("isNavItemActive — isolation", () => {
    const routes = [
        "/",
        "/learn",
        "/learn/sql-basics",
        "/learn/tracks",
        "/practice",
        "/practice/two-sum",
        "/contests",
    ]

    for (const path of routes) {
        it(`selects at most one top-level item for ${path}`, () => {
            const hits = PRIMARY_NAV.filter((i) => isNavItemActive(i, path))
            assert.ok(
                hits.length <= 1,
                `${path} selected: ${hits.map((h) => h.key).join(", ")}`,
            )
        })
    }

    it("leaves Practice unselected on /contests", () => {
        assert.equal(isNavItemActive(find("practice"), "/contests"), false)
        assert.equal(isNavItemActive(find("contests"), "/contests"), true)
    })
})

describe("activeNavKey", () => {
    it("returns the matching top-level key", () => {
        assert.equal(activeNavKey("/learn/tracks"), "tracks")
        assert.equal(activeNavKey("/practice/two-sum"), "practice")
        assert.equal(activeNavKey("/"), "home")
    })

    it("returns null for a route outside the nav", () => {
        assert.equal(activeNavKey("/privacy"), null)
    })
})

describe("soon items", () => {
    it("never carry an href", () => {
        const flat: NavItem[] = []
        for (const item of [...PRIMARY_NAV, ...FOOTER_NAV]) {
            flat.push(item)
            for (const child of item.children ?? []) flat.push(child)
        }
        for (const item of flat) {
            if (item.status === "soon") {
                assert.equal(
                    item.href,
                    undefined,
                    `"${item.key}" is soon but has href ${item.href}`,
                )
            }
        }
    })

    it("are never active", () => {
        assert.equal(isNavItemActive(find("projects"), "/projects"), false)
    })
})

describe("tab bar", () => {
    it("has exactly four items, all live with an href", () => {
        assert.equal(TAB_BAR.length, 4)
        for (const item of TAB_BAR) {
            assert.equal(item.status, "live", `${item.key} is not live`)
            assert.ok(item.href, `${item.key} has no href`)
        }
    })
})

describe("sidebar cookie", () => {
    it("defaults to expanded when unset or unrecognised", () => {
        assert.equal(parseSidebarState(undefined), "expanded")
        assert.equal(parseSidebarState(""), "expanded")
        assert.equal(parseSidebarState("nonsense"), "expanded")
    })

    it("round-trips both states", () => {
        assert.equal(parseSidebarState("collapsed"), "collapsed")
        assert.equal(parseSidebarState("expanded"), "expanded")
    })

    it("serialises a year-long, path-wide, Lax cookie", () => {
        const s = sidebarCookieString("collapsed")
        assert.ok(s.startsWith(`${SIDEBAR_COOKIE}=collapsed`))
        assert.match(s, /Path=\//)
        assert.match(s, /Max-Age=31536000/)
        assert.match(s, /SameSite=Lax/)
    })

    it("is not HttpOnly — the client must be able to write it", () => {
        assert.doesNotMatch(sidebarCookieString("expanded"), /HttpOnly/i)
    })
})
