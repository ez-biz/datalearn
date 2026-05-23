import Link from "next/link"
import { notFound } from "next/navigation"
import { ChevronLeft } from "lucide-react"
import { prisma } from "@/lib/prisma"
import { requireAdminPage } from "@/lib/admin-page-auth"
import { AdminListShell } from "@/components/admin/AdminListShell"
import { TopicEditForm } from "@/components/admin/TopicEditForm"

export const metadata = {
    title: "Edit topic",
    robots: { index: false, follow: false },
}

type Props = { params: Promise<{ slug: string }> }

export default async function EditTopicPage({ params }: Props) {
    await requireAdminPage()

    const { slug } = await params
    const topic = await prisma.topic.findUnique({ where: { slug } })
    if (!topic) notFound()

    return (
        <AdminListShell
            eyebrow="EDIT TOPIC"
            title={topic.name}
            description={
                <>
                    Saved via{" "}
                    <code className="font-mono text-xs">
                        PATCH /api/admin/topics/{topic.slug}
                    </code>
                </>
            }
            actions={<BackLink href="/admin/topics" label="Back to topics" />}
        >
            <TopicEditForm
                originalSlug={topic.slug}
                initial={{
                    name: topic.name,
                    slug: topic.slug,
                    description: topic.description ?? "",
                    lane: topic.lane,
                    displayOrder: topic.displayOrder,
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
