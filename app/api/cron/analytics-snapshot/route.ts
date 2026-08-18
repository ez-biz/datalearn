import { NextResponse, type NextRequest } from "next/server"
import { writeDailySnapshot } from "@/lib/analytics/analytics-read"
import { toDayKey } from "@/lib/profile-stats"

const ONE_DAY_MS = 86_400_000

function isAuthorized(req: NextRequest): boolean {
    const secret = process.env.CRON_SECRET
    return Boolean(secret) && req.headers.get("authorization") === `Bearer ${secret}`
}

export async function GET(req: NextRequest) {
    if (!isAuthorized(req)) {
        return NextResponse.json({ error: "forbidden" }, { status: 403 })
    }

    const day = toDayKey(new Date(Date.now() - ONE_DAY_MS))
    await writeDailySnapshot(day)

    return NextResponse.json({ ok: true, day })
}
