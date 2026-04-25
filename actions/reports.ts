"use server"

import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { ProblemReportCreateInput } from "@/lib/admin-validation"

export type ReportSubmitResult =
    | { ok: true }
    | { ok: false; error: string }

const REPORTS_PER_HOUR = 5

/**
 * Submit a problem report.
 *
 * SECURITY: previously anonymous-friendly with no rate limit, which
 * meant a 30-line script could fill the table and DoS the admin
 * inbox. We now require an authenticated user and cap to
 * REPORTS_PER_HOUR per user.
 */
export async function submitProblemReport(
    input: unknown
): Promise<ReportSubmitResult> {
    const parsed = ProblemReportCreateInput.safeParse(input)
    if (!parsed.success) {
        return { ok: false, error: "Please fill in all fields." }
    }
    const { problemSlug, kind, message } = parsed.data

    const session = await auth()
    if (!session?.user?.id) {
        return { ok: false, error: "Sign in to report a problem." }
    }
    const userId = session.user.id

    try {
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)
        const recent = await prisma.problemReport.count({
            where: { userId, createdAt: { gte: oneHourAgo } },
        })
        if (recent >= REPORTS_PER_HOUR) {
            return {
                ok: false,
                error: `Too many reports — please wait an hour. (Limit: ${REPORTS_PER_HOUR}/hour.)`,
            }
        }

        const problem = await prisma.sQLProblem.findUnique({
            where: { slug: problemSlug },
            select: { id: true },
        })
        if (!problem) {
            return { ok: false, error: "Problem not found." }
        }
        await prisma.problemReport.create({
            data: {
                problemId: problem.id,
                userId,
                kind,
                message,
            },
        })
        return { ok: true }
    } catch (e) {
        console.error("submitProblemReport failed:", e)
        return { ok: false, error: "Failed to submit report. Try again." }
    }
}

export async function resolveProblemReport(
    reportId: string
): Promise<{ ok: boolean }> {
    const session = await auth()
    if (!session?.user?.id || session.user.role !== "ADMIN") {
        return { ok: false }
    }
    try {
        await prisma.problemReport.update({
            where: { id: reportId },
            data: {
                resolvedAt: new Date(),
                resolvedBy: session.user.id,
            },
        })
        return { ok: true }
    } catch (e) {
        console.error("resolveProblemReport failed:", e)
        return { ok: false }
    }
}

export async function reopenProblemReport(
    reportId: string
): Promise<{ ok: boolean }> {
    const session = await auth()
    if (!session?.user?.id || session.user.role !== "ADMIN") {
        return { ok: false }
    }
    try {
        await prisma.problemReport.update({
            where: { id: reportId },
            data: { resolvedAt: null, resolvedBy: null },
        })
        return { ok: true }
    } catch (e) {
        console.error("reopenProblemReport failed:", e)
        return { ok: false }
    }
}
