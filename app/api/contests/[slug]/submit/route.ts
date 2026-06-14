import crypto from "node:crypto"
import { NextResponse } from "next/server"
import { z } from "zod"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { deriveContestStatus } from "@/lib/contest-status"
import { warmUpJudge } from "@/lib/contest-judge"
import {
    ContestNotLiveError,
    NotRegisteredError,
    submitContestEntry,
} from "@/lib/contest-submit"

const WARM_DIALECTS = new Set(["DUCKDB", "POSTGRES"])

const SubmitBody = z.object({
    problemId: z.string().min(20).max(40),
    sql: z.string().min(1).max(64 * 1024),
    dialect: z.enum(["DUCKDB", "POSTGRES"]),
    idempotencyKey: z.string().uuid(),
})

type Ctx = { params: Promise<{ slug: string }> }

/**
 * Judge warm-up ping. The contest play client hits this on mount so the cold
 * fork — worker bundle + native DuckDB / PGlite load + engine boot — is paid
 * for while the contestant is still writing SQL, instead of by whoever submits
 * first (>30s on a cold serverless instance). This lives in the same route file
 * as the POST submit handler on purpose: Vercel routes both methods to the same
 * function, so warming here warms the very instances that will judge. The work
 * is debounced per dialect inside `warmUpJudge`, so repeated pings are cheap.
 */
export async function GET(req: Request, ctx: Ctx) {
    const session = await auth()
    if (!session?.user?.id) {
        return NextResponse.json({ warmed: false }, { status: 401 })
    }

    const { slug } = await ctx.params
    const contest = await prisma.contest.findUnique({
        where: { slug },
        select: { startsAt: true, endsAt: true, status: true },
    })
    if (!contest) {
        return NextResponse.json({ warmed: false }, { status: 404 })
    }

    // Only worth a fork while the contest can actually take submissions.
    if (
        deriveContestStatus(contest.startsAt, contest.endsAt, contest.status) !==
        "LIVE"
    ) {
        return NextResponse.json({ warmed: false })
    }

    const requested = new URL(req.url).searchParams.get("dialect")
    const dialect =
        requested && WARM_DIALECTS.has(requested)
            ? (requested as "DUCKDB" | "POSTGRES")
            : "DUCKDB"

    // Await so the serverless instance stays alive while the worker forks. The
    // client fires this fire-and-forget, so the contestant never blocks on it.
    await warmUpJudge(dialect)
    return NextResponse.json({ warmed: true })
}

export async function POST(req: Request, ctx: Ctx) {
    const session = await auth()
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Not signed in." }, { status: 401 })
    }

    let body: unknown
    try {
        body = await req.json()
    } catch {
        return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 })
    }

    const parsed = SubmitBody.safeParse(body)
    if (!parsed.success) {
        return NextResponse.json(
            { error: "Validation failed", details: z.treeifyError(parsed.error) },
            { status: 400 }
        )
    }

    const { slug } = await ctx.params
    const contest = await prisma.contest.findUnique({
        where: { slug },
        select: { id: true },
    })
    if (!contest) {
        return NextResponse.json({ error: "Contest not found." }, { status: 404 })
    }

    try {
        const result = await submitContestEntry({
            contestId: contest.id,
            userId: session.user.id,
            problemId: parsed.data.problemId,
            sql: parsed.data.sql,
            dialect: parsed.data.dialect,
            idempotencyKey: parsed.data.idempotencyKey,
            ipHash: hashIp(req, contest.id),
            userAgent: req.headers.get("user-agent")?.slice(0, 1000) ?? "unknown",
        })
        // Return only the verdict + attempt — never the judge `message`, which
        // can carry hidden-data hints (expected column names / row count).
        return NextResponse.json({
            data: {
                verdict: result.verdict,
                attemptNumber: result.attemptNumber,
            },
        })
    } catch (error: unknown) {
        if (error instanceof ContestNotLiveError) {
            return NextResponse.json(
                { error: "Contest not live." },
                { status: 409 }
            )
        }
        if (error instanceof NotRegisteredError) {
            return NextResponse.json(
                { error: "Not registered for this contest." },
                { status: 403 }
            )
        }

        const message = error instanceof Error ? error.message : "UNKNOWN"
        if (message === "CONTEST_NOT_FOUND") {
            return NextResponse.json(
                { error: "Contest not found." },
                { status: 404 }
            )
        }
        if (message === "PROBLEM_NOT_IN_CONTEST") {
            return NextResponse.json(
                { error: "Problem not in this contest." },
                { status: 404 }
            )
        }
        if (message === "DIALECT_NOT_ALLOWED") {
            return NextResponse.json(
                { error: "Dialect is not enabled for this problem." },
                { status: 400 }
            )
        }
        if (message.startsWith("HIDDEN_DATA_MISSING:")) {
            return NextResponse.json(
                { error: "Problem hidden data is not ready." },
                { status: 409 }
            )
        }

        console.error("[contest-submit] failed", error)
        return NextResponse.json({ error: "Internal error." }, { status: 500 })
    }
}

function hashIp(req: Request, contestId: string): string {
    const forwardedFor = req.headers.get("x-forwarded-for")
    const ip =
        forwardedFor?.split(",")[0]?.trim() ??
        req.headers.get("x-real-ip")?.trim() ??
        "unknown"
    return crypto.createHash("sha256").update(`${contestId}:${ip}`).digest("hex")
}
