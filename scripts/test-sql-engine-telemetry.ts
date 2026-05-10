import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
    SQL_ENGINE_TELEMETRY_ENDPOINT,
    SQL_ENGINE_TELEMETRY_OPT_OUT_KEY,
    buildSqlEngineTelemetryEvent,
    createSqlEngineTelemetrySession,
    dispatchSqlEngineTelemetryEvent,
    isSqlEngineTelemetryDisabled,
    isSqlEngineTelemetryEvent,
    shouldSampleSqlEngineTelemetry,
    type SqlEngineTelemetryEvent,
} from "../lib/sql-engine/telemetry"

describe("SQL engine telemetry", () => {
    it("builds a strict timing payload without SQL or result data", () => {
        const event = buildSqlEngineTelemetryEvent({
            name: "engine.init.ready",
            dialect: "DUCKDB",
            sessionId: "session-1",
            problemSlug: "simple-select",
            schemaStatementCount: 3,
            startedAtMs: 100,
            nowMs: 163.7,
        })

        assert.deepEqual(event, {
            version: 1,
            name: "engine.init.ready",
            dialect: "DUCKDB",
            sessionId: "session-1",
            problemSlug: "simple-select",
            schemaStatementCount: 3,
            timestampMs: 164,
            elapsedMs: 64,
        })
        assert.equal(JSON.stringify(event).includes("SELECT"), false)
    })

    it("can attach first-query runtime while preserving session elapsed time", () => {
        const event = buildSqlEngineTelemetryEvent({
            name: "engine.firstQuery.ready",
            dialect: "POSTGRES",
            sessionId: "session-2",
            schemaStatementCount: 2,
            startedAtMs: 100,
            nowMs: 250,
            queryElapsedMs: 39.4,
        })

        assert.equal(event.elapsedMs, 150)
        assert.equal(event.queryElapsedMs, 39)
    })

    it("honors localStorage opt-out values", () => {
        assert.equal(
            isSqlEngineTelemetryDisabled({
                getItem: (key) =>
                    key === SQL_ENGINE_TELEMETRY_OPT_OUT_KEY ? "true" : null,
            }),
            true
        )
        assert.equal(
            isSqlEngineTelemetryDisabled({
                getItem: (key) =>
                    key === SQL_ENGINE_TELEMETRY_OPT_OUT_KEY ? "0" : null,
            }),
            false
        )
    })

    it("supports deterministic sampling", () => {
        assert.equal(
            shouldSampleSqlEngineTelemetry({ sampleRate: 0, random: () => 0 }),
            false
        )
        assert.equal(
            shouldSampleSqlEngineTelemetry({ sampleRate: 0.25, random: () => 0.1 }),
            true
        )
        assert.equal(
            shouldSampleSqlEngineTelemetry({ sampleRate: 0.25, random: () => 0.9 }),
            false
        )
        assert.equal(
            shouldSampleSqlEngineTelemetry({ sampleRate: 1, random: () => 0.99 }),
            true
        )
    })

    it("emits sampled session events through the configured sink", () => {
        const events: unknown[] = []
        let nowMs = 100
        const session = createSqlEngineTelemetrySession({
            dialect: "DUCKDB",
            sessionId: "session-3",
            problemSlug: "simple-select",
            schemaStatementCount: 4,
            sampleRate: 1,
            now: () => nowMs,
            sink: (event) => events.push(event),
        })

        session.emit("engine.init.start")
        nowMs = 145
        session.emit("engine.init.ready")

        assert.deepEqual(events, [
            {
                version: 1,
                name: "engine.init.start",
                dialect: "DUCKDB",
                sessionId: "session-3",
                problemSlug: "simple-select",
                schemaStatementCount: 4,
                timestampMs: 100,
                elapsedMs: 0,
            },
            {
                version: 1,
                name: "engine.init.ready",
                dialect: "DUCKDB",
                sessionId: "session-3",
                problemSlug: "simple-select",
                schemaStatementCount: 4,
                timestampMs: 145,
                elapsedMs: 45,
            },
        ])
    })

    it("uses the documented production endpoint", () => {
        assert.equal(SQL_ENGINE_TELEMETRY_ENDPOINT, "/api/telemetry/sql-engine")
    })

    it("does not emit when localStorage opt-out is set", () => {
        const events: unknown[] = []
        const session = createSqlEngineTelemetrySession({
            dialect: "DUCKDB",
            sessionId: "session-opt-out",
            schemaStatementCount: 1,
            sampleRate: 1,
            now: () => 0,
            storage: {
                getItem: (key) =>
                    key === SQL_ENGINE_TELEMETRY_OPT_OUT_KEY ? "true" : null,
            },
            sink: (event) => events.push(event),
        })

        assert.equal(session.sampled, false)
        session.emit("engine.init.start")
        session.emit("engine.dispose")
        assert.deepEqual(events, [])
    })

    it("rejects telemetry payloads with negative numerics", () => {
        const valid: SqlEngineTelemetryEvent = {
            version: 1,
            name: "engine.init.ready",
            dialect: "DUCKDB",
            sessionId: "s",
            schemaStatementCount: 0,
            timestampMs: 0,
            elapsedMs: 0,
        }

        assert.equal(isSqlEngineTelemetryEvent(valid), true)
        assert.equal(
            isSqlEngineTelemetryEvent({ ...valid, elapsedMs: -1 }),
            false
        )
        assert.equal(
            isSqlEngineTelemetryEvent({ ...valid, schemaStatementCount: -5 }),
            false
        )
        assert.equal(
            isSqlEngineTelemetryEvent({ ...valid, queryElapsedMs: -3 }),
            false
        )
    })

    it("dispatches dev events through the injected console.debug", () => {
        const debugCalls: unknown[][] = []
        dispatchSqlEngineTelemetryEvent(buildEvent(), {
            environment: "development",
            console: { debug: (...args) => debugCalls.push(args) },
        })

        assert.equal(debugCalls.length, 1)
        assert.equal(debugCalls[0][0], "[sql-engine telemetry]")
    })

    it("dispatches production events through navigator.sendBeacon when available", () => {
        const beaconCalls: Array<{ url: string; body: string | null }> = []
        const fetcherCalls: Array<{ url: string }> = []
        dispatchSqlEngineTelemetryEvent(buildEvent(), {
            environment: "production",
            navigator: {
                sendBeacon: (url, data) => {
                    beaconCalls.push({
                        url,
                        body: typeof data === "string" ? data : null,
                    })
                    return true
                },
            },
            fetcher: async (input) => {
                fetcherCalls.push({ url: String(input) })
            },
        })

        assert.equal(beaconCalls.length, 1)
        assert.equal(beaconCalls[0]?.url, SQL_ENGINE_TELEMETRY_ENDPOINT)
        assert.equal(fetcherCalls.length, 0)
    })

    it("falls back to fetch when sendBeacon is unavailable or returns false", () => {
        const fetcherCalls: Array<{ url: string; method?: string }> = []
        dispatchSqlEngineTelemetryEvent(buildEvent(), {
            environment: "production",
            navigator: { sendBeacon: () => false },
            fetcher: async (input, init) => {
                fetcherCalls.push({ url: String(input), method: init?.method })
            },
        })

        assert.equal(fetcherCalls.length, 1)
        assert.equal(fetcherCalls[0]?.url, SQL_ENGINE_TELEMETRY_ENDPOINT)
        assert.equal(fetcherCalls[0]?.method, "POST")
    })
})

describe("SQL engine telemetry server route", () => {
    it("logs a sanitized line for valid payloads and returns 204", async () => {
        const { POST } = await import("../app/api/telemetry/sql-engine/route")
        const logs: unknown[][] = []
        const originalLog = console.log
        console.log = (...args) => logs.push(args)
        try {
            const response = await POST(
                new Request("http://localhost/api/telemetry/sql-engine", {
                    method: "POST",
                    body: JSON.stringify(buildEvent()),
                })
            )
            assert.equal(response.status, 204)
            assert.equal(logs.length, 1)
            assert.equal(logs[0][0], "[sql-engine telemetry]")
        } finally {
            console.log = originalLog
        }
    })

    it("ignores invalid JSON without logging", async () => {
        const { POST } = await import("../app/api/telemetry/sql-engine/route")
        const logs: unknown[][] = []
        const originalLog = console.log
        console.log = (...args) => logs.push(args)
        try {
            const response = await POST(
                new Request("http://localhost/api/telemetry/sql-engine", {
                    method: "POST",
                    body: "not-json{",
                })
            )
            assert.equal(response.status, 204)
            assert.equal(logs.length, 0)
        } finally {
            console.log = originalLog
        }
    })

    it("ignores payloads missing required fields without logging", async () => {
        const { POST } = await import("../app/api/telemetry/sql-engine/route")
        const logs: unknown[][] = []
        const originalLog = console.log
        console.log = (...args) => logs.push(args)
        try {
            const response = await POST(
                new Request("http://localhost/api/telemetry/sql-engine", {
                    method: "POST",
                    body: JSON.stringify({ version: 1, name: "engine.init.start" }),
                })
            )
            assert.equal(response.status, 204)
            assert.equal(logs.length, 0)
        } finally {
            console.log = originalLog
        }
    })

    it("ignores payloads larger than 5KB without logging", async () => {
        const { POST } = await import("../app/api/telemetry/sql-engine/route")
        const logs: unknown[][] = []
        const originalLog = console.log
        console.log = (...args) => logs.push(args)
        try {
            const response = await POST(
                new Request("http://localhost/api/telemetry/sql-engine", {
                    method: "POST",
                    body: "x".repeat(5_001),
                })
            )
            assert.equal(response.status, 204)
            assert.equal(logs.length, 0)
        } finally {
            console.log = originalLog
        }
    })
})

function buildEvent(): SqlEngineTelemetryEvent {
    return {
        version: 1,
        name: "engine.init.ready",
        dialect: "DUCKDB",
        sessionId: "session-x",
        schemaStatementCount: 1,
        timestampMs: 100,
        elapsedMs: 25,
    }
}
