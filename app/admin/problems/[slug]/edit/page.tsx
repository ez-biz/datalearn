import Link from "next/link"
import { ChevronLeft } from "lucide-react"
import { notFound } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { Container } from "@/components/ui/Container"
import { ProblemForm } from "@/components/admin/ProblemForm"

export const metadata = {
    title: "Edit problem",
    robots: { index: false, follow: false },
}

type Props = { params: Promise<{ slug: string }> }

export default async function EditProblemPage({ params }: Props) {
    const { slug } = await params
    const problem = await prisma.sQLProblem.findUnique({
        where: { slug },
        include: {
            tags: { select: { slug: true } },
        },
    })
    if (!problem) notFound()

    return (
        <Container width="lg" className="py-10">
            <Link
                href="/admin/problems"
                className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-4"
            >
                <ChevronLeft className="h-3.5 w-3.5" />
                Back to problems
            </Link>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mb-1">
                Edit · {problem.title}
            </h1>
            <p className="text-sm text-muted-foreground mb-6">
                Saved via{" "}
                <code className="font-mono text-xs">
                    PATCH /api/admin/problems/{problem.slug}
                </code>
            </p>
            <ProblemForm
                originalSlug={problem.slug}
                initial={{
                    mode: "edit",
                    title: problem.title,
                    slug: problem.slug,
                    difficulty: problem.difficulty,
                    description: problem.description,
                    schemaDescription: problem.schemaDescription,
                    ordered: problem.ordered,
                    hints: problem.hints,
                    tagSlugs: problem.tags.map((t) => t.slug),
                    schemaId: problem.schemaId,
                    expectedOutput: problem.expectedOutput,
                    solutionSql: problem.solutionSql ?? "",
                }}
            />
        </Container>
    )
}
