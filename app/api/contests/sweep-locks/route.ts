import { NextResponse, type NextRequest } from "next/server"
import { sweepExpiredLocks } from "@/lib/contest-locks"
import { prisma } from "@/lib/prisma"

function isAuthorized(req: NextRequest): boolean {
    const secret = process.env.CRON_SECRET
    return Boolean(secret) && req.headers.get("authorization") === `Bearer ${secret}`
}

export async function GET(req: NextRequest) {
    if (!isAuthorized(req)) {
        return NextResponse.json({ error: "forbidden" }, { status: 403 })
    }
    const deleted = await sweepExpiredLocks(prisma)
    return NextResponse.json({ data: { deleted } })
}

export const POST = GET
