import Link from "next/link"
import { notFound } from "next/navigation"
import { ChevronLeft } from "lucide-react"
import { prisma } from "@/lib/prisma"
import { requireAdminPage } from "@/lib/admin-page-auth"
import { AdminListShell } from "@/components/admin/AdminListShell"
import { ContestForm } from "@/components/contests/admin/ContestForm"
import { ContestProblemsPicker } from "@/components/contests/admin/ContestProblemsPicker"

type Props = { params: Promise<{ id: string }> }

export const metadata = {
    title: "Edit contest",
    robots: { index: false, follow: false },
}
export const dynamic = "force-dynamic"

function toLocalInput(date: Date): string {
    const offsetMs = date.getTimezoneOffset() * 60_000
    return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16)
}

export default async function EditContestPage({ params }: Props) {
    await requireAdminPage()
    const { id } = await params
    const [contest, problems] = await Promise.all([
        prisma.contest.findUnique({
            where: { id },
            include: {
                problems: {
                    orderBy: { position: "asc" },
                    include: {
                        problem: {
                            select: {
                                id: true,
                                number: true,
                                slug: true,
                                title: true,
                                difficulty: true,
                            },
                        },
                    },
                },
            },
        }),
        prisma.sQLProblem.findMany({
            where: { status: "PUBLISHED" },
            orderBy: { number: "asc" },
            select: {
                id: true,
                number: true,
                slug: true,
                title: true,
                difficulty: true,
            },
        }),
    ])
    if (!contest) notFound()

    return (
        <AdminListShell
            eyebrow="EDIT CONTEST"
            title={contest.title}
            description={
                <code className="font-mono text-xs">
                    /contests/{contest.slug}
                </code>
            }
            actions={<BackLink href="/admin/contests" label="Back to contests" />}
        >
            <div className="space-y-6">
                <ContestForm
                    mode={{
                        kind: "edit",
                        id: contest.id,
                        initial: {
                            slug: contest.slug,
                            title: contest.title,
                            description: contest.description,
                            kind: contest.kind as "WEEKLY" | "BIWEEKLY" | "SPECIAL",
                            startsAt: toLocalInput(contest.startsAt),
                            endsAt: toLocalInput(contest.endsAt),
                            rated: contest.rated,
                            maxParticipants: contest.maxParticipants,
                        },
                    }}
                />
                <ContestProblemsPicker
                    contestId={contest.id}
                    attached={contest.problems.map((item) => ({
                        problemId: item.problemId,
                        position: item.position,
                        points: item.points,
                        problem: item.problem,
                    }))}
                    allProblems={problems}
                />
            </div>
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
