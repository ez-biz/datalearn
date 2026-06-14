"use server"

import crypto from "node:crypto"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { deriveContestStatus } from "@/lib/contest-status"
import { recordFirstSolveAndLeaderboard } from "@/lib/contest-submit"
import { compareResults } from "@/lib/sql-validator"
import {
    canCreateCustomContest,
    validateCustomContestInput,
} from "@/lib/contests/custom"

/**
 * Create an unlisted, link-shared custom contest. Auth-required. Enforces the
 * one-active-custom-contest cap, verifies all problems are PUBLISHED, and
 * validates title/duration/participants via the pure helper.
 */
export async function createCustomContest(input: {
    title: string
    problemIds: string[]
    startsAtIso: string
    endsAtIso: string
    maxParticipants: number
}): Promise<{ ok: true; slug: string } | { ok: false; error: string }> {
    const session = await auth()
    if (!session?.user?.id) {
        return { ok: false, error: "Sign in to create a contest." }
    }
    const userId = session.user.id

    const startsAt = new Date(input.startsAtIso)
    const endsAt = new Date(input.endsAtIso)

    const validation = validateCustomContestInput({
        title: input.title,
        problemIds: input.problemIds,
        startsAt,
        endsAt,
        maxParticipants: input.maxParticipants,
    })
    if (!validation.ok) {
        return { ok: false, error: validation.reason }
    }

    // All attached problems must be published.
    const publishedCount = await prisma.sQLProblem.count({
        where: { id: { in: input.problemIds }, status: "PUBLISHED" },
    })
    if (publishedCount !== input.problemIds.length) {
        return { ok: false, error: "All problems must be published." }
    }

    const slug = "c-" + crypto.randomBytes(9).toString("base64url")

    try {
        return await prisma.$transaction(async (tx) => {
            // Serialize this user's contest creation so the one-active cap is
            // race-safe — a per-user transaction advisory lock means two
            // parallel requests can't both pass the count check. (XACT-scoped
            // locks work under PgBouncer / Neon transaction pooling.)
            await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${userId})::bigint)`

            const existing = await tx.contest.findMany({
                where: { kind: "USER_CUSTOM", createdById: userId },
                select: { startsAt: true, endsAt: true, status: true },
            })
            const activeCount = existing.filter(
                (row) =>
                    deriveContestStatus(row.startsAt, row.endsAt, row.status) !==
                    "CLOSED"
            ).length
            if (!canCreateCustomContest(activeCount)) {
                return {
                    ok: false as const,
                    error: "You already have an active custom contest.",
                }
            }

            await tx.contest.create({
                data: {
                    slug,
                    title: input.title.trim(),
                    description: "User-created contest.",
                    kind: "USER_CUSTOM",
                    status: "SCHEDULED",
                    visibility: "PUBLIC",
                    startsAt,
                    endsAt,
                    durationMinutes: Math.round(
                        (endsAt.getTime() - startsAt.getTime()) / 60000
                    ),
                    rated: false,
                    maxParticipants: input.maxParticipants,
                    createdById: userId,
                    problems: {
                        create: input.problemIds.map((problemId, i) => ({
                            problemId,
                            position: i,
                            points: 1,
                        })),
                    },
                },
            })
            return { ok: true as const, slug }
        })
    } catch {
        return { ok: false, error: "Could not create contest." }
    }
}

/**
 * Load a custom contest by slug for the detail/play pages. Returns null unless
 * the row exists and is USER_CUSTOM. Hides problems until the contest is live.
 */
export async function getCustomContestBySlug(slug: string) {
    const row = await prisma.contest.findUnique({
        where: { slug },
        select: {
            id: true,
            slug: true,
            title: true,
            description: true,
            kind: true,
            status: true,
            startsAt: true,
            endsAt: true,
            durationMinutes: true,
            rated: true,
            visibility: true,
            maxParticipants: true,
            problems: {
                orderBy: { position: "asc" },
                select: {
                    position: true,
                    points: true,
                    problem: {
                        select: {
                            id: true,
                            number: true,
                            slug: true,
                            title: true,
                            difficulty: true,
                        },
                    },
                },
            },
            _count: { select: { registrations: true } },
        },
    })
    if (!row || row.kind !== "USER_CUSTOM") {
        return null
    }

    const status = deriveContestStatus(row.startsAt, row.endsAt, row.status)
    return {
        ...row,
        status,
        registrationCount: row._count.registrations,
        problemCount: row.problems.length,
        problems: status === "SCHEDULED" ? [] : row.problems,
    }
}

/**
 * Practice-judge a custom-contest submission. The query ran in the learner's
 * browser; we receive the result rows and compare them against the problem's
 * public expected output (same resolution as `validateSubmission`). On the
 * first accepted solve we record the leaderboard entry.
 */
export async function submitCustomContestEntry(input: {
    slug: string
    problemId: string
    dialect: "DUCKDB" | "POSTGRES"
    userResult: unknown[]
}): Promise<
    | { ok: true; verdict: "ACCEPTED" | "WRONG_ANSWER"; attemptNumber: number }
    | { ok: false; error: string }
> {
    const session = await auth()
    if (!session?.user?.id) {
        return { ok: false, error: "Sign in to submit your solution." }
    }
    const userId = session.user.id

    const contest = await prisma.contest.findUnique({
        where: { slug: input.slug },
        select: {
            id: true,
            kind: true,
            startsAt: true,
            endsAt: true,
            status: true,
            problems: {
                where: { problemId: input.problemId },
                select: { problemId: true },
                take: 1,
            },
        },
    })
    if (!contest || contest.kind !== "USER_CUSTOM") {
        return { ok: false, error: "Not found." }
    }
    if (
        deriveContestStatus(contest.startsAt, contest.endsAt, contest.status) !==
        "LIVE"
    ) {
        return { ok: false, error: "Contest isn't live." }
    }
    if (contest.problems.length === 0) {
        return { ok: false, error: "Problem not in contest." }
    }

    // Rate limit: cap submissions per user per contest to curb floods (the
    // judge work is cheap here, but the DB writes aren't free at scale).
    const recentSubmissions = await prisma.contestSubmission.count({
        where: {
            contestId: contest.id,
            userId,
            submittedAt: { gte: new Date(Date.now() - 60_000) },
        },
    })
    if (recentSubmissions >= 20) {
        return { ok: false, error: "Too many submissions — slow down a moment." }
    }

    const problem = await prisma.sQLProblem.findUnique({
        where: { id: input.problemId },
        select: {
            expectedOutputs: true,
            expectedOutput: true,
            ordered: true,
        },
    })
    if (!problem) {
        return { ok: false, error: "Problem not in contest." }
    }

    // Resolve expected output exactly as validateSubmission does: prefer the
    // per-dialect map, fall back to the legacy single field.
    const expectedOutputs =
        (problem.expectedOutputs as Record<string, string>) ?? {}
    const rawExpected =
        (input.dialect && expectedOutputs[input.dialect]) ||
        problem.expectedOutput

    let expected: unknown
    try {
        expected = JSON.parse(rawExpected)
    } catch {
        return {
            ok: false,
            error: "Expected output for this problem is malformed.",
        }
    }

    const result = compareResults(input.userResult, expected, {
        ordered: problem.ordered,
    })
    const verdict: "ACCEPTED" | "WRONG_ANSWER" = result.ok
        ? "ACCEPTED"
        : "WRONG_ANSWER"

    try {
        const contestId = contest.id
        const problemId = input.problemId

        const attemptNumber = await prisma.$transaction(async (tx) => {
            const submission = await tx.submission.create({
                data: {
                    userId,
                    problemId,
                    status: verdict,
                    code: "",
                    reason: result.ok ? null : result.reason ?? null,
                },
                select: { id: true },
            })

            const priorContestSubs = await tx.contestSubmission.count({
                where: { contestId, userId, problemId },
            })
            const attempt = priorContestSubs + 1
            const acceptedAt = result.ok ? new Date() : null

            await tx.contestSubmission.create({
                data: {
                    contestId,
                    userId,
                    problemId,
                    submissionId: submission.id,
                    // Custom contests are judged practice-style: there's no
                    // idempotency key, IP/UA capture, or stored SQL. Supply
                    // safe placeholders for the non-nullable columns and a
                    // unique idempotency key so the (contest,user,key) unique
                    // constraint never collides across attempts.
                    idempotencyKey: crypto.randomUUID(),
                    sqlHash: "",
                    simhash: "",
                    attemptNumber: attempt,
                    verdict,
                    acceptedAt,
                    ipHash: "",
                    userAgent: "custom",
                },
            })

            if (result.ok) {
                const existingSolve = await tx.contestProblemSolve.findUnique({
                    where: {
                        contestId_userId_problemId: {
                            contestId,
                            userId,
                            problemId,
                        },
                    },
                    select: { submissionId: true },
                })
                if (!existingSolve) {
                    await recordFirstSolveAndLeaderboard({
                        tx,
                        contestId,
                        userId,
                        problemId,
                        submissionId: submission.id,
                        acceptedAt: acceptedAt!,
                        attemptNumber: attempt,
                        contestStartsAt: contest.startsAt,
                    })
                }
            }

            return attempt
        })

        return { ok: true, verdict, attemptNumber }
    } catch (error) {
        console.error("[submitCustomContestEntry]", error)
        return { ok: false, error: "Submission failed." }
    }
}
