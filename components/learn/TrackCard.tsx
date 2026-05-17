import Link from "next/link"
import { ArrowRight, Clock, ListChecks, Route } from "lucide-react"
import type { PublicTrack } from "@/actions/tracks"
import { Badge } from "@/components/ui/Badge"
import { Card } from "@/components/ui/Card"

type TrackCardProps = {
    track: PublicTrack
}

export function TrackCard({ track }: TrackCardProps) {
    return (
        <Link
            href={`/learn/tracks/${track.slug}`}
            className="group block h-full"
        >
            <Card className="h-full overflow-hidden transition-[border-color,box-shadow,translate] duration-200 ease-out hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md">
                <TrackCover track={track} />
                <div className="p-5">
                    <div className="mb-3 flex flex-wrap items-center gap-2">
                        <TrackDifficultyBadge difficulty={track.difficulty} />
                        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground tabular-nums">
                            <ListChecks className="h-3.5 w-3.5" />
                            {track.itemCount}{" "}
                            {track.itemCount === 1 ? "problem" : "problems"}
                        </span>
                        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground tabular-nums">
                            <Clock className="h-3.5 w-3.5" />
                            {formatMinutes(track.estimatedMinutes)}
                        </span>
                    </div>
                    <h2 className="text-lg font-semibold tracking-tight transition-colors group-hover:text-primary">
                        {track.name}
                    </h2>
                    <p className="mt-2 line-clamp-3 text-sm leading-6 text-muted-foreground">
                        {track.summary}
                    </p>
                    <div className="mt-5 inline-flex items-center gap-1 text-sm font-medium text-primary">
                        Start track
                        <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                    </div>
                </div>
            </Card>
        </Link>
    )
}

export function TrackDifficultyBadge({
    difficulty,
}: {
    difficulty: PublicTrack["difficulty"]
}) {
    if (difficulty === "EASY") {
        return <Badge variant="easy">Easy</Badge>
    }
    if (difficulty === "MEDIUM") {
        return <Badge variant="medium">Medium</Badge>
    }
    if (difficulty === "HARD") {
        return <Badge variant="hard">Hard</Badge>
    }
    return <Badge variant="primary">Mixed</Badge>
}

function TrackCover({ track }: TrackCardProps) {
    if (track.coverImageUrl) {
        return (
            <div className="aspect-[16/9] overflow-hidden border-b border-border bg-surface-muted">
                <img
                    src={track.coverImageUrl}
                    alt=""
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                />
            </div>
        )
    }

    return (
        <div className="relative aspect-[16/9] overflow-hidden border-b border-border bg-surface-muted">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,hsl(var(--primary)/0.18),transparent_34%),linear-gradient(135deg,hsl(var(--surface-muted)),hsl(var(--surface)))]" />
            <div className="absolute left-5 top-5 flex h-11 w-11 items-center justify-center rounded-lg border border-border bg-background/80 text-primary shadow-sm backdrop-blur">
                <Route className="h-5 w-5" />
            </div>
            <div className="absolute bottom-4 left-5 right-5">
                <div className="h-1.5 rounded-full bg-background/70">
                    <div className="h-full w-2/3 rounded-full bg-primary/70" />
                </div>
            </div>
        </div>
    )
}

function formatMinutes(minutes: number) {
    if (minutes < 60) return `${minutes} min`
    const hours = Math.floor(minutes / 60)
    const remainder = minutes % 60
    if (remainder === 0) return `${hours} hr`
    return `${hours} hr ${remainder} min`
}
