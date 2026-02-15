"use client"

import dynamic from "next/dynamic"

const SqlPlayground = dynamic(
    () => import("@/components/sql/SqlPlayground").then(mod => mod.SqlPlayground),
    { ssr: false }
)

interface ProblemWorkspaceProps {
    initialSql: string | undefined
    schemaSql: string | undefined
    expectedOutput: string | undefined
}

export function ProblemWorkspace({ initialSql, schemaSql, expectedOutput }: ProblemWorkspaceProps) {
    return (
        <SqlPlayground
            initialSchema={schemaSql}
        />
    )
}
