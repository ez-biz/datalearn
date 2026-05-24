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

type DuckDbInstanceLike = {
    instantiate: (
        mainModule: string,
        pthreadWorker?: string | null
    ) => Promise<unknown>
}

type DuckDbInitializerDeps<TDb extends DuckDbInstanceLike> = {
    getSelfHostedBundles: () => duckdb.DuckDBBundles | null
    getJsDelivrBundles: () => duckdb.DuckDBBundles
    selectBundle: (bundles: duckdb.DuckDBBundles) => Promise<duckdb.DuckDBBundle>
    createWorkerBlobUrl: (mainWorker: string) => string
    revokeWorkerBlobUrl: (url: string) => void
    createWorker: (url: string) => Worker
    createDatabase: (worker: Worker) => TDb
    warn: (message: string, error: unknown) => void
}

async function instantiateBundle<TDb extends DuckDbInstanceLike>(
    deps: DuckDbInitializerDeps<TDb>,
    bundle: duckdb.DuckDBBundle,
    source: "self" | "cdn"
): Promise<TDb> {
    if (!bundle.mainWorker) {
        throw new Error("DuckDB bundle is missing mainWorker")
    }

    let workerUrl: string | null = null
    let worker: Worker | null = null
    try {
        workerUrl = deps.createWorkerBlobUrl(bundle.mainWorker)
        worker = deps.createWorker(workerUrl)
        const db = deps.createDatabase(worker)
        await db.instantiate(bundle.mainModule, bundle.pthreadWorker)
        lastBundleSource = source
        return db
    } catch (error) {
        worker?.terminate()
        throw error
    } finally {
        if (workerUrl) {
            deps.revokeWorkerBlobUrl(workerUrl)
        }
    }
}

async function instantiateSelectedBundle<TDb extends DuckDbInstanceLike>(
    deps: DuckDbInitializerDeps<TDb>,
    bundles: duckdb.DuckDBBundles,
    source: "self" | "cdn"
): Promise<TDb> {
    const bundle = await deps.selectBundle(bundles)
    return instantiateBundle(deps, bundle, source)
}

export function createDuckDbInitializer<TDb extends DuckDbInstanceLike>(
    deps: DuckDbInitializerDeps<TDb>
) {
    return async function initDuckDBFromDeps(): Promise<TDb> {
        lastBundleSource = null
        const selfHosted = deps.getSelfHostedBundles()

        if (selfHosted) {
            try {
                return await instantiateSelectedBundle(deps, selfHosted, "self")
            } catch (error) {
                deps.warn(
                    "[duckdb] self-hosted initialization failed; falling back to CDN",
                    error
                )
            }
        }

        return instantiateSelectedBundle(deps, deps.getJsDelivrBundles(), "cdn")
    }
}

export async function initDuckDB(): Promise<duckdb.AsyncDuckDB> {
    return createDuckDbInitializer<duckdb.AsyncDuckDB>({
        getSelfHostedBundles,
        getJsDelivrBundles: duckdb.getJsDelivrBundles,
        selectBundle: duckdb.selectBundle,
        createWorkerBlobUrl: (mainWorker) =>
            URL.createObjectURL(
                new Blob([`importScripts("${mainWorker}");`], {
                    type: "text/javascript",
                })
            ),
        revokeWorkerBlobUrl: (url) => URL.revokeObjectURL(url),
        createWorker: (url) => new Worker(url),
        createDatabase: (worker) =>
            new duckdb.AsyncDuckDB(
                new duckdb.ConsoleLogger(duckdb.LogLevel.WARNING),
                worker
            ),
        warn: (message, error) => console.warn(message, error),
    })()
}
