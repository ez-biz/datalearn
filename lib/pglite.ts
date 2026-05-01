"use client"

import type { PGlite as PGliteType } from "@electric-sql/pglite"

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
export async function initPGlite(): Promise<PGliteType> {
    const { PGlite } = await import("@electric-sql/pglite")
    // No persistence — fresh ephemeral DB per page load, matching the
    // DuckDB-WASM lifecycle. The schema is replayed on every mount.
    const db = new PGlite()
    await db.waitReady
    return db
}
