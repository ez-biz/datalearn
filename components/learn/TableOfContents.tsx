"use client"

import { useEffect, useState } from "react"
import type { TocEntry } from "@/lib/markdown-toc"
import { cn } from "@/lib/utils"

export function TableOfContents({ entries }: { entries: TocEntry[] }) {
    const [activeSlug, setActiveSlug] = useState<string | null>(null)
    const [progress, setProgress] = useState(0)

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
            { rootMargin: "-80px 0px -70% 0px", threshold: 0 }
        )
        for (const e of entries) {
            const el = document.getElementById(e.slug)
            if (el) observer.observe(el)
        }
        return () => observer.disconnect()
    }, [entries])

    // Reading progress through the article body. rAF-throttled; the fill width is
    // driven directly by scroll (no CSS transition) so it tracks the scrollbar 1:1.
    useEffect(() => {
        if (entries.length === 0) return
        const article = document.querySelector("article")
        if (!article) return
        let raf = 0
        const compute = () => {
            raf = 0
            const rect = article.getBoundingClientRect()
            const distance = article.offsetHeight - window.innerHeight
            const p = distance <= 0 ? 100 : (-rect.top / distance) * 100
            setProgress(Math.min(100, Math.max(0, Math.round(p))))
        }
        const onScroll = () => {
            if (!raf) raf = requestAnimationFrame(compute)
        }
        compute()
        window.addEventListener("scroll", onScroll, { passive: true })
        window.addEventListener("resize", onScroll)
        return () => {
            window.removeEventListener("scroll", onScroll)
            window.removeEventListener("resize", onScroll)
            if (raf) cancelAnimationFrame(raf)
        }
    }, [entries])

    if (entries.length === 0) return null

    return (
        <aside
            aria-label="Table of contents"
            className="hidden lg:block sticky top-24 self-start ml-8 w-56 shrink-0 max-h-[calc(100vh-8rem)] overflow-y-auto"
        >
            <div className="mb-3 flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    On this page
                </p>
                <span
                    className="text-xs tabular-nums text-muted-foreground"
                    aria-hidden
                >
                    {progress}%
                </span>
            </div>
            <div className="mb-4 h-0.5 rounded-full bg-border" aria-hidden>
                <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${progress}%` }}
                />
            </div>
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
