import assert from "node:assert/strict"
import { describe, it } from "node:test"

import type { DuckDBBundles } from "@duckdb/duckdb-wasm"
import {
    createDuckDbInitializer,
    getLastDuckDbBundleSource,
} from "../lib/duckdb"

type FakeWorker = {
    url: string
    terminated: boolean
    terminate: () => void
}

type FakeDb = {
    source: "self" | "cdn"
    instantiate: (
        mainModule: string,
        pthreadWorker?: string | null
    ) => Promise<null>
}

function makeBundles(source: "self" | "cdn"): DuckDBBundles {
    return {
        mvp: {
            mainModule: `https://example.test/${source}/duckdb-mvp.wasm`,
            mainWorker: `https://example.test/${source}/duckdb-browser-mvp.worker.js`,
        },
        eh: {
            mainModule: `https://example.test/${source}/duckdb-eh.wasm`,
            mainWorker: `https://example.test/${source}/duckdb-browser-eh.worker.js`,
        },
    }
}

function makeHarness(options: { failSelfInstantiate?: boolean } = {}) {
    const instantiateCalls: string[] = []
    const workers: FakeWorker[] = []
    const revokedBlobUrls: string[] = []
    const warnings: Array<{ message: string; error: unknown }> = []

    const deps = {
        getSelfHostedBundles: () => makeBundles("self"),
        getJsDelivrBundles: () => makeBundles("cdn"),
        selectBundle: async (bundles: DuckDBBundles) => ({
            mainModule: bundles.eh?.mainModule ?? bundles.mvp.mainModule,
            mainWorker: bundles.eh?.mainWorker ?? bundles.mvp.mainWorker,
            pthreadWorker: null,
        }),
        createWorkerBlobUrl: (mainWorker: string) => `blob:${mainWorker}`,
        revokeWorkerBlobUrl: (url: string) => {
            revokedBlobUrls.push(url)
        },
        createWorker: (url: string) => {
            const worker: FakeWorker = {
                url,
                terminated: false,
                terminate() {
                    worker.terminated = true
                },
            }
            workers.push(worker)
            return worker as unknown as Worker
        },
        createDatabase: (worker: Worker): FakeDb => {
            const source = (worker as unknown as FakeWorker).url.includes("/self/")
                ? "self"
                : "cdn"
            return {
                source,
                async instantiate(mainModule) {
                    instantiateCalls.push(mainModule)
                    if (options.failSelfInstantiate && source === "self") {
                        throw new Error("self-hosted wasm load failed")
                    }
                    return null
                },
            }
        },
        warn: (message: string, error: unknown) => {
            warnings.push({ message, error })
        },
    }

    return { deps, instantiateCalls, workers, revokedBlobUrls, warnings }
}

describe("DuckDB browser initialization", () => {
    it("falls back to the CDN when self-hosted instantiation fails", async () => {
        const { deps, instantiateCalls, workers, revokedBlobUrls, warnings } =
            makeHarness({ failSelfInstantiate: true })

        const initDuckDB = createDuckDbInitializer(deps)
        const db = await initDuckDB()

        assert.equal(db.source, "cdn")
        assert.deepEqual(instantiateCalls, [
            "https://example.test/self/duckdb-eh.wasm",
            "https://example.test/cdn/duckdb-eh.wasm",
        ])
        assert.equal(workers.length, 2)
        assert.equal(workers[0]?.terminated, true)
        assert.equal(workers[1]?.terminated, false)
        assert.deepEqual(revokedBlobUrls, [
            "blob:https://example.test/self/duckdb-browser-eh.worker.js",
            "blob:https://example.test/cdn/duckdb-browser-eh.worker.js",
        ])
        assert.equal(warnings.length, 1)
        assert.equal(getLastDuckDbBundleSource(), "cdn")
    })

    it("keeps the self-hosted source marker only after successful instantiation", async () => {
        const { deps, instantiateCalls, workers, warnings } = makeHarness()

        const initDuckDB = createDuckDbInitializer(deps)
        const db = await initDuckDB()

        assert.equal(db.source, "self")
        assert.deepEqual(instantiateCalls, [
            "https://example.test/self/duckdb-eh.wasm",
        ])
        assert.equal(workers.length, 1)
        assert.equal(workers[0]?.terminated, false)
        assert.equal(warnings.length, 0)
        assert.equal(getLastDuckDbBundleSource(), "self")
    })
})
