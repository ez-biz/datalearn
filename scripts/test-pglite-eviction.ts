// Unit tests for the PGlite persisted-database registry + eviction policy
// in lib/sql-engine/pglite-eviction.ts. No browser, no real IndexedDB —
// storage and the IndexedDB deleter are injected fakes, same pattern as
// scripts/test-pglite-recovery.ts uses for browser-session.ts.
//
// Run: node --import tsx --test scripts/test-pglite-eviction.ts

import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
    PGLITE_NAMESPACE_PREFIX,
    evictStalePgliteDatabases,
    isOwnedPgliteDatabaseName,
    planPgliteEviction,
    readPgliteRegistry,
    recordPgliteDatabaseUse,
    writePgliteRegistry,
    type PgliteRegistryEntry,
    type StorageLike,
} from "../lib/sql-engine/pglite-eviction"

const V1 = "v1"
const V2 = "v2"

function entry(
    name: string,
    version: string,
    lastUsedAt: number
): PgliteRegistryEntry {
    return { name, version, lastUsedAt }
}

function fakeStorage(initial: Record<string, string> = {}): StorageLike & {
    data: Record<string, string>
} {
    const data: Record<string, string> = { ...initial }
    return {
        data,
        getItem: (key) => (key in data ? data[key] : null),
        setItem: (key, value) => {
            data[key] = value
        },
    }
}

function fakeDeleter(options: { fails?: boolean } = {}) {
    const calls: string[] = []
    const deleteIndexedDb = async (idbName: string) => {
        calls.push(idbName)
        if (options.fails) throw new Error("delete blocked")
    }
    return { deleteIndexedDb, calls }
}

const toIdbDatabaseName = (name: string) => `/pglite/${name}`

describe("planPgliteEviction — stale cache version", () => {
    it("evicts every entry from an older cache version regardless of recency", () => {
        const entries = [
            entry(`${PGLITE_NAMESPACE_PREFIX}a-1`, V1, 5000), // most recent, but stale version
            entry(`${PGLITE_NAMESPACE_PREFIX}b-1`, V2, 1000),
        ]
        const plan = planPgliteEviction(entries, {
            currentVersion: V2,
            currentName: null,
            cap: 20,
        })
        assert.deepEqual(
            plan.evict.map((e) => e.name),
            [`${PGLITE_NAMESPACE_PREFIX}a-1`]
        )
        assert.deepEqual(
            plan.keep.map((e) => e.name),
            [`${PGLITE_NAMESPACE_PREFIX}b-1`]
        )
    })
})

describe("planPgliteEviction — cap", () => {
    it("keeps only the N most-recently-used current-version entries and evicts the least-recently-used", () => {
        const entries = [
            entry(`${PGLITE_NAMESPACE_PREFIX}a`, V1, 1000),
            entry(`${PGLITE_NAMESPACE_PREFIX}b`, V1, 3000),
            entry(`${PGLITE_NAMESPACE_PREFIX}c`, V1, 2000),
        ]
        const plan = planPgliteEviction(entries, {
            currentVersion: V1,
            currentName: null,
            cap: 2,
        })
        assert.deepEqual(
            plan.keep.map((e) => e.name).sort(),
            [`${PGLITE_NAMESPACE_PREFIX}b`, `${PGLITE_NAMESPACE_PREFIX}c`].sort()
        )
        assert.deepEqual(
            plan.evict.map((e) => e.name),
            [`${PGLITE_NAMESPACE_PREFIX}a`]
        )
    })
})

describe("planPgliteEviction — current session protection", () => {
    it("never evicts the current session's database, even when it is the oldest and the cap would otherwise exclude it", () => {
        const current = `${PGLITE_NAMESPACE_PREFIX}current`
        const entries = [
            entry(current, V1, 1), // oldest by far
            entry(`${PGLITE_NAMESPACE_PREFIX}b`, V1, 5000),
            entry(`${PGLITE_NAMESPACE_PREFIX}c`, V1, 4000),
            entry(`${PGLITE_NAMESPACE_PREFIX}d`, V1, 3000),
        ]
        const plan = planPgliteEviction(entries, {
            currentVersion: V1,
            currentName: current,
            cap: 1,
        })
        assert.ok(
            plan.keep.some((e) => e.name === current),
            "current session's database must be kept"
        )
        assert.ok(
            !plan.evict.some((e) => e.name === current),
            "current session's database must never appear in the evict list"
        )
        // cap=1 still applies to the non-current candidates: only the
        // single most-recently-used of b/c/d survives alongside current.
        assert.equal(plan.keep.length, 2)
        assert.deepEqual(
            plan.keep.map((e) => e.name).sort(),
            [current, `${PGLITE_NAMESPACE_PREFIX}b`].sort()
        )
    })

    it("keeps the current session's database even if its recorded version is stale", () => {
        const current = `${PGLITE_NAMESPACE_PREFIX}current`
        const entries = [entry(current, V1, 100)]
        const plan = planPgliteEviction(entries, {
            currentVersion: V2,
            currentName: current,
            cap: 20,
        })
        assert.deepEqual(plan.keep, entries)
        assert.deepEqual(plan.evict, [])
    })
})

describe("planPgliteEviction — foreign namespace", () => {
    it("never touches a database name outside our namespace", () => {
        const entries = [
            entry("some-other-app-db", V1, 9999),
            entry(`${PGLITE_NAMESPACE_PREFIX}ours`, V1, 1),
        ]
        const plan = planPgliteEviction(entries, {
            currentVersion: V1,
            currentName: null,
            cap: 0,
        })
        assert.ok(!plan.keep.some((e) => e.name === "some-other-app-db"))
        assert.ok(!plan.evict.some((e) => e.name === "some-other-app-db"))
    })

    it("isOwnedPgliteDatabaseName rejects names outside the namespace", () => {
        assert.equal(isOwnedPgliteDatabaseName("datalearn-pglite-foo"), true)
        assert.equal(isOwnedPgliteDatabaseName("other-datalearn-pglite-foo"), false)
        assert.equal(isOwnedPgliteDatabaseName("datalearn-pglit-foo"), false)
        assert.equal(isOwnedPgliteDatabaseName(""), false)
    })
})

describe("recordPgliteDatabaseUse", () => {
    it("adds a new entry stamped with now", () => {
        const result = recordPgliteDatabaseUse(
            [],
            `${PGLITE_NAMESPACE_PREFIX}foo`,
            V1,
            42
        )
        assert.deepEqual(result, [
            { name: `${PGLITE_NAMESPACE_PREFIX}foo`, version: V1, lastUsedAt: 42 },
        ])
    })

    it("bumps an existing entry's lastUsedAt and version rather than duplicating it", () => {
        const existing = [entry(`${PGLITE_NAMESPACE_PREFIX}foo`, V1, 10)]
        const result = recordPgliteDatabaseUse(
            existing,
            `${PGLITE_NAMESPACE_PREFIX}foo`,
            V2,
            99
        )
        assert.equal(result.length, 1)
        assert.deepEqual(result[0], {
            name: `${PGLITE_NAMESPACE_PREFIX}foo`,
            version: V2,
            lastUsedAt: 99,
        })
    })

    it("ignores a name outside our namespace", () => {
        const result = recordPgliteDatabaseUse([], "foreign-db", V1, 1)
        assert.deepEqual(result, [])
    })
})

describe("readPgliteRegistry / writePgliteRegistry", () => {
    it("round-trips through a fake storage", () => {
        const storage = fakeStorage()
        const entries = [entry(`${PGLITE_NAMESPACE_PREFIX}a`, V1, 1)]
        writePgliteRegistry(storage, entries)
        assert.deepEqual(readPgliteRegistry(storage), entries)
    })

    it("returns [] for missing, corrupt, or non-array storage content", () => {
        assert.deepEqual(readPgliteRegistry(fakeStorage()), [])
        assert.deepEqual(
            readPgliteRegistry(fakeStorage({ "dl:pglite-registry": "{not json" })),
            []
        )
        assert.deepEqual(
            readPgliteRegistry(fakeStorage({ "dl:pglite-registry": '{"a":1}' })),
            []
        )
    })

    it("drops malformed entries but keeps well-formed ones", () => {
        const storage = fakeStorage({
            "dl:pglite-registry": JSON.stringify([
                { name: "ok", version: "v1", lastUsedAt: 1 },
                { name: "missing-fields" },
                { name: "bad-type", version: "v1", lastUsedAt: "not-a-number" },
            ]),
        })
        assert.deepEqual(readPgliteRegistry(storage), [
            { name: "ok", version: "v1", lastUsedAt: 1 },
        ])
    })

    it("returns [] and no-ops a write when storage is null/undefined", () => {
        assert.deepEqual(readPgliteRegistry(null), [])
        assert.deepEqual(readPgliteRegistry(undefined), [])
        // Must not throw.
        writePgliteRegistry(null, [entry("x", "v1", 1)])
    })
})

describe("evictStalePgliteDatabases — storage unavailable", () => {
    it("attempts no eviction and never throws when storage is unavailable", async () => {
        const { deleteIndexedDb, calls } = fakeDeleter()
        await assert.doesNotReject(
            evictStalePgliteDatabases(`${PGLITE_NAMESPACE_PREFIX}current`, {
                storage: null,
                now: () => 1,
                deleteIndexedDb,
                toIdbDatabaseName,
            })
        )
        assert.equal(calls.length, 0)
    })
})

describe("evictStalePgliteDatabases — deleter failure is swallowed", () => {
    it("a deleter that throws does not prevent the caller from proceeding", async () => {
        const storage = fakeStorage({
            "dl:pglite-registry": JSON.stringify([
                entry(`${PGLITE_NAMESPACE_PREFIX}stale`, V1, 1),
            ]),
        })
        const { deleteIndexedDb, calls } = fakeDeleter({ fails: true })

        await assert.doesNotReject(
            evictStalePgliteDatabases(`${PGLITE_NAMESPACE_PREFIX}current`, {
                storage,
                now: () => 100,
                deleteIndexedDb,
                toIdbDatabaseName,
                currentVersion: V2, // stale entry's version (V1) is now stale
                cap: 20,
            })
        )
        // The delete was still attempted against the real idb name...
        assert.deepEqual(calls, [`/pglite/${PGLITE_NAMESPACE_PREFIX}stale`])
        // ...and the registry was still trimmed despite the delete failing.
        const remaining = readPgliteRegistry(storage)
        assert.ok(!remaining.some((e) => e.name.includes("stale")))
    })
})

describe("evictStalePgliteDatabases — end-to-end wiring", () => {
    it("records the current session, evicts a stale-version entry via the real idb name, and never deletes the current database", async () => {
        const current = `${PGLITE_NAMESPACE_PREFIX}current-problem`
        const storage = fakeStorage({
            "dl:pglite-registry": JSON.stringify([
                entry(`${PGLITE_NAMESPACE_PREFIX}old-version`, V1, 500),
                entry("foreign-app-db", V2, 999999),
            ]),
        })
        const { deleteIndexedDb, calls } = fakeDeleter()

        await evictStalePgliteDatabases(current, {
            storage,
            now: () => 1000,
            deleteIndexedDb,
            toIdbDatabaseName,
            currentVersion: V2,
            cap: 20,
        })

        // Only the real, namespaced, stale-version idb name was deleted.
        assert.deepEqual(calls, [
            `/pglite/${PGLITE_NAMESPACE_PREFIX}old-version`,
        ])

        const remaining = readPgliteRegistry(storage)
        assert.ok(remaining.some((e) => e.name === current))
        assert.ok(!remaining.some((e) => e.name.includes("old-version")))
    })

    it("evicts beyond the cap on init, keeping the current database plus the most-recently-used others", async () => {
        const current = `${PGLITE_NAMESPACE_PREFIX}current`
        const storage = fakeStorage({
            "dl:pglite-registry": JSON.stringify([
                entry(`${PGLITE_NAMESPACE_PREFIX}old`, V1, 1000),
                entry(`${PGLITE_NAMESPACE_PREFIX}new`, V1, 2000),
            ]),
        })
        const { deleteIndexedDb, calls } = fakeDeleter()

        await evictStalePgliteDatabases(current, {
            storage,
            now: () => 3000,
            deleteIndexedDb,
            toIdbDatabaseName,
            currentVersion: V1,
            cap: 1,
        })

        assert.deepEqual(calls, [`/pglite/${PGLITE_NAMESPACE_PREFIX}old`])
        const remaining = readPgliteRegistry(storage)
        assert.deepEqual(
            remaining.map((e) => e.name).sort(),
            [current, `${PGLITE_NAMESPACE_PREFIX}new`].sort()
        )
    })
})
