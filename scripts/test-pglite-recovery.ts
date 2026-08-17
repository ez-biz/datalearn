// Unit tests for the PGlite corrupt-cache recovery ladder in
// lib/sql-engine/browser-session.ts. No browser, no real IndexedDB —
// `initPGlite` and the IndexedDB deleter are injected fakes, same
// pattern as scripts/test-duckdb-init.ts uses for DuckDB's bundle
// fallback.
//
// Run: node --import tsx --test scripts/test-pglite-recovery.ts

import assert from "node:assert/strict"
import { describe, it } from "node:test"

import type { PGlite as PGliteType } from "@electric-sql/pglite"
import {
    createPostgresResourceFactory,
    createPostgresResources,
} from "../lib/sql-engine/browser-session"
import type { ResolvedDataDir } from "../lib/sql-engine/schema-cache-key"
import type {
    SqlEngineRecoveryOutcome,
    SqlEngineTelemetrySession,
} from "../lib/sql-engine/telemetry"

const SCHEMA_STATEMENTS = ["CREATE TABLE users (id INTEGER, name VARCHAR)"]

/** A fake PGlite instance: `query` always misses (no persisted schema
 * table yet, which is true for every fresh cluster in these tests), and
 * `exec` just records what it was asked to run. */
function makeFakePg() {
    const execCalls: string[] = []
    const pg = {
        query: async () => {
            throw new Error('relation "_dl_pglite_meta" does not exist')
        },
        exec: async (sql: string) => {
            execCalls.push(sql)
        },
    }
    return { pg: pg as unknown as PGliteType, execCalls }
}

type InitOutcome = { ok: true } | { ok: false; error?: Error }

function makeInitPGlite(outcomes: InitOutcome[]) {
    const calls: Array<{ dataDir?: string }> = []
    const { pg, execCalls } = makeFakePg()
    let index = 0
    const initPGlite = async (options?: { dataDir?: string }) => {
        calls.push({ dataDir: options?.dataDir })
        const outcome = outcomes[index++]
        assert.ok(outcome, "initPGlite called more times than scripted")
        if (!outcome.ok) throw outcome.error ?? new Error("init failed")
        return pg
    }
    return { initPGlite, calls, execCalls }
}

function makeDeleteIndexedDb(options: { fails?: boolean } = {}) {
    const calls: string[] = []
    const deleteIndexedDb = async (name: string) => {
        calls.push(name)
        if (options.fails) throw new Error("delete failed")
    }
    return { deleteIndexedDb, calls }
}

function makeTelemetry() {
    const events: Array<{
        name: string
        recoveryOutcome?: SqlEngineRecoveryOutcome
    }> = []
    const telemetry: SqlEngineTelemetrySession = {
        sessionId: "test-session",
        sampled: true,
        now: () => 0,
        elapsedSince: () => 0,
        emit: (name, details) => {
            events.push({ name, recoveryOutcome: details?.recoveryOutcome })
        },
    }
    return { telemetry, events }
}

const INDEXEDDB_PERSISTENCE: ResolvedDataDir = {
    mode: "indexeddb",
    name: "datalearn-pglite-two-sum-abc123def456",
}

describe("PGlite corrupt-cache recovery", () => {
    it("succeeds on the first try: no deletion, no retry", async () => {
        const { initPGlite, calls, execCalls } = makeInitPGlite([{ ok: true }])
        const { deleteIndexedDb, calls: deleteCalls } = makeDeleteIndexedDb()
        const { telemetry, events } = makeTelemetry()

        const pg = await createPostgresResources(
            initPGlite,
            SCHEMA_STATEMENTS,
            INDEXEDDB_PERSISTENCE,
            telemetry,
            deleteIndexedDb
        )

        assert.ok(pg)
        assert.equal(calls.length, 1)
        assert.equal(calls[0]?.dataDir, "idb://datalearn-pglite-two-sum-abc123def456")
        assert.equal(deleteCalls.length, 0)
        assert.equal(events.length, 0)
        // Schema replayed + persisted metadata written on first-time init.
        assert.equal(execCalls.length, SCHEMA_STATEMENTS.length + 2)
    })

    it("recovers a corrupt cache: deletes the real IDB store, retries once, and replays schema on the fresh cluster", async () => {
        const corruptError = new Error("PGlite failed to initialize properly")
        const { initPGlite, calls, execCalls } = makeInitPGlite([
            { ok: false, error: corruptError },
            { ok: true },
        ])
        const { deleteIndexedDb, calls: deleteCalls } = makeDeleteIndexedDb()
        const { telemetry, events } = makeTelemetry()

        const pg = await createPostgresResources(
            initPGlite,
            SCHEMA_STATEMENTS,
            INDEXEDDB_PERSISTENCE,
            telemetry,
            deleteIndexedDb
        )

        assert.ok(pg)
        assert.equal(calls.length, 2)
        // Same dataDir both times — a fresh cluster, not a different one.
        assert.equal(calls[0]?.dataDir, "idb://datalearn-pglite-two-sum-abc123def456")
        assert.equal(calls[1]?.dataDir, "idb://datalearn-pglite-two-sum-abc123def456")

        // The deleted name is the *real* browser IndexedDB database name:
        // PGlite mounts IDBFS at `/pglite/<name>` and Emscripten's IDBFS
        // opens IndexedDB using that mount path, not the bare `idb://`
        // name. Asserting the exact prefixed name here is load-bearing —
        // deleting the wrong name would silently no-op and the retry
        // would reopen the same broken store.
        assert.deepEqual(deleteCalls, [
            "/pglite/datalearn-pglite-two-sum-abc123def456",
        ])

        assert.deepEqual(events, [
            { name: "engine.init.recovered", recoveryOutcome: "idb-retry" },
        ])

        // Fresh cluster has no schema: replay ran, and since we're still
        // in indexeddb mode, persisted metadata was written too.
        assert.equal(execCalls.length, SCHEMA_STATEMENTS.length + 2)
    })

    it("falls back to memory mode when the retry against a fresh cluster also fails", async () => {
        const { initPGlite, calls, execCalls } = makeInitPGlite([
            { ok: false, error: new Error("corrupt") },
            { ok: false, error: new Error("still corrupt") },
            { ok: true },
        ])
        const { deleteIndexedDb, calls: deleteCalls } = makeDeleteIndexedDb()
        const { telemetry, events } = makeTelemetry()

        const pg = await createPostgresResources(
            initPGlite,
            SCHEMA_STATEMENTS,
            INDEXEDDB_PERSISTENCE,
            telemetry,
            deleteIndexedDb
        )

        assert.ok(pg)
        assert.equal(calls.length, 3)
        assert.equal(calls[0]?.dataDir, "idb://datalearn-pglite-two-sum-abc123def456")
        assert.equal(calls[1]?.dataDir, "idb://datalearn-pglite-two-sum-abc123def456")
        assert.equal(calls[2]?.dataDir, undefined) // memory mode

        // Deleted exactly once — never again before the memory attempt.
        assert.equal(deleteCalls.length, 1)

        assert.deepEqual(events, [
            { name: "engine.init.recovered", recoveryOutcome: "memory-fallback" },
        ])

        // Schema still replayed so the learner can solve the problem...
        // ...but no persisted-metadata write, since memory mode caches
        // nothing.
        assert.equal(execCalls.length, SCHEMA_STATEMENTS.length)
        assert.ok(!execCalls.some((sql) => sql.includes("_dl_pglite_meta")))
    })

    it("surfaces the error when the memory-mode fallback attempt also fails", async () => {
        const finalError = new Error("out of memory")
        const { initPGlite, calls } = makeInitPGlite([
            { ok: false, error: new Error("corrupt") },
            { ok: false, error: new Error("still corrupt") },
            { ok: false, error: finalError },
        ])
        const { deleteIndexedDb, calls: deleteCalls } = makeDeleteIndexedDb()
        const { telemetry, events } = makeTelemetry()

        await assert.rejects(
            createPostgresResources(
                initPGlite,
                SCHEMA_STATEMENTS,
                INDEXEDDB_PERSISTENCE,
                telemetry,
                deleteIndexedDb
            ),
            finalError
        )

        assert.equal(calls.length, 3)
        assert.equal(deleteCalls.length, 1)
        // Nothing succeeded, so nothing was "recovered" — no telemetry.
        assert.equal(events.length, 0)
    })

    it("never attempts a deletion in memory mode — there is no store to delete", async () => {
        const memoryPersistence: ResolvedDataDir = {
            mode: "memory",
            reason: "no problem slug",
        }
        const { initPGlite, calls } = makeInitPGlite([{ ok: true }])
        const { deleteIndexedDb, calls: deleteCalls } = makeDeleteIndexedDb()
        const { telemetry, events } = makeTelemetry()

        const pg = await createPostgresResources(
            initPGlite,
            SCHEMA_STATEMENTS,
            memoryPersistence,
            telemetry,
            deleteIndexedDb
        )

        assert.ok(pg)
        assert.equal(calls.length, 1)
        assert.equal(calls[0]?.dataDir, undefined)
        assert.equal(deleteCalls.length, 0)
        assert.equal(events.length, 0)
    })
})

describe("createPostgresResourceFactory — persistence carried across reset()", () => {
    it("a session that degraded to memory mode stays in memory mode on the next connect() — no repeat deletion or idb attempt", async () => {
        const { initPGlite, calls } = makeInitPGlite([
            // First connect(): idb attempt fails, retry against a fresh
            // cluster also fails, falls back to memory mode.
            { ok: false, error: new Error("corrupt") },
            { ok: false, error: new Error("still corrupt") },
            { ok: true },
            // Second connect() (simulating reset()): should go straight
            // to memory mode with a single call, since the factory
            // should have remembered the degraded persistence.
            { ok: true },
        ])
        const { deleteIndexedDb, calls: deleteCalls } = makeDeleteIndexedDb()
        const { telemetry, events } = makeTelemetry()

        const connect = createPostgresResourceFactory(
            initPGlite,
            SCHEMA_STATEMENTS,
            INDEXEDDB_PERSISTENCE,
            telemetry,
            deleteIndexedDb
        )

        const first = await connect()
        assert.ok(first)
        assert.equal(calls.length, 3)
        assert.equal(deleteCalls.length, 1)
        assert.deepEqual(
            events.map((e) => e.recoveryOutcome),
            ["memory-fallback"]
        )

        const second = await connect()
        assert.ok(second)

        // Exactly one more init call, straight to memory mode — not
        // another 3-call ladder and not another deletion.
        assert.equal(calls.length, 4)
        assert.equal(calls[3]?.dataDir, undefined)
        assert.equal(deleteCalls.length, 1)
        // No new recovery event — reusing memory mode isn't a recovery.
        assert.equal(events.length, 1)
    })
})
