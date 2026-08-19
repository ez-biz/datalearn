// Unit tests for the admin sidebar's nav model.
// No React, no DOM, no database.
//
// Run: node --import tsx --test scripts/test-admin-nav.ts

import { describe, it } from "node:test"
import assert from "node:assert/strict"
import {
    ADMIN_NAV,
    visibleAdminNav,
    activeAdminNavKey,
} from "../lib/admin/admin-nav-model"
import { matchesAdminPath } from "../lib/admin/admin-nav-match"

const ADMIN = { role: "ADMIN" as const, canViewDiscussionQueue: true }
const MOD_WITH = { role: "MODERATOR" as const, canViewDiscussionQueue: true }
const MOD_WITHOUT = { role: "MODERATOR" as const, canViewDiscussionQueue: false }

function allItems(groups: ReturnType<typeof visibleAdminNav>) {
    return groups.flatMap((g) => g.items)
}

describe("ADMIN_NAV shape", () => {
    it("carries all fifteen destinations", () => {
        assert.equal(allItems(ADMIN_NAV).length, 15)
    })

    it("uses the five designed groups in order", () => {
        assert.deepEqual(
            ADMIN_NAV.map((g) => g.label),
            [null, "Content", "Scheduling", "Moderation", "People & access"]
        )
    })

    it("gives every item a real href", () => {
        for (const item of allItems(ADMIN_NAV)) {
            assert.ok(item.href.startsWith("/admin"), `${item.key} href`)
        }
    })

    it("has unique keys", () => {
        const keys = allItems(ADMIN_NAV).map((i) => i.key)
        assert.equal(new Set(keys).size, keys.length)
    })
})

describe("visibleAdminNav", () => {
    it("shows everything to an admin", () => {
        assert.equal(allItems(visibleAdminNav(ADMIN)).length, 15)
    })

    it("shows a permitted moderator only the discussion queue", () => {
        const items = allItems(visibleAdminNav(MOD_WITH))
        assert.deepEqual(items.map((i) => i.key), ["discussions"])
    })

    it("shows an unpermitted moderator nothing", () => {
        assert.deepEqual(visibleAdminNav(MOD_WITHOUT), [])
    })

    it("drops a group whose items all filter out, rather than emptying it", () => {
        for (const group of visibleAdminNav(MOD_WITH)) {
            assert.ok(group.items.length > 0, `${group.label} left empty`)
        }
    })
})

describe("activeAdminNavKey", () => {
    it("matches Overview exactly, not by prefix", () => {
        assert.equal(activeAdminNavKey("/admin"), "overview")
        assert.equal(activeAdminNavKey("/admin/problems"), "problems")
    })

    it("matches nested routes by prefix", () => {
        assert.equal(activeAdminNavKey("/admin/problems/foo/edit"), "problems")
        assert.equal(activeAdminNavKey("/admin/tracks/x/edit"), "tracks")
    })

    it("returns null off the admin surface", () => {
        assert.equal(activeAdminNavKey("/practice"), null)
    })

    it("does not false-match a sibling CMS page like /admin-faq", () => {
        // Regression: activeAdminNavKey used to route through a
        // startsWith-based matcher — /admin-faq must not resolve to
        // "overview" (or any other item) just because it starts with "/admin".
        assert.equal(activeAdminNavKey("/admin-faq"), null)
    })
})

describe("matchesAdminPath", () => {
    it("exact match requires the literal pathname", () => {
        assert.equal(matchesAdminPath("/admin", "/admin", "exact"), true)
        assert.equal(matchesAdminPath("/admin/problems", "/admin", "exact"), false)
    })

    it("prefix match covers the href itself and nested paths", () => {
        assert.equal(matchesAdminPath("/admin/problems", "/admin/problems", "prefix"), true)
        assert.equal(
            matchesAdminPath("/admin/problems/foo/edit", "/admin/problems", "prefix"),
            true
        )
    })

    it("does not false-match a sibling path that merely shares a prefix", () => {
        // The case the shell's `admin` predicate (ConsoleChrome.tsx) and this
        // matcher both have to get right: /admin-faq is not under /admin.
        assert.equal(matchesAdminPath("/admin-faq", "/admin", "exact"), false)
        assert.equal(matchesAdminPath("/admin-faq", "/admin", "prefix"), false)
    })

    it("does not match unrelated paths", () => {
        assert.equal(matchesAdminPath("/practice", "/admin/problems", "prefix"), false)
    })
})

describe("matchesAdminPath — no cross-item ambiguity", () => {
    // AdminSidebarLink (components/layout/console/AdminSidebarLink.tsx) now
    // decides its own active state by calling matchesAdminPath against just
    // its own href, rather than going through activeAdminNavKey's
    // longest-match-wins search across every item. That's only equivalent to
    // the old behavior if no admin href is ever a prefix of another — verify
    // the invariant here so a future item can't silently make two rows light
    // up at once.
    it("no non-exact href is a prefix of another item's href", () => {
        const items = ADMIN_NAV.flatMap((g) => g.items)
        for (const a of items) {
            if (a.match === "exact") continue
            for (const b of items) {
                if (a === b) continue
                assert.ok(
                    !b.href.startsWith(`${a.href}/`) && b.href !== a.href,
                    `${a.key} (${a.href}) is a prefix of ${b.key} (${b.href})`
                )
            }
        }
    })
})
