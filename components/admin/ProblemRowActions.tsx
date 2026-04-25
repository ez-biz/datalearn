"use client"

import { useRouter } from "next/navigation"
import Link from "next/link"
import { useState } from "react"
import { Pencil, Trash2, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/Button"

export function ProblemRowActions({
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
                `Delete "${title}"? This also removes all submissions for this problem. This cannot be undone.`
            )
        ) {
            return
        }
        setDeleting(true)
        try {
            const res = await fetch(`/api/admin/problems/${slug}`, {
                method: "DELETE",
            })
            if (!res.ok) {
                const err = await res.json().catch(() => ({}))
                alert(`Delete failed: ${err.error ?? res.statusText}`)
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
                href={`/admin/problems/${slug}/edit`}
                className="inline-flex items-center justify-center h-8 w-8 rounded-md text-muted-foreground hover:bg-surface-muted hover:text-foreground transition-colors"
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
