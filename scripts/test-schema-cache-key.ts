import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
    PGLITE_CACHE_OPT_OUT_KEY,
    PGLITE_CACHE_VERSION,
    computeSchemaCacheKey,
    resolvePgliteDataDir,
} from "../lib/sql-engine/schema-cache-key"

describe("PGlite schema cache key", () => {
    it("is stable for the same (slug, schemaSql, version) tuple", async () => {
        const a = await computeSchemaCacheKey({
            slug: "simple-select",
            schemaSql: "CREATE TABLE users (id INT);",
        })
        const b = await computeSchemaCacheKey({
            slug: "simple-select",
            schemaSql: "CREATE TABLE users (id INT);",
        })

        assert.equal(a, b)
        assert.match(a, /^datalearn-pglite-simple-select-[0-9a-f]{16}$/)
    })

    it("changes when the schema SQL changes", async () => {
        const a = await computeSchemaCacheKey({
            slug: "simple-select",
            schemaSql: "CREATE TABLE users (id INT);",
        })
        const b = await computeSchemaCacheKey({
            slug: "simple-select",
            schemaSql: "CREATE TABLE users (id INT, name TEXT);",
        })

        assert.notEqual(a, b)
    })

    it("changes when the cache version is bumped", async () => {
        const a = await computeSchemaCacheKey({
            slug: "simple-select",
            schemaSql: "CREATE TABLE users (id INT);",
            version: "v1",
        })
        const b = await computeSchemaCacheKey({
            slug: "simple-select",
            schemaSql: "CREATE TABLE users (id INT);",
            version: "v2",
        })

        assert.notEqual(a, b)
    })

    it("sanitizes the slug component into a friendly identifier", async () => {
        const key = await computeSchemaCacheKey({
            slug: "Total Revenue / Customer!",
            schemaSql: "CREATE TABLE t (id INT);",
        })
        assert.match(key, /^datalearn-pglite-total-revenue-customer-[0-9a-f]{16}$/)
    })

    it("falls back to a placeholder slug if input is empty after sanitizing", async () => {
        const key = await computeSchemaCacheKey({
            slug: "!!!",
            schemaSql: "CREATE TABLE t (id INT);",
        })
        assert.match(key, /^datalearn-pglite-problem-[0-9a-f]{16}$/)
    })
})

describe("resolvePgliteDataDir", () => {
    const baseInput = {
        slug: "simple-select",
        schemaSql: "CREATE TABLE users (id INT);",
    }

    it("returns indexeddb mode when storage, indexedDB, and crypto are all available", async () => {
        const result = await resolvePgliteDataDir(baseInput, {
            storage: { getItem: () => null },
            indexedDbAvailable: true,
            cryptoAvailable: true,
        })

        assert.equal(result.mode, "indexeddb")
        if (result.mode === "indexeddb") {
            assert.match(
                result.name,
                /^datalearn-pglite-simple-select-[0-9a-f]{16}$/
            )
        }
    })

    it("falls back to memory mode when learner has opted out", async () => {
        const result = await resolvePgliteDataDir(baseInput, {
            storage: {
                getItem: (key) =>
                    key === PGLITE_CACHE_OPT_OUT_KEY ? "true" : null,
            },
            indexedDbAvailable: true,
            cryptoAvailable: true,
        })

        assert.equal(result.mode, "memory")
        if (result.mode === "memory") {
            assert.match(result.reason, /opted out/i)
        }
    })

    it("falls back to memory mode when indexedDB is unavailable", async () => {
        const result = await resolvePgliteDataDir(baseInput, {
            storage: { getItem: () => null },
            indexedDbAvailable: false,
            cryptoAvailable: true,
        })

        assert.equal(result.mode, "memory")
        if (result.mode === "memory") {
            assert.match(result.reason, /indexedDB unavailable/i)
        }
    })

    it("falls back to memory mode when WebCrypto is unavailable", async () => {
        const result = await resolvePgliteDataDir(baseInput, {
            storage: { getItem: () => null },
            indexedDbAvailable: true,
            cryptoAvailable: false,
        })

        assert.equal(result.mode, "memory")
        if (result.mode === "memory") {
            assert.match(result.reason, /WebCrypto/i)
        }
    })

    it("treats common opt-out token shapes consistently", async () => {
        for (const token of ["1", "true", "yes", "on", "TRUE", "  Yes "]) {
            const result = await resolvePgliteDataDir(baseInput, {
                storage: { getItem: () => token },
                indexedDbAvailable: true,
                cryptoAvailable: true,
            })
            assert.equal(result.mode, "memory", `token "${token}" should opt out`)
        }
    })

    it("ignores unrecognized opt-out values and proceeds with persistence", async () => {
        const result = await resolvePgliteDataDir(baseInput, {
            storage: { getItem: () => "maybe" },
            indexedDbAvailable: true,
            cryptoAvailable: true,
        })

        assert.equal(result.mode, "indexeddb")
    })

    it("exposes the current cache version constant", () => {
        assert.equal(typeof PGLITE_CACHE_VERSION, "string")
        assert.match(PGLITE_CACHE_VERSION, /^v\d+$/)
    })
})
