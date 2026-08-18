import { NextResponse, type NextRequest } from "next/server"
import { writeDailySnapshot } from "@/lib/analytics/analytics-read"
import { toDayKey } from "@/lib/profile-stats"

function isAuthorized(req: NextRequest): boolean {
    const secret = process.env.CRON_SECRET
    return Boolean(secret) && req.headers.get("authorization") === `Bearer ${secret}`
}

export async function GET(req: NextRequest) {
    if (!isAuthorized(req)) {
        return NextResponse.json({ error: "forbidden" }, { status: 403 })
    }

    // This captures the live state at the first run in the current UTC day.
    // Retried runs cannot rewrite that day's snapshot.
    const day = toDayKey(new Date())
    await writeDailySnapshot(day)

    return NextResponse.json({ ok: true, day })
}
