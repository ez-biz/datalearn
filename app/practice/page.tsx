import type { Metadata } from "next"
import { auth } from "@/lib/auth"
import { getCatalogProblems } from "@/lib/practice/catalog-read"
import { Container } from "@/components/ui/Container"
import { Eyebrow } from "@/components/ui/Eyebrow"
import { CatalogClient } from "@/components/practice/catalog/CatalogClient"
import { cn } from "@/lib/utils"

export const metadata: Metadata = {
    title: "Practice",
    description:
        "Browse SQL practice problems across e-commerce, HR, and SaaS schemas. Run queries in your browser and get instant validation.",
}

export default async function PracticePage() {
    const session = await auth()
    // Staff see problems from DRAFT curriculum tracks so an unpublished
    // module can be reviewed from the catalog; learners get those problems
    // in the "not in a track" bucket instead. Same rule the workspace panel
    // and the lesson reader use.
    const isStaff =
        session?.user?.role === "ADMIN" || session?.user?.role === "MODERATOR"
    const problems = await getCatalogProblems(session?.user?.id ?? null, isStaff)

    const solvedCount = problems.filter((p) => p.solved).length
    // "Attempted" here means the facet rail's `attempted` status — tried,
    // not yet accepted — not the raw `attempted` field, which stays true
    // for a problem after it's solved. Keeps this stat and the Status
    // facet's counts telling the same story.
    const attemptedCount = problems.filter((p) => p.attempted && !p.solved).length
    const pctOfCatalog =
        problems.length > 0 ? Math.round((solvedCount / problems.length) * 100) : 0

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
                    <p className="mt-2 max-w-2xl text-text-muted">
                        Sharpen your SQL with curated problems across realistic
                        schemas. Each problem runs in your browser — no setup,
                        instant feedback.
                    </p>
                </div>
                <div className="grid grid-cols-3 gap-6 text-[12px]">
                    <CatalogStat
                        label="Solved"
                        value={solvedCount}
                        suffix={`/ ${problems.length}`}
                        className="text-primary"
                    />
                    <CatalogStat label="Attempted" value={attemptedCount} />
                    <CatalogStat
                        label="% of catalog"
                        value={`${pctOfCatalog}%`}
                        className="text-warning"
                    />
                </div>
            </header>
            <CatalogClient problems={problems} />
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
    value: number | string
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
                    <span className="font-mono text-[11px] text-text-dim">{suffix}</span>
                )}
            </div>
        </div>
    )
}
