"use client"

import type { PGlite as PGliteType } from "@electric-sql/pglite"

export type PGliteInitOptions = {
    /**
     * Pass `idb://<name>` to persist the database in IndexedDB. Omit (or
     * pass `undefined`) for an ephemeral in-memory database — same
     * behavior as before persistence landed.
     *
     * The browser-session layer computes a stable name from the problem
     * slug + schemaSql + cache version so each problem has its own
     * persisted database. See `lib/sql-engine/schema-cache-key.ts`.
     */
    dataDir?: string
}

/**
 * PGlite (Postgres-WASM) initializer.
 *
 * Lazy-imports the package so the ~3MB Postgres-WASM bundle is only
 * loaded for problems whose `dialects` includes POSTGRES and whose
 * learner has selected Postgres in the workspace toggle. Pure DuckDB
 * users never download it.
 *
 * The instance runs entirely in-browser. No server roundtrip per query.
 */
export async function initPGlite(
    options: PGliteInitOptions = {}
): Promise<PGliteType> {
    const { PGlite } = await import("@electric-sql/pglite")
    const db = options.dataDir ? new PGlite(options.dataDir) : new PGlite()
    await db.waitReady
    return db
}
