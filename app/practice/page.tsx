import type { Metadata } from "next"
import Link from "next/link"
import { Route, Tag as TagIcon } from "lucide-react"
import { getProblems } from "@/actions/problems"
import { getSolvedSlugs } from "@/actions/submissions"
import { Container } from "@/components/ui/Container"
import { Eyebrow } from "@/components/ui/Eyebrow"
import { PracticeList } from "@/components/practice/PracticeList"
import { cn } from "@/lib/utils"

export const metadata: Metadata = {
    title: "Practice",
    description:
        "Browse SQL practice problems across e-commerce, HR, and SaaS schemas. Run queries in your browser and get instant validation.",
}

export default async function PracticePage() {
    const [{ data: problems }, solvedSlugs] = await Promise.all([
        getProblems(),
        getSolvedSlugs(),
    ])
    const list = (problems ?? []) as any[]
    const solvedCount = list.filter((p) => solvedSlugs.includes(p.slug)).length
    const difficultyCounts = list.reduce(
        (counts, problem) => {
            if (problem.difficulty === "EASY") counts.easy += 1
            if (problem.difficulty === "MEDIUM") counts.medium += 1
            if (problem.difficulty === "HARD") counts.hard += 1
            return counts
        },
        { easy: 0, medium: 0, hard: 0 }
    )

    return (
        <Container width="2xl" className="py-10 sm:py-14">
            <header className="mb-8 flex items-end justify-between gap-4 flex-wrap">
                <div>
                    <Eyebrow variant="bracket" className="mb-1">
                        CATALOG
                    </Eyebrow>
                    <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
                        Practice
                    </h1>
                    <p className="mt-2 text-muted-foreground max-w-2xl">
                        Sharpen your SQL with curated problems across realistic
                        schemas. Each problem runs in your browser — no setup,
                        instant feedback.
                    </p>
                    <div className="mt-5 grid grid-cols-2 gap-4 text-[12px] sm:grid-cols-4 sm:gap-6">
                        <CatalogStat
                            label="Solved"
                            value={solvedCount}
                            suffix={`/ ${list.length}`}
                        />
                        <CatalogStat
                            label="Easy"
                            value={difficultyCounts.easy}
                            className="text-easy"
                        />
                        <CatalogStat
                            label="Medium"
                            value={difficultyCounts.medium}
                            className="text-medium"
                        />
                        <CatalogStat
                            label="Hard"
                            value={difficultyCounts.hard}
                            className="text-hard"
                        />
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    <Link
                        href="/learn/tracks"
                        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
                    >
                        <Route className="h-3.5 w-3.5" />
                        Tracks
                    </Link>
                    <Link
                        href="/practice/tags"
                        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
                    >
                        <TagIcon className="h-3.5 w-3.5" />
                        Browse by tag
                    </Link>
                    {list.length > 0 && (
                        <div className="text-sm text-muted-foreground tabular-nums">
                            <span className="text-foreground font-semibold">
                                {solvedCount}
                            </span>{" "}
                            / {list.length} solved
                        </div>
                    )}
                </div>
            </header>
            <PracticeList problems={list} solvedSlugs={solvedSlugs} />
        </Container>
    )
}

function CatalogStat({
    label,
    value,
    suffix,
    className,
}: {
    label: string
    value: number
    suffix?: string
    className?: string
}) {
    return (
        <div>
            <Eyebrow>{label}</Eyebrow>
            <div className="mt-1 flex items-baseline gap-2">
                <span className={cn("text-[20px] font-semibold tabular-nums", className)}>
                    {value}
                </span>
                {suffix && (
                    <span className="font-mono text-[11px] text-muted-foreground">
                        {suffix}
                    </span>
                )}
            </div>
        </div>
    )
}
