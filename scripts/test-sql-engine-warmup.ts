import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { createWarmupRegistry } from "../lib/sql-engine/warmup"

/**
 * Test helpers: synthetic DuckDB and PGlite module placeholders. We never
 * touch the real WASM bundles in node — the warmup registry treats them
 * as opaque, so synthetic objects exercise the lifecycle just fine.
 */
type FakeDuckDb = { id: string; terminated: boolean }

function fakeDuckDbFactory() {
    let next = 0
    const instances: FakeDuckDb[] = []
    return {
        async init(): Promise<FakeDuckDb> {
            const db: FakeDuckDb = {
                id: `duck-${++next}`,
                terminated: false,
            }
            instances.push(db)
            return db
        },
        async terminate(db: FakeDuckDb): Promise<void> {
            db.terminated = true
        },
        instances,
    }
}

function fakePGliteFactory() {
    let importCount = 0
    return {
        async import(): Promise<{ module: "pglite" }> {
            importCount += 1
            return { module: "pglite" }
        },
        get importCount() {
            return importCount
        },
    }
}

function manualClock() {
    let nowMs = 0
    const timers: Array<{ id: number; fireAt: number; cb: () => void; cleared: boolean }> = []
    let nextId = 1
    return {
        now: () => nowMs,
        advance(ms: number) {
            nowMs += ms
            for (const t of timers) {
                if (!t.cleared && t.fireAt <= nowMs) {
                    t.cleared = true
                    t.cb()
                }
            }
        },
        setTimeout: (cb: () => void, delay: number): number => {
            const id = nextId++
            timers.push({ id, fireAt: nowMs + delay, cb, cleared: false })
            return id
        },
        clearTimeout: (handle: unknown): void => {
            const t = timers.find((x) => x.id === handle)
            if (t) t.cleared = true
        },
        pendingTimers: () => timers.filter((t) => !t.cleared).length,
    }
}

type Harness = {
    duck: ReturnType<typeof fakeDuckDbFactory>
    pg: ReturnType<typeof fakePGliteFactory>
    clock: ReturnType<typeof manualClock>
    registry: ReturnType<typeof createWarmupRegistry<FakeDuckDb>>
}

function buildHarness(idleTtlMs = 60_000): Harness {
    const duck = fakeDuckDbFactory()
    const pg = fakePGliteFactory()
    const clock = manualClock()
    const registry = createWarmupRegistry<FakeDuckDb>({
        initDuckDB: duck.init,
        terminateDuckDB: duck.terminate,
        importPGlite: pg.import,
        now: clock.now,
        setTimeout: clock.setTimeout,
        clearTimeout: clock.clearTimeout,
        idleTtlMs,
    })
    return { duck, pg, clock, registry }
}

describe("SQL engine warmup registry", () => {
    it("warm(DUCKDB) then claim(DUCKDB) returns the warmed instance", async () => {
        const { duck, registry } = buildHarness()

        await registry.warm("DUCKDB")
        const claimed = registry.claim("DUCKDB")

        assert.equal(claimed?.id, "duck-1")
        assert.equal(duck.instances.length, 1)
        assert.equal(duck.instances[0].terminated, false)
    })

    it("warm(DUCKDB) is idempotent — repeat calls do not spawn extra instances", async () => {
        const { duck, registry } = buildHarness()

        await Promise.all([
            registry.warm("DUCKDB"),
            registry.warm("DUCKDB"),
            registry.warm("DUCKDB"),
        ])
        // Calling again after ready should also no-op.
        await registry.warm("DUCKDB")

        assert.equal(duck.instances.length, 1)
    })

    it("claim(DUCKDB) before warm() returns null", () => {
        const { registry } = buildHarness()
        assert.equal(registry.claim("DUCKDB"), null)
    })

    it("claim(DUCKDB) while warming (init in flight) returns null", async () => {
        const duck = fakeDuckDbFactory()
        const pg = fakePGliteFactory()
        const clock = manualClock()
        const initGate: { resolve: (db: FakeDuckDb) => void } = {
            resolve: () => {},
        }
        const registry = createWarmupRegistry<FakeDuckDb>({
            initDuckDB: () =>
                new Promise<FakeDuckDb>((res) => {
                    initGate.resolve = res
                }),
            terminateDuckDB: duck.terminate,
            importPGlite: pg.import,
            now: clock.now,
            setTimeout: clock.setTimeout,
            clearTimeout: clock.clearTimeout,
            idleTtlMs: 60_000,
        })

        const warming = registry.warm("DUCKDB")

        // Init promise hasn't resolved yet — claim must return null.
        assert.equal(registry.claim("DUCKDB"), null)

        initGate.resolve({ id: "duck-late", terminated: false })
        await warming
        // After warming resolves, claim returns the instance.
        const claimed = registry.claim("DUCKDB")
        assert.equal(claimed?.id, "duck-late")
    })

    it("idle TTL expiry disposes the warmed instance and clears the entry", async () => {
        const { duck, clock, registry } = buildHarness(60_000)

        await registry.warm("DUCKDB")
        const instance = duck.instances[0]
        assert.equal(instance.terminated, false)

        clock.advance(60_000)

        assert.equal(instance.terminated, true)
        assert.equal(registry.claim("DUCKDB"), null)
    })

    it("claim before TTL cancels the timer so the instance is not terminated", async () => {
        const { duck, clock, registry } = buildHarness(60_000)

        await registry.warm("DUCKDB")
        clock.advance(30_000)
        const claimed = registry.claim("DUCKDB")
        // Advance well past the original TTL — the canceled timer must not fire.
        clock.advance(120_000)

        assert.equal(claimed?.id, "duck-1")
        assert.equal(duck.instances[0].terminated, false)
        assert.equal(clock.pendingTimers(), 0)
    })

    it("warm(POSTGRES) triggers exactly one module import and never produces a DuckDB instance", async () => {
        const { duck, pg, registry } = buildHarness()

        await registry.warm("POSTGRES")
        await registry.warm("POSTGRES")
        await registry.warm("POSTGRES")

        assert.equal(pg.importCount, 1)
        assert.equal(duck.instances.length, 0)
    })

    it("claim is DuckDB-only — there is no claimable POSTGRES instance to hand off", async () => {
        const { registry } = buildHarness()
        await registry.warm("POSTGRES")
        // Type system forbids claim("POSTGRES"); behavior is that DUCKDB
        // remains unaffected by a POSTGRES warm.
        assert.equal(registry.claim("DUCKDB"), null)
    })

    it("re-warm after claim spawns a fresh instance", async () => {
        const { duck, registry } = buildHarness()

        await registry.warm("DUCKDB")
        const first = registry.claim("DUCKDB")
        assert.equal(first?.id, "duck-1")

        await registry.warm("DUCKDB")
        const second = registry.claim("DUCKDB")
        assert.equal(second?.id, "duck-2")
        assert.equal(duck.instances.length, 2)
    })

    it("disposeAll terminates ready instances and cancels their idle timers", async () => {
        const { duck, clock, registry } = buildHarness(60_000)

        await registry.warm("DUCKDB")
        await registry.warm("POSTGRES")
        assert.equal(duck.instances[0].terminated, false)

        await registry.disposeAll()

        assert.equal(duck.instances[0].terminated, true)
        assert.equal(clock.pendingTimers(), 0)
        // After dispose, claim is null and warm starts over.
        assert.equal(registry.claim("DUCKDB"), null)
        await registry.warm("DUCKDB")
        assert.equal(duck.instances.length, 2)
    })

    it("propagates init failure to the awaiting warm() promise without poisoning future warms", async () => {
        const pg = fakePGliteFactory()
        const clock = manualClock()
        const terminateCalls: FakeDuckDb[] = []
        let attempt = 0
        const registry = createWarmupRegistry({
            initDuckDB: async () => {
                attempt += 1
                if (attempt === 1) throw new Error("boom")
                return { id: `duck-retry-${attempt}`, terminated: false }
            },
            terminateDuckDB: async (db) => {
                terminateCalls.push(db)
            },
            importPGlite: pg.import,
            now: clock.now,
            setTimeout: clock.setTimeout,
            clearTimeout: clock.clearTimeout,
            idleTtlMs: 60_000,
        })

        await assert.rejects(() => registry.warm("DUCKDB"), /boom/)

        // A subsequent warm should retry and succeed.
        await registry.warm("DUCKDB")
        const claimed = registry.claim("DUCKDB")
        assert.equal(claimed?.id, "duck-retry-2")
        assert.equal(terminateCalls.length, 0)
    })
})
