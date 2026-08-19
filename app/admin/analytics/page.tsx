import type { Metadata } from "next"
import { requireAdminPage } from "@/lib/admin-page-auth"
import { Container } from "@/components/ui/Container"
import { PlatformSection } from "@/components/admin/analytics/PlatformSection"
import { ContentSection } from "@/components/admin/analytics/ContentSection"

export const metadata: Metadata = {
    title: "Analytics",
    robots: { index: false, follow: false },
}

// Operator-facing and low traffic, so always read current data rather than
// serving a cached page that quietly ages.
export const dynamic = "force-dynamic"

const WINDOW_DAYS = 30

export default async function AnalyticsPage() {
    // ADMIN only — requireAdminPage redirects every other role, including
    // MODERATOR, whose permissions are scoped to the discussion queue.
    await requireAdminPage()

    return (
        <Container width="2xl" className="py-10 sm:py-14">
            <h1 className="text-2xl font-semibold">Analytics</h1>
            <p className="mt-1 text-sm text-muted-foreground">
                Platform health over the last {WINDOW_DAYS} days. Days start at UTC
                midnight, matching the profile heatmap.
            </p>
            <PlatformSection windowDays={WINDOW_DAYS} />
            {/* Content performance is all-time, not windowed: acceptance rate
                over the last 30 days would be noise on a low-traffic problem,
                and the point is finding problems that are broken, not busy. */}
            <ContentSection />
        </Container>
    )
}
