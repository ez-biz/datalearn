import Image from "next/image"
import { Calendar, Flame, Mail } from "lucide-react"
import type { ProfileData } from "@/actions/profile"
import { Card, CardContent } from "@/components/ui/Card"
import { Badge } from "@/components/ui/Badge"
import { cn } from "@/lib/utils"

type Role = ProfileData["user"]["role"]

const ROLE_LABEL: Record<Role, string> = {
    USER: "Member",
    CONTRIBUTOR: "Contributor",
    ADMIN: "Admin",
}

const ROLE_PILL: Record<Role, string> = {
    USER: "secondary",
    CONTRIBUTOR: "primary",
    ADMIN: "accent",
}

function formatJoined(d: Date): string {
    return d.toLocaleDateString(undefined, {
        month: "long",
        year: "numeric",
    })
}

export function ProfileSidebar({
    user,
    streak,
}: {
    user: ProfileData["user"]
    streak: ProfileData["streak"]
}) {
    const initial = (user.name ?? user.email ?? "?").charAt(0).toUpperCase()
    const displayName = user.name ?? user.email?.split("@")[0] ?? "Member"
    return (
        <Card>
            <CardContent className="p-6">
                <div className="flex flex-col items-center text-center sm:items-start sm:text-left">
                    {user.image ? (
                        <Image
                            src={user.image}
                            alt={user.name ?? "Profile"}
                            width={88}
                            height={88}
                            className="h-22 w-22 rounded-full object-cover ring-2 ring-border"
                        />
                    ) : (
                        <span className="flex h-22 w-22 items-center justify-center rounded-full bg-primary/15 text-3xl font-semibold text-primary ring-2 ring-border">
                            {initial}
                        </span>
                    )}
                    <h1 className="mt-4 text-xl font-semibold tracking-tight">
                        {displayName}
                    </h1>
                    <Badge
                        variant={ROLE_PILL[user.role] as "primary" | "accent" | "secondary"}
                        className="mt-2"
                    >
                        {ROLE_LABEL[user.role]}
                    </Badge>
                </div>

                <dl className="mt-6 space-y-2.5 text-sm">
                    {user.email && (
                        <div className="flex items-center gap-2.5 text-muted-foreground">
                            <Mail className="h-4 w-4 shrink-0" />
                            <dd className="truncate">{user.email}</dd>
                        </div>
                    )}
                    <div className="flex items-center gap-2.5 text-muted-foreground">
                        <Calendar className="h-4 w-4 shrink-0" />
                        <dd>Joined {formatJoined(user.joinedAt)}</dd>
                    </div>
                    <div
                        className={cn(
                            "flex items-center gap-2.5",
                            streak.current > 0
                                ? "text-foreground"
                                : "text-muted-foreground"
                        )}
                    >
                        <Flame
                            className={cn(
                                "h-4 w-4 shrink-0",
                                streak.current > 0 ? "text-accent" : ""
                            )}
                            aria-hidden
                        />
                        <dd className="tabular-nums">
                            {streak.current === 0
                                ? "No active streak"
                                : `${streak.current}-day streak`}
                            {streak.longest > streak.current && (
                                <span className="text-xs text-muted-foreground ml-1.5">
                                    (best: {streak.longest})
                                </span>
                            )}
                        </dd>
                    </div>
                </dl>
            </CardContent>
        </Card>
    )
}
