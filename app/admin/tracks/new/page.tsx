import Link from "next/link"
import { ChevronLeft } from "lucide-react"
import { requireAdminPage } from "@/lib/admin-page-auth"
import { AdminListShell } from "@/components/admin/AdminListShell"
import { TrackCreateForm } from "@/components/admin/TrackCreateForm"

export const metadata = {
    title: "New track",
    robots: { index: false, follow: false },
}

export default async function NewTrackPage() {
    await requireAdminPage()

    return (
        <AdminListShell
            eyebrow="NEW TRACK"
            title="New track"
            description={
                <>
                    Submitted via{" "}
                    <code className="font-mono text-xs">POST /api/admin/tracks</code>
                </>
            }
            actions={<BackLink href="/admin/tracks" label="Back to tracks" />}
        >
            <TrackCreateForm />
        </AdminListShell>
    )
}

function BackLink({ href, label }: { href: string; label: string }) {
    return (
        <Link
            href={href}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
            <ChevronLeft className="h-3.5 w-3.5" />
            {label}
        </Link>
    )
}
