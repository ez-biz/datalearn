// Shared workspace types.
//
// TableInfo lived in components/practice/ProblemPanel.tsx until SP5 split
// that file into per-tab components. It moved here rather than into one of
// the tabs because ProblemClient, the DuckDB introspection fallback and the
// description tab all need it, and none of them owns it.

export type TableInfo = {
    name: string
    columns: { name: string; type: string }[]
    sampleRows: Record<string, unknown>[]
}

export type RelatedArticle = {
    id: string
    slug: string
    title: string
    summary: string | null
    readingMinutes: number | null
    topic: { slug: string }
}

export type ProblemTab =
    | "description"
    | "hints"
    | "solutions"
    | "discussion"
    | "history"
