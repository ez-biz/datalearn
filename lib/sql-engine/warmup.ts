import type { AsyncDuckDB } from "@duckdb/duckdb-wasm"
import type { Dialect } from "@/lib/sql-engine/types"

export type WarmupRegistry<TDuckDB = AsyncDuckDB> = {
    /**
     * Begin warming the engine for `dialect`, or no-op if a warm entry is
     * already in flight or ready. Idempotent — safe to call from multiple
     * triggers (list mount, hover, etc).
     *
     * Returns a promise that resolves once the warm entry is ready (or
     * already was). Rejects if the underlying initializer rejected.
     */
    warm(dialect: Dialect): Promise<void>

    /**
     * Hand off the warm DuckDB instance for the caller to take ownership
     * of. Returns null if nothing is ready (still warming, never warmed,
     * already claimed, or evicted by the idle TTL).
     *
     * After claim, the entry is removed from the registry — the caller
     * owns disposal. Calling `warm()` again starts a fresh instance.
     */
    claim(dialect: "DUCKDB"): TDuckDB | null

    /**
     * Dispose any ready or in-flight entries. Used at component unmount
     * and in tests. Disposal is best-effort and never throws.
     */
    disposeAll(): Promise<void>
}

export type WarmupRegistryDeps<TDuckDB = AsyncDuckDB> = {
    initDuckDB: () => Promise<TDuckDB>
    terminateDuckDB: (db: TDuckDB) => Promise<void>
    importPGlite: () => Promise<unknown>
    now: () => number
    setTimeout: (cb: () => void, delay: number) => unknown
    clearTimeout: (handle: unknown) => void
    idleTtlMs: number
}

type Entry<TDuckDB> =
    | { state: "warming"; promise: Promise<void> }
    | { state: "ready"; instance: TDuckDB; idleHandle: unknown }
    | { state: "ready-module" }

export function createWarmupRegistry<TDuckDB = AsyncDuckDB>(
    deps: WarmupRegistryDeps<TDuckDB>
): WarmupRegistry<TDuckDB> {
    const entries = new Map<Dialect, Entry<TDuckDB>>()

    async function warm(dialect: Dialect): Promise<void> {
        const existing = entries.get(dialect)
        if (existing) {
            if (existing.state === "warming") return existing.promise
            return
        }

        if (dialect === "DUCKDB") {
            const promise = (async () => {
                try {
                    const db = await deps.initDuckDB()
                    const idleHandle = deps.setTimeout(() => {
                        const e = entries.get("DUCKDB")
                        if (e?.state === "ready") {
                            entries.delete("DUCKDB")
                            void deps.terminateDuckDB(e.instance)
                        }
                    }, deps.idleTtlMs)
                    entries.set("DUCKDB", {
                        state: "ready",
                        instance: db,
                        idleHandle,
                    })
                } catch (err) {
                    // Clear the warming entry so a later warm() retries
                    // instead of hanging on the failed promise forever.
                    entries.delete("DUCKDB")
                    throw err
                }
            })()
            entries.set(dialect, { state: "warming", promise })
            await promise
            return
        }

        // POSTGRES: warm the module import only. Browser caches the JS
        // bundle. The real PGlite instance is bound to a dataDir we don't
        // know at warm time, so we never construct one.
        const promise = (async () => {
            try {
                await deps.importPGlite()
                entries.set("POSTGRES", { state: "ready-module" })
            } catch (err) {
                entries.delete("POSTGRES")
                throw err
            }
        })()
        entries.set(dialect, { state: "warming", promise })
        await promise
    }

    function claim(dialect: "DUCKDB"): TDuckDB | null {
        const entry = entries.get(dialect)
        if (entry?.state !== "ready") return null
        deps.clearTimeout(entry.idleHandle)
        entries.delete(dialect)
        return entry.instance
    }

    async function disposeAll(): Promise<void> {
        const toTerminate: TDuckDB[] = []
        for (const [, entry] of entries) {
            if (entry.state === "ready") {
                deps.clearTimeout(entry.idleHandle)
                toTerminate.push(entry.instance)
            }
        }
        entries.clear()
        await Promise.allSettled(
            toTerminate.map((db) => deps.terminateDuckDB(db))
        )
    }

    return { warm, claim, disposeAll }
}

/**
 * Default idle TTL for warmed engines. After this many milliseconds with
 * no claim, the registry disposes the instance. 60s covers the realistic
 * window between a learner hovering / loading the practice list and
 * actually clicking into a problem. Above this, the win is no longer
 * worth holding a WASM instance in memory.
 */
export const DEFAULT_WARMUP_IDLE_TTL_MS = 60_000

/**
 * Returns the process-wide warmup registry, creating it lazily on first
 * access. Server-side / non-browser callers receive a no-op registry —
 * we never spin up WASM outside the browser.
 */
let cachedRegistry: WarmupRegistry | null = null

export function getDefaultWarmupRegistry(): WarmupRegistry {
    if (cachedRegistry) return cachedRegistry
    if (typeof window === "undefined") {
        cachedRegistry = createNoopRegistry()
        return cachedRegistry
    }
    cachedRegistry = createWarmupRegistry({
        initDuckDB: async () => {
            const { initDuckDB } = await import("@/lib/duckdb")
            return initDuckDB()
        },
        terminateDuckDB: async (db) => {
            try {
                await db.terminate()
            } catch {
                // Best-effort — the worker may already be gone if the tab
                // is unloading. Swallow so disposeAll() can finish.
            }
        },
        importPGlite: async () => {
            await import("@electric-sql/pglite")
        },
        now: () => Date.now(),
        setTimeout: (cb, delay) => globalThis.setTimeout(cb, delay),
        clearTimeout: (handle) =>
            globalThis.clearTimeout(handle as ReturnType<typeof setTimeout>),
        idleTtlMs: DEFAULT_WARMUP_IDLE_TTL_MS,
    })
    return cachedRegistry
}

function createNoopRegistry(): WarmupRegistry {
    return {
        async warm() {},
        claim() {
            return null
        },
        async disposeAll() {},
    }
}

/**
 * Convenience: fire a warm for the given dialect against the default
 * registry. Logs at debug level on failure but never throws — the call
 * site is a UI hook that should not surface engine errors.
 */
export function warmSqlEngine(dialect: Dialect): void {
    void getDefaultWarmupRegistry()
        .warm(dialect)
        .catch((err) => {
            if (
                typeof process !== "undefined" &&
                process.env?.NODE_ENV !== "production"
            ) {
                console.debug("[sql-engine] warmup failed", {
                    dialect,
                    error: err instanceof Error ? err.message : String(err),
                })
            }
        })
}

/**
 * Convenience: claim the warm DuckDB instance, if one is ready. Returns
 * null if no instance is warm; callers must fall back to a fresh init.
 */
export function claimWarmDuckDB(): AsyncDuckDB | null {
    return getDefaultWarmupRegistry().claim("DUCKDB")
}

/**
 * localStorage key prefix written by `components/practice/ProblemClient.tsx`
 * when the learner picks a dialect for a specific problem. Format:
 * `dl:dialect:<slug>` → `"DUCKDB" | "POSTGRES"`.
 *
 * Exported for tests; consumers should call `shouldWarmPostgres()` rather
 * than scan keys directly.
 */
export const DIALECT_STORAGE_KEY_PREFIX = "dl:dialect:"

/**
 * Heuristic for whether to preemptively warm PGlite on practice-list
 * mount. Returns true if **any** previously-visited problem had its
 * dialect set to POSTGRES — that's our signal the learner has at least
 * sampled Postgres mode and is plausibly going to use it again.
 *
 * Returns false (no warm) on:
 * - Missing/null storage (SSR, no-window).
 * - Any storage exception (Safari private mode can throw QuotaExceeded
 *   on read in rare cases).
 * - Empty storage.
 * - All `dl:dialect:*` entries set to anything other than POSTGRES.
 *
 * Pure function modulo the `storage` arg; safe to unit-test with a
 * synthetic Storage implementation.
 */
export function shouldWarmPostgres(
    storage: Storage | null | undefined
): boolean {
    if (!storage) return false
    try {
        const total = storage.length
        for (let i = 0; i < total; i++) {
            const key = storage.key(i)
            if (!key || !key.startsWith(DIALECT_STORAGE_KEY_PREFIX)) continue
            const value = storage.getItem(key)
            if (value === "POSTGRES") return true
        }
        return false
    } catch {
        return false
    }
}
