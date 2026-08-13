import { prisma } from "@/lib/prisma"
import { sortApproaches } from "@/lib/workspace/approach-sort"

// NOT a "use server" module, deliberately — the same rule as
// lib/curriculum-write.ts. Every export of a server-action file becomes a
// client-callable RPC endpoint, so these functions, which take an explicit
// userId, would let any client post, edit or delete as any other user.
// actions/approaches.ts resolves the session and delegates here.
//
// Community approaches: user-shared solutions rendered by the workspace's
// Solutions tab, stored as DiscussionComment rows with kind = APPROACH.
//
// Posting is open to any signed-in user — chosen deliberately over an
// accepted-only gate. The mitigation is `verified`, computed at read time
// from whether the author has an ACCEPTED submission on this problem, never
// stored: it would go stale the moment an author solved the problem after
// posting.

const MAX_SQL_LENGTH = 5_000
const MAX_STRATEGY_LENGTH = 60
const PUBLIC_STATUSES = ["VISIBLE"] as const

export type ApproachView = {
    id: string
    authorName: string
    authorImage: string | null
    sql: string
    strategy: string | null
    score: number
    verified: boolean
    isMine: boolean
    createdAt: Date
    editedAt: Date | null
}

export type Result = { ok: true } | { ok: false; reason: string }

/**
 * Whether the problem accepts new approaches right now.
 *
 * HIDDEN hides both community surfaces; LOCKED keeps them readable and
 * refuses writes. Mirrors the discussion rules exactly — approaches are the
 * same moderation surface, not a parallel one.
 */
async function problemWriteState(problemId: string): Promise<{
    writable: boolean
    hidden: boolean
}> {
    const state = await prisma.problemDiscussionState.findUnique({
        where: { problemId },
        select: { mode: true },
    })
    const mode = state?.mode ?? "OPEN"
    return { writable: mode === "OPEN", hidden: mode === "HIDDEN" }
}

export async function getApproachesFor(
    problemSlug: string,
    viewerId: string | null
): Promise<ApproachView[]> {
    const problem = await prisma.sQLProblem.findUnique({
        where: { slug: problemSlug },
        select: { id: true },
    })
    if (!problem) return []

    const { hidden } = await problemWriteState(problem.id)
    if (hidden) return []

    const rows = await prisma.discussionComment.findMany({
        where: {
            problemId: problem.id,
            kind: "APPROACH",
            status: { in: [...PUBLIC_STATUSES] },
        },
        select: {
            id: true,
            sql: true,
            strategy: true,
            score: true,
            createdAt: true,
            editedAt: true,
            userId: true,
            user: { select: { name: true, image: true } },
        },
    })
    if (rows.length === 0) return []

    // One query for the whole page rather than per row: which of these
    // authors have actually solved this problem.
    const authorIds = rows
        .map((r) => r.userId)
        .filter((id): id is string => id !== null)
    const accepted = authorIds.length
        ? await prisma.submission.findMany({
              where: {
                  problemId: problem.id,
                  userId: { in: authorIds },
                  status: "ACCEPTED",
              },
              select: { userId: true },
              distinct: ["userId"],
          })
        : []
    const solvers = new Set(accepted.map((s) => s.userId))

    return sortApproaches(
        rows.map((r) => ({
            id: r.id,
            // userId is nulled when an account is deleted; the approach stays
            // as history rather than vanishing from the thread.
            authorName: r.user?.name ?? "Deleted account",
            authorImage: r.user?.image ?? null,
            sql: r.sql ?? "",
            strategy: r.strategy,
            score: r.score,
            verified: r.userId !== null && solvers.has(r.userId),
            isMine: viewerId !== null && r.userId === viewerId,
            createdAt: r.createdAt,
            editedAt: r.editedAt,
        }))
    )
}

export async function createApproach(
    userId: string,
    input: { problemSlug: string; sql: string; strategy: string | null }
): Promise<Result> {
    const sql = input.sql.trim()
    if (!sql) return { ok: false, reason: "Add a query to share." }
    if (sql.length > MAX_SQL_LENGTH) {
        return { ok: false, reason: "That query is too long to share." }
    }
    const strategy = input.strategy?.trim().slice(0, MAX_STRATEGY_LENGTH) || null

    const problem = await prisma.sQLProblem.findUnique({
        where: { slug: input.problemSlug },
        select: { id: true },
    })
    if (!problem) return { ok: false, reason: "Problem not found." }

    const { writable } = await problemWriteState(problem.id)
    if (!writable) {
        return { ok: false, reason: "Sharing is closed for this problem." }
    }

    try {
        await prisma.discussionComment.create({
            data: {
                problemId: problem.id,
                userId,
                kind: "APPROACH",
                sql,
                strategy,
                // bodyMarkdown is non-null on the shared model. The SQL lives
                // in its own column; this keeps the row readable in any
                // moderation view that only knows about comment bodies.
                bodyMarkdown: strategy ?? "Shared approach",
            },
        })
    } catch (e) {
        if (isOneApproachViolation(e)) {
            return {
                ok: false,
                reason: "You have already shared an approach for this problem.",
            }
        }
        throw e
    }

    return { ok: true }
}

export async function updateApproach(
    userId: string,
    input: { id: string; sql: string; strategy: string | null }
): Promise<Result> {
    const sql = input.sql.trim()
    if (!sql) return { ok: false, reason: "Add a query to share." }
    if (sql.length > MAX_SQL_LENGTH) {
        return { ok: false, reason: "That query is too long to share." }
    }

    // Scope the update by author as well as id, so ownership is enforced by
    // the query rather than by a check that a later refactor could drop.
    const updated = await prisma.discussionComment.updateMany({
        where: {
            id: input.id,
            userId,
            kind: "APPROACH",
        },
        data: {
            sql,
            strategy: input.strategy?.trim().slice(0, MAX_STRATEGY_LENGTH) || null,
            editedAt: new Date(),
        },
    })
    if (updated.count === 0) return { ok: false, reason: "Not found." }
    return { ok: true }
}

export async function removeApproach(
    userId: string,
    id: string
): Promise<Result> {
    const deleted = await prisma.discussionComment.updateMany({
        where: { id, userId, kind: "APPROACH" },
        // Soft delete, matching how comments are removed — moderation history
        // must survive the author changing their mind.
        data: { status: "DELETED", deletedAt: new Date() },
    })
    if (deleted.count === 0) return { ok: false, reason: "Not found." }
    return { ok: true }
}

/**
 * Whether a Prisma error is the one-approach-per-user partial unique index.
 *
 * Under @prisma/adapter-pg a P2002's meta.target is always undefined; the
 * offending columns live at meta.driverAdapterError.cause.constraint.fields
 * and arrive partly quoted, e.g. ["\"problemId\"", "\"userId\""]. Verified
 * against Postgres — see the migration's commit message. Mirrors
 * isUniqueViolationOn in lib/admin-curriculum.ts.
 */
function isOneApproachViolation(e: unknown): boolean {
    const err = e as {
        code?: string
        meta?: {
            target?: unknown
            driverAdapterError?: {
                cause?: { constraint?: { fields?: unknown } }
            }
        }
    }
    if (err?.code !== "P2002") return false

    const strip = (v: unknown) =>
        typeof v === "string" ? v.replace(/"/g, "") : ""
    const adapterFields = err.meta?.driverAdapterError?.cause?.constraint?.fields
    const fields = Array.isArray(adapterFields)
        ? adapterFields.map(strip)
        : Array.isArray(err.meta?.target)
          ? (err.meta.target as unknown[]).map(strip)
          : []

    return fields.includes("problemId") && fields.includes("userId")
}
