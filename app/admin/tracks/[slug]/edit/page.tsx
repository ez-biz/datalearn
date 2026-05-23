import Link from "next/link"
import { notFound } from "next/navigation"
import { ChevronLeft } from "lucide-react"
import { prisma } from "@/lib/prisma"
import { requireAdminPage } from "@/lib/admin-page-auth"
import { AdminListShell } from "@/components/admin/AdminListShell"
import { TrackEditor } from "@/components/admin/TrackEditor"

export const metadata = {
    title: "Edit track",
    robots: { index: false, follow: false },
}
export const dynamic = "force-dynamic"

type PageProps = {
    params: Promise<{ slug: string }>
}

export default async function EditTrackPage({ params }: PageProps) {
    await requireAdminPage()
    const { slug } = await params

    const [track, problems] = await Promise.all([
        prisma.track.findUnique({
            where: { slug },
            include: {
                items: {
                    orderBy: { position: "asc" },
                    include: {
                        problem: {
                            select: {
                                id: true,
                                number: true,
                                slug: true,
                                title: true,
                                difficulty: true,
                                status: true,
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

    if (!track) notFound()

    return (
        <AdminListShell
            eyebrow="EDIT"
            title="Edit track"
            description={
                <>
                    Saved via{" "}
                    <code className="font-mono text-xs">
                        PATCH /api/admin/tracks/{track.slug}
                    </code>
                </>
            }
            actions={<BackLink href="/admin/tracks" label="Back to tracks" />}
        >
            <TrackEditor track={track} allProblems={problems} />
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
