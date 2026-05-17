import Link from "next/link"
import { notFound } from "next/navigation"
import { ChevronLeft } from "lucide-react"
import { prisma } from "@/lib/prisma"
import { requireAdminPage } from "@/lib/admin-page-auth"
import { Container } from "@/components/ui/Container"
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
        <Container width="lg" className="py-10">
            <Link
                href="/admin/tracks"
                className="mb-4 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
                <ChevronLeft className="h-3.5 w-3.5" />
                Back to tracks
            </Link>
            <TrackEditor track={track} allProblems={problems} />
        </Container>
    )
}
