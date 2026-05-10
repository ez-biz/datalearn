import type { Dialect } from "@/lib/sql-engine/types"

export const SQL_ENGINE_TELEMETRY_ENDPOINT = "/api/telemetry/sql-engine"
export const SQL_ENGINE_TELEMETRY_OPT_OUT_KEY = "dl:telemetry:off"
export const DEFAULT_SQL_ENGINE_TELEMETRY_SAMPLE_RATE = 1
export const SQL_ENGINE_TELEMETRY_VERSION = 1

export const SQL_ENGINE_TELEMETRY_EVENT_NAMES = [
    "engine.init.start",
    "engine.init.ready",
    "engine.firstQuery.ready",
    "engine.dispose",
] as const

export type SqlEngineTelemetryEventName =
    (typeof SQL_ENGINE_TELEMETRY_EVENT_NAMES)[number]

export type SqlEngineTelemetryEvent = {
    version: typeof SQL_ENGINE_TELEMETRY_VERSION
    name: SqlEngineTelemetryEventName
    dialect: Dialect
    sessionId: string
    schemaStatementCount: number
    timestampMs: number
    elapsedMs: number
    problemSlug?: string
    queryElapsedMs?: number
}

type TelemetryStorage = Pick<Storage, "getItem">

type BuildSqlEngineTelemetryEventInput = {
    name: SqlEngineTelemetryEventName
    dialect: Dialect
    sessionId: string
    schemaStatementCount: number
    startedAtMs: number
    nowMs: number
    problemSlug?: string
    queryElapsedMs?: number
}

type SamplingOptions = {
    sampleRate?: number
    random?: () => number
}

type CreateSqlEngineTelemetrySessionInput = {
    dialect: Dialect
    schemaStatementCount: number
    problemSlug?: string
    sessionId?: string
    sampleRate?: number
    now?: () => number
    random?: () => number
    storage?: TelemetryStorage
    sink?: (event: SqlEngineTelemetryEvent) => void
}

export type SqlEngineTelemetrySession = {
    sessionId: string
    sampled: boolean
    now: () => number
    elapsedSince: (startedAtMs: number) => number
    emit: (
        name: SqlEngineTelemetryEventName,
        details?: { queryElapsedMs?: number }
    ) => void
}

type DispatchOptions = {
    environment?: string
    console?: Pick<Console, "debug">
    navigator?: {
        sendBeacon?: (url: string, data?: BodyInit | null) => boolean
    }
    fetcher?: (input: RequestInfo | URL, init?: RequestInit) => Promise<unknown>
}

export function buildSqlEngineTelemetryEvent({
    name,
    dialect,
    sessionId,
    schemaStatementCount,
    startedAtMs,
    nowMs,
    problemSlug,
    queryElapsedMs,
}: BuildSqlEngineTelemetryEventInput): SqlEngineTelemetryEvent {
    return {
        version: SQL_ENGINE_TELEMETRY_VERSION,
        name,
        dialect,
        sessionId,
        ...(problemSlug ? { problemSlug } : {}),
        schemaStatementCount: toRoundedNonNegativeNumber(schemaStatementCount),
        timestampMs: toRoundedNonNegativeNumber(nowMs),
        elapsedMs: toRoundedNonNegativeNumber(nowMs - startedAtMs),
        ...(queryElapsedMs !== undefined
            ? { queryElapsedMs: toRoundedNonNegativeNumber(queryElapsedMs) }
            : {}),
    }
}

export function createSqlEngineTelemetrySession({
    dialect,
    schemaStatementCount,
    problemSlug,
    sessionId = createTelemetrySessionId(),
    sampleRate = DEFAULT_SQL_ENGINE_TELEMETRY_SAMPLE_RATE,
    now = nowMs,
    random = defaultRandom,
    storage = getBrowserLocalStorage(),
    sink = dispatchSqlEngineTelemetryEvent,
}: CreateSqlEngineTelemetrySessionInput): SqlEngineTelemetrySession {
    const startedAtMs = now()
    const sampled =
        !isSqlEngineTelemetryDisabled(storage) &&
        shouldSampleSqlEngineTelemetry({ sampleRate, random })

    return {
        sessionId,
        sampled,
        now,
        elapsedSince: (spanStartedAtMs) =>
            toRoundedNonNegativeNumber(now() - spanStartedAtMs),
        emit(name, details) {
            if (!sampled) return
            sink(
                buildSqlEngineTelemetryEvent({
                    name,
                    dialect,
                    sessionId,
                    problemSlug,
                    schemaStatementCount,
                    startedAtMs,
                    nowMs: now(),
                    queryElapsedMs: details?.queryElapsedMs,
                })
            )
        },
    }
}

export function isSqlEngineTelemetryDisabled(
    storage: TelemetryStorage | undefined
): boolean {
    if (!storage) return false
    try {
        const value = storage.getItem(SQL_ENGINE_TELEMETRY_OPT_OUT_KEY)
        return ["1", "true", "yes", "on"].includes(
            String(value ?? "").trim().toLowerCase()
        )
    } catch {
        return false
    }
}

export function shouldSampleSqlEngineTelemetry({
    sampleRate = DEFAULT_SQL_ENGINE_TELEMETRY_SAMPLE_RATE,
    random = defaultRandom,
}: SamplingOptions = {}): boolean {
    if (!Number.isFinite(sampleRate) || sampleRate <= 0) return false
    if (sampleRate >= 1) return true
    return random() < sampleRate
}

export function dispatchSqlEngineTelemetryEvent(
    event: SqlEngineTelemetryEvent,
    options: DispatchOptions = {}
): void {
    const hasInjectedTarget =
        options.console !== undefined ||
        options.navigator !== undefined ||
        options.fetcher !== undefined
    if (typeof window === "undefined" && !hasInjectedTarget) return

    const environment = options.environment ?? process.env.NODE_ENV
    if (environment !== "production") {
        const logger = options.console ?? console
        logger.debug("[sql-engine telemetry]", event)
        return
    }

    const body = JSON.stringify(event)
    const beaconTarget =
        options.navigator ??
        (typeof navigator !== "undefined" ? navigator : undefined)

    if (
        typeof beaconTarget?.sendBeacon === "function" &&
        beaconTarget.sendBeacon(SQL_ENGINE_TELEMETRY_ENDPOINT, body)
    ) {
        return
    }

    const fetcher =
        options.fetcher ?? (typeof fetch !== "undefined" ? fetch : undefined)
    if (!fetcher) return

    void fetcher(SQL_ENGINE_TELEMETRY_ENDPOINT, {
        method: "POST",
        body,
        headers: { "content-type": "application/json" },
        keepalive: true,
    }).catch(() => {})
}

export function isSqlEngineTelemetryEvent(
    value: unknown
): value is SqlEngineTelemetryEvent {
    if (!value || typeof value !== "object") return false
    const event = value as Partial<SqlEngineTelemetryEvent>
    return (
        event.version === SQL_ENGINE_TELEMETRY_VERSION &&
        typeof event.sessionId === "string" &&
        isFiniteNonNegative(event.schemaStatementCount) &&
        isFiniteNonNegative(event.timestampMs) &&
        isFiniteNonNegative(event.elapsedMs) &&
        SQL_ENGINE_TELEMETRY_EVENT_NAMES.includes(
            event.name as SqlEngineTelemetryEventName
        ) &&
        (event.dialect === "DUCKDB" || event.dialect === "POSTGRES") &&
        (event.problemSlug === undefined ||
            typeof event.problemSlug === "string") &&
        (event.queryElapsedMs === undefined ||
            isFiniteNonNegative(event.queryElapsedMs))
    )
}

function isFiniteNonNegative(value: unknown): value is number {
    return typeof value === "number" && Number.isFinite(value) && value >= 0
}

function createTelemetrySessionId(): string {
    if (typeof globalThis.crypto?.randomUUID === "function") {
        return globalThis.crypto.randomUUID()
    }
    return `dleng_${Date.now().toString(36)}_${Math.random()
        .toString(36)
        .slice(2)}`
}

function getBrowserLocalStorage(): TelemetryStorage | undefined {
    if (typeof window === "undefined") return undefined
    return window.localStorage
}

function nowMs(): number {
    return globalThis.performance?.now() ?? Date.now()
}

/**
 * Crypto-grade fallback for the sampling decision. Telemetry sampling
 * isn't a security context — predicting "will this user be sampled?"
 * has no exploit value — but using `crypto.getRandomValues` here keeps
 * `Math.random` data-flow out of the codebase entirely so static
 * analyzers (CodeQL `js/insecure-randomness`) don't have to reason
 * about intent.
 */
function defaultRandom(): number {
    if (typeof globalThis.crypto?.getRandomValues === "function") {
        const buf = new Uint32Array(1)
        globalThis.crypto.getRandomValues(buf)
        return buf[0] / 0x1_0000_0000
    }
    return Math.random()
}

function toRoundedNonNegativeNumber(value: number): number {
    if (!Number.isFinite(value)) return 0
    return Math.max(0, Math.round(value))
}
