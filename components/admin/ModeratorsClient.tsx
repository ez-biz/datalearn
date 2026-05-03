"use client"

import { useMemo, useState } from "react"
import Image from "next/image"
import {
    Loader2,
    Search,
    ShieldCheck,
    ShieldOff,
    SlidersHorizontal,
    UserPlus,
} from "lucide-react"
import { Badge } from "@/components/ui/Badge"
import { Button } from "@/components/ui/Button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card"
import { EmptyState } from "@/components/ui/EmptyState"
import { Input } from "@/components/ui/Input"
import { cn } from "@/lib/utils"

type PermissionKey =
    | "VIEW_DISCUSSION_QUEUE"
    | "HIDE_COMMENT"
    | "RESTORE_COMMENT"
    | "DISMISS_REPORT"
    | "MARK_SPAM"
    | "LOCK_PROBLEM_DISCUSSION"
    | "HIDE_PROBLEM_DISCUSSION"

type UserRole = "USER" | "CONTRIBUTOR" | "MODERATOR" | "ADMIN"

interface CandidateUser {
    id: string
    email: string | null
    name: string | null
    image: string | null
    role: UserRole
    createdAt: string | Date
}

interface ModeratorUser extends CandidateUser {
    role: "MODERATOR"
    moderatorPermissions: {
        permission: PermissionKey
        createdAt: string | Date
        grantedBy: {
            id: string
            name: string | null
            email: string | null
        } | null
    }[]
}

const PERMISSIONS: { key: PermissionKey; label: string; description: string }[] = [
    {
        key: "VIEW_DISCUSSION_QUEUE",
        label: "View discussion queue",
        description: "Access reported, hidden, dismissed, and spam comment queues.",
    },
    {
        key: "HIDE_COMMENT",
        label: "Hide comment",
        description: "Hide visible comments from problem discussions.",
    },
    {
        key: "RESTORE_COMMENT",
        label: "Restore comment",
        description: "Return hidden or spam comments to visible state.",
    },
    {
        key: "DISMISS_REPORT",
        label: "Dismiss report",
        description: "Close reports that do not need action.",
    },
    {
        key: "MARK_SPAM",
        label: "Mark spam",
        description: "Confirm spam and remove the comment from normal discussion.",
    },
    {
        key: "LOCK_PROBLEM_DISCUSSION",
        label: "Lock problem discussion",
        description: "Switch a problem discussion to locked mode.",
    },
    {
        key: "HIDE_PROBLEM_DISCUSSION",
        label: "Hide problem discussion",
        description: "Disable a problem discussion from public view.",
    },
]

export function ModeratorsClient({
    initialModerators,
}: {
    initialModerators: ModeratorUser[]
}) {
    const [moderators, setModerators] = useState(initialModerators)
    const [drafts, setDrafts] = useState<Record<string, PermissionKey[]>>(() =>
        Object.fromEntries(
            initialModerators.map((moderator) => [
                moderator.id,
                moderator.moderatorPermissions.map((p) => p.permission),
            ])
        )
    )
    const [query, setQuery] = useState("")
    const [candidates, setCandidates] = useState<CandidateUser[]>([])
    const [selectedUserId, setSelectedUserId] = useState<string | null>(null)
    const [newPermissions, setNewPermissions] = useState<PermissionKey[]>([
        "VIEW_DISCUSSION_QUEUE",
    ])
    const [pending, setPending] = useState<string | null>(null)
    const [searching, setSearching] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const moderatorIds = useMemo(
        () => new Set(moderators.map((moderator) => moderator.id)),
        [moderators]
    )
    const visibleCandidates = candidates.filter(
        (candidate) => !moderatorIds.has(candidate.id)
    )

    async function searchCandidates() {
        const q = query.trim()
        setError(null)
        setSelectedUserId(null)
        if (!q) {
            setCandidates([])
            return
        }
        setSearching(true)
        try {
            const res = await fetch(
                `/api/admin/moderators?q=${encodeURIComponent(q)}`
            )
            const json = await res.json().catch(() => ({}))
            if (!res.ok) {
                setError(json.error ?? `Search failed: ${res.status}`)
                return
            }
            setModerators(json.data.moderators)
            setDrafts((current) => ({
                ...Object.fromEntries(
                    json.data.moderators.map((moderator: ModeratorUser) => [
                        moderator.id,
                        current[moderator.id] ??
                            moderator.moderatorPermissions.map((p) => p.permission),
                    ])
                ),
            }))
            setCandidates(json.data.candidates)
        } finally {
            setSearching(false)
        }
    }

    async function saveModerator(userId: string) {
        setError(null)
        setPending(userId)
        try {
            const res = await fetch(`/api/admin/moderators/${userId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ permissions: drafts[userId] ?? [] }),
            })
            const json = await res.json().catch(() => ({}))
            if (!res.ok) {
                setError(json.error ?? `Save failed: ${res.status}`)
                return
            }
            upsertModerator(json.data)
        } finally {
            setPending(null)
        }
    }

    async function revokeModerator(userId: string) {
        setError(null)
        setPending(userId)
        try {
            const res = await fetch(`/api/admin/moderators/${userId}`, {
                method: "DELETE",
            })
            const json = await res.json().catch(() => ({}))
            if (!res.ok) {
                setError(json.error ?? `Revoke failed: ${res.status}`)
                return
            }
            setModerators((current) =>
                current.filter((moderator) => moderator.id !== userId)
            )
            setDrafts((current) => {
                const next = { ...current }
                delete next[userId]
                return next
            })
        } finally {
            setPending(null)
        }
    }

    async function addModerator() {
        if (!selectedUserId) return
        setError(null)
        setPending("new")
        try {
            const res = await fetch("/api/admin/moderators", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    userId: selectedUserId,
                    permissions: newPermissions,
                }),
            })
            const json = await res.json().catch(() => ({}))
            if (!res.ok) {
                setError(json.error ?? `Create failed: ${res.status}`)
                return
            }
            upsertModerator(json.data)
            setCandidates((current) =>
                current.filter((candidate) => candidate.id !== selectedUserId)
            )
            setSelectedUserId(null)
            setNewPermissions(["VIEW_DISCUSSION_QUEUE"])
        } finally {
            setPending(null)
        }
    }

    function upsertModerator(moderator: ModeratorUser) {
        setModerators((current) => {
            const exists = current.some((item) => item.id === moderator.id)
            return exists
                ? current.map((item) => (item.id === moderator.id ? moderator : item))
                : [moderator, ...current]
        })
        setDrafts((current) => ({
            ...current,
            [moderator.id]: moderator.moderatorPermissions.map((p) => p.permission),
        }))
    }

    return (
        <div className="space-y-5">
            {error && (
                <p
                    className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
                    role="alert"
                >
                    {error}
                </p>
            )}

            <Card>
                <CardHeader className="pb-3">
                    <div className="flex items-center justify-between gap-3">
                        <CardTitle className="flex items-center gap-2">
                            <UserPlus className="h-4 w-4" />
                            Add moderator
                        </CardTitle>
                        <Badge variant="secondary" className="normal-case tracking-normal">
                            Search users
                        </Badge>
                    </div>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex flex-col gap-2 sm:flex-row">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                            <Input
                                type="search"
                                value={query}
                                onChange={(event) => setQuery(event.target.value)}
                                onKeyDown={(event) => {
                                    if (event.key === "Enter") searchCandidates()
                                }}
                                placeholder="Search by email or name"
                                className="pl-9"
                            />
                        </div>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={searchCandidates}
                            disabled={searching}
                            className="min-h-10"
                        >
                            {searching ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                <Search className="h-4 w-4" />
                            )}
                            Search
                        </Button>
                    </div>

                    {visibleCandidates.length > 0 && (
                        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.9fr)]">
                            <div className="divide-y divide-border rounded-md border border-border">
                                {visibleCandidates.map((candidate) => (
                                    <button
                                        key={candidate.id}
                                        type="button"
                                        onClick={() => setSelectedUserId(candidate.id)}
                                        className={cn(
                                            "flex min-h-14 w-full items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                                            selectedUserId === candidate.id &&
                                                "bg-primary/10"
                                        )}
                                    >
                                        <Avatar user={candidate} />
                                        <UserIdentity user={candidate} />
                                        <Badge
                                            variant="outline"
                                            className="ml-auto normal-case tracking-normal"
                                        >
                                            {candidate.role.toLowerCase()}
                                        </Badge>
                                    </button>
                                ))}
                            </div>
                            <div className="rounded-md border border-border p-3">
                                <PermissionChecklist
                                    value={newPermissions}
                                    onChange={setNewPermissions}
                                    idPrefix="new-moderator"
                                />
                                <Button
                                    type="button"
                                    onClick={addModerator}
                                    disabled={!selectedUserId || pending === "new"}
                                    className="mt-4 min-h-10 w-full"
                                >
                                    {pending === "new" ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                        <ShieldCheck className="h-4 w-4" />
                                    )}
                                    Make moderator
                                </Button>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>

            <section className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <h2 className="text-base font-semibold tracking-tight">
                            Current moderators
                        </h2>
                        <p className="text-sm text-muted-foreground">
                            <span className="tabular-nums">{moderators.length}</span>{" "}
                            moderator{moderators.length === 1 ? "" : "s"} configured
                        </p>
                    </div>
                    <Badge variant="primary" className="normal-case tracking-normal">
                        Permission replacement
                    </Badge>
                </div>

                {moderators.length === 0 ? (
                    <EmptyState
                        icon={<SlidersHorizontal className="h-5 w-5" />}
                        title="No moderators yet"
                        description="Search for a user to grant discussion moderation access."
                    />
                ) : (
                    <div className="grid gap-4">
                        {moderators.map((moderator) => {
                            const currentPermissions =
                                drafts[moderator.id] ??
                                moderator.moderatorPermissions.map(
                                    (permission) => permission.permission
                                )
                            const savedPermissions = moderator.moderatorPermissions.map(
                                (permission) => permission.permission
                            )
                            const dirty =
                                currentPermissions.slice().sort().join("|") !==
                                savedPermissions.slice().sort().join("|")
                            const isPending = pending === moderator.id

                            return (
                                <Card key={moderator.id}>
                                    <CardContent className="p-4">
                                        <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
                                            <div className="flex min-w-0 flex-1 items-center gap-3">
                                                <Avatar user={moderator} />
                                                <div className="min-w-0">
                                                    <UserIdentity user={moderator} />
                                                    <p className="mt-1 text-xs text-muted-foreground">
                                                        <span className="tabular-nums">
                                                            {savedPermissions.length}
                                                        </span>{" "}
                                                        active permission
                                                        {savedPermissions.length === 1
                                                            ? ""
                                                            : "s"}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="min-w-0 flex-[1.4]">
                                                <PermissionChecklist
                                                    value={currentPermissions}
                                                    onChange={(permissions) =>
                                                        setDrafts((current) => ({
                                                            ...current,
                                                            [moderator.id]: permissions,
                                                        }))
                                                    }
                                                    idPrefix={`moderator-${moderator.id}`}
                                                />
                                                <div className="mt-4 flex flex-wrap justify-end gap-2">
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        onClick={() =>
                                                            saveModerator(moderator.id)
                                                        }
                                                        disabled={!dirty || isPending}
                                                        className="min-h-10"
                                                    >
                                                        {isPending ? (
                                                            <Loader2 className="h-4 w-4 animate-spin" />
                                                        ) : (
                                                            <ShieldCheck className="h-4 w-4" />
                                                        )}
                                                        Save
                                                    </Button>
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        onClick={() =>
                                                            revokeModerator(moderator.id)
                                                        }
                                                        disabled={isPending}
                                                        className="min-h-10 text-muted-foreground hover:text-destructive"
                                                    >
                                                        {isPending ? (
                                                            <Loader2 className="h-4 w-4 animate-spin" />
                                                        ) : (
                                                            <ShieldOff className="h-4 w-4" />
                                                        )}
                                                        Revoke
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            )
                        })}
                    </div>
                )}
            </section>
        </div>
    )
}

function PermissionChecklist({
    value,
    onChange,
    idPrefix,
}: {
    value: PermissionKey[]
    onChange: (permissions: PermissionKey[]) => void
    idPrefix: string
}) {
    const selected = new Set(value)

    return (
        <fieldset className="space-y-2">
            <legend className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Permissions
            </legend>
            {PERMISSIONS.map((permission) => {
                const id = `${idPrefix}-${permission.key}`
                return (
                    <label
                        key={permission.key}
                        htmlFor={id}
                        className="flex min-h-10 cursor-pointer items-start gap-3 rounded-md border border-border px-3 py-2 transition-colors hover:bg-surface-muted"
                    >
                        <input
                            id={id}
                            type="checkbox"
                            checked={selected.has(permission.key)}
                            onChange={(event) => {
                                const next = event.target.checked
                                    ? [...value, permission.key]
                                    : value.filter((item) => item !== permission.key)
                                onChange(next)
                            }}
                            className="mt-1 h-4 w-4 rounded border-border text-primary focus-visible:ring-ring"
                        />
                        <span className="min-w-0">
                            <span className="block text-sm font-medium">
                                {permission.label}
                            </span>
                            <span className="block text-xs text-muted-foreground">
                                {permission.description}
                            </span>
                        </span>
                    </label>
                )
            })}
        </fieldset>
    )
}

function Avatar({ user }: { user: Pick<CandidateUser, "image" | "name" | "email"> }) {
    const initial = (user.name ?? user.email ?? "?").charAt(0).toUpperCase()
    return user.image ? (
        <Image
            src={user.image}
            alt=""
            width={40}
            height={40}
            className="h-10 w-10 rounded-full object-cover"
        />
    ) : (
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-muted text-sm font-semibold">
            {initial}
        </div>
    )
}

function UserIdentity({
    user,
}: {
    user: Pick<CandidateUser, "name" | "email">
}) {
    return (
        <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">
                {user.name ?? user.email ?? "Unnamed user"}
            </p>
            {user.name && user.email && (
                <p className="truncate text-xs text-muted-foreground">{user.email}</p>
            )}
        </div>
    )
}
