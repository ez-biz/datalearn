import {
    getAdminDashboardMetrics,
    getAdminRecentActivity,
} from "@/actions/admin-dashboard"
import { AdminQuickActions } from "@/components/admin/AdminQuickActions"
import { MetricCard } from "@/components/admin/MetricCard"
import { RecentActivityFeed } from "@/components/admin/RecentActivityFeed"
import { Eyebrow } from "@/components/ui/Eyebrow"

export async function AdminDashboard() {
    const [metrics, activity] = await Promise.all([
        getAdminDashboardMetrics(),
        getAdminRecentActivity(),
    ])

    return (
        <div className="space-y-8">
            <header className="flex flex-wrap items-end justify-between gap-4">
                <div>
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
                </div>
                <AdminQuickActions />
            </header>

            <section>
                <Eyebrow className="mb-3">OVERVIEW</Eyebrow>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                    {metrics.map((metric) => (
                        <MetricCard key={metric.label} metric={metric} />
                    ))}
                </div>
            </section>

            <RecentActivityFeed items={activity} />
        </div>
    )
}
