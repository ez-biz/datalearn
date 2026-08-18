/**
 * Registry + eviction for persisted PGlite IndexedDB clusters.
 *
 * `lib/sql-engine/schema-cache-key.ts` mints a fresh, permanently-persisted
 * IndexedDB database for every distinct (problem slug, schemaSql, cache
 * version) tuple, but nothing removes one once it stops being reachable:
 *   - a learner who works through many Postgres problems accumulates one
 *     Postgres cluster per problem — tens of MB each;
 *   - an admin editing a problem's schema changes its cache key, orphaning
 *     the old database forever;
 *   - bumping `PGLITE_CACHE_VERSION` re-keys every cached database at once,
 *     orphaning all of them.
 *
 * We generate every database name ourselves, so rather than depend on
 * `indexedDB.databases()` (unavailable/unreliable in some browsers, where a
 * fallback that silently does nothing would be worse than no feature at
 * all) we keep our own registry in `localStorage`, following the `dl:`
 * key-prefix convention used elsewhere in this codebase (`dl:pglite-cache:
 * off`, `dl:dialect:<slug>`).
 *
 * The policy itself (`planPgliteEviction`) is a pure function over an
 * in-memory list of registry entries — no localStorage, no IndexedDB, no
 * PGlite — so it unit-tests without a browser (see
 * `scripts/test-pglite-eviction.ts`). `evictStalePgliteDatabases` is the
 * thin, best-effort side-effecting wrapper actually wired into session
 * creation; every failure mode inside it is swallowed, because eviction is
 * a storage optimization and must never block a learner from getting a
 * working SQL session.
 *
 * Note: because this registry only ever learns about a database when a
 * session actually uses it, it has no visibility into databases created
 * before this module shipped (or any it otherwise never observed). Those
 * pre-existing orphans are not retroactively swept — see the doc comment
 * on `evictStalePgliteDatabases` for the exact first-visit behavior.
 */

import { PGLITE_CACHE_VERSION } from "@/lib/sql-engine/schema-cache-key"

/**
 * localStorage key for the eviction registry. Follows the `dl:` prefix
 * convention (see `dl:pglite-cache:off`, `dl:dialect:<slug>`).
 */
export const PGLITE_REGISTRY_STORAGE_KEY = "dl:pglite-registry"

/**
 * Max persisted PGlite clusters kept locally, beyond whichever one is the
 * current session's own database (always exempt — see
 * `planPgliteEviction`). Each cluster is a full Postgres data directory
 * (WAL, catalogs, the seeded tables) — tens of MB even for a small schema.
 *
 * 20 caps worst-case local footprint in the low hundreds of MB to
 * ~1GB (20 x tens-of-MB), which is a meaningful fraction of the catalog —
 * production has 77 problems today — so a learner working through a study
 * session doesn't thrash the cache, while staying comfortably under
 * typical desktop IndexedDB quotas and inside the tighter per-origin
 * budgets mobile browsers (notably Safari) grant before prompting or
 * evicting.
 */
export const PGLITE_REGISTRY_CAP = 20

/**
 * Every name this module manages starts with this prefix — the same
 * namespace `schema-cache-key.ts` mints names under
 * (`datalearn-pglite-<slug>-<hash>`). Anything else is not ours and must
 * never be touched, whether that means evicting it or even tracking it in
 * our own bookkeeping.
 */
export const PGLITE_NAMESPACE_PREFIX = "datalearn-pglite-"

export type PgliteRegistryEntry = {
    /**
     * The PGlite data-dir name — `schema-cache-key.ts`'s
     * `computeSchemaCacheKey` output. NOT the `idb://` URL and NOT the
     * real browser IndexedDB name (see `pgliteIdbDatabaseName` in
     * `browser-session.ts` for that derivation).
     */
    name: string
    /** The `PGLITE_CACHE_VERSION` this entry was created under. */
    version: string
    /** Epoch millis (`Date.now()`-style) of this database's last use. */
    lastUsedAt: number
}

export type StorageLike = {
    getItem(key: string): string | null
    setItem(key: string, value: string): void
}

export function isOwnedPgliteDatabaseName(name: string): boolean {
    return name.startsWith(PGLITE_NAMESPACE_PREFIX)
}

/**
 * Reads the registry from storage. Never throws — corrupt/missing JSON, a
 * non-array payload, or malformed entries all resolve to `[]` rather than
 * propagating.
 */
export function readPgliteRegistry(
    storage: StorageLike | null | undefined
): PgliteRegistryEntry[] {
    if (!storage) return []
    try {
        const raw = storage.getItem(PGLITE_REGISTRY_STORAGE_KEY)
        if (!raw) return []
        const parsed: unknown = JSON.parse(raw)
        if (!Array.isArray(parsed)) return []
        return parsed.filter(isValidRegistryEntry)
    } catch {
        return []
    }
}

function isValidRegistryEntry(value: unknown): value is PgliteRegistryEntry {
    if (typeof value !== "object" || value === null) return false
    const entry = value as Record<string, unknown>
    return (
        typeof entry.name === "string" &&
        typeof entry.version === "string" &&
        typeof entry.lastUsedAt === "number"
    )
}

/** Writes the registry to storage. Never throws. */
export function writePgliteRegistry(
    storage: StorageLike | null | undefined,
    entries: PgliteRegistryEntry[]
): void {
    if (!storage) return
    try {
        storage.setItem(PGLITE_REGISTRY_STORAGE_KEY, JSON.stringify(entries))
    } catch {
        // Best-effort — Safari private mode or a full quota can throw on
        // write. Skipping the bookkeeping write just means this session's
        // database may look "unseen" a bit longer than it should.
    }
}

/**
 * Adds or bumps `name`'s entry to `now`, moving it to most-recently-used.
 * No-ops (returns `entries` unchanged) for a name outside our namespace —
 * defense in depth even though every real caller only ever passes a name
 * `computeSchemaCacheKey` produced.
 */
export function recordPgliteDatabaseUse(
    entries: PgliteRegistryEntry[],
    name: string,
    version: string,
    now: number
): PgliteRegistryEntry[] {
    if (!isOwnedPgliteDatabaseName(name)) return entries
    const withoutName = entries.filter((entry) => entry.name !== name)
    withoutName.push({ name, version, lastUsedAt: now })
    return withoutName
}

export type PgliteEvictionPlan = {
    keep: PgliteRegistryEntry[]
    evict: PgliteRegistryEntry[]
}

export type PgliteEvictionPolicy = {
    /**
     * The current `PGLITE_CACHE_VERSION`. Any entry not on this version is
     * unreachable — `computeSchemaCacheKey` can never mint that name again
     * — so it's evicted regardless of recency.
     */
    currentVersion: string
    /**
     * The database name the caller's session is about to use (or is
     * already using). Always kept, regardless of recency or cap, and
     * regardless of what its recorded version says. `null` for a session
     * that resolved to memory mode — nothing is exempted in that case.
     */
    currentName: string | null
    /**
     * How many non-current entries (on the current version) to keep,
     * beyond the always-kept current entry.
     */
    cap: number
}

/**
 * Pure eviction policy — no I/O, no clock reads. Decides which registry
 * entries to keep and which to evict:
 *
 *   1. Anything outside our namespace is dropped from consideration
 *      entirely — not evicted, not kept, just not ours to manage.
 *   2. `currentName`, if present, is always kept.
 *   3. Anything on a stale cache version (and not `currentName`) is
 *      evicted — it can never be hit again.
 *   4. Among the rest (current version, not `currentName`), the `cap`
 *      most-recently-used are kept and the remainder evicted.
 */
export function planPgliteEviction(
    entries: PgliteRegistryEntry[],
    policy: PgliteEvictionPolicy
): PgliteEvictionPlan {
    const { currentVersion, currentName, cap } = policy
    const owned = entries.filter((entry) =>
        isOwnedPgliteDatabaseName(entry.name)
    )

    const keep: PgliteRegistryEntry[] = []
    const evict: PgliteRegistryEntry[] = []
    const candidates: PgliteRegistryEntry[] = []

    for (const entry of owned) {
        if (currentName !== null && entry.name === currentName) {
            keep.push(entry)
            continue
        }
        if (entry.version !== currentVersion) {
            evict.push(entry)
            continue
        }
        candidates.push(entry)
    }

    const sorted = [...candidates].sort((a, b) => b.lastUsedAt - a.lastUsedAt)
    const safeCap = Math.max(0, cap)
    keep.push(...sorted.slice(0, safeCap))
    evict.push(...sorted.slice(safeCap))

    return { keep, evict }
}

export type EvictStalePgliteDatabasesDeps = {
    /**
     * Injected for tests. `undefined` reads the browser's `localStorage`;
     * `null` forces the "unavailable" branch (SSR, or Safari private mode
     * throwing on access).
     */
    storage?: StorageLike | null
    /** Injected for tests; defaults to `Date.now`. */
    now?: () => number
    /**
     * Deletes the *real* browser IndexedDB database by name. Callers
     * should pass `deleteBrowserIndexedDb` from `browser-session.ts` (or a
     * fake in tests) — this module has no delete implementation of its
     * own.
     */
    deleteIndexedDb: (idbDatabaseName: string) => Promise<void>
    /**
     * Derives the real Emscripten-mounted IndexedDB name from a PGlite
     * data-dir name. Callers should pass `pgliteIdbDatabaseName` from
     * `browser-session.ts` — see the derivation comment there for why
     * `idb://<name>` is not the real database name. This module
     * deliberately does not re-derive that rule.
     */
    toIdbDatabaseName: (name: string) => string
    cap?: number
    currentVersion?: string
}

/**
 * Records `currentName` as just-used and evicts whatever the policy says
 * to evict. Best-effort and silent: eviction is an optimization, never a
 * requirement for a working session, so every failure mode here — no
 * storage, a blocked/erroring delete, corrupt JSON, anything else — is
 * swallowed rather than propagated. A learner must never see an error
 * because this cleanup step failed.
 *
 * `currentName` is `null` for a session that resolved to memory mode;
 * eviction still runs (to reclaim other stale/excess entries) but nothing
 * is exempted as "in use."
 *
 * First-visit behavior after this ships: the registry starts empty, and
 * this module only ever learns about a database when a session actually
 * uses it (it deliberately does not call `indexedDB.databases()` — see the
 * module doc comment). So a learner who already has many accumulated
 * databases sees no immediate cleanup: none of those pre-existing
 * databases are evicted on their first visit, because none of them are in
 * the registry yet. Revisiting a previously-cached problem records that
 * one database going forward, making it eligible for future eviction
 * bookkeeping; growth is bounded from this point on, but old databases the
 * learner never revisits stay orphaned indefinitely, same as today.
 */
export async function evictStalePgliteDatabases(
    currentName: string | null,
    deps: EvictStalePgliteDatabasesDeps
): Promise<void> {
    try {
        const storage =
            deps.storage === undefined ? getBrowserLocalStorage() : deps.storage
        if (!storage) return

        const now = (deps.now ?? Date.now)()
        const cap = deps.cap ?? PGLITE_REGISTRY_CAP
        const currentVersion = deps.currentVersion ?? PGLITE_CACHE_VERSION

        const existing = readPgliteRegistry(storage)
        const withCurrent =
            currentName !== null
                ? recordPgliteDatabaseUse(existing, currentName, currentVersion, now)
                : existing

        const { keep, evict } = planPgliteEviction(withCurrent, {
            currentVersion,
            currentName,
            cap,
        })

        // Persist the trimmed registry before attempting any deletes, so a
        // delete that throws or hangs doesn't leave us retrying the same
        // eviction forever on every subsequent init.
        writePgliteRegistry(storage, keep)

        await Promise.all(
            evict.map((entry) =>
                deps
                    .deleteIndexedDb(deps.toIdbDatabaseName(entry.name))
                    .catch(() => {
                        // Best-effort — a blocked delete (open connection)
                        // or any other failure just leaves that cluster on
                        // disk until it's swept again on a future init.
                    })
            )
        )
    } catch {
        // Never let a bookkeeping failure block session creation.
    }
}

function getBrowserLocalStorage(): StorageLike | null {
    if (typeof window === "undefined") return null
    try {
        return window.localStorage
    } catch {
        return null
    }
}
