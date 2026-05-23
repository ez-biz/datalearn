import Link from "next/link"
import { FileText, KeyRound, Plus, Route, Tags } from "lucide-react"
import { Kbd } from "@/components/ui/Kbd"

const actions = [
    {
        label: "new problem",
        href: "/admin/problems/new",
        shortcut: "P",
        icon: Plus,
    },
    {
        label: "new article",
        href: "/admin/articles/new",
        shortcut: "A",
        icon: FileText,
    },
    {
        label: "new track",
        href: "/admin/tracks/new",
        shortcut: "T",
        icon: Route,
    },
    {
        label: "tags",
        href: "/admin/tags",
        shortcut: "G",
        icon: Tags,
    },
    {
        label: "api keys",
        href: "/admin/api-keys",
        shortcut: "K",
        icon: KeyRound,
    },
]

export function AdminQuickActions() {
    return (
        <div className="flex flex-wrap items-center gap-2">
            {actions.map((action) => {
                const Icon = action.icon
                return (
                    <Link
                        key={action.href}
                        href={action.href}
                        className="inline-flex h-9 items-center gap-2 rounded-md border border-border bg-surface-muted px-3 text-[13px] font-medium transition-colors hover:border-border-strong hover:bg-surface-elevated"
                    >
                        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                        <span>{action.label}</span>
                        <Kbd>⌥{action.shortcut}</Kbd>
                    </Link>
                )
            })}
        </div>
    )
}
