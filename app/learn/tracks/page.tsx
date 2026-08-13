import type { Metadata } from "next"
import Link from "next/link"
import { ArrowLeft, Route } from "lucide-react"
import { auth } from "@/lib/auth"
import { getTrackSummariesForUser } from "@/lib/learn/tracks-read"
import { TrackSummaryCard } from "@/components/learn/tracks/TrackSummaryCard"
import { Container } from "@/components/ui/Container"
import { Eyebrow } from "@/components/ui/Eyebrow"
import { EmptyState } from "@/components/ui/EmptyState"

export const metadata: Metadata = {
    title: "SQL learning tracks",
    description:
        "Follow curated SQL study plans that sequence practice problems around interview-ready skills.",
}
export const dynamic = "force-dynamic"

export default async function TracksIndexPage() {
    const session = await auth().catch(() => null)
    const userId = session?.user?.id ?? null
    // Same ADMIN/MODERATOR staff gate as app/practice/[slug]/page.tsx and the
    // module screen: staff preview DRAFT tracks, learners never see them.
    const isStaff =
        session?.user?.role === "ADMIN" || session?.user?.role === "MODERATOR"
    const tracks = await getTrackSummariesForUser(userId, isStaff)

    return (
        <Container width="2xl" className="py-10 sm:py-14">
            <header className="mb-8">
                <Link
                    href="/learn"
                    className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
                >
                    <ArrowLeft className="h-3.5 w-3.5" />
                    Learning hub
                </Link>
                <Eyebrow variant="bracket" className="mt-4 mb-1">
                    TRACKS
                </Eyebrow>
                <div className="flex flex-wrap items-end justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
                            Tracks
                        </h1>
                        <p className="mt-2 max-w-2xl text-muted-foreground">
                            Opinionated study paths that turn the problem
                            catalog into a focused sequence.
                        </p>
                    </div>
                    {tracks.length > 0 && (
                        <div className="rounded-md border border-border bg-surface px-3 py-2 text-sm text-muted-foreground tabular-nums">
                            <span className="font-semibold text-foreground">
                                {tracks.length}
                            </span>{" "}
                            {tracks.length === 1 ? "track" : "tracks"}
                        </div>
                    )}
                </div>
            </header>

            {tracks.length === 0 ? (
                <EmptyState
                    icon={<Route className="h-5 w-5" />}
                    title="No tracks yet"
                    description="Curated SQL study plans will appear here once they are published."
                />
            ) : (
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {tracks.map((track, index) => (
                        <TrackSummaryCard
                            key={track.slug}
                            track={track}
                            index={index}
                        />
                    ))}
                </div>
            )}
        </Container>
    )
}
