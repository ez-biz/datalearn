// The single nav definition. The sidebar, the collapsed rail and the mobile
// tab bar all render from this — three presentations, one source of truth.
//
// Eight of the fourteen designed destinations do not exist yet. They carry
// status "soon" and deliberately have no href: they render dimmed and
// non-interactive, which keeps the designed density and signals the roadmap
// without dead links. Promoting one later means adding an href and flipping
// the status.

import type { LucideIcon } from "lucide-react"
import {
    Box,
    BookOpen,
    CircleHelp,
    Cloud,
    CodeXml,
    Database,
    Folder,
    LayoutGrid,
    Megaphone,
    MessageCircle,
    Newspaper,
    Route,
    SquarePen,
    Trophy,
    User,
} from "lucide-react"

export type NavStatus = "live" | "soon"

export interface NavItem {
    /** Stable identity for tests and active-state lookups. */
    key: string
    label: string
    icon: LucideIcon
    /** Absent if and only if status is "soon". Enforced by test. */
    href?: string
    status: NavStatus
    /** Defaults to "prefix". */
    match?: "exact" | "prefix"
    /** Prefixes that must NOT select this item. */
    exclude?: string[]
    children?: NavItem[]
}

export const PRIMARY_NAV: NavItem[] = [
    { key: "home", label: "Home", icon: LayoutGrid, href: "/", status: "live", match: "exact" },
    {
        key: "learn",
        label: "Learn",
        icon: BookOpen,
        href: "/learn",
        status: "live",
        // /learn/tracks belongs to Tracks, not Learn.
        exclude: ["/learn/tracks"],
    },
    { key: "tracks", label: "Tracks", icon: Route, href: "/learn/tracks", status: "live" },
    { key: "projects", label: "Projects", icon: Folder, status: "soon" },
    {
        key: "practice",
        label: "Practice",
        icon: SquarePen,
        href: "/practice",
        status: "live",
        children: [
            {
                key: "coding-problems",
                label: "Coding problems",
                icon: CodeXml,
                href: "/practice",
                status: "live",
            },
            { key: "data-modeling", label: "Data modeling", icon: Database, status: "soon" },
            { key: "architecture", label: "Architecture design", icon: Box, status: "soon" },
            { key: "cloud-labs", label: "Cloud labs", icon: Cloud, status: "soon" },
        ],
    },
    { key: "contests", label: "Contests", icon: Trophy, href: "/contests", status: "live" },
    { key: "blogs", label: "Blogs", icon: Newspaper, status: "soon" },
    { key: "community", label: "Community", icon: MessageCircle, status: "soon" },
]

export const FOOTER_NAV: NavItem[] = [
    { key: "updates", label: "Updates", icon: Megaphone, status: "soon" },
    { key: "help", label: "Help center", icon: CircleHelp, status: "soon" },
]

export const TAB_BAR: NavItem[] = [
    { key: "tab-learn", label: "Learn", icon: BookOpen, href: "/learn", status: "live" },
    { key: "tab-practice", label: "Practice", icon: SquarePen, href: "/practice", status: "live" },
    { key: "tab-tracks", label: "Tracks", icon: Route, href: "/learn/tracks", status: "live" },
    { key: "tab-you", label: "You", icon: User, href: "/profile", status: "live" },
]

function underPrefix(pathname: string, prefix: string): boolean {
    return pathname === prefix || pathname.startsWith(`${prefix}/`)
}

export function isNavItemActive(item: NavItem, pathname: string): boolean {
    if (!item.href) return false
    if (item.exclude?.some((p) => underPrefix(pathname, p))) return false
    if (item.match === "exact") return pathname === item.href
    return underPrefix(pathname, item.href)
}

/** Key of the selected top-level item, or null when the route is outside the nav. */
export function activeNavKey(pathname: string): string | null {
    return PRIMARY_NAV.find((i) => isNavItemActive(i, pathname))?.key ?? null
}
