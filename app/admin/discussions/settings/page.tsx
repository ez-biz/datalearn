import { requireAdminPage } from "@/lib/admin-page-auth"
import { getDiscussionSettings } from "@/lib/discussions/settings"
import { Container } from "@/components/ui/Container"
import { DiscussionSettingsForm } from "@/components/admin/discussions/DiscussionSettingsForm"

export const metadata = {
    title: "Discussion settings",
    robots: { index: false, follow: false },
}
export const dynamic = "force-dynamic"

export default async function AdminDiscussionSettingsPage() {
    await requireAdminPage()
    const settings = await getDiscussionSettings()

    return (
        <Container width="lg" className="py-10">
            <header className="mb-6">
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
                    Discussion settings
                </h1>
                <p className="mt-1 text-sm text-muted-foreground">
                    Controls learner discussion availability, trust thresholds, and
                    rate limits.
                </p>
            </header>

            <DiscussionSettingsForm initialSettings={settings} />
        </Container>
    )
}
