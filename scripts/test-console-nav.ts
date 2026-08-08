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
import { isFocusRoute } from "../components/layout/console/focus-route"

function find(key: string): NavItem {
    const flat: NavItem[] = []
    for (const item of [...PRIMARY_NAV, ...FOOTER_NAV, ...TAB_BAR]) {
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

    describe("isolation — at most one tab matches any route", () => {
        const routes = [
            "/",
            "/learn",
            "/learn/sql-basics",
            "/learn/tracks",
            "/learn/tracks/analyst-interview-prep",
            "/practice",
            "/practice/two-sum",
            "/profile",
        ]

        for (const path of routes) {
            it(`selects at most one tab for ${path}`, () => {
                const hits = TAB_BAR.filter((i) => isNavItemActive(i, path))
                assert.ok(
                    hits.length <= 1,
                    `${path} selected: ${hits.map((h) => h.key).join(", ")}`,
                )
            })
        }
    })

    describe("exclusion — /learn/tracks belongs to Tracks, not Learn", () => {
        it("selects tab-tracks and not tab-learn for /learn/tracks", () => {
            assert.equal(isNavItemActive(find("tab-tracks"), "/learn/tracks"), true)
            assert.equal(isNavItemActive(find("tab-learn"), "/learn/tracks"), false)
        })

        it("selects tab-tracks for a track detail page", () => {
            assert.equal(
                isNavItemActive(find("tab-tracks"), "/learn/tracks/analyst-interview-prep"),
                true,
            )
            assert.equal(
                isNavItemActive(find("tab-learn"), "/learn/tracks/analyst-interview-prep"),
                false,
            )
        })
    })

    describe("consistency with PRIMARY_NAV", () => {
        // For certain routes, verify that the tab bar and PRIMARY_NAV
        // select the same logical section.
        const testCases = [
            { path: "/learn", tab: "tab-learn", primary: "learn" },
            { path: "/learn/tracks", tab: "tab-tracks", primary: "tracks" },
            { path: "/learn/sql-basics", tab: "tab-learn", primary: "learn" },
            { path: "/learn/tracks/analyst-interview-prep", tab: "tab-tracks", primary: "tracks" },
            { path: "/practice", tab: "tab-practice", primary: "practice" },
            { path: "/practice/two-sum", tab: "tab-practice", primary: "practice" },
        ]

        for (const { path, tab, primary } of testCases) {
            it(`agrees on ${path}`, () => {
                const tabActive = isNavItemActive(find(tab), path)
                const primaryActive = isNavItemActive(find(primary), path)
                assert.equal(
                    tabActive,
                    primaryActive,
                    `${path}: tab ${tab}=${tabActive}, primary ${primary}=${primaryActive}`,
                )
            })
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

describe("isFocusRoute", () => {
    it("is true for a lesson reader route", () => {
        assert.equal(isFocusRoute("/learn/tracks/analyst-interview-prep/sessionisation"), true)
    })

    it("is FALSE for the track detail page", () => {
        // The near-miss that matters: the track page keeps the console
        // shell. Only the lesson below it is a focus route.
        assert.equal(isFocusRoute("/learn/tracks/analyst-interview-prep"), false)
    })

    it("is false for the tracks index", () => {
        assert.equal(isFocusRoute("/learn/tracks"), false)
    })

    it("is false for a topic article at the same depth", () => {
        assert.equal(isFocusRoute("/learn/sql-basics/joins"), false)
    })

    it("is false for anything deeper than a lesson", () => {
        assert.equal(isFocusRoute("/learn/tracks/a/b/c"), false)
    })

    it("ignores a trailing slash", () => {
        assert.equal(isFocusRoute("/learn/tracks/a/b/"), true)
    })

    it("is false for the site root", () => {
        assert.equal(isFocusRoute("/"), false)
    })
})

describe("nav coverage (handoff follow-up #4)", () => {
    it("marks exactly one primary item active on any known route", () => {
        const routes = [
            "/", "/practice", "/learn", "/learn/tracks",
            "/learn/tracks/analyst-interview-prep",
            "/projects", "/blogs", "/community",
            "/daily", "/lists", "/profile",
        ]
        for (const route of routes) {
            const active = PRIMARY_NAV.filter((item) => isNavItemActive(item, route))
            assert.ok(
                active.length <= 1,
                `${route} marked ${active.length} primary items active: ${active.map((a) => a.key).join(", ")}`,
            )
        }
    })

    it("marks exactly one footer item active on any footer route", () => {
        for (const item of FOOTER_NAV) {
            if (!item.href) continue
            const active = FOOTER_NAV.filter((other) => isNavItemActive(other, item.href!))
            assert.equal(
                active.length, 1,
                `${item.href} marked ${active.length} footer items active`,
            )
        }
    })

    it("has no nav item whose own href is a focus route", () => {
        // A nav entry pointing at a focus route would render a link to a
        // page that suppresses the very nav it was clicked from. Nothing
        // does that today; this guards the invariant as nav grows.
        const all = [...PRIMARY_NAV, ...FOOTER_NAV, ...TAB_BAR]
        for (const item of all) {
            for (const candidate of [item, ...(item.children ?? [])]) {
                if (!candidate.href) continue
                assert.equal(
                    isFocusRoute(candidate.href), false,
                    `nav item "${candidate.key}" points at focus route ${candidate.href}`,
                )
            }
        }
    })
})
