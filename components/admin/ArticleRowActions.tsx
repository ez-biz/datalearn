"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { Loader2, Pencil, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/Button"

export function ArticleRowActions({
    slug,
    title,
}: {
    slug: string
    title: string
}) {
    const router = useRouter()
    const [deleting, setDeleting] = useState(false)

    async function handleDelete() {
        if (
            !confirm(
                `Delete "${title}"? This also removes all version snapshots. Cannot be undone.`
            )
        ) {
            return
        }
        setDeleting(true)
        try {
            const res = await fetch(`/api/admin/articles/${slug}`, {
                method: "DELETE",
            })
            if (!res.ok) {
                const j = await res.json().catch(() => ({}))
                alert(`Delete failed: ${j.error ?? res.statusText}`)
                return
            }
            router.refresh()
        } finally {
            setDeleting(false)
        }
    }

    return (
        <div className="flex items-center justify-end gap-1">
            <Link
                href={`/admin/articles/${slug}/edit`}
                className="inline-flex items-center justify-center h-8 w-8 rounded-md text-muted-foreground hover:bg-surface-muted hover:text-foreground"
                aria-label={`Edit ${title}`}
            >
                <Pencil className="h-3.5 w-3.5" />
            </Link>
            <Button
                variant="ghost"
                size="icon"
                onClick={handleDelete}
                disabled={deleting}
                aria-label={`Delete ${title}`}
                className="h-8 w-8 text-muted-foreground hover:text-destructive"
            >
                {deleting ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                    <Trash2 className="h-3.5 w-3.5" />
                )}
            </Button>
        </div>
    )
}
