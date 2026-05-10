import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
    SQL_ENGINE_TELEMETRY_ENDPOINT,
    SQL_ENGINE_TELEMETRY_OPT_OUT_KEY,
    buildSqlEngineTelemetryEvent,
    createSqlEngineTelemetrySession,
    isSqlEngineTelemetryDisabled,
    shouldSampleSqlEngineTelemetry,
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
})
