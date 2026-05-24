import Link from "next/link"
import { Plus } from "lucide-react"
import { prisma } from "@/lib/prisma"
import { requireAdminPage } from "@/lib/admin-page-auth"
import { AdminListShell } from "@/components/admin/AdminListShell"
import { ContestStatusPill } from "@/components/contests/ContestStatusPill"
import { Badge } from "@/components/ui/Badge"
import { Card } from "@/components/ui/Card"
import { EmptyState } from "@/components/ui/EmptyState"
import { LinkButton } from "@/components/ui/Button"
import { ScrollableTable } from "@/components/ui/ScrollableTable"

export const metadata = {
    title: "Contests",
    robots: { index: false, follow: false },
}
export const dynamic = "force-dynamic"

export default async function AdminContestsPage() {
    await requireAdminPage()
    const rows = await prisma.contest.findMany({
        orderBy: [{ startsAt: "desc" }, { title: "asc" }],
        include: { _count: { select: { problems: true, registrations: true } } },
    })

    return (
        <AdminListShell
            eyebrow="CONTESTS"
            title="Contests"
            description={
                <>
                    {rows.length} total · managed via{" "}
                    <code className="font-mono text-xs">
                        /api/admin/contests
                    </code>
                </>
            }
            actions={
                <LinkButton href="/admin/contests/new" size="sm">
                    <Plus className="h-3.5 w-3.5" />
                    New contest
                </LinkButton>
            }
        >
            {rows.length === 0 ? (
                <EmptyState
                    title="No contests yet"
                    description="Create a contest and attach problems to lock them for a timed round."
                />
            ) : (
                <ScrollableTable>
                    <Card className="min-w-[800px] overflow-hidden">
                        <ul className="divide-y divide-border">
                            {rows.map((contest) => (
                                <li
                                    key={contest.id}
                                    className="flex items-center gap-4 px-5 py-4"
                                >
                                    <div className="min-w-0 flex-1">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <Link
                                                href={`/admin/contests/${contest.id}`}
                                                className="truncate font-medium hover:text-primary"
                                            >
                                                {contest.title}
                                            </Link>
                                            <ContestStatusPill
                                                status={contest.status}
                                            />
                                            <Badge variant="outline">
                                                {contest.kind.toLowerCase()}
                                            </Badge>
                                            <Badge
                                                variant={
                                                    contest.rated
                                                        ? "primary"
                                                        : "secondary"
                                                }
                                            >
                                                {contest.rated
                                                    ? "rated"
                                                    : "unrated"}
                                            </Badge>
                                        </div>
                                        <p className="mt-1 truncate font-mono text-xs text-muted-foreground">
                                            /contests/{contest.slug}
                                        </p>
                                    </div>
                                    <p className="text-xs tabular-nums text-muted-foreground">
                                        {contest._count.problems} problems
                                    </p>
                                    <p className="text-xs tabular-nums text-muted-foreground">
                                        {contest._count.registrations} registered
                                    </p>
                                    <p className="hidden text-xs tabular-nums text-muted-foreground md:block">
                                        {contest.startsAt.toLocaleString()}
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
