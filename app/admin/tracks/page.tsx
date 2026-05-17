import Link from "next/link"
import { Plus } from "lucide-react"
import { prisma } from "@/lib/prisma"
import { requireAdminPage } from "@/lib/admin-page-auth"
import { Container } from "@/components/ui/Container"
import { Card, CardContent } from "@/components/ui/Card"
import { Badge } from "@/components/ui/Badge"
import { EmptyState } from "@/components/ui/EmptyState"
import { LinkButton } from "@/components/ui/Button"

export const metadata = {
    title: "Tracks",
    robots: { index: false, follow: false },
}
export const dynamic = "force-dynamic"

function statusVariant(status: string): "secondary" | "primary" | "outline" {
    if (status === "PUBLISHED") return "primary"
    if (status === "ARCHIVED") return "outline"
    return "secondary"
}

export default async function TracksPage() {
    await requireAdminPage()

    const tracks = await prisma.track.findMany({
        orderBy: [{ createdAt: "desc" }, { name: "asc" }],
        include: { _count: { select: { items: true } } },
    })

    return (
        <Container width="lg" className="py-10">
            <header className="mb-6 flex items-start justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
                        Tracks
                    </h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                        {tracks.length} total · managed via{" "}
                        <code className="font-mono text-xs">
                            /api/admin/tracks
                        </code>
                    </p>
                </div>
                <LinkButton href="/admin/tracks/new" size="sm">
                    <Plus className="h-3.5 w-3.5" />
                    New track
                </LinkButton>
            </header>

            {tracks.length === 0 ? (
                <EmptyState
                    title="No tracks yet"
                    description="Create a track to start sequencing problems into a curriculum."
                />
            ) : (
                <Card>
                    <CardContent className="p-0">
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
                                            <Badge
                                                variant={statusVariant(
                                                    track.status,
                                                )}
                                            >
                                                {track.status.toLowerCase()}
                                            </Badge>
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
                    </CardContent>
                </Card>
            )}
        </Container>
    )
}
