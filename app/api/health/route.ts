import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

/**
 * Liveness + DB-reachability check for uptime monitors / load balancers.
 *
 * Returns 200 with the current commit SHA + DB latency on success, 503 with
 * the error message on failure. The DB ping is a single round-trip — do not
 * add expensive checks here, this endpoint is hit on every health-check
 * tick (often once a minute).
 */
export async function GET() {
    const start = Date.now()
    try {
        await prisma.$queryRaw`SELECT 1`
        return NextResponse.json(
            {
                ok: true,
                db: { ok: true, latencyMs: Date.now() - start },
                commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "local",
                deployedAt: process.env.VERCEL_GIT_COMMIT_AUTHOR_NAME
                    ? new Date().toISOString()
                    : null,
            },
            { status: 200 }
        )
    } catch (e: any) {
        return NextResponse.json(
            {
                ok: false,
                db: { ok: false, error: String(e?.message ?? e) },
                commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "local",
            },
            { status: 503 }
        )
    }
}
