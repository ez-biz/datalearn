import { CalendarCheck2 } from "lucide-react"
import { redirect } from "next/navigation"
import { setManualDailyProblem, listDailyProblems, toDailyKey } from "@/actions/daily"
import { prisma } from "@/lib/prisma"
import { requireAdminPage } from "@/lib/admin-page-auth"
import { AdminListShell } from "@/components/admin/AdminListShell"
import { Card } from "@/components/ui/Card"
import { Button } from "@/components/ui/Button"
import { Field, Input } from "@/components/ui/Input"
import { DifficultyBadge } from "@/components/ui/Badge"
import { ScrollableTable } from "@/components/ui/ScrollableTable"
import { StatusPill } from "@/components/ui/StatusPill"

export const dynamic = "force-dynamic"

export const metadata = {
    title: "Daily Problems",
    robots: { index: false, follow: false },
}

async function saveDailyProblem(formData: FormData) {
    "use server"
    const dateKey = String(formData.get("dateKey") ?? "")
    const problemId = String(formData.get("problemId") ?? "")
    const result = await setManualDailyProblem({ dateKey, problemId })
    if (!result.ok) {
        redirect(`/admin/daily?error=${encodeURIComponent(result.error)}`)
    }
    redirect("/admin/daily?saved=1")
}

const updatedFormatter = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
    timeZoneName: "short",
})

export default async function AdminDailyPage({
    searchParams,
}: {
    searchParams: Promise<{ saved?: string; error?: string }>
}) {
    await requireAdminPage()

    const sp = await searchParams
    const [rows, problems] = await Promise.all([
        listDailyProblems(),
        prisma.sQLProblem.findMany({
            where: { status: "PUBLISHED" },
            orderBy: { number: "asc" },
            select: { id: true, number: true, title: true },
        }),
    ])
    const todayKey = toDailyKey(new Date())

    return (
        <AdminListShell
            eyebrow="DAILY"
            title="Daily problems"
            description={
                <>
                    Schedule a published problem for a UTC date. Missing dates auto-fill on first request.
                </>
            }
            actions={
                <span className="inline-flex h-10 items-center gap-2 rounded-md border border-border bg-surface px-3 text-sm text-muted-foreground">
                    <CalendarCheck2 className="h-4 w-4 text-primary" />
                    UTC schedule
                </span>
            }
        >

            <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
                <ScrollableTable>
                    <Card className="min-w-[720px] overflow-hidden">
                        <div className="hidden md:grid grid-cols-[8rem_1fr_7rem_10rem] gap-4 border-b border-border bg-surface-muted/40 px-5 py-3 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                            <span>Date</span>
                            <span>Problem</span>
                            <span>Source</span>
                            <span>Updated</span>
                        </div>
                        <ul className="divide-y divide-border">
                            {rows.map((row) => (
                                <li
                                    key={row.id}
                                    className="grid gap-3 px-5 py-3 md:grid-cols-[8rem_1fr_7rem_10rem] md:items-center"
                                >
                                    <span className="text-sm tabular-nums text-muted-foreground">
                                        {toDailyKey(row.date)}
                                    </span>
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm font-medium truncate">
                                                <span className="mr-1 font-mono text-[11px] text-muted-foreground tabular-nums">
                                                    #{String(row.problem.number).padStart(3, "0")}
                                                </span>
                                                {row.problem.title}
                                            </span>
                                            <DifficultyBadge difficulty={row.problem.difficulty} />
                                        </div>
                                    </div>
                                    <StatusPill
                                        status={
                                            row.source === "MANUAL"
                                                ? "accepted"
                                                : "draft"
                                        }
                                        label={row.source.toLowerCase()}
                                    />
                                    <span className="text-xs text-muted-foreground tabular-nums">
                                        {updatedFormatter.format(row.updatedAt)}
                                    </span>
                                </li>
                            ))}
                            {rows.length === 0 && (
                                <li className="px-5 py-10 text-center text-sm text-muted-foreground">
                                    No daily rows yet. Save a manual schedule or visit /daily to auto-fill today.
                                </li>
                            )}
                        </ul>
                    </Card>
                </ScrollableTable>

                <Card className="p-5">
                    {sp.saved === "1" && (
                        <div className="mb-4 rounded-md border border-easy/30 bg-easy/10 px-3 py-2 text-sm text-easy-fg">
                            Daily problem saved.
                        </div>
                    )}
                    {sp.error && (
                        <div className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                            {sp.error}
                        </div>
                    )}
                    <form action={saveDailyProblem} className="space-y-4">
                        <Field label="Date" htmlFor="dateKey" required>
                            <Input
                                id="dateKey"
                                name="dateKey"
                                type="date"
                                defaultValue={todayKey}
                                required
                            />
                        </Field>
                        <Field label="Published problem" htmlFor="problemId" required>
                            <select
                                id="problemId"
                                name="problemId"
                                required
                                className="block h-10 w-full rounded-md border border-border bg-surface px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            >
                                <option value="">Choose a problem</option>
                                {problems.map((p) => (
                                    <option key={p.id} value={p.id}>
                                        {p.number}. {p.title}
                                    </option>
                                ))}
                            </select>
                        </Field>
                        <Button type="submit" className="w-full">
                            Save manual daily
                        </Button>
                    </form>
                </Card>
            </div>
        </AdminListShell>
    )
}
