"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { Loader2, Pencil, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/Button"

export function TopicRowActions({
    slug,
    name,
    articleCount,
}: {
    slug: string
    name: string
    articleCount: number
}) {
    const router = useRouter()
    const [deleting, setDeleting] = useState(false)

    async function handleDelete() {
        if (articleCount > 0) {
            alert(
                `Topic "${name}" has ${articleCount} article${
                    articleCount === 1 ? "" : "s"
                }. Move or delete them first.`
            )
            return
        }
        if (!confirm(`Delete topic "${name}"? This cannot be undone.`)) return
        setDeleting(true)
        try {
            const res = await fetch(`/api/admin/topics/${slug}`, {
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
        <div className="flex items-center gap-1">
            <Link
                href={`/admin/topics/${slug}/edit`}
                className="inline-flex items-center justify-center h-8 w-8 rounded-md text-muted-foreground hover:bg-surface-muted hover:text-foreground"
                aria-label={`Edit ${name}`}
            >
                <Pencil className="h-3.5 w-3.5" />
            </Link>
            <Button
                variant="ghost"
                size="icon"
                onClick={handleDelete}
                disabled={deleting}
                aria-label={`Delete ${name}`}
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
