"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import Link from "next/link"
import { Loader2, Search, ShieldCheck, ShieldOff, UserPlus } from "lucide-react"
import { Badge } from "@/components/ui/Badge"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { EmptyState } from "@/components/ui/EmptyState"
import { cn } from "@/lib/utils"

interface UserRow {
    id: string
    email: string | null
    name: string | null
    image: string | null
    role: "USER" | "CONTRIBUTOR" | "MODERATOR" | "ADMIN"
    createdAt: Date | string
    _count: { articles: number }
}

type FilterRole = "ALL" | "USER" | "CONTRIBUTOR" | "MODERATOR" | "ADMIN"

const FILTERS: { value: FilterRole; label: string }[] = [
    { value: "ALL", label: "All" },
    { value: "ADMIN", label: "Admins" },
    { value: "MODERATOR", label: "Moderators" },
    { value: "CONTRIBUTOR", label: "Contributors" },
    { value: "USER", label: "Users" },
]

export function ContributorsClient({ initialUsers }: { initialUsers: UserRow[] }) {
    const router = useRouter()
    const [users, setUsers] = useState(initialUsers)
    const [filter, setFilter] = useState<FilterRole>("ALL")
    const [query, setQuery] = useState("")
    const [pendingId, setPendingId] = useState<string | null>(null)
    const [error, setError] = useState<string | null>(null)

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase()
        return users.filter((u) => {
            if (filter !== "ALL" && u.role !== filter) return false
            if (!q) return true
            return (
                u.email?.toLowerCase().includes(q) ||
                u.name?.toLowerCase().includes(q)
            )
        })
    }, [users, filter, query])

    async function changeRole(
        userId: string,
        newRole: "USER" | "CONTRIBUTOR"
    ) {
        setError(null)
        setPendingId(userId)
        try {
            const res = await fetch(`/api/admin/users/${userId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ role: newRole }),
            })
            const json = await res.json().catch(() => ({}))
            if (!res.ok) {
                setError(json.error ?? `Request failed: ${res.status}`)
                return
            }
            setUsers((cur) =>
                cur.map((u) => (u.id === userId ? { ...u, role: newRole } : u))
            )
            router.refresh()
        } finally {
            setPendingId(null)
        }
    }

    return (
        <div className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        type="search"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Search by email or name…"
                        className="pl-9"
                    />
                </div>
                <div className="flex items-center gap-1 rounded-md border border-border bg-surface p-1">
                    {FILTERS.map((f) => (
                        <Button
                            key={f.value}
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setFilter(f.value)}
                            aria-pressed={filter === f.value}
                            className={cn(
                                "rounded-sm font-medium",
                                filter === f.value
                                    ? "bg-surface-muted text-foreground"
                                    : "text-muted-foreground"
                            )}
                        >
                            {f.label}
                        </Button>
                    ))}
                </div>
            </div>

            {error && (
                <p className="text-xs text-destructive">{error}</p>
            )}

            {filtered.length === 0 ? (
                <EmptyState
                    title="No matching users"
                    description="Try changing the filter or searching by email."
                />
            ) : (
                <ul className="divide-y divide-border -mx-2">
                    {filtered.map((u) => {
                        const initial = (u.name ?? u.email ?? "?")
                            .charAt(0)
                            .toUpperCase()
                        const isPending = pendingId === u.id
                        return (
                            <li
                                key={u.id}
                                className="flex items-center gap-3 px-2 py-2.5"
                            >
                                {u.image ? (
                                    <Image
                                        src={u.image}
                                        alt=""
                                        width={32}
                                        height={32}
                                        className="h-8 w-8 rounded-full object-cover"
                                    />
                                ) : (
                                    <div className="h-8 w-8 rounded-full bg-surface-muted flex items-center justify-center text-xs font-semibold">
                                        {initial}
                                    </div>
                                )}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className="text-sm font-medium truncate">
                                            {u.name ?? u.email ?? "—"}
                                        </span>
                                        <RoleBadge role={u.role} />
                                        {u._count.articles > 0 && (
                                            <span className="text-[11px] text-muted-foreground tabular-nums">
                                                {u._count.articles} article
                                                {u._count.articles === 1 ? "" : "s"}
                                            </span>
                                        )}
                                    </div>
                                    {u.name && u.email && (
                                        <p className="text-xs text-muted-foreground truncate">
                                            {u.email}
                                        </p>
                                    )}
                                </div>
                                <RoleActions
                                    role={u.role}
                                    isPending={isPending}
                                    onPromote={() => changeRole(u.id, "CONTRIBUTOR")}
                                    onRevoke={() => changeRole(u.id, "USER")}
                                />
                            </li>
                        )
                    })}
                </ul>
            )}
        </div>
    )
}

function RoleBadge({ role }: { role: UserRow["role"] }) {
    if (role === "ADMIN")
        return (
            <Badge variant="accent" className="normal-case tracking-normal">
                Admin
            </Badge>
        )
    if (role === "CONTRIBUTOR")
        return (
            <Badge variant="primary" className="normal-case tracking-normal">
                Contributor
            </Badge>
        )
    if (role === "MODERATOR")
        return (
            <Badge variant="accent" className="normal-case tracking-normal">
                Moderator
            </Badge>
        )
    return (
        <Badge variant="secondary" className="normal-case tracking-normal">
            User
        </Badge>
    )
}

function RoleActions({
    role,
    isPending,
    onPromote,
    onRevoke,
}: {
    role: UserRow["role"]
    isPending: boolean
    onPromote: () => void
    onRevoke: () => void
}) {
    if (role === "ADMIN") {
        return (
            <span className="text-xs text-muted-foreground italic">
                Manage via DB
            </span>
        )
    }
    if (role === "MODERATOR") {
        return (
            <Link
                href="/admin/moderators"
                className="inline-flex h-8 items-center justify-center gap-2 rounded-md px-3 text-xs font-medium text-muted-foreground transition-colors hover:bg-surface-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
                <ShieldCheck className="h-3.5 w-3.5" />
                Permissions
            </Link>
        )
    }
    if (role === "CONTRIBUTOR") {
        return (
            <Button
                variant="ghost"
                size="sm"
                onClick={onRevoke}
                disabled={isPending}
                className="text-muted-foreground hover:text-destructive"
            >
                {isPending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                    <ShieldOff className="h-3.5 w-3.5" />
                )}
                Revoke
            </Button>
        )
    }
    return (
        <Button
            variant="outline"
            size="sm"
            onClick={onPromote}
            disabled={isPending}
        >
            {isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
                <UserPlus className="h-3.5 w-3.5" />
            )}
            Make contributor
        </Button>
    )
}
