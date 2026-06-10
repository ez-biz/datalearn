import type { Metadata } from "next"
import { cache } from "react"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, Clock, ListChecks, Route } from "lucide-react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { getTrackBySlug, getTrackProgress } from "@/actions/tracks"
import { TrackDifficultyBadge } from "@/components/learn/TrackCard"
import { TrackItemRow } from "@/components/learn/TrackItemRow"
import { TrackProgressBar } from "@/components/learn/TrackProgressBar"
import { LinkButton } from "@/components/ui/Button"
import { Card } from "@/components/ui/Card"
import { Container } from "@/components/ui/Container"
import { EmptyState } from "@/components/ui/EmptyState"

type Props = {
    params: Promise<{ slug: string }>
}

export const dynamic = "force-dynamic"

// Dedup the track fetch across generateMetadata and the page render —
// both run in the same request and would otherwise hit the DB twice.
const getCachedTrack = cache(getTrackBySlug)

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { slug } = await params
    const track = await getCachedTrack(slug)
    if (!track) return { title: "Track not found" }

    return {
        title: track.name,
        description: track.summary,
    }
}

export default async function TrackDetailPage({ params }: Props) {
    const { slug } = await params
    const track = await getCachedTrack(slug)
    if (!track) notFound()

    const progress = await getTrackProgress(track.id)
    const completedItemIds = new Set(progress.completedItemIds)
    const nextItem = track.items.find((item) => item.id === progress.nextItemId)
    const reviewItem = track.items[0]
    const ctaItem = nextItem ?? reviewItem
    const ctaLabel =
        progress.totalCount === 0
            ? "No items yet"
            : progress.completedCount === 0
              ? "Start"
              : nextItem
                ? "Continue"
                : "Review"

    return (
        <Container width="lg" className="py-10 sm:py-14">
            <Link
                href="/learn/tracks"
                className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
                <ArrowLeft className="h-3.5 w-3.5" />
                All tracks
            </Link>

            <header className="mt-6 grid gap-6 lg:grid-cols-[1fr_20rem] lg:items-start">
                <div>
                    <div className="mb-4 flex flex-wrap items-center gap-2">
                        <TrackDifficultyBadge difficulty={track.difficulty} />
                        <span className="inline-flex items-center gap-1 text-sm text-muted-foreground tabular-nums">
                            <ListChecks className="h-4 w-4" />
                            {track.items.length}{" "}
                            {track.items.length === 1 ? "problem" : "problems"}
                        </span>
                        <span className="inline-flex items-center gap-1 text-sm text-muted-foreground tabular-nums">
                            <Clock className="h-4 w-4" />
                            {formatMinutes(track.estimatedMinutes)}
                        </span>
                    </div>
                    <h1 className="max-w-3xl text-3xl font-bold tracking-tight sm:text-4xl">
                        {track.name}
                    </h1>
                    <p className="mt-3 max-w-3xl text-lg leading-8 text-muted-foreground">
                        {track.summary}
                    </p>
                </div>

                <Card className="p-5">
                    <TrackProgressBar
                        completedCount={progress.completedCount}
                        totalCount={progress.totalCount}
                    />
                    {ctaItem ? (
                        <LinkButton
                            href={`/practice/${ctaItem.problem.slug}`}
                            className="mt-5 w-full"
                        >
                            <Route className="h-4 w-4" />
                            {ctaLabel}
                        </LinkButton>
                    ) : (
                        <div className="mt-5 rounded-md border border-border bg-surface-muted px-3 py-2 text-center text-sm text-muted-foreground">
                            {ctaLabel}
                        </div>
                    )}
                </Card>
            </header>

            {track.coverImageUrl && (
                <div className="mt-8 aspect-[21/9] overflow-hidden rounded-lg border border-border bg-surface-muted">
                    <img
                        src={track.coverImageUrl}
                        alt=""
                        className="h-full w-full object-cover"
                    />
                </div>
            )}

            <div className="mt-10 grid gap-8 lg:grid-cols-[1fr_20rem] lg:items-start">
                <main className="min-w-0">
                    <section className="prose prose-neutral max-w-none dark:prose-invert prose-headings:font-semibold prose-headings:tracking-tight prose-a:text-primary hover:prose-a:text-primary-hover">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {track.description}
                        </ReactMarkdown>
                    </section>

                    <section className="mt-8" aria-labelledby="track-items">
                        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
                            <div>
                                <h2
                                    id="track-items"
                                    className="text-xl font-semibold tracking-tight"
                                >
                                    Study sequence
                                </h2>
                                <p className="mt-1 text-sm text-muted-foreground">
                                    Work through the list in order, or jump into
                                    any problem when you want a specific drill.
                                </p>
                            </div>
                        </div>

                        {track.items.length === 0 ? (
                            <EmptyState
                                icon={<ListChecks className="h-5 w-5" />}
                                title="No problems in this track yet"
                                description="The track is published, but its item list is still being curated."
                            />
                        ) : (
                            <Card className="overflow-hidden">
                                {track.items.map((item) => (
                                    <TrackItemRow
                                        key={item.id}
                                        item={item}
                                        isCompleted={completedItemIds.has(
                                            item.id,
                                        )}
                                        isNext={item.id === progress.nextItemId}
                                    />
                                ))}
                            </Card>
                        )}
                    </section>
                </main>

                <aside className="lg:sticky lg:top-24">
                    <Card className="p-5">
                        <h2 className="font-semibold tracking-tight">
                            Track rhythm
                        </h2>
                        <p className="mt-2 text-sm leading-6 text-muted-foreground">
                            Complete accepted submissions to advance progress.
                            The next step always points to the first unsolved
                            item in the sequence.
                        </p>
                    </Card>
                </aside>
            </div>
        </Container>
    )
}

function formatMinutes(minutes: number) {
    if (minutes < 60) return `${minutes} min`
    const hours = Math.floor(minutes / 60)
    const remainder = minutes % 60
    if (remainder === 0) return `${hours} hr`
    return `${hours} hr ${remainder} min`
}
