/**
 * Prebuild step that copies the DuckDB-WASM bundle into `public/_dl/sql-engine/`
 * so the production deploy serves the bytes from our own origin instead of
 * proxying through jsDelivr. See `docs/superpowers/specs/2026-05-16-sql-engine-asset-caching-design.md`.
 *
 * Runs automatically via the `prebuild` npm hook. Safe to run repeatedly —
 * the destination directory is cleared first so package upgrades that
 * rename a wasm file don't leave the old copy behind in the deploy.
 *
 * No external deps. Pure Node + node:fs.
 */

import { copyFileSync, existsSync, mkdirSync, rmSync, statSync } from "node:fs"
import { dirname, join, resolve } from "node:path"

const ROOT = resolve(import.meta.dirname ?? dirname(new URL(import.meta.url).pathname), "..")
const SOURCE_DIR = join(ROOT, "node_modules/@duckdb/duckdb-wasm/dist")
const DEST_DIR = join(ROOT, "public/_dl/sql-engine")

// We ship both `eh` (the modern path, what every recent Chrome/Firefox/
// Safari picks) and `mvp` (the older WASM-without-exception-handling
// fallback). `selectBundle()` from @duckdb/duckdb-wasm requires `mvp` to
// be defined in `DuckDBBundles` — so we keep it as a safety net even
// though we expect ~0% real-user traffic on the mvp path. The `coi`
// variant is intentionally NOT shipped: it requires cross-origin
// isolation (COOP/COEP) site-wide, which would interact with the rest
// of the app.
const ASSETS = [
    "duckdb-eh.wasm",
    "duckdb-browser-eh.worker.js",
    "duckdb-mvp.wasm",
    "duckdb-browser-mvp.worker.js",
]

function main(): void {
    if (!existsSync(SOURCE_DIR)) {
        throw new Error(
            `[copy-sql-engine-assets] Source dir missing: ${SOURCE_DIR}\n` +
                `Did 'npm install' run? @duckdb/duckdb-wasm should be on disk.`
        )
    }

    // Clear destination first so stale files from an old package version
    // never end up in the build artifact.
    if (existsSync(DEST_DIR)) {
        rmSync(DEST_DIR, { recursive: true, force: true })
    }
    mkdirSync(DEST_DIR, { recursive: true })

    let totalBytes = 0
    for (const filename of ASSETS) {
        const src = join(SOURCE_DIR, filename)
        const dest = join(DEST_DIR, filename)
        if (!existsSync(src)) {
            throw new Error(
                `[copy-sql-engine-assets] Missing asset: ${src}\n` +
                    `The bundled @duckdb/duckdb-wasm version may have changed.`
            )
        }
        copyFileSync(src, dest)
        totalBytes += statSync(dest).size
    }

    const mb = (totalBytes / 1_048_576).toFixed(2)
    console.log(
        `[copy-sql-engine-assets] copied ${ASSETS.length} files (${mb} MB total) → public/_dl/sql-engine/`
    )
}

main()
