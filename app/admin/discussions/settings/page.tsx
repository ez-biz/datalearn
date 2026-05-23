import { requireAdminPage } from "@/lib/admin-page-auth"
import { getDiscussionSettings } from "@/lib/discussions/settings"
import { AdminListShell } from "@/components/admin/AdminListShell"
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
        <AdminListShell
            eyebrow="SETTINGS"
            title="Discussion settings"
            description={
                <>
                    Controls learner discussion availability, trust thresholds, and
                    rate limits.
                </>
            }
        >
            <DiscussionSettingsForm initialSettings={settings} />
        </AdminListShell>
    )
}
