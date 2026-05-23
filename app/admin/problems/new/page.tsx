import Link from "next/link"
import { ChevronLeft } from "lucide-react"
import { requireAdminPage } from "@/lib/admin-page-auth"
import { AdminListShell } from "@/components/admin/AdminListShell"
import { ProblemForm } from "@/components/admin/ProblemForm"

export const metadata = {
    title: "New problem",
    robots: { index: false, follow: false },
}

export default async function NewProblemPage() {
    await requireAdminPage()

    return (
        <AdminListShell
            eyebrow="NEW PROBLEM"
            title="New problem"
            description={
                <>
                    Submitted via{" "}
                    <code className="font-mono text-xs">POST /api/admin/problems</code>
                </>
            }
            actions={<BackLink href="/admin/problems" label="Back to problems" />}
        >
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
                    solutions: {},
                    expectedOutputs: {},
                    expectedOutput: "",
                    solutionSql: "",
                }}
            />
        </AdminListShell>
    )
}

function BackLink({ href, label }: { href: string; label: string }) {
    return (
        <Link
            href={href}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
            <ChevronLeft className="h-3.5 w-3.5" />
            {label}
        </Link>
    )
}
