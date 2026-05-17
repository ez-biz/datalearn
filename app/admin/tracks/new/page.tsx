import Link from "next/link"
import { ChevronLeft } from "lucide-react"
import { requireAdminPage } from "@/lib/admin-page-auth"
import { Container } from "@/components/ui/Container"
import { TrackCreateForm } from "@/components/admin/TrackCreateForm"

export const metadata = {
    title: "New track",
    robots: { index: false, follow: false },
}

export default async function NewTrackPage() {
    await requireAdminPage()

    return (
        <Container width="lg" className="py-10">
            <Link
                href="/admin/tracks"
                className="mb-4 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
                <ChevronLeft className="h-3.5 w-3.5" />
                Back to tracks
            </Link>
            <h1 className="mb-1 text-2xl font-bold tracking-tight sm:text-3xl">
                New track
            </h1>
            <p className="mb-6 text-sm text-muted-foreground">
                Submitted via{" "}
                <code className="font-mono text-xs">POST /api/admin/tracks</code>
            </p>
            <TrackCreateForm />
        </Container>
    )
}
