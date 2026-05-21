"use client"

import { useEffect, useState } from "react"
import {
    Columns2,
    GitBranch,
    ImageUp,
    Info,
    ListOrdered,
    Plus,
    Trash2,
} from "lucide-react"
import { Button } from "@/components/ui/Button"

type UploadItem = {
    id: string
    blobUrl: string | null
    contentType: string
    bytes: number
}

const INSERT_ITEMS = [
    {
        label: "Mermaid diagram",
        icon: GitBranch,
        snippet: `\n:::mermaid{alt=""}\nflowchart LR\n  A --> B\n:::\n`,
    },
    {
        label: "Steps",
        icon: ListOrdered,
        snippet: `\n:::steps\n1. **First** body\n2. **Second** body\n3. **Third** body\n:::\n`,
    },
    {
        label: "Side-by-side",
        icon: Columns2,
        snippet: `\n:::side-by-side\n### Left\nleft body\n\n---\n\n### Right\nright body\n:::\n`,
    },
    {
        label: "Callout",
        icon: Info,
        snippet: `\n:::callout{kind="tip"}\nbody\n:::\n`,
    },
]

async function uploadViaPicker(): Promise<string | null> {
    return new Promise((resolve) => {
        const input = document.createElement("input")
        input.type = "file"
        input.accept = "image/svg+xml,image/png,image/jpeg,image/webp,image/gif"
        input.onchange = async () => {
            const file = input.files?.[0]
            if (!file) {
                resolve(null)
                return
            }
            const form = new FormData()
            form.append("file", file)
            const res = await fetch("/api/me/uploads", { method: "POST", body: form })
            if (!res.ok) {
                alert(`upload failed: ${res.status} ${await res.text()}`)
                resolve(null)
                return
            }
            const body = (await res.json()) as { url?: string }
            resolve(body.url ?? null)
        }
        input.click()
    })
}

export function InsertMenu({
    onInsert,
}: {
    onInsert: (snippet: string) => void
}) {
    const [open, setOpen] = useState(false)

    return (
        <div className="relative">
            <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setOpen((value) => !value)}
                className="h-8"
            >
                <Plus className="h-3.5 w-3.5" />
                Insert
            </Button>
            {open && (
                <div className="absolute right-0 z-20 mt-1 w-56 overflow-hidden rounded-md border border-border bg-surface shadow-md">
                    <button
                        type="button"
                        onClick={async () => {
                            setOpen(false)
                            const url = await uploadViaPicker()
                            if (url) {
                                onInsert(`\n:::figure{src="${url}" alt=""}\n\n:::\n`)
                            }
                        }}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-surface-muted"
                    >
                        <ImageUp className="h-3.5 w-3.5" />
                        Upload image
                    </button>
                    {INSERT_ITEMS.map((item) => {
                        const Icon = item.icon
                        return (
                            <button
                                key={item.label}
                                type="button"
                                onClick={() => {
                                    setOpen(false)
                                    onInsert(item.snippet)
                                }}
                                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-surface-muted"
                            >
                                <Icon className="h-3.5 w-3.5" />
                                {item.label}
                            </button>
                        )
                    })}
                </div>
            )}
        </div>
    )
}

export function MyUploadsPanel({
    onInsertUrl,
}: {
    onInsertUrl: (url: string) => void
}) {
    const [items, setItems] = useState<UploadItem[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        let cancelled = false
        ;(async () => {
            try {
                const res = await fetch("/api/me/uploads?limit=50")
                if (!res.ok) return
                const json = (await res.json()) as { items?: UploadItem[] }
                if (!cancelled) setItems(json.items ?? [])
            } finally {
                if (!cancelled) setLoading(false)
            }
        })()
        return () => {
            cancelled = true
        }
    }, [])

    return (
        <aside className="border-t border-border pt-4 lg:border-l lg:border-t-0 lg:pl-4 lg:pt-0">
            <div className="mb-3 flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold">My uploads</h3>
                {loading && (
                    <span className="text-xs text-muted-foreground">Loading</span>
                )}
            </div>
            {items.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                    Uploaded images will appear here.
                </p>
            ) : (
                <ul className="grid gap-2">
                    {items.map((item) => {
                        if (!item.blobUrl) return null
                        const name = safeFileName(item.blobUrl)
                        return (
                            <li
                                key={item.id}
                                className="rounded-md border border-border bg-surface p-2"
                            >
                                <div className="flex items-center gap-2">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img
                                        src={item.blobUrl}
                                        alt=""
                                        className="h-10 w-10 rounded object-cover"
                                    />
                                    <div className="min-w-0 flex-1">
                                        <div className="truncate font-mono text-[11px]">
                                            {name}
                                        </div>
                                        <div className="text-[11px] text-muted-foreground">
                                            {item.contentType} |{" "}
                                            {(item.bytes / 1024).toFixed(1)} KB
                                        </div>
                                    </div>
                                </div>
                                <div className="mt-2 flex items-center gap-2">
                                    <Button
                                        type="button"
                                        size="sm"
                                        className="h-7 px-2 text-xs"
                                        onClick={() => onInsertUrl(item.blobUrl!)}
                                    >
                                        Insert
                                    </Button>
                                    <Button
                                        type="button"
                                        size="sm"
                                        variant="outline"
                                        className="h-7 px-2 text-xs"
                                        onClick={async () => {
                                            const res = await fetch(
                                                `/api/me/uploads/${item.id}`,
                                                { method: "DELETE" }
                                            )
                                            if (res.status === 409) {
                                                const body = (await res.json()) as {
                                                    articles?: { slug: string }[]
                                                }
                                                alert(
                                                    `In use by: ${(
                                                        body.articles ?? []
                                                    )
                                                        .map((article) => article.slug)
                                                        .join(", ")}`
                                                )
                                                return
                                            }
                                            if (res.status === 204) {
                                                setItems((current) =>
                                                    current.filter(
                                                        (x) => x.id !== item.id
                                                    )
                                                )
                                            }
                                        }}
                                    >
                                        <Trash2 className="h-3 w-3" />
                                        Delete
                                    </Button>
                                </div>
                            </li>
                        )
                    })}
                </ul>
            )}
        </aside>
    )
}

function safeFileName(url: string): string {
    try {
        return new URL(url).pathname.split("/").pop() ?? url
    } catch {
        return url
    }
}
