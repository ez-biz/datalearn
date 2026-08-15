"use client"

// Rendered once in app/admin/layout.tsx so it is reachable from every admin
// screen, not just the Overview page.
//
// Every chip here has a real keydown listener behind it — this project has
// twice shipped a keyboard hint with no handler (the "/" shortcut in
// components/practice/catalog/CatalogClient.tsx predates this comment and
// is itself wired; the hero's "↵" in SP6 was not). If a shortcut can't be
// wired, the rule is: don't render the chip.
//
// Keyed off event.code (the physical key, e.g. "KeyP"), not event.key.
// event.key reflects the character the OS produces for Alt+<letter> — on a
// macOS layout, Option+P types "π", Option+A types "å", etc. — so matching
// on event.key would silently break every shortcut on a Mac. event.code is
// layout-independent and unaffected by the Alt remap.
import { useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { FileText, Plus, Route, Trophy, type LucideIcon } from "lucide-react"
import { Kbd } from "@/components/ui/Kbd"

interface QuickAction {
    label: string
    href: string
    /** KeyboardEvent.code for the shortcut's physical key. */
    code: string
    /** What the Kbd chip displays. */
    shortcutLabel: string
    icon: LucideIcon
}

const ACTIONS: QuickAction[] = [
    {
        label: "New problem",
        href: "/admin/problems/new",
        code: "KeyP",
        shortcutLabel: "P",
        icon: Plus,
    },
    {
        label: "New article",
        href: "/admin/articles/new",
        code: "KeyA",
        shortcutLabel: "A",
        icon: FileText,
    },
    {
        label: "New track",
        href: "/admin/tracks/new",
        code: "KeyT",
        shortcutLabel: "T",
        icon: Route,
    },
    {
        label: "New contest",
        href: "/admin/contests/new",
        code: "KeyC",
        shortcutLabel: "C",
        icon: Trophy,
    },
]

/** Same convention as CatalogClient's "/" shortcut: never fire while the
 *  target is an input, textarea, or contenteditable region — and never fire
 *  anywhere inside a <form>. The problem form's tab strip and segmented
 *  controls are plain buttons, not inputs, so without the form check
 *  focusing one of them and pressing e.g. ⌥P would router.push away and
 *  discard the whole in-progress problem, with no dirty-state or
 *  beforeunload guard to catch it.
 *
 *  `target` isn't always an Element — a KeyboardEvent dispatched directly on
 *  `window` (as this project's e2e suite does, to reproduce the real
 *  Option-remap shape CDP can't) reports `target === window`, which has no
 *  `.closest`. `el?.closest?.("form")` guards that call too, not just the
 *  reference, so it degrades to "not inside a form" instead of throwing. */
function isTypingTarget(target: EventTarget | null): boolean {
    const el = target as HTMLElement | null
    const tag = el?.tagName
    return (
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        Boolean(el?.isContentEditable) ||
        Boolean(el?.closest?.("form"))
    )
}

export function AdminQuickActions() {
    const router = useRouter()

    useEffect(() => {
        function onKeyDown(event: KeyboardEvent) {
            if (!event.altKey) return
            if (isTypingTarget(event.target)) return
            const action = ACTIONS.find((a) => a.code === event.code)
            if (!action) return
            event.preventDefault()
            router.push(action.href)
        }
        window.addEventListener("keydown", onKeyDown)
        return () => window.removeEventListener("keydown", onKeyDown)
    }, [router])

    return (
        <div className="flex flex-wrap items-center gap-2">
            {ACTIONS.map((action) => {
                const Icon = action.icon
                return (
                    <Link
                        key={action.href}
                        href={action.href}
                        className="inline-flex h-9 items-center gap-2 rounded-md border border-border bg-surface-muted px-3 text-[13px] font-medium transition-colors hover:border-border-strong hover:bg-surface-elevated"
                    >
                        <Icon className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
                        <span>{action.label}</span>
                        <Kbd>⌥{action.shortcutLabel}</Kbd>
                    </Link>
                )
            })}
        </div>
    )
}
