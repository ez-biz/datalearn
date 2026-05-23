import Link from "next/link"
import { ChevronLeft } from "lucide-react"
import { prisma } from "@/lib/prisma"
import { requireAdminPage } from "@/lib/admin-page-auth"
import { AdminListShell } from "@/components/admin/AdminListShell"
import { ArticleForm } from "@/components/admin/ArticleForm"

export const metadata = {
    title: "New article",
    robots: { index: false, follow: false },
}

export default async function NewArticlePage() {
    await requireAdminPage()

    // Pre-pick a topic if one exists
    const firstTopic = await prisma.topic.findFirst({
        orderBy: { name: "asc" },
        select: { slug: true },
    })

    return (
        <AdminListShell
            eyebrow="NEW ARTICLE"
            title="New article"
            description={
                <>
                    Submitted via{" "}
                    <code className="font-mono text-xs">POST /api/admin/articles</code>
                </>
            }
            actions={<BackLink href="/admin/articles" label="Back to articles" />}
        >
            <ArticleForm
                initial={{
                    mode: "create",
                    title: "",
                    slug: "",
                    topicSlug: firstTopic?.slug ?? "",
                    content: "",
                    summary: "",
                    status: "DRAFT",
                    tagSlugs: [],
                    relatedProblemSlugs: [],
                    reviewNotes: null,
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
