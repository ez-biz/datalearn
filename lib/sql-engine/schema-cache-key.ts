/**
 * Schema cache key + data-dir resolver for the per-problem PGlite
 * IndexedDB database.
 *
 * Different (slug, schemaSql, version) tuples → different IndexedDB
 * databases. Schema updates → a fresh database on the next visit
 * (slow first init); subsequent visits hit the cache.
 *
 * **Bump `PGLITE_CACHE_VERSION` whenever:**
 *   - The `@electric-sql/pglite` package is upgraded across a minor
 *     version (its on-disk format isn't versioned for us automatically).
 *   - The seed-schema replay format changes in a way that breaks
 *     existing cached data.
 *
 * Bumping invalidates every learner's local cache; one slow load after
 * deploy. Worth it to avoid silent corruption.
 */

export const PGLITE_CACHE_VERSION = "v1"

export const PGLITE_CACHE_OPT_OUT_KEY = "dl:pglite-cache:off"

const CACHE_KEY_NAMESPACE = "datalearn-pglite"

export type SchemaCacheKeyInput = {
    slug: string
    schemaSql: string
    version?: string
}

export type ResolvedDataDir =
    | { mode: "indexeddb"; name: string }
    | { mode: "memory"; reason: string }

type StorageLike = { getItem(key: string): string | null }

type ResolveOptions = {
    /** Inject `null` to force the memory branch; `undefined` reads the browser's localStorage. */
    storage?: StorageLike | null
    /** Inject `false` to force the memory branch; `undefined` checks `globalThis.indexedDB`. */
    indexedDbAvailable?: boolean
    /** Inject `false` to force the memory branch; `undefined` probes WebCrypto. */
    cryptoAvailable?: boolean
}

/**
 * Pick the PGlite data dir for this (slug, schemaSql) pair, or fall back
 * to memory mode when persistence isn't safe (opt-out, missing platform
 * APIs, key derivation failure).
 */
export async function resolvePgliteDataDir(
    input: SchemaCacheKeyInput,
    options: ResolveOptions = {}
): Promise<ResolvedDataDir> {
    const storage =
        options.storage === undefined
            ? getBrowserLocalStorage()
            : options.storage

    if (isPgliteCacheDisabled(storage)) {
        return { mode: "memory", reason: "opted out via dl:pglite-cache:off" }
    }

    const indexedDbAvailable =
        options.indexedDbAvailable ?? typeof globalThis.indexedDB !== "undefined"
    if (!indexedDbAvailable) {
        return { mode: "memory", reason: "indexedDB unavailable" }
    }

    const cryptoAvailable =
        options.cryptoAvailable ??
        typeof globalThis.crypto?.subtle?.digest === "function"
    if (!cryptoAvailable) {
        return { mode: "memory", reason: "WebCrypto subtle.digest unavailable" }
    }

    try {
        const name = await computeSchemaCacheKey(input)
        return { mode: "indexeddb", name }
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        return { mode: "memory", reason: `key derivation failed: ${message}` }
    }
}

/**
 * Stable IndexedDB name for a (slug, schemaSql, version) tuple. Format:
 * `datalearn-pglite-<sanitized-slug>-<sha256-prefix>`. The sha256 prefix
 * (16 hex chars = 64 bits) is far more than enough to avoid collisions
 * across one user's problem set; the prefix exists so the DB shows up
 * recognizably in DevTools.
 */
export async function computeSchemaCacheKey({
    slug,
    schemaSql,
    version = PGLITE_CACHE_VERSION,
}: SchemaCacheKeyInput): Promise<string> {
    const safeSlug = sanitizeSlug(slug)
    const digest = await sha256Hex(`${slug}\n${schemaSql}\n${version}`)
    return `${CACHE_KEY_NAMESPACE}-${safeSlug}-${digest.slice(0, 16)}`
}

async function sha256Hex(input: string): Promise<string> {
    if (typeof globalThis.crypto?.subtle?.digest !== "function") {
        throw new Error("WebCrypto subtle.digest unavailable")
    }
    const data = new TextEncoder().encode(input)
    const buf = await globalThis.crypto.subtle.digest("SHA-256", data)
    return Array.from(new Uint8Array(buf), (b) =>
        b.toString(16).padStart(2, "0")
    ).join("")
}

function sanitizeSlug(input: string): string {
    return (
        input
            .toLowerCase()
            .replace(/[^a-z0-9_-]+/g, "-")
            .replace(/^-+|-+$/g, "")
            .slice(0, 32) || "problem"
    )
}

function isPgliteCacheDisabled(
    storage: StorageLike | null | undefined
): boolean {
    if (!storage) return false
    try {
        const value = storage.getItem(PGLITE_CACHE_OPT_OUT_KEY)
        return ["1", "true", "yes", "on"].includes(
            String(value ?? "")
                .trim()
                .toLowerCase()
        )
    } catch {
        return false
    }
}

function getBrowserLocalStorage(): StorageLike | null {
    if (typeof window === "undefined") return null
    return window.localStorage
}
