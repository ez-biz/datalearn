import {
    getAdminDashboardMetrics,
    getAdminRecentActivity,
} from "@/actions/admin-dashboard"
import { prisma } from "@/lib/prisma"
import { MetricCard } from "@/components/admin/MetricCard"
import { QueueStack } from "@/components/admin/QueueStack"
import { RecentActivityFeed } from "@/components/admin/RecentActivityFeed"
import { Eyebrow } from "@/components/ui/Eyebrow"

// The design's six-up grid assumed seven metrics minus one; two of those
// seven (Open reports, Pending review) move into the queue stack below
// instead, leaving five real cards. Filtering here rather than trimming
// actions/admin-dashboard.ts keeps that action's 7-entry shape available to
// any other future caller while this screen renders only what belongs in
// the grid.
const GRID_METRIC_LABELS = new Set([
    "Problems",
    "Articles",
    "Tracks",
    "Contests",
    "Submissions (7d)",
])

export async function AdminDashboard() {
    const [metrics, activity, flaggedCommentCount] = await Promise.all([
        getAdminDashboardMetrics(),
        getAdminRecentActivity(),
        // Same OPEN-status count ConsoleShell computes for the sidebar's
        // discussion badge (components/layout/console/ConsoleShell.tsx) —
        // this page is ADMIN-only (requireAdminPage), so there is no
        // moderator permission gate to thread through here.
        prisma.discussionReport.count({ where: { status: "OPEN" } }),
    ])

    const gridMetrics = metrics.filter((metric) =>
        GRID_METRIC_LABELS.has(metric.label)
    )
    const openReports = metrics.find((m) => m.label === "Open reports")
    const pendingArticles = metrics.find((m) => m.label === "Pending review")

    return (
        <div className="space-y-8">
            <header>
                <Eyebrow variant="bracket" className="mb-1">
                    ADMIN
                </Eyebrow>
                <h1 className="text-3xl font-bold tracking-tight">
                    Dashboard
                </h1>
                <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                    Review platform health, queue pressure, and the most
                    recent authoring and learner activity from one surface.
                </p>
            </header>

            <section>
                <Eyebrow className="mb-3">OVERVIEW</Eyebrow>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                    {gridMetrics.map((metric) => (
                        <MetricCard key={metric.label} metric={metric} />
                    ))}
                </div>
            </section>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                <div className="lg:col-span-2">
                    <RecentActivityFeed items={activity} />
                </div>
                <QueueStack
                    openReports={{
                        count: openReports?.value ?? 0,
                        href: "/admin/reports",
                    }}
                    pendingArticles={{
                        count: pendingArticles?.value ?? 0,
                        href: "/admin/articles?status=SUBMITTED",
                    }}
                    flaggedComments={{
                        count: flaggedCommentCount,
                        href: "/admin/discussions",
                    }}
                />
            </div>
        </div>
    )
}
