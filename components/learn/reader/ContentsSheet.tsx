"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { ArrowRight, List, X } from "lucide-react"
import type { TocEntry } from "@/lib/markdown-toc"

interface ContentsSheetProps {
    toc: TocEntry[]
    nextHref: string | null
}

/**
 * The mobile sticky footer and its contents sheet. Below `lg` the console
 * tab bar is suppressed (this is a focus route), so the footer sits at the
 * true viewport bottom with no offset to clear.
 */
export function ContentsSheet({ toc, nextHref }: ContentsSheetProps) {
    const [open, setOpen] = useState(false)
    const triggerRef = useRef<HTMLButtonElement>(null)

    // Registered only while the sheet is open, torn down the moment it
    // isn't — via whichever path got it there (X button, backdrop,
    // Escape, or a TOC link). The cleanup also returns focus to the
    // trigger: this is a disclosure, not a modal (see the `role="region"`
    // below), so there's no focus trap to release, but a keyboard user who
    // opened the sheet should not be dumped at the top of the document
    // when it closes.
    useEffect(() => {
        if (!open) return
        function onKeyDown(event: KeyboardEvent) {
            if (event.key === "Escape") setOpen(false)
        }
        document.addEventListener("keydown", onKeyDown)
        return () => {
            document.removeEventListener("keydown", onKeyDown)
            triggerRef.current?.focus()
        }
    }, [open])

    return (
        <>
            <div className="fixed inset-x-0 bottom-0 z-40 flex gap-2 border-t border-line bg-panel p-2 lg:hidden print:hidden">
                <button
                    ref={triggerRef}
                    type="button"
                    onClick={() => setOpen(true)}
                    disabled={toc.length === 0}
                    aria-expanded={open}
                    className="inline-flex h-11 flex-1 items-center justify-center gap-1.5 rounded-md border border-line-strong text-sm text-foreground disabled:opacity-40"
                >
                    <List aria-hidden="true" className="size-4" />
                    Contents
                </button>
                {nextHref && (
                    <Link
                        href={nextHref}
                        className="inline-flex h-11 flex-1 items-center justify-center gap-1.5 rounded-md bg-primary text-sm font-medium text-primary-foreground"
                    >
                        Next lesson
                        <ArrowRight aria-hidden="true" className="size-4" />
                    </Link>
                )}
            </div>

            {open && (
                <div className="fixed inset-0 z-50 lg:hidden">
                    <button
                        type="button"
                        aria-label="Close contents"
                        onClick={() => setOpen(false)}
                        className="absolute inset-0 bg-canvas-deep/70"
                    />
                    <div
                        role="region"
                        aria-label="Contents"
                        className="absolute inset-x-0 bottom-0 max-h-[70vh] overflow-y-auto rounded-t-xl border-t border-line bg-panel-raised p-4"
                    >
                        <div className="mb-3 flex items-center justify-between">
                            <h2 className="font-mono text-[10px] uppercase tracking-wider text-text-muted">
                                Contents
                            </h2>
                            <button
                                type="button"
                                onClick={() => setOpen(false)}
                                aria-label="Close contents"
                                className="-mr-2 flex size-11 items-center justify-center text-text-muted"
                            >
                                <X aria-hidden="true" className="size-4" />
                            </button>
                        </div>
                        <ul>
                            {toc.map((entry) => (
                                <li key={entry.slug}>
                                    <a
                                        href={`#${entry.slug}`}
                                        onClick={() => setOpen(false)}
                                        className={`block min-h-11 py-2.5 text-sm text-text-3 ${
                                            entry.level === 3 ? "pl-4" : ""
                                        }`}
                                    >
                                        {entry.text}
                                    </a>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
            )}
        </>
    )
}
