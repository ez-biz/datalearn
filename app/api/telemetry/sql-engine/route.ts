import { isSqlEngineTelemetryEvent } from "@/lib/sql-engine/telemetry"

export const runtime = "nodejs"

// Intentionally unauthenticated and unmetered for now: the handler only
// validates payload shape and writes to stdout (Vercel function logs).
// TODO: add rate-limiting / origin checks when this gets wired to a real
// telemetry sink (Vercel Analytics, Datadog, etc.).
export async function POST(request: Request) {
    const event = await readTelemetryEvent(request)
    if (event) {
        console.log("[sql-engine telemetry]", {
            name: event.name,
            dialect: event.dialect,
            problemSlug: event.problemSlug ?? null,
            schemaStatementCount: event.schemaStatementCount,
            elapsedMs: event.elapsedMs,
            queryElapsedMs: event.queryElapsedMs ?? null,
        })
    }

    return new Response(null, { status: 204 })
}

async function readTelemetryEvent(request: Request) {
    const text = await request.text()
    if (text.length === 0 || text.length > 5_000) return null

    try {
        const body = JSON.parse(text)
        return isSqlEngineTelemetryEvent(body) ? body : null
    } catch {
        return null
    }
}
