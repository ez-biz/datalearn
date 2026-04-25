import type { Metadata } from "next"
import { getProblems } from "@/actions/problems"
import { Container } from "@/components/ui/Container"
import { PracticeList } from "@/components/practice/PracticeList"

export const metadata: Metadata = {
    title: "Practice",
    description:
        "Browse SQL practice problems across e-commerce, HR, and SaaS schemas. Run queries in your browser and get instant validation.",
}

export default async function PracticePage() {
    const { data: problems } = await getProblems()

    return (
        <Container width="lg" className="py-10 sm:py-14">
            <header className="mb-8">
                <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
                    Problems
                </h1>
                <p className="mt-2 text-muted-foreground max-w-2xl">
                    Sharpen your SQL with curated problems across realistic schemas. Each
                    problem runs in your browser — no setup, instant feedback.
                </p>
            </header>
            <PracticeList problems={(problems ?? []) as any} />
        </Container>
    )
}
