"use client"

import dynamic from "next/dynamic"
import { validateSubmission } from "@/actions/submissions"
import type { ValidationResult } from "@/lib/sql-validator"

const SqlPlayground = dynamic(
    () =>
        import("@/components/sql/SqlPlayground").then((mod) => mod.SqlPlayground),
    { ssr: false }
)

interface ProblemWorkspaceProps {
    initialSql: string | undefined
    schemaSql: string | undefined
    problemSlug: string
}

export function ProblemWorkspace({
    initialSql,
    schemaSql,
    problemSlug,
}: ProblemWorkspaceProps) {
    async function handleSubmit(userResult: unknown[]): Promise<ValidationResult> {
        return await validateSubmission({ problemSlug, userResult })
    }

    return (
        <SqlPlayground
            initialSchema={schemaSql}
            initialQuery={initialSql}
            problemSlug={problemSlug}
            onSubmit={handleSubmit}
        />
    )
}
