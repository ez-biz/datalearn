"use client"

import Link from "next/link"
import { BookOpen } from "lucide-react"
import type { CheckpointContext } from "@/lib/workspace/queries"

/**
 * "Comes from" — the description tab's link back to the lesson that set this
 * problem as a checkpoint. Renders only when the problem has one.
 */
export function ComesFromCard({ context }: { context: CheckpointContext }) {
    return (
        <section className="rounded-md border border-border bg-surface-muted/40 p-3">
            <div className="mb-1.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                Comes from
            </div>
            <Link
                href={`/learn/tracks/${context.trackSlug}/${context.lessonSlug}`}
                className="inline-flex items-center gap-2 text-[13px] text-foreground transition-colors duration-150 hover:text-primary"
            >
                <BookOpen className="h-3.5 w-3.5 shrink-0" aria-hidden />
                {context.lessonTitle}
            </Link>
        </section>
    )
}
