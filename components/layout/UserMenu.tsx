"use client"

import Link from "next/link"
import Image from "next/image"
import { useEffect, useRef, useState } from "react"
import { signOut } from "next-auth/react"
import {
    Bookmark,
    CalendarCheck2,
    CheckCircle2,
    History,
    LogOut,
    PenSquare,
    Shield,
    User as UserIcon,
} from "lucide-react"
import { cn } from "@/lib/utils"

type Role = "USER" | "CONTRIBUTOR" | "MODERATOR" | "ADMIN"

interface UserMenuProps {
    name: string | null
    email: string | null
    image: string | null
    role: Role
    /** Total ACCEPTED-distinct problems for this user. */
    solved: number
    /** Total PUBLISHED problems on the platform. */
    total: number
    dailySolved: boolean
}

const ROLE_LABEL: Record<Role, string> = {
    USER: "Member",
    CONTRIBUTOR: "Contributor",
    MODERATOR: "Moderator",
    ADMIN: "Admin",
}

const ROLE_PILL: Record<Role, string> = {
    USER: "bg-surface-muted text-muted-foreground",
    CONTRIBUTOR: "bg-primary/15 text-primary",
    MODERATOR: "bg-accent/15 text-accent",
    ADMIN: "bg-accent/15 text-accent",
}

export function UserMenu({
    name,
    email,
    image,
    role,
    solved,
    total,
    dailySolved,
}: UserMenuProps) {
    const [open, setOpen] = useState(false)
    const [signingOut, setSigningOut] = useState(false)
    const containerRef = useRef<HTMLDivElement>(null)
    const triggerRef = useRef<HTMLButtonElement>(null)

    // Close on click outside or Escape.
    useEffect(() => {
        if (!open) return
        function onPointerDown(e: PointerEvent) {
            if (
                containerRef.current &&
                !containerRef.current.contains(e.target as Node)
            ) {
                setOpen(false)
            }
        }
        function onKey(e: KeyboardEvent) {
            if (e.key === "Escape") {
                setOpen(false)
                triggerRef.current?.focus()
            }
        }
        document.addEventListener("pointerdown", onPointerDown)
        document.addEventListener("keydown", onKey)
        return () => {
            document.removeEventListener("pointerdown", onPointerDown)
            document.removeEventListener("keydown", onKey)
        }
    }, [open])

    const initial = (name ?? email ?? "?").charAt(0).toUpperCase()
    const displayName = name?.trim() || email?.split("@")[0] || "Account"
    const safeTotal = Math.max(1, total)
    const pct = Math.min(100, (solved / safeTotal) * 100)

    // Track whether the avatar image failed to load. Common causes:
    // (a) OAuth provider's avatar URL stopped resolving (user changed avatar
    //     at the provider, account expired, etc.), (b) next/image domain
    //     not whitelisted, (c) network/CORS edge case. Falling back to
    //     initials keeps the UI from rendering a broken thumbnail.
    const [imageFailed, setImageFailed] = useState(false)
    const showAvatarImage = Boolean(image) && !imageFailed
    const isContributor = role === "CONTRIBUTOR" || role === "ADMIN"
    const isAdmin = role === "ADMIN"

    async function handleSignOut() {
        setSigningOut(true)
        setOpen(false)
        try {
            await signOut({ redirectTo: "/" })
        } finally {
            setSigningOut(false)
        }
    }

    return (
        <div className="relative" ref={containerRef}>
            <button
                ref={triggerRef}
                type="button"
                aria-haspopup="menu"
                aria-expanded={open}
                aria-label={open ? "Close account menu" : "Open account menu"}
                onClick={() => setOpen((v) => !v)}
                className={cn(
                    "ml-1 rounded-full ring-2 transition-shadow duration-150 cursor-pointer",
                    open
                        ? "ring-primary/40"
                        : "ring-transparent hover:ring-primary/30"
                )}
            >
                {showAvatarImage ? (
                    <Image
                        src={image!}
                        alt={name ?? "Profile"}
                        width={32}
                        height={32}
                        className="h-8 w-8 rounded-full object-cover"
                        onError={() => setImageFailed(true)}
                        unoptimized
                    />
                ) : (
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary">
                        {initial}
                    </span>
                )}
            </button>

            {open && (
                <div
                    role="menu"
                    aria-label="Account menu"
                    className="absolute right-0 top-[calc(100%+8px)] w-72 rounded-lg border border-border bg-surface shadow-lg overflow-hidden z-50"
                >
                    {/* Header */}
                    <div className="flex items-start gap-3 p-4 border-b border-border">
                        {showAvatarImage ? (
                            <Image
                                src={image!}
                                alt={name ?? "Profile"}
                                width={40}
                                height={40}
                                className="h-10 w-10 rounded-full object-cover shrink-0"
                                onError={() => setImageFailed(true)}
                                unoptimized
                            />
                        ) : (
                            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/15 text-sm font-semibold text-primary shrink-0">
                                {initial}
                            </span>
                        )}
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                                <p className="font-medium text-sm truncate">
                                    {displayName}
                                </p>
                                <span
                                    className={cn(
                                        "rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                                        ROLE_PILL[role]
                                    )}
                                >
                                    {ROLE_LABEL[role]}
                                </span>
                            </div>
                            {email && (
                                <p className="text-xs text-muted-foreground truncate mt-0.5">
                                    {email}
                                </p>
                            )}
                        </div>
                    </div>

                    {/* Stats banner */}
                    <div className="px-4 py-3 border-b border-border bg-surface-muted/40">
                        <div className="flex items-center justify-between text-xs mb-1.5">
                            <span className="font-medium text-muted-foreground">
                                Problems solved
                            </span>
                            <span className="tabular-nums text-foreground font-semibold">
                                {solved}{" "}
                                <span className="text-muted-foreground font-normal">
                                    / {total}
                                </span>
                            </span>
                        </div>
                        <div className="h-1.5 rounded-full bg-surface-muted overflow-hidden">
                            <div
                                className="h-full bg-primary transition-[width] duration-500 ease-out"
                                style={{ width: `${pct}%` }}
                            />
                        </div>
                    </div>

                    {/* Menu items */}
                    <ul className="py-1.5" role="none">
                        <MenuItem
                            href="/daily"
                            icon={<CalendarCheck2 className="h-4 w-4" />}
                            label="Daily problem"
                            trailing={
                                dailySolved ? (
                                    <span className="ml-auto inline-flex items-center gap-1 text-xs text-easy-fg">
                                        <CheckCircle2 className="h-3 w-3" />
                                        Solved
                                    </span>
                                ) : null
                            }
                            onClick={() => setOpen(false)}
                        />
                        <MenuItem
                            href="/profile"
                            icon={<UserIcon className="h-4 w-4" />}
                            label="Profile"
                            onClick={() => setOpen(false)}
                        />
                        <MenuItem
                            href="/profile#submissions"
                            icon={<History className="h-4 w-4" />}
                            label="Submissions"
                            onClick={() => setOpen(false)}
                        />
                        <MenuItem
                            href="/me/lists"
                            icon={<Bookmark className="h-4 w-4" />}
                            label="My lists"
                            onClick={() => setOpen(false)}
                        />
                        {isContributor && (
                            <MenuItem
                                href="/me/articles"
                                icon={<PenSquare className="h-4 w-4" />}
                                label="My articles"
                                tone="primary"
                                onClick={() => setOpen(false)}
                            />
                        )}
                        {isAdmin && (
                            <MenuItem
                                href="/admin"
                                icon={<Shield className="h-4 w-4" />}
                                label="Admin"
                                tone="accent"
                                trailing={
                                    <span className="ml-auto rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-accent bg-accent/10">
                                        Staff
                                    </span>
                                }
                                onClick={() => setOpen(false)}
                            />
                        )}
                    </ul>

                    <div className="border-t border-border py-1.5">
                        <button
                            type="button"
                            role="menuitem"
                            disabled={signingOut}
                            className="flex w-full cursor-pointer items-center gap-2.5 px-4 py-2 text-left text-sm text-muted-foreground transition-colors hover:bg-surface-muted hover:text-foreground disabled:cursor-wait disabled:opacity-70"
                            onClick={handleSignOut}
                        >
                            <LogOut aria-hidden="true" className="h-4 w-4" />
                            {signingOut ? "Signing out..." : "Sign out"}
                        </button>
                    </div>
                </div>
            )}
        </div>
    )
}

function MenuItem({
    href,
    icon,
    label,
    tone,
    trailing,
    onClick,
}: {
    href: string
    icon: React.ReactNode
    label: string
    tone?: "primary" | "accent"
    trailing?: React.ReactNode
    onClick?: () => void
}) {
    const toneClass =
        tone === "primary"
            ? "text-primary"
            : tone === "accent"
                ? "text-accent"
                : "text-foreground"
    return (
        <li role="none">
            <Link
                href={href}
                role="menuitem"
                onClick={onClick}
                className={cn(
                    "flex items-center gap-2.5 px-4 py-2 text-sm hover:bg-surface-muted transition-colors",
                    toneClass
                )}
            >
                {icon}
                <span>{label}</span>
                {trailing}
            </Link>
        </li>
    )
}
