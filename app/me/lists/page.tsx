import Link from "next/link"
import { redirect } from "next/navigation"
import { ArrowRight, ListPlus } from "lucide-react"
import { auth } from "@/lib/auth"
import { Container } from "@/components/ui/Container"
import { Card } from "@/components/ui/Card"
import { EmptyState } from "@/components/ui/EmptyState"
import { getMyLists } from "@/actions/lists"
import { CreateListButton } from "@/components/lists/CreateListButton"

export const dynamic = "force-dynamic"

export const metadata = {
    title: "My lists",
    description: "Private problem collections you've curated.",
}

function formatRelative(date: Date): string {
    const diff = Date.now() - date.getTime()
    const minutes = Math.round(diff / 60_000)
    if (minutes < 1) return "just now"
    if (minutes < 60) return `${minutes}m ago`
    const hours = Math.round(minutes / 60)
    if (hours < 24) return `${hours}h ago`
    const days = Math.round(hours / 24)
    if (days < 30) return `${days}d ago`
    return date.toLocaleDateString(undefined, { month: "short", day: "numeric" })
}

export default async function MyListsPage() {
    const session = await auth()
    if (!session?.user?.id) redirect("/api/auth/signin?callbackUrl=/me/lists")

    const lists = await getMyLists()

    return (
        <Container width="lg" className="py-10">
            <header className="flex items-end justify-between mb-6 gap-4 flex-wrap">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
                        My lists
                    </h1>
                    <p className="mt-1 text-sm text-muted-foreground max-w-prose">
                        Private collections you curate. Use them to track problems
                        you want to redo, group by topic, or build your own
                        interview-prep playlist.
                    </p>
                </div>
                <CreateListButton />
            </header>

            {lists.length === 0 ? (
                <EmptyState
                    icon={<ListPlus className="h-5 w-5" />}
                    title="No lists yet"
                    description="Create your first list to start curating problems."
                    action={<CreateListButton size="sm" />}
                />
            ) : (
                <Card className="overflow-hidden">
                    <ul className="divide-y divide-border">
                        {lists.map((l) => (
                            <li key={l.id}>
                                <Link
                                    href={`/me/lists/${l.id}`}
                                    className="grid grid-cols-[1fr_auto] sm:grid-cols-[1fr_6rem_6rem_2rem] items-center gap-4 px-5 py-4 hover:bg-surface-muted/60 transition-colors group"
                                >
                                    <div className="min-w-0">
                                        <h3 className="font-medium truncate group-hover:text-primary transition-colors">
                                            {l.name}
                                        </h3>
                                        {l.description && (
                                            <p className="text-sm text-muted-foreground line-clamp-1 mt-0.5">
                                                {l.description}
                                            </p>
                                        )}
                                    </div>
                                    <span className="hidden sm:inline text-xs tabular-nums text-muted-foreground">
                                        {l.itemCount}{" "}
                                        {l.itemCount === 1 ? "problem" : "problems"}
                                    </span>
                                    <span className="hidden sm:inline text-xs tabular-nums text-muted-foreground">
                                        {formatRelative(l.updatedAt)}
                                    </span>
                                    <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-[color,translate] duration-150" />
                                </Link>
                            </li>
                        ))}
                    </ul>
                </Card>
            )}
        </Container>
    )
}
