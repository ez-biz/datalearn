import * as duckdb from "@duckdb/duckdb-wasm"

/**
 * Source the runtime picked for the most recent DuckDB initialization.
 * Exposed for telemetry — `lib/sql-engine/browser-session.ts` reads this
 * after `initDuckDB()` resolves and attaches `bundleSource` to the
 * `engine.init.ready` event so we can split self-host vs. CDN performance.
 *
 * `null` before the first init, `"self"` when serving from `/_dl/sql-engine/`,
 * `"cdn"` when serving from jsDelivr.
 */
let lastBundleSource: "self" | "cdn" | null = null

export function getLastDuckDbBundleSource(): "self" | "cdn" | null {
    return lastBundleSource
}

/** Marker substring in self-hosted bundle URLs — used for telemetry source detection. */
const SELF_HOSTED_PATH = "/_dl/sql-engine/"

/**
 * In a production browser build, ship the bundle from our own origin
 * (`public/_dl/sql-engine/` populated by `scripts/copy-sql-engine-assets.ts`).
 * Dev / SSR / fallback path uses jsDelivr — the prebuild copy doesn't run
 * under `next dev`, so dev still loads from the CDN exactly as before.
 *
 * **URLs must be absolute.** The Worker is constructed from a Blob URL
 * (`blob:https://…/<uuid>`), and `importScripts` inside that worker
 * resolves relative paths against the *blob* origin, not the page origin
 * — so a path like `/_dl/sql-engine/…` ends up invalid. Same for the
 * wasm fetch in `db.instantiate()`. Building absolute URLs against
 * `window.location.origin` matches what jsDelivr used to provide.
 *
 * See `docs/superpowers/specs/2026-05-16-sql-engine-asset-caching-design.md`
 * for the rationale (cache-partitioning + opportunistic-eviction trade-offs).
 */
function getSelfHostedBundles(): duckdb.DuckDBBundles | null {
    if (typeof window === "undefined") return null
    if (process.env.NODE_ENV !== "production") return null
    const origin = window.location.origin
    return {
        mvp: {
            mainModule: `${origin}${SELF_HOSTED_PATH}duckdb-mvp.wasm`,
            mainWorker: `${origin}${SELF_HOSTED_PATH}duckdb-browser-mvp.worker.js`,
        },
        eh: {
            mainModule: `${origin}${SELF_HOSTED_PATH}duckdb-eh.wasm`,
            mainWorker: `${origin}${SELF_HOSTED_PATH}duckdb-browser-eh.worker.js`,
        },
    }
}

export async function initDuckDB() {
    const selfHosted = getSelfHostedBundles()

    // Try the self-hosted bundle first when we have one. `selectBundle`
    // still does its feature check (WASM exception handling). If the
    // browser doesn't pass that check, fall through to the full jsDelivr
    // set, which includes the `mvp` variant for very old browsers.
    let bundle: duckdb.DuckDBBundle | null = null
    let source: "self" | "cdn" = "cdn"
    if (selfHosted) {
        try {
            bundle = await duckdb.selectBundle(selfHosted)
            if (bundle?.mainModule?.includes(SELF_HOSTED_PATH)) {
                source = "self"
            } else {
                bundle = null
            }
        } catch {
            bundle = null
        }
    }
    if (!bundle) {
        bundle = await duckdb.selectBundle(duckdb.getJsDelivrBundles())
        source = "cdn"
    }

    const worker_url = URL.createObjectURL(
        new Blob([`importScripts("${bundle.mainWorker!}");`], {
            type: "text/javascript",
        })
    )

    const worker = new Worker(worker_url)
    const logger = new duckdb.ConsoleLogger()
    const db = new duckdb.AsyncDuckDB(logger, worker)
    await db.instantiate(bundle.mainModule, bundle.pthreadWorker)
    URL.revokeObjectURL(worker_url)

    lastBundleSource = source
    return db
}
