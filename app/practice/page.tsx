import type { Metadata } from "next"
import { getProblems } from "@/actions/problems"
import { getSolvedSlugs } from "@/actions/submissions"
import { Container } from "@/components/ui/Container"
import { PracticeList } from "@/components/practice/PracticeList"

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

    return (
        <Container width="lg" className="py-10 sm:py-14">
            <header className="mb-8 flex items-end justify-between gap-4 flex-wrap">
                <div>
                    <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
                        Problems
                    </h1>
                    <p className="mt-2 text-muted-foreground max-w-2xl">
                        Sharpen your SQL with curated problems across realistic schemas. Each
                        problem runs in your browser — no setup, instant feedback.
                    </p>
                </div>
                {list.length > 0 && (
                    <div className="text-sm text-muted-foreground tabular-nums">
                        <span className="text-foreground font-semibold">{solvedCount}</span>{" "}
                        / {list.length} solved
                    </div>
                )}
            </header>
            <PracticeList problems={list} solvedSlugs={solvedSlugs} />
        </Container>
    )
}
