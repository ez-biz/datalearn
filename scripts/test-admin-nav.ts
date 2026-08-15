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

const ADMIN = { role: "ADMIN" as const, canViewDiscussionQueue: true }
const MOD_WITH = { role: "MODERATOR" as const, canViewDiscussionQueue: true }
const MOD_WITHOUT = { role: "MODERATOR" as const, canViewDiscussionQueue: false }

function allItems(groups: ReturnType<typeof visibleAdminNav>) {
    return groups.flatMap((g) => g.items)
}

describe("ADMIN_NAV shape", () => {
    it("carries all fourteen destinations", () => {
        assert.equal(allItems(ADMIN_NAV).length, 14)
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
        assert.equal(allItems(visibleAdminNav(ADMIN)).length, 14)
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
})
