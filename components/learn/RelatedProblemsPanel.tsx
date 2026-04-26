import Link from "next/link"
import { ArrowRight, Code2 } from "lucide-react"
import { Card } from "@/components/ui/Card"
import { DifficultyBadge } from "@/components/ui/Badge"

interface RelatedProblem {
    id: string
    slug: string
    title: string
    difficulty: "EASY" | "MEDIUM" | "HARD"
    description: string | null
}

export function RelatedProblemsPanel({
    problems,
}: {
    problems: RelatedProblem[]
}) {
    if (problems.length === 0) return null
    return (
        <section className="mt-10">
            <header className="flex items-center gap-2 mb-3">
                <Code2 className="h-4 w-4 text-primary" />
                <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                    Practice this
                </h2>
            </header>
            <Card className="overflow-hidden divide-y divide-border">
                {problems.map((p) => (
                    <Link
                        key={p.id}
                        href={`/practice/${p.slug}`}
                        className="flex items-center gap-4 p-4 hover:bg-surface-muted/60 transition-colors group"
                    >
                        <div className="flex-1 min-w-0">
                            <h3 className="font-medium text-foreground group-hover:text-primary transition-colors truncate">
                                {p.title}
                            </h3>
                            {p.description && (
                                <p className="text-sm text-muted-foreground line-clamp-1 mt-0.5">
                                    {p.description}
                                </p>
                            )}
                        </div>
                        <DifficultyBadge difficulty={p.difficulty} />
                        <ArrowRight className="hidden sm:block h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-[color,translate] duration-150" />
                    </Link>
                ))}
            </Card>
        </section>
    )
}
