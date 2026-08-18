import { NextResponse, type NextRequest } from "next/server"
import { writeDailySnapshot } from "@/lib/analytics/analytics-read"
import { snapshotDayForRun } from "@/lib/analytics/snapshot-day"

function isAuthorized(req: NextRequest): boolean {
    const secret = process.env.CRON_SECRET
    return Boolean(secret) && req.headers.get("authorization") === `Bearer ${secret}`
}

export async function GET(req: NextRequest) {
    if (!isAuthorized(req)) {
        return NextResponse.json({ error: "forbidden" }, { status: 403 })
    }

    // An authorized invocation belongs to the UTC day when it starts. A
    // later retry cannot rewrite that day's first successfully persisted row.
    const day = snapshotDayForRun(new Date())
    await writeDailySnapshot(day)

    return NextResponse.json({ ok: true, day })
}
