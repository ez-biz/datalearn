import Link from "next/link"
import { ChevronLeft } from "lucide-react"
import { Container } from "@/components/ui/Container"
import { ProblemForm } from "@/components/admin/ProblemForm"

export const metadata = {
    title: "New problem",
    robots: { index: false, follow: false },
}

export default function NewProblemPage() {
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
                New problem
            </h1>
            <p className="text-sm text-muted-foreground mb-6">
                Submitted via{" "}
                <code className="font-mono text-xs">POST /api/admin/problems</code>
            </p>
            <ProblemForm
                initial={{
                    mode: "create",
                    title: "",
                    slug: "",
                    difficulty: "EASY",
                    status: "DRAFT",
                    description: "",
                    schemaDescription: "",
                    ordered: false,
                    dialects: ["DUCKDB", "POSTGRES"],
                    hints: [],
                    tagSlugs: [],
                    schemaId: undefined,
                    expectedOutput: "",
                    solutionSql: "",
                }}
            />
        </Container>
    )
}
