import Link from "next/link"
import type { ModeratorPermissionKey, Prisma } from "@prisma/client"
import { MessageSquareWarning, Settings } from "lucide-react"
import { prisma } from "@/lib/prisma"
import { requireAdminOrModeratorPage } from "@/lib/admin-page-auth"
import { listModeratorPermissions } from "@/lib/discussions/permissions"
import { getDiscussionSettings } from "@/lib/discussions/settings"
import { Container } from "@/components/ui/Container"
import { EmptyState } from "@/components/ui/EmptyState"
import { DiscussionQueueClient } from "@/components/admin/discussions/DiscussionQueueClient"

export const metadata = {
    title: "Discussion moderation",
    robots: { index: false, follow: false },
}
export const dynamic = "force-dynamic"

const QUEUE_LIMIT = 100

const commentSelect = {
    id: true,
    bodyMarkdown: true,
    status: true,
    score: true,
    reportCount: true,
    createdAt: true,
    updatedAt: true,
    hiddenAt: true,
    problem: {
        select: {
            slug: true,
            title: true,
            number: true,
        },
    },
    user: {
        select: {
            id: true,
            name: true,
            email: true,
        },
    },
    reports: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: {
            id: true,
            reason: true,
            message: true,
            status: true,
            createdAt: true,
            user: {
                select: {
                    name: true,
                    email: true,
                },
            },
        },
    },
} satisfies Prisma.DiscussionCommentSelect

type CommentRecord = Prisma.DiscussionCommentGetPayload<{
    select: typeof commentSelect
}>

export default async function AdminDiscussionQueuePage() {
    const session = await requireAdminOrModeratorPage("VIEW_DISCUSSION_QUEUE")
    const settings = await getDiscussionSettings()

    const [needsReview, hidden, dismissedReports, spam, moderatorPermissions] =
        await Promise.all([
            prisma.discussionComment.findMany({
                where: {
                    status: "VISIBLE",
                    reportCount: { gte: settings.reportThreshold },
                },
                orderBy: [{ reportCount: "desc" }, { updatedAt: "desc" }],
                take: QUEUE_LIMIT,
                select: commentSelect,
            }),
            prisma.discussionComment.findMany({
                where: { status: "HIDDEN" },
                orderBy: [{ hiddenAt: "desc" }, { updatedAt: "desc" }],
                take: QUEUE_LIMIT,
                select: commentSelect,
            }),
            prisma.discussionComment.findMany({
                where: {
                    reports: {
                        some: { status: "DISMISSED" },
                    },
                },
                orderBy: { updatedAt: "desc" },
                take: QUEUE_LIMIT,
                select: commentSelect,
            }),
            prisma.discussionComment.findMany({
                where: { status: "SPAM" },
                orderBy: [{ hiddenAt: "desc" }, { updatedAt: "desc" }],
                take: QUEUE_LIMIT,
                select: commentSelect,
            }),
            session.user.role === "MODERATOR"
                ? listModeratorPermissions(session.user.id)
                : Promise.resolve([] as ModeratorPermissionKey[]),
        ])

    const permissions = buildPermissions(session.user.role, moderatorPermissions)

    const total =
        needsReview.length +
        hidden.length +
        dismissedReports.length +
        spam.length

    return (
        <Container width="xl" className="py-10">
            <header className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
                        Discussion moderation
                    </h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                        {total} queued comments · review threshold{" "}
                        <span className="tabular-nums">
                            {settings.reportThreshold}
                        </span>{" "}
                        reports
                    </p>
                </div>
                {session.user.role === "ADMIN" && (
                    <Link
                        href="/admin/discussions/settings"
                        className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-border bg-surface px-3 text-sm font-medium text-foreground transition-colors hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                    >
                        <Settings className="h-4 w-4" />
                        Settings
                    </Link>
                )}
            </header>

            {total === 0 ? (
                <EmptyState
                    icon={<MessageSquareWarning className="h-5 w-5" />}
                    title="No discussion comments need review"
                    description="Reported, hidden, dismissed, and spammed comments will appear here."
                />
            ) : (
                <DiscussionQueueClient
                    queues={{
                        needsReview: needsReview.map(shapeComment),
                        hidden: hidden.map(shapeComment),
                        dismissedReports: dismissedReports.map(shapeComment),
                        spam: spam.map(shapeComment),
                    }}
                    permissions={permissions}
                />
            )}
        </Container>
    )
}

function buildPermissions(
    role: string,
    permissions: ModeratorPermissionKey[]
) {
    const has = (permission: ModeratorPermissionKey) =>
        role === "ADMIN" || permissions.includes(permission)

    return {
        hideComment: has("HIDE_COMMENT"),
        restoreComment: has("RESTORE_COMMENT"),
        dismissReport: has("DISMISS_REPORT"),
        markSpam: has("MARK_SPAM"),
    }
}

function shapeComment(comment: CommentRecord) {
    const latestReport = comment.reports[0] ?? null

    return {
        id: comment.id,
        bodyMarkdown: comment.bodyMarkdown,
        status: comment.status,
        score: comment.score,
        reportCount: comment.reportCount,
        createdAt: comment.createdAt.toISOString(),
        updatedAt: comment.updatedAt.toISOString(),
        hiddenAt: comment.hiddenAt?.toISOString() ?? null,
        problem: comment.problem,
        author: comment.user
            ? {
                  id: comment.user.id,
                  name: comment.user.name,
                  email: comment.user.email,
              }
            : null,
        latestReport: latestReport
            ? {
                  id: latestReport.id,
                  reason: latestReport.reason,
                  message: latestReport.message,
                  status: latestReport.status,
                  createdAt: latestReport.createdAt.toISOString(),
                  reporter:
                      latestReport.user.name ??
                      latestReport.user.email ??
                      "user",
              }
            : null,
    }
}
