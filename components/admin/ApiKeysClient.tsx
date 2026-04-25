"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Copy, Check, Loader2, Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/Button"
import { Field, Input } from "@/components/ui/Input"
import { Badge } from "@/components/ui/Badge"
import { EmptyState } from "@/components/ui/EmptyState"

interface KeyRow {
    id: string
    name: string
    prefix: string
    lastUsedAt: Date | string | null
    expiresAt: Date | string | null
    revokedAt: Date | string | null
    createdAt: Date | string
}

export function ApiKeysClient({ initialKeys }: { initialKeys: KeyRow[] }) {
    const router = useRouter()
    const [name, setName] = useState("")
    const [creating, setCreating] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [newKey, setNewKey] = useState<string | null>(null)
    const [copied, setCopied] = useState(false)
    const [revokingId, setRevokingId] = useState<string | null>(null)

    async function create() {
        setError(null)
        if (!name.trim()) {
            setError("Give the key a name first.")
            return
        }
        setCreating(true)
        try {
            const res = await fetch("/api/admin/api-keys", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: name.trim() }),
            })
            const json = await res.json().catch(() => ({}))
            if (!res.ok) {
                setError(json.error ?? "Failed to create key.")
                return
            }
            setNewKey(json.data.plaintext)
            setName("")
            router.refresh()
        } finally {
            setCreating(false)
        }
    }

    async function revoke(id: string, label: string) {
        if (!confirm(`Revoke "${label}"? Any client using it will be locked out.`)) {
            return
        }
        setRevokingId(id)
        try {
            const res = await fetch(`/api/admin/api-keys/${id}`, {
                method: "DELETE",
            })
            if (!res.ok) {
                const j = await res.json().catch(() => ({}))
                alert(`Failed: ${j.error ?? res.statusText}`)
                return
            }
            router.refresh()
        } finally {
            setRevokingId(null)
        }
    }

    async function copy(text: string) {
        await navigator.clipboard.writeText(text)
        setCopied(true)
        setTimeout(() => setCopied(false), 1500)
    }

    return (
        <div className="space-y-6">
            {newKey && (
                <div className="rounded-md border border-warning/40 bg-warning/5 p-4">
                    <p className="text-sm font-medium mb-2">
                        New API key — copy it now. It will not be shown again.
                    </p>
                    <div className="flex items-center gap-2">
                        <code className="flex-1 rounded bg-surface border border-border px-2.5 py-1.5 text-[12px] font-mono break-all">
                            {newKey}
                        </code>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => copy(newKey)}
                        >
                            {copied ? (
                                <Check className="h-3.5 w-3.5" />
                            ) : (
                                <Copy className="h-3.5 w-3.5" />
                            )}
                            {copied ? "Copied" : "Copy"}
                        </Button>
                    </div>
                    <button
                        type="button"
                        onClick={() => setNewKey(null)}
                        className="mt-3 text-xs text-muted-foreground hover:text-foreground cursor-pointer"
                    >
                        Dismiss (I&apos;ve saved it)
                    </button>
                </div>
            )}

            <div className="flex flex-col sm:flex-row sm:items-end gap-3">
                <div className="flex-1">
                    <Field label="Key name" htmlFor="keyName" description="Internal label — e.g. 'CI seeder', 'CLI'.">
                        <Input
                            id="keyName"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="CI seeder"
                            onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                    e.preventDefault()
                                    create()
                                }
                            }}
                        />
                    </Field>
                </div>
                <Button
                    type="button"
                    onClick={create}
                    disabled={creating || !name.trim()}
                >
                    {creating ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                        <Plus className="h-3.5 w-3.5" />
                    )}
                    Generate
                </Button>
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <div>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                    Existing keys
                </h3>
                {initialKeys.length === 0 ? (
                    <EmptyState
                        title="No API keys yet"
                        description="Generate one above to authenticate external clients."
                    />
                ) : (
                    <ul className="divide-y divide-border -mx-2">
                        {initialKeys.map((k) => (
                            <li
                                key={k.id}
                                className="flex items-center gap-3 px-2 py-3"
                            >
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className="text-sm font-medium truncate">
                                            {k.name}
                                        </span>
                                        {k.revokedAt ? (
                                            <Badge variant="secondary">Revoked</Badge>
                                        ) : k.expiresAt &&
                                          new Date(k.expiresAt) < new Date() ? (
                                            <Badge variant="secondary">Expired</Badge>
                                        ) : (
                                            <Badge variant="primary">Active</Badge>
                                        )}
                                    </div>
                                    <div className="mt-0.5 text-xs text-muted-foreground font-mono">
                                        {k.prefix}…
                                    </div>
                                    <div className="mt-0.5 text-xs text-muted-foreground">
                                        Created {fmt(k.createdAt)}
                                        {k.lastUsedAt && (
                                            <> · Last used {fmt(k.lastUsedAt)}</>
                                        )}
                                    </div>
                                </div>
                                {!k.revokedAt && (
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => revoke(k.id, k.name)}
                                        disabled={revokingId === k.id}
                                        aria-label={`Revoke ${k.name}`}
                                        className="text-muted-foreground hover:text-destructive"
                                    >
                                        {revokingId === k.id ? (
                                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                        ) : (
                                            <Trash2 className="h-3.5 w-3.5" />
                                        )}
                                    </Button>
                                )}
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
    )
}

function fmt(d: Date | string): string {
    const t = typeof d === "string" ? new Date(d) : d
    const diffMs = Date.now() - t.getTime()
    const sec = Math.round(diffMs / 1000)
    if (sec < 60) return `${sec}s ago`
    const min = Math.round(sec / 60)
    if (min < 60) return `${min}m ago`
    const hr = Math.round(min / 60)
    if (hr < 24) return `${hr}h ago`
    const day = Math.round(hr / 24)
    if (day < 30) return `${day}d ago`
    return t.toLocaleDateString()
}
