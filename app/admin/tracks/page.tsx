import Link from "next/link"
import { Plus } from "lucide-react"
import type { TrackStatus } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { requireAdminPage } from "@/lib/admin-page-auth"
import { AdminListShell } from "@/components/admin/AdminListShell"
import { Card } from "@/components/ui/Card"
import { Badge } from "@/components/ui/Badge"
import { EmptyState } from "@/components/ui/EmptyState"
import { LinkButton } from "@/components/ui/Button"
import { ScrollableTable } from "@/components/ui/ScrollableTable"
import { StatusPill, type StatusPillStatus } from "@/components/ui/StatusPill"

export const metadata = {
    title: "Tracks",
    robots: { index: false, follow: false },
}
export const dynamic = "force-dynamic"

export default async function TracksPage() {
    await requireAdminPage()

    const tracks = await prisma.track.findMany({
        orderBy: [{ createdAt: "desc" }, { name: "asc" }],
        include: { _count: { select: { items: true } } },
    })

    return (
        <AdminListShell
            eyebrow="TRACKS"
            title="Tracks"
            description={
                <>
                    {tracks.length} total · managed via{" "}
                    <code className="font-mono text-xs">
                        /api/admin/tracks
                    </code>
                </>
            }
            actions={
                <LinkButton href="/admin/tracks/new" size="sm">
                    <Plus className="h-3.5 w-3.5" />
                    New track
                </LinkButton>
            }
        >

            {tracks.length === 0 ? (
                <EmptyState
                    title="No tracks yet"
                    description="Create a track to start sequencing problems into a curriculum."
                />
            ) : (
                <ScrollableTable>
                    <Card className="min-w-[760px] overflow-hidden">
                        <ul className="divide-y divide-border">
                            {tracks.map((track) => (
                                <li
                                    key={track.id}
                                    className="flex items-center gap-4 px-5 py-4"
                                >
                                    <div className="min-w-0 flex-1">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <Link
                                                href={`/admin/tracks/${track.slug}/edit`}
                                                className="truncate font-medium hover:text-primary"
                                            >
                                                {track.name}
                                            </Link>
                                            <TrackStatusPill status={track.status} />
                                            <Badge variant="secondary">
                                                {track._count.items}{" "}
                                                {track._count.items === 1
                                                    ? "item"
                                                    : "items"}
                                            </Badge>
                                            <Badge variant="outline">
                                                {track.difficulty.toLowerCase()}
                                            </Badge>
                                        </div>
                                        <p className="mt-1 truncate font-mono text-xs text-muted-foreground">
                                            /{track.slug}
                                        </p>
                                        <p className="mt-1 line-clamp-1 text-sm text-muted-foreground">
                                            {track.summary}
                                        </p>
                                    </div>
                                    <p className="hidden shrink-0 text-xs tabular-nums text-muted-foreground sm:block">
                                        {track.estimatedMinutes} min
                                    </p>
                                </li>
                            ))}
                        </ul>
                    </Card>
                </ScrollableTable>
            )}
        </AdminListShell>
    )
}

function TrackStatusPill({ status }: { status: TrackStatus }) {
    const map: Record<TrackStatus, { pill: StatusPillStatus; label: string }> = {
        DRAFT: { pill: "draft", label: "draft" },
        PUBLISHED: { pill: "accepted", label: "published" },
        ARCHIVED: { pill: "rejected", label: "archived" },
    }
    const { pill, label } = map[status]
    return <StatusPill status={pill} label={label} />
}
