import Link from "next/link"
import { ChevronLeft } from "lucide-react"
import type { ArticleStatus } from "@prisma/client"
import { notFound } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { requireAdminPage } from "@/lib/admin-page-auth"
import { AdminListShell } from "@/components/admin/AdminListShell"
import { StatusPill, type StatusPillStatus } from "@/components/ui/StatusPill"
import { ArticleForm } from "@/components/admin/ArticleForm"

export const metadata = {
    title: "Edit article",
    robots: { index: false, follow: false },
}

type Props = { params: Promise<{ slug: string }> }

export default async function EditArticlePage({ params }: Props) {
    await requireAdminPage()

    const { slug } = await params
    const article = await prisma.article.findUnique({
        where: { slug },
        include: {
            topic: { select: { slug: true } },
            tags: { select: { slug: true } },
            relatedProblems: { select: { slug: true } },
        },
    })
    if (!article) notFound()

    return (
        <AdminListShell
            eyebrow="EDIT"
            title={article.title}
            description={
                <>
                    Saved via{" "}
                    <code className="font-mono text-xs">
                        PATCH /api/admin/articles/{article.slug}
                    </code>
                </>
            }
            actions={
                <div className="flex flex-wrap items-center gap-2">
                    <ArticleStatusPill status={article.status} />
                    <BackLink href="/admin/articles" label="Back to articles" />
                </div>
            }
        >
            <ArticleForm
                originalSlug={article.slug}
                initial={{
                    mode: "edit",
                    title: article.title,
                    slug: article.slug,
                    topicSlug: article.topic.slug,
                    content: article.content,
                    summary: article.summary ?? "",
                    status: article.status,
                    tagSlugs: article.tags.map((t) => t.slug),
                    relatedProblemSlugs: article.relatedProblems.map((p) => p.slug),
                    reviewNotes: article.reviewNotes,
                }}
            />
        </AdminListShell>
    )
}

function ArticleStatusPill({ status }: { status: ArticleStatus }) {
    const map: Record<ArticleStatus, { pill: StatusPillStatus; label: string }> = {
        DRAFT: { pill: "draft", label: "draft" },
        SUBMITTED: { pill: "pending", label: "review" },
        PUBLISHED: { pill: "accepted", label: "published" },
        ARCHIVED: { pill: "rejected", label: "archived" },
    }
    const { pill, label } = map[status]
    return <StatusPill status={pill} label={label} />
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
