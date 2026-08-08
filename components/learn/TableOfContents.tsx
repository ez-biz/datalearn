"use client"

import { useEffect, useState } from "react"
import type { TocEntry } from "@/lib/markdown-toc"
import { cn } from "@/lib/utils"

export function TableOfContents({ entries }: { entries: TocEntry[] }) {
    const [activeSlug, setActiveSlug] = useState<string | null>(null)

    useEffect(() => {
        if (entries.length === 0) return
        const observer = new IntersectionObserver(
            (intersections) => {
                // Pick the topmost intersecting heading
                const visible = intersections
                    .filter((e) => e.isIntersecting)
                    .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
                if (visible[0]) {
                    setActiveSlug(visible[0].target.id)
                }
            },
            // The top inset used to be -80px to clear the 64px sticky navbar.
            // The console shell has no top chrome — the sidebar is a left
            // column — so nothing overlays the top of the scroll port any
            // more. -24px matches this aside's own `top-6` offset, which is
            // where a heading visually reads as "current".
            { rootMargin: "-24px 0px -70% 0px", threshold: 0 }
        )
        for (const e of entries) {
            const el = document.getElementById(e.slug)
            if (el) observer.observe(el)
        }
        return () => observer.disconnect()
    }, [entries])

    if (entries.length === 0) return null

    return (
        <aside
            aria-label="Table of contents"
            className="hidden lg:block sticky top-6 self-start ml-8 w-56 shrink-0"
        >
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
                On this page
            </p>
            <ul className="space-y-1.5 text-sm">
                {entries.map((e) => (
                    <li
                        key={e.slug}
                        className={cn(e.level === 3 && "ml-3")}
                    >
                        <a
                            href={`#${e.slug}`}
                            className={cn(
                                "block py-0.5 transition-colors leading-snug",
                                activeSlug === e.slug
                                    ? "text-primary font-medium"
                                    : "text-muted-foreground hover:text-foreground"
                            )}
                        >
                            {e.text}
                        </a>
                    </li>
                ))}
            </ul>
        </aside>
    )
}
