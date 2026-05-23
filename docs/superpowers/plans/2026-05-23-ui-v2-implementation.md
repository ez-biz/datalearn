# UI v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the UI v2 spec end-to-end on every public + admin surface: new dark-default token contract, container breathing, overflow primitives, the D+A hybrid theme, shadcn/ui adoption for a11y-heavy primitives, and the new admin dashboard.

**Architecture:** Eleven sequential commits on a single branch (`feat/ui-v2`). Commit 1 lands the foundation (tokens, primitives, shadcn init + 18 components). Commits 2–3 prep CI for the migration. Commits 4–7 sweep public surfaces. Commits 8–10 redesign the admin portal. Commit 11 flips the `next-themes` default to dark.

**Tech Stack:** Next.js 16 (App Router, RSC), TypeScript strict, Tailwind v4, `next-themes`, shadcn/ui (radix base), Prisma 7 (admin dashboard metrics), Playwright (e2e checks).

**Source spec:** `docs/superpowers/specs/2026-05-23-ui-v2-design.md` — 825 lines, 7 Codex passes, 16 findings closed. Implementation must satisfy every Done-criteria checkbox in the spec.

---

## File Structure

### Net-new files

- `components/ui/Eyebrow.tsx` — small `<Eyebrow variant="bracket" | "plain">` primitive
- `components/ui/Kbd.tsx` — `<Kbd>` for keyboard-shortcut chips
- `components/ui/StatusPill.tsx` — `<StatusPill status="accepted | rejected | pending | draft" />`
- `components/ui/ScrollableTable.tsx` — wraps wide content with right-edge fade gradient
- `components/ui/CodeBlock.tsx` — `<pre>` wrapper with per-block soft-wrap toggle (replaces inline `<SyntaxHighlighter>` config in MarkdownRenderer)
- `components/shadcn/<name>.tsx` — 18 shadcn components added by the CLI (dialog, tooltip, sonner, popover, command, dropdown-menu, tabs, separator, alert-dialog, sheet, form, field, switch, select, checkbox, radio-group, toggle-group, scroll-area)
- `components.json` — shadcn config at repo root
- `lib/utils.ts` — already exists; `cn()` helper preserved (init may add if missing)
- `scripts/check-no-palette-colors.sh` — CI denylist guard
- `scripts/check-shadcn-token-definitions.sh` — token-definition completeness check
- `components/admin/AdminDashboard.tsx` — new overview-page composition for `/admin`
- `components/admin/MetricCard.tsx` — single metric tile (count + delta + label)
- `components/admin/RecentActivityFeed.tsx` — server-component feed for the dashboard
- `components/admin/AdminQuickActions.tsx` — `+ new problem`, etc. row with `Kbd` hints
- `components/admin/AdminListShell.tsx` — shared chrome for admin list pages (eyebrow + tabs + scrollable table)
- `actions/admin-dashboard.ts` — Prisma aggregate queries for the dashboard metrics

### Files modified

- `app/globals.css` — token values re-toned (dark default + light inverted), shadow tokens re-toned, shadcn alias tokens added, `--muted-foreground-dim` added, `@theme inline` mappings extended
- `components/ui/Container.tsx` — adds `2xl` variant
- `components/sql/ResultTable.tsx` — uses `<ScrollableTable>` + `<StatusPill>`
- `components/markdown/MarkdownRenderer.tsx` — uses `<CodeBlock>`, wraps `prose-table` in `<ScrollableTable>`
- `components/markdown/directives/Mermaid.tsx` — wraps SVG output in `<ScrollableTable>`
- `components/markdown/directives/Callout.tsx` — bracketed eyebrow labels
- `components/practice/SqlPlayground.tsx` — `$ query.sql` prompt tab, `[ RESULT ]` header, blinking cursor, status pill
- `components/practice/ProblemPanel.tsx` — replaces inline tabs with shadcn `<Tabs>`; bracketed callout labels
- `components/practice/PracticeList.tsx` — replaces inline tab logic with shadcn `<Tabs>`
- `components/layout/Navbar.tsx` — theme-toggle still on `next-themes`, command-palette `⌘K` hint added
- `components/layout/UserMenu.tsx` — distinct token treatment for CONTRIBUTOR vs MODERATOR pills
- `components/NewsFeed.tsx` — five hardcoded palette classes swapped to semantic tokens
- `app/learn/page.tsx`, `app/learn/[topicSlug]/page.tsx`, `app/learn/[topicSlug]/[articleSlug]/page.tsx`, `app/learn/tracks/page.tsx`, `app/learn/tracks/[slug]/page.tsx` — Container width adjustments per spec; bracketed eyebrows
- `app/practice/page.tsx`, `app/practice/[slug]/page.tsx`, `app/practice/tags/page.tsx`, `app/practice/tags/[slug]/page.tsx` — Container `2xl`; bracketed eyebrows; stat block
- `app/page.tsx`, `app/profile/page.tsx`, `app/auth/signin/page.tsx`, `app/me/articles/page.tsx`, `app/me/articles/new/page.tsx`, `app/me/articles/[slug]/edit/page.tsx`, `app/me/lists/page.tsx`, `app/me/lists/[id]/page.tsx` — token re-toning + eyebrows where called out in spec
- `app/admin/page.tsx` — full dashboard redesign
- `app/admin/{problems,articles,tracks,discussions,schemas,moderators,topics,tags,api-keys,contributors,reports}/page.tsx` and corresponding `/new` and `/[slug]/edit` routes — migrated per spec table
- `app/admin/discussions/settings/page.tsx`, `app/admin/daily/page.tsx` — chrome update + shadcn `Switch` / `Select`
- `components/layout/ThemeProvider.tsx` — `defaultTheme="dark"`
- `.github/workflows/test.yml` — wire in the two new CI gates
- `app/privacy/page.tsx` — note about the functional anon-trial cookie (carryover from anon-gating spec; preserved through token re-tone)
- `docs/design-system/README.md` — updated with the new token contract + A-flavor application policy

---

## Task 1: Foundation — tokens, hand-rolled primitives, shadcn init + 18 components

This is the largest single task. Lands a new branch off `main`, updates `app/globals.css` end-to-end, creates the five new hand-rolled primitives, runs `shadcn init` against a non-default alias to avoid the PascalCase/lowercase case collision, and adds all 18 shadcn components used downstream. No page changes; subsequent commits modify call sites.

**Files:**
- Create: `components/ui/Eyebrow.tsx`, `components/ui/Kbd.tsx`, `components/ui/StatusPill.tsx`, `components/ui/ScrollableTable.tsx`, `components/ui/CodeBlock.tsx`
- Create: `components.json` (via shadcn init)
- Create: `components/shadcn/<18 files>.tsx` (via shadcn add)
- Create: `scripts/check-shadcn-token-definitions.sh`
- Modify: `app/globals.css` (entire token block + `@theme inline`)
- Modify: `components/ui/Container.tsx` (add `2xl` variant)

### Step 1.1: Cut branch off main

```bash
git checkout main
git pull --ff-only origin main
git checkout -b feat/ui-v2
```

### Step 1.2: Re-tone the `app/globals.css` token block (dark default)

Open `app/globals.css`. Replace the existing `:root` block with the dark-default values from the spec's "Value changes — new dark default in `:root`" section. The new block must define every existing token name plus the seven shadcn aliases plus `--muted-foreground-dim`.

Exact replacement for `:root` (copy verbatim from the spec; reproduced here for the engineer's convenience):

```css
:root {
    /* canvas */
    --background: 220 13% 7%;
    --foreground: 220 14% 92%;

    --surface: 220 13% 10%;
    --surface-muted: 220 13% 13%;
    --surface-elevated: 220 13% 17%;

    --border: 220 13% 18%;
    --border-strong: 220 13% 26%;

    --muted: 220 13% 13%;
    --muted-foreground: 220 9% 60%;
    --muted-foreground-dim: 220 9% 42%;

    --primary: 166 76% 64%;
    --primary-foreground: 168 84% 11%;
    --primary-hover: 166 76% 58%;

    --accent: 258 89% 76%;
    --accent-foreground: 258 70% 14%;

    --destructive: 0 84% 71%;
    --destructive-foreground: 220 13% 7%;
    --warning: 38 92% 58%;
    --warning-foreground: 28 100% 14%;
    --success: 166 76% 64%;
    --success-foreground: 168 84% 11%;

    --easy: 142 71% 64%;
    --easy-bg: 142 50% 18%;
    --easy-fg: 142 71% 84%;
    --medium: 38 92% 58%;
    --medium-bg: 38 50% 18%;
    --medium-fg: 38 92% 84%;
    --hard: 0 84% 71%;
    --hard-bg: 0 50% 20%;
    --hard-fg: 0 84% 84%;

    /* shadcn surface family (aliases) */
    --card: var(--surface);
    --card-foreground: var(--foreground);
    --popover: var(--surface-elevated);
    --popover-foreground: var(--foreground);
    --secondary: var(--surface-muted);
    --secondary-foreground: var(--foreground);
    --input: var(--border);

    --ring: var(--primary);
    --radius: 0.5rem;

    /* shadow tokens — dark mode opacities */
    --shadow-xs: 0 1px 2px hsl(0 0% 0% / 0.30);
    --shadow-sm: 0 1px 2px hsl(0 0% 0% / 0.35), 0 1px 3px hsl(0 0% 0% / 0.30);
    --shadow-md: 0 4px 6px -1px hsl(0 0% 0% / 0.40), 0 2px 4px -2px hsl(0 0% 0% / 0.30);
    --shadow-lg: 0 10px 15px -3px hsl(0 0% 0% / 0.45), 0 4px 6px -4px hsl(0 0% 0% / 0.35);
    --shadow-xl: 0 20px 25px -5px hsl(0 0% 0% / 0.50), 0 8px 10px -6px hsl(0 0% 0% / 0.35);
    --shadow-primary: 0 10px 25px -5px hsl(var(--primary) / 0.25);
}
```

### Step 1.3: Update `.dark` to mirror `:root`

The existing `.dark` block keeps its position in the file so Tailwind `dark:` variants continue to fire. Replace its body with the same values as the new `:root`:

```css
.dark {
    /* Same as :root — see spec "Class-on-html contract" — .dark is preserved
       so Tailwind dark: variants fire when next-themes sets class="dark". */
    --background: 220 13% 7%;
    --foreground: 220 14% 92%;
    --surface: 220 13% 10%;
    --surface-muted: 220 13% 13%;
    --surface-elevated: 220 13% 17%;
    --border: 220 13% 18%;
    --border-strong: 220 13% 26%;
    --muted: 220 13% 13%;
    --muted-foreground: 220 9% 60%;
    --muted-foreground-dim: 220 9% 42%;
    --primary: 166 76% 64%;
    --primary-foreground: 168 84% 11%;
    --primary-hover: 166 76% 58%;
    --accent: 258 89% 76%;
    --accent-foreground: 258 70% 14%;
    --destructive: 0 84% 71%;
    --destructive-foreground: 220 13% 7%;
    --warning: 38 92% 58%;
    --warning-foreground: 28 100% 14%;
    --success: 166 76% 64%;
    --success-foreground: 168 84% 11%;
    --easy: 142 71% 64%;
    --easy-bg: 142 50% 18%;
    --easy-fg: 142 71% 84%;
    --medium: 38 92% 58%;
    --medium-bg: 38 50% 18%;
    --medium-fg: 38 92% 84%;
    --hard: 0 84% 71%;
    --hard-bg: 0 50% 20%;
    --hard-fg: 0 84% 84%;
    --card: var(--surface);
    --card-foreground: var(--foreground);
    --popover: var(--surface-elevated);
    --popover-foreground: var(--foreground);
    --secondary: var(--surface-muted);
    --secondary-foreground: var(--foreground);
    --input: var(--border);
    --ring: var(--primary);
    --shadow-xs: 0 1px 2px hsl(0 0% 0% / 0.30);
    --shadow-sm: 0 1px 2px hsl(0 0% 0% / 0.35), 0 1px 3px hsl(0 0% 0% / 0.30);
    --shadow-md: 0 4px 6px -1px hsl(0 0% 0% / 0.40), 0 2px 4px -2px hsl(0 0% 0% / 0.30);
    --shadow-lg: 0 10px 15px -3px hsl(0 0% 0% / 0.45), 0 4px 6px -4px hsl(0 0% 0% / 0.35);
    --shadow-xl: 0 20px 25px -5px hsl(0 0% 0% / 0.50), 0 8px 10px -6px hsl(0 0% 0% / 0.35);
    --shadow-primary: 0 10px 25px -5px hsl(var(--primary) / 0.25);
}
```

### Step 1.4: Add the `.light` block (inverted toggle values)

Append immediately after `.dark`:

```css
.light {
    --background: 0 0% 100%;
    --foreground: 222 47% 11%;
    --surface: 0 0% 100%;
    --surface-muted: 220 14% 96%;
    --surface-elevated: 0 0% 100%;
    --border: 220 13% 91%;
    --border-strong: 220 13% 82%;
    --muted: 220 14% 96%;
    --muted-foreground: 220 9% 38%;
    --muted-foreground-dim: 220 9% 64%;
    --primary: 168 84% 24%;
    --primary-foreground: 0 0% 100%;
    --primary-hover: 168 84% 20%;
    --accent: 258 70% 42%;
    --accent-foreground: 0 0% 100%;
    --destructive: 0 72% 42%;
    --destructive-foreground: 0 0% 100%;
    --warning: 28 92% 38%;
    --warning-foreground: 0 0% 100%;
    --success: 168 84% 24%;
    --success-foreground: 0 0% 100%;
    --easy: 142 76% 28%;
    --easy-bg: 142 76% 96%;
    --easy-fg: 142 84% 22%;
    --medium: 28 92% 32%;
    --medium-bg: 33 100% 96%;
    --medium-fg: 26 90% 28%;
    --hard: 0 78% 42%;
    --hard-bg: 0 86% 97%;
    --hard-fg: 0 70% 32%;
    --card: var(--surface);
    --card-foreground: var(--foreground);
    --popover: var(--surface-elevated);
    --popover-foreground: var(--foreground);
    --secondary: var(--surface-muted);
    --secondary-foreground: var(--foreground);
    --input: var(--border);
    --ring: var(--primary);
    --shadow-xs: 0 1px 2px hsl(220 13% 20% / 0.04);
    --shadow-sm: 0 1px 2px hsl(220 13% 20% / 0.05), 0 1px 3px hsl(220 13% 20% / 0.06);
    --shadow-md: 0 4px 6px -1px hsl(220 13% 20% / 0.08), 0 2px 4px -2px hsl(220 13% 20% / 0.06);
    --shadow-lg: 0 10px 15px -3px hsl(220 13% 20% / 0.10), 0 4px 6px -4px hsl(220 13% 20% / 0.05);
    --shadow-xl: 0 20px 25px -5px hsl(220 13% 20% / 0.12), 0 8px 10px -6px hsl(220 13% 20% / 0.06);
    --shadow-primary: 0 10px 25px -5px hsl(var(--primary) / 0.15);
}
```

### Step 1.5: Extend `@theme inline` mappings for the new tokens

Locate the `@theme inline { ... }` block in `app/globals.css`. Append these mappings (preserve existing entries):

```css
@theme inline {
    /* ...existing mappings unchanged... */
    --color-card: hsl(var(--card));
    --color-card-foreground: hsl(var(--card-foreground));
    --color-popover: hsl(var(--popover));
    --color-popover-foreground: hsl(var(--popover-foreground));
    --color-secondary: hsl(var(--secondary));
    --color-secondary-foreground: hsl(var(--secondary-foreground));
    --color-input: hsl(var(--input));
    --color-muted-foreground-dim: hsl(var(--muted-foreground-dim));
}
```

### Step 1.6: Add the new utility classes (bracket, prompt, cursor, pill, scroll-fade)

Append after the `@theme inline` block in `app/globals.css`:

```css
.bracket { font-family: var(--font-mono); color: hsl(var(--primary)); }
.bracket::before { content: "[ "; color: hsl(var(--muted-foreground-dim)); }
.bracket::after  { content: " ]"; color: hsl(var(--muted-foreground-dim)); }

.prompt::before { content: "$ "; color: hsl(var(--accent)); font-family: var(--font-mono); }

@keyframes dl-cursor-blink { 50% { opacity: 0 } }
.cursor::after {
    content: "▊";
    color: hsl(var(--primary));
    margin-left: 4px;
    animation: dl-cursor-blink 1.1s steps(1) infinite;
    font-family: var(--font-mono);
}
@media (prefers-reduced-motion: reduce) {
    .cursor::after { animation: none; }
}

.pill {
    display: inline-flex; align-items: center; gap: 6px;
    padding: 2px 8px; border-radius: 4px;
    font-family: var(--font-mono); font-size: 11px;
    text-transform: uppercase; letter-spacing: 0.06em; font-weight: 600;
}
.pill-accepted { background: hsl(var(--success) / 0.12);     color: hsl(var(--success)); }
.pill-rejected { background: hsl(var(--destructive) / 0.12); color: hsl(var(--destructive)); }
.pill-pending  { background: hsl(var(--warning) / 0.12);     color: hsl(var(--warning)); }
.pill-draft    { background: hsl(var(--muted-foreground) / 0.12); color: hsl(var(--muted-foreground)); }

.scroll-fade { position: relative; }
.scroll-fade::after {
    content: "";
    position: absolute; top: 0; right: 0; bottom: 0;
    width: 36px;
    background: linear-gradient(to right, transparent, hsl(var(--surface)));
    pointer-events: none;
    transition: opacity 200ms ease;
}
.scroll-fade.at-end::after { opacity: 0; }
```

### Step 1.7: Add the `2xl` width to `components/ui/Container.tsx`

Open `components/ui/Container.tsx`. Find the `widths` record:

```ts
const widths: Record<Width, string> = {
    sm: "max-w-2xl",
    md: "max-w-4xl",
    lg: "max-w-6xl",
    xl: "max-w-7xl",
    full: "max-w-none",
}
```

Replace with (adds the `"2xl"` key, also extend the `Width` type alias above to include `"2xl"`):

```ts
type Width = "sm" | "md" | "lg" | "xl" | "2xl" | "full"

const widths: Record<Width, string> = {
    sm: "max-w-2xl",
    md: "max-w-4xl",
    lg: "max-w-6xl",
    xl: "max-w-7xl",
    "2xl": "max-w-screen-2xl",
    full: "max-w-none",
}
```

### Step 1.8: Create `components/ui/Eyebrow.tsx`

```tsx
import { cn } from "@/lib/utils"

type EyebrowVariant = "plain" | "bracket"

interface EyebrowProps {
    children: React.ReactNode
    variant?: EyebrowVariant
    className?: string
}

export function Eyebrow({ children, variant = "plain", className }: EyebrowProps) {
    return (
        <div
            className={cn(
                "text-[11px] font-mono uppercase tracking-widest",
                variant === "bracket" ? "bracket" : "text-muted-foreground",
                className
            )}
        >
            {children}
        </div>
    )
}
```

### Step 1.9: Create `components/ui/Kbd.tsx`

```tsx
import { cn } from "@/lib/utils"

interface KbdProps {
    children: React.ReactNode
    tone?: "default" | "on-primary"
    className?: string
}

export function Kbd({ children, tone = "default", className }: KbdProps) {
    return (
        <kbd
            className={cn(
                "inline-flex items-center justify-center font-mono",
                "border rounded px-1.5 py-0.5 text-[11px] min-w-[18px]",
                "shadow-[inset_0_-1px_0_hsl(var(--border))]",
                tone === "default"
                    ? "border-border bg-surface-muted text-foreground"
                    : "border-primary-foreground/30 bg-primary-foreground/20 text-primary-foreground",
                className
            )}
        >
            {children}
        </kbd>
    )
}
```

### Step 1.10: Create `components/ui/StatusPill.tsx`

```tsx
import { cn } from "@/lib/utils"

export type StatusPillStatus = "accepted" | "rejected" | "pending" | "draft"

interface StatusPillProps {
    status: StatusPillStatus
    label?: string
    icon?: React.ReactNode
    className?: string
}

const DEFAULT_LABEL: Record<StatusPillStatus, string> = {
    accepted: "▸ accepted",
    rejected: "✗ rejected",
    pending: "⊗ pending",
    draft: "· draft",
}

export function StatusPill({ status, label, icon, className }: StatusPillProps) {
    return (
        <span className={cn("pill", `pill-${status}`, className)}>
            {icon}
            <span>{label ?? DEFAULT_LABEL[status]}</span>
        </span>
    )
}
```

### Step 1.11: Create `components/ui/ScrollableTable.tsx`

```tsx
"use client"

import { useEffect, useRef, useState } from "react"
import { cn } from "@/lib/utils"

interface ScrollableTableProps {
    children: React.ReactNode
    className?: string
}

export function ScrollableTable({ children, className }: ScrollableTableProps) {
    const ref = useRef<HTMLDivElement>(null)
    const [atEnd, setAtEnd] = useState(true)

    useEffect(() => {
        const el = ref.current
        if (!el) return
        const check = () => {
            const overflows = el.scrollWidth > el.clientWidth + 1
            const reachedEnd =
                Math.abs(el.scrollLeft + el.clientWidth - el.scrollWidth) < 4
            setAtEnd(!overflows || reachedEnd)
        }
        check()
        el.addEventListener("scroll", check, { passive: true })
        const observer = new ResizeObserver(check)
        observer.observe(el)
        return () => {
            el.removeEventListener("scroll", check)
            observer.disconnect()
        }
    }, [])

    return (
        <div
            ref={ref}
            className={cn(
                "scroll-fade overflow-x-auto scrollbar-thin",
                atEnd && "at-end",
                className
            )}
        >
            {children}
        </div>
    )
}
```

### Step 1.12: Create `components/ui/CodeBlock.tsx`

```tsx
"use client"

import { useEffect, useState } from "react"
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter"
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism"
import { cn } from "@/lib/utils"

const WRAP_STORAGE_KEY = "dl:codeblock:wrap"
const prismTheme = vscDarkPlus as Record<string, React.CSSProperties>

interface CodeBlockProps {
    language?: string
    children: string
    className?: string
}

export function CodeBlock({ language, children, className }: CodeBlockProps) {
    const [wrap, setWrap] = useState<boolean | null>(null)

    useEffect(() => {
        try {
            const stored = window.localStorage.getItem(WRAP_STORAGE_KEY)
            setWrap(stored === "1")
        } catch {
            setWrap(false)
        }
    }, [])

    const toggleWrap = () => {
        setWrap((prev) => {
            const next = !prev
            try {
                window.localStorage.setItem(WRAP_STORAGE_KEY, next ? "1" : "0")
            } catch {}
            return next
        })
    }

    const isWrap = wrap === true
    const code = String(children).replace(/\n$/, "")

    return (
        <div className={cn("relative my-3 group", className)}>
            <button
                type="button"
                onClick={toggleWrap}
                className="absolute right-2 top-2 z-10 rounded-md border border-border bg-surface-muted/80 px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                aria-label={isWrap ? "Disable soft-wrap" : "Enable soft-wrap"}
            >
                {isWrap ? "no wrap" : "wrap"}
            </button>
            <SyntaxHighlighter
                style={prismTheme}
                language={language ?? "sql"}
                PreTag="div"
                wrapLongLines={isWrap}
                customStyle={{
                    borderRadius: "0.375rem",
                    fontSize: "12px",
                    lineHeight: "1.55",
                    padding: "0.75rem",
                    margin: 0,
                    border: "1px solid hsl(var(--border))",
                    background: "hsl(var(--surface-muted))",
                    whiteSpace: isWrap ? "pre-wrap" : "pre",
                }}
            >
                {code}
            </SyntaxHighlighter>
        </div>
    )
}
```

### Step 1.13: Sanity-build before shadcn init

Run:

```bash
npm run build
```

Expected: clean build. (Token migration is purely additive at this point — existing pages still work because every token they reference is defined.)

### Step 1.14: Run shadcn init with the non-default alias

```bash
npx shadcn@latest init --base radix --no-overwrite
```

When prompted for the components alias, answer **`@/components/shadcn`** (NOT the default). For other prompts, accept defaults (TypeScript yes, RSC yes, Tailwind v4, CSS file `app/globals.css`).

After init, verify `components.json`:

```bash
cat components.json
```

Expected `aliases.ui` value: `"@/components/shadcn"`. If anything else, edit `components.json` manually to set:

```json
"aliases": {
    "components": "@/components",
    "utils": "@/lib/utils",
    "ui": "@/components/shadcn",
    "lib": "@/lib",
    "hooks": "@/hooks"
}
```

Confirm `app/globals.css` is unchanged from your token edits:

```bash
git diff app/globals.css | head -40
```

If shadcn touched it despite `--no-overwrite`, revert with `git checkout app/globals.css` then re-apply tokens (`git checkout HEAD~1 app/globals.css` won't work since not yet committed; instead, keep a copy of your token edits on disk before running init).

### Step 1.15: Add the 18 shadcn components

Run one command (shadcn batches the install):

```bash
npx shadcn@latest add dialog tooltip sonner popover command dropdown-menu tabs separator alert-dialog sheet form field switch select checkbox radio-group toggle-group scroll-area
```

After the command completes, verify:

```bash
ls components/shadcn/
```

Expected files: `dialog.tsx`, `tooltip.tsx`, `sonner.tsx`, `popover.tsx`, `command.tsx`, `dropdown-menu.tsx`, `tabs.tsx`, `separator.tsx`, `alert-dialog.tsx`, `sheet.tsx`, `form.tsx`, `field.tsx`, `switch.tsx`, `select.tsx`, `checkbox.tsx`, `radio-group.tsx`, `toggle-group.tsx`, `scroll-area.tsx`. Plus any helper files shadcn shipped (`field-group.tsx` may be separate; check). Verify `components/ui/Button.tsx`, `Card.tsx`, `Input.tsx` etc. are unmodified:

```bash
git status components/ui
```

Expected: clean (no changes to `components/ui/`).

### Step 1.16: Create `scripts/check-shadcn-token-definitions.sh`

```bash
#!/bin/sh
# Verify every var(--X) reference in the component tree has a matching
# CSS declaration (^\s*--X\s*:) in app/globals.css.
# Run after shadcn add, and before commit on any token-touching change.

set -e

exit_code=0

refs=$(rg -hoE 'var\(--[a-z0-9-]+\)' \
    components/shadcn \
    components/ui \
    components/markdown \
    components/sql \
    components/practice \
    components/layout \
    components/admin \
    components/learn \
    components/me \
    components/lists \
    components/auth \
    app \
    2>/dev/null \
    | sed -E 's/var\((--[a-z0-9-]+)\)/\1/' \
    | sort -u)

for token in $refs; do
    if ! rg -q "^\s*${token}\s*:" app/globals.css; then
        echo "MISSING DECLARATION: $token"
        exit_code=1
    fi
done

exit $exit_code
```

Make it executable:

```bash
chmod +x scripts/check-shadcn-token-definitions.sh
```

### Step 1.17: Run the token-definition check

```bash
./scripts/check-shadcn-token-definitions.sh
```

Expected: exit 0 (no `MISSING DECLARATION` output). If any tokens are flagged, they're shadcn-required variables that need to be added to the `:root`/`.dark`/`.light` blocks. Common candidates the spec didn't preemptively cover: `--sidebar`, `--sidebar-foreground`, `--chart-1` through `--chart-5`. If shadcn pulled in a component that uses them (it shouldn't, given the install list), either add the tokens (aliasing to existing surfaces / `--accent`) or remove the offending component.

### Step 1.18: Build + typecheck

```bash
npx tsc --noEmit -p .
npm run build
```

Expected: both succeed. Build error usually means a token rename leaked in or a shadcn import path didn't resolve.

### Step 1.19: Commit

```bash
git add app/globals.css \
        components.json \
        components/ui/Eyebrow.tsx \
        components/ui/Kbd.tsx \
        components/ui/StatusPill.tsx \
        components/ui/ScrollableTable.tsx \
        components/ui/CodeBlock.tsx \
        components/ui/Container.tsx \
        components/shadcn \
        scripts/check-shadcn-token-definitions.sh \
        package.json \
        package-lock.json \
        lib/utils.ts
git commit -m "feat(ui): UI v2 foundation — tokens, primitives, shadcn init"
```

---

## Task 2: Fix pre-existing palette violations in NewsFeed.tsx

The CI palette guard (next task) requires the working tree to be free of hardcoded palette classes. `components/NewsFeed.tsx` has five violations from before UI v2.

**Files:**
- Modify: `components/NewsFeed.tsx`

### Step 2.1: Open the file and locate the five violations

```bash
grep -nE "bg-white|text-red-500|text-blue-700|text-gray-(500|600)" components/NewsFeed.tsx
```

Expected output (line numbers may differ slightly):

```
8:        return <div className="text-red-500 text-sm">Failed to load news.</div>
12:        <div className="bg-white rounded-xl shadow-sm border p-6">
22:                            className="font-semibold text-blue-700 hover:underline block"
26:                        <p className="text-xs text-gray-500 mt-1">
29:                        <p className="text-sm text-gray-600 mt-2 line-clamp-2">
```

### Step 2.2: Apply the five replacements

In `components/NewsFeed.tsx`:

- Line 8: `text-red-500` → `text-destructive`
- Line 12: `bg-white` → `bg-surface`
- Line 22: `text-blue-700` → `text-primary` (and `hover:underline` becomes `hover:text-primary-hover hover:underline` for consistency with v2 link behavior)
- Line 26: `text-gray-500` → `text-muted-foreground`
- Line 29: `text-gray-600` → `text-muted-foreground`

### Step 2.3: Confirm the file is clean

```bash
grep -nE "bg-(white|black|slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-?[0-9]*|text-(white|black|slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-?[0-9]*" components/NewsFeed.tsx
```

Expected: no output.

### Step 2.4: Visually test in dev

```bash
npm run dev
```

Open whatever page renders `<NewsFeed/>` (likely the home page). Confirm the news cards still render, links remain blue-ish (now `text-primary` teal), and the error state stays readable.

### Step 2.5: Commit

```bash
git add components/NewsFeed.tsx
git commit -m "fix(ui): migrate NewsFeed.tsx off hardcoded palette classes"
```

---

## Task 3: CI palette guard wired in

Lands the denylist script and wires it into the test workflow.

**Files:**
- Create: `scripts/check-no-palette-colors.sh`
- Modify: `.github/workflows/test.yml`

### Step 3.1: Create the denylist script

```bash
cat > scripts/check-no-palette-colors.sh <<'EOF'
#!/bin/sh
# UI v2 anti-regression guard: forbid hardcoded Tailwind palette classes.
# Use semantic tokens (bg-background, text-foreground, etc.) instead.

set -e

PALETTE='(slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)'
PREFIXES='(bg|text|border|from|to|ring|fill|stroke|outline|divide|placeholder|accent)'

# Tailwind palette colors with shade numbers
pattern1="\\b${PREFIXES}-${PALETTE}-[0-9]{2,3}\\b"
# Absolute white/black with the same prefixes
pattern2="\\b(bg|text|border|from|to|ring|fill|stroke|outline|divide)-(white|black)\\b"

violations=$(
    rg -n -e "$pattern1" -e "$pattern2" \
        app components \
        --glob '!**/node_modules/**' \
        --glob '!components/shadcn/**' \
        2>/dev/null \
    || true
)

if [ -n "$violations" ]; then
    echo "Hardcoded palette classes found. Use semantic tokens instead."
    echo "---"
    echo "$violations"
    exit 1
fi

exit 0
EOF
chmod +x scripts/check-no-palette-colors.sh
```

Note: `components/shadcn/**` is excluded from the scan because shadcn-generated files use semantic tokens but the CLI may emit them in ways the regex misreads. We trust shadcn output (verified via Task 1's token-definition check instead).

### Step 3.2: Run the script locally to verify it exits clean

```bash
./scripts/check-no-palette-colors.sh
echo "exit=$?"
```

Expected: `exit=0`. If any violations are reported, fix them inline (the same approach as Task 2 for NewsFeed) before proceeding.

### Step 3.3: Wire the script into CI

Open `.github/workflows/test.yml`. Find the existing `jobs:` block. Add a new job (or extend an existing one) that runs the script:

```yaml
  palette-guard:
    name: Forbidden Tailwind palette classes
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Run palette guard
        run: ./scripts/check-no-palette-colors.sh
```

If the workflow already has a "lint" or "checks" job that's cheap, add the script as a step there instead — saves a runner. Example:

```yaml
      - name: Palette guard
        run: ./scripts/check-no-palette-colors.sh
```

### Step 3.4: Commit

```bash
git add scripts/check-no-palette-colors.sh .github/workflows/test.yml
git commit -m "feat(ci): block hardcoded Tailwind palette classes"
```

---

## Task 4: Workspace migration (max A flavor)

Migrate `components/sql/SqlPlayground.tsx`, `components/practice/ProblemPanel.tsx`, and `components/sql/ResultTable.tsx`. This is where the hacky vibe lives loudest — bracket eyebrow labels, `$` prompt on the editor tab, `[ RESULT ]` header, `▸ ACCEPTED` status pill, monospace status line, blinking cursor at editor end (only when focused), `⌘↵` `Kbd` chip on the Run button.

**Files:**
- Modify: `components/sql/SqlPlayground.tsx`
- Modify: `components/sql/ResultTable.tsx`
- Modify: `components/practice/ProblemPanel.tsx`
- Modify: `components/markdown/MarkdownRenderer.tsx` (use `<CodeBlock>` for code blocks)
- Modify: `components/markdown/directives/Mermaid.tsx` (wrap in `<ScrollableTable>`)
- Modify: `components/markdown/directives/Callout.tsx` (bracketed labels)

### Step 4.1: ResultTable — use `<ScrollableTable>` + `<StatusPill>`

Open `components/sql/ResultTable.tsx`. Identify the existing scroll container (currently `<div className="... overflow-auto ...">`). Wrap the table's overflow container in `<ScrollableTable>`:

Find:

```tsx
<div className="min-h-0 flex-1 overflow-auto scrollbar-thin">
    <table>...</table>
</div>
```

Replace with:

```tsx
import { ScrollableTable } from "@/components/ui/ScrollableTable"

// ...inside the component body
<div className="min-h-0 flex-1">
    <ScrollableTable className="h-full">
        <table>...</table>
    </ScrollableTable>
</div>
```

Where the table currently shows an "ACCEPTED" or status indicator, replace it with `<StatusPill>`:

```tsx
import { StatusPill } from "@/components/ui/StatusPill"

// e.g., in the header bar above the table
<StatusPill status="accepted" />
```

### Step 4.2: SqlPlayground — editor tab gets `$ query.sql` prompt + Kbd

Open `components/sql/SqlPlayground.tsx`. Find the editor header / toolbar block (where the file name and dialect picker live).

Replace the file-name span with the `.prompt`-prefixed monospace label:

```tsx
import { Eyebrow } from "@/components/ui/Eyebrow"
import { Kbd } from "@/components/ui/Kbd"
import { StatusPill } from "@/components/ui/StatusPill"

// e.g., editor header
<div className="surface-2 border-b border-border px-4 py-2 flex items-center justify-between text-[12px] font-mono">
    <div className="flex items-center gap-3">
        <span className="prompt text-muted-foreground">query.sql</span>
        <span className="text-muted-foreground-dim">·</span>
        <span className="text-muted-foreground">{dialect}</span>
    </div>
    <div className="flex items-center gap-2 text-muted-foreground">
        <span>{lineCount} lines</span>
        <span className="text-muted-foreground-dim">·</span>
        <span>autosave {autosaveAge}</span>
    </div>
</div>
```

(The exact JSX wrap will depend on the current code shape; preserve all existing wires. The point is the `.prompt` class, the muted-foreground-dim separator dots, and tabular-nums on numeric spans.)

### Step 4.3: SqlPlayground — Run button gets the `⌘↵` Kbd inside

Find the Run button. Replace its inner content:

```tsx
<button
    onClick={handleRun}
    disabled={isRunning}
    className="px-3 py-1.5 rounded-md text-[13px] font-medium bg-primary text-primary-foreground inline-flex items-center gap-2"
>
    <span>▸ Run</span>
    <Kbd tone="on-primary">⌘↵</Kbd>
</button>
```

The Submit button gets `<Kbd>⌘⇧↵</Kbd>` (default tone since it's a secondary button).

### Step 4.4: SqlPlayground — result panel `[ RESULT ]` eyebrow + monospace status line

Find the result panel header. Replace with:

```tsx
<div className="px-4 py-2 border-b border-border flex items-center justify-between">
    <div className="flex items-center gap-3 text-[12px] font-mono">
        <Eyebrow variant="bracket">RESULT</Eyebrow>
        <span className="text-muted-foreground tabular-nums">{rowCount} rows</span>
        <span className="text-muted-foreground-dim">·</span>
        <span className="text-muted-foreground tabular-nums">{elapsedSec}s</span>
    </div>
    <div className="flex items-center gap-2">
        {resultStatus && <StatusPill status={resultStatus} />}
    </div>
</div>
```

### Step 4.5: SqlPlayground — blinking cursor at editor end when focused

The Monaco editor manages its own cursor, so this is purely cosmetic. Skip the `.cursor` class on Monaco itself. Apply `.cursor` only to small static prompts (e.g., a "live status" indicator that says `connected` with a blinking cursor on the dialect-init path). This is decorative; keep it sparing.

If a specific use case isn't obvious, omit the cursor in this commit and revisit in a polish pass.

### Step 4.6: ProblemPanel — replace inline tab state with shadcn `<Tabs>`

Open `components/practice/ProblemPanel.tsx`. Find the inline tab logic (currently a `<div>` with `flex` and buttons that toggle a local `useState` for active tab).

Replace with shadcn Tabs:

```tsx
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/shadcn/tabs"

// ...inside JSX
<Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col flex-1 min-h-0">
    <TabsList className="border-b border-border px-3 pt-2 bg-transparent rounded-none justify-start">
        <TabsTrigger value="prompt" className="text-[12px] font-mono">prompt</TabsTrigger>
        <TabsTrigger value="schema" className="text-[12px] font-mono">schema</TabsTrigger>
        <TabsTrigger value="input" className="text-[12px] font-mono">input</TabsTrigger>
        <TabsTrigger value="hints" className="text-[12px] font-mono">hints ({hintCount})</TabsTrigger>
        <TabsTrigger value="discuss" className="ml-auto text-[12px] font-mono">discuss ({discussCount})</TabsTrigger>
    </TabsList>
    <TabsContent value="prompt" className="px-5 py-4 text-[13px] leading-relaxed text-foreground flex-1 overflow-y-auto">
        {/* existing prompt JSX */}
    </TabsContent>
    {/* etc for other tabs */}
</Tabs>
```

Remove the local `useState` for tab tracking; `Tabs.value`/`onValueChange` replaces it.

### Step 4.7: Callout directive — bracketed label

Open `components/markdown/directives/Callout.tsx`. Find where the callout renders its kind-specific label (e.g., "Tip", "Pitfall"). Replace with the bracketed eyebrow:

```tsx
import { Eyebrow } from "@/components/ui/Eyebrow"

// inside the JSX, replacing the existing kind-label span
<Eyebrow variant="bracket" className="mb-1">{kind.toUpperCase()}</Eyebrow>
```

### Step 4.8: MarkdownRenderer — use `<CodeBlock>`

Open `components/markdown/MarkdownRenderer.tsx`. Find the `code({ className, children }: ...)` component override that currently inlines `<SyntaxHighlighter>` with `vscDarkPlus`. Replace with `<CodeBlock>`:

```tsx
import { CodeBlock } from "@/components/ui/CodeBlock"

const components = {
    code({ className, children }: ComponentPropsWithoutRef<"code">) {
        const match = /language-(\w+)/.exec(className || "")
        if (match) {
            return <CodeBlock language={match[1]}>{String(children)}</CodeBlock>
        }
        return <code className={className}>{children}</code>
    },
    // ...rest unchanged
} as Components
```

### Step 4.9: MarkdownRenderer — wrap prose tables in ScrollableTable

Same file. Override the `table` element:

```tsx
import { ScrollableTable } from "@/components/ui/ScrollableTable"

const components = {
    // ...
    table({ children }: ComponentPropsWithoutRef<"table">) {
        return (
            <ScrollableTable className="my-3 rounded-md border border-border">
                <table className="w-full text-[12px]">{children}</table>
            </ScrollableTable>
        )
    },
} as Components
```

### Step 4.10: Mermaid directive — wrap output in ScrollableTable

Open `components/markdown/directives/Mermaid.tsx`. Find the render boundary where the SVG is mounted (likely a wrapping `<div>`). Wrap it:

```tsx
import { ScrollableTable } from "@/components/ui/ScrollableTable"

// inside the component, replacing the current outer wrapper
<figure className="my-6 overflow-hidden rounded-lg border border-border bg-surface" aria-label={alt}>
    <ScrollableTable className="bg-surface-muted">
        <div className="flex items-center justify-center p-6">
            <MermaidClient source={source} idHint={...} />
        </div>
    </ScrollableTable>
    {caption && (
        <figcaption className="border-t border-border px-4 py-2.5 text-sm text-muted-foreground">
            {caption}
        </figcaption>
    )}
</figure>
```

### Step 4.11: Smoke locally

```bash
npm run dev
```

Open `http://localhost:3000/practice/joins/how-a-join-works` (or any practice problem). Verify:
- Editor tab shows `$ query.sql` with violet `$` prefix
- Run button shows `▸ Run` + a `⌘↵` chip inline
- After clicking Run, result panel shows `[ RESULT ]` eyebrow + monospace stats + `▸ accepted` pill
- Wide result tables show the right-edge fade gradient; scrolling to the end makes it disappear
- Problem panel tabs work; styling matches shadcn defaults

### Step 4.12: Run the verification scripts

```bash
./scripts/check-no-palette-colors.sh
./scripts/check-shadcn-token-definitions.sh
npx tsc --noEmit -p .
```

Expected: all three exit 0.

### Step 4.13: Commit

```bash
git add components/sql components/practice components/markdown
git commit -m "feat(workspace): UI v2 chrome — bracket eyebrows, status pills, fade-edge tables"
```

---

## Task 5: Public dashboards — `/practice` catalog, Learn lane index, tracks index, daily

Widen these surfaces to `2xl`, add bracketed eyebrows, monospace stat blocks, lane labels on Learn, and tag-chip mono treatment.

**Files:**
- Modify: `app/practice/page.tsx`
- Modify: `app/practice/tags/page.tsx`
- Modify: `app/practice/tags/[slug]/page.tsx`
- Modify: `app/learn/page.tsx` (already has lane sections; tighten chrome)
- Modify: `app/learn/tracks/page.tsx`
- Modify: `app/learn/tracks/[slug]/page.tsx`
- Modify: `app/daily/page.tsx` (likely just a redirect; verify nothing renders)

### Step 5.1: `/practice` catalog

In `app/practice/page.tsx`:

1. Change `<Container width="lg" ...>` → `<Container width="2xl" ...>`.
2. Above the page title, add an eyebrow:
   ```tsx
   import { Eyebrow } from "@/components/ui/Eyebrow"
   // ...
   <Eyebrow variant="bracket" className="mb-1">CATALOG</Eyebrow>
   <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">Practice</h1>
   ```
3. Add a 4-column stat block under the title (Solved, Easy, Medium, Hard counts) using `tabular-nums` monospace numbers and uppercase eyebrow labels:
   ```tsx
   <div className="mt-4 grid grid-cols-4 gap-6 text-[12px]">
       <div>
           <Eyebrow>Solved</Eyebrow>
           <div className="mt-1 flex items-baseline gap-2">
               <span className="text-[20px] font-semibold tabular-nums">{stats.solved}</span>
               <span className="text-muted-foreground font-mono text-[11px]">/ {stats.total}</span>
           </div>
       </div>
       {/* same for easy/medium/hard with badge-easy/medium/hard text color */}
   </div>
   ```
   The `getProblems`/`getSolvedSlugs` server actions already return what's needed; aggregate the counts in the server component.
4. Each problem card: monospace problem ID with `text-[11px]` and `text-muted-foreground`; tag chips in lowercase mono (existing `<TagPill>` already does this).
5. If a search input exists, prefix or trailing a `<Kbd>/</Kbd>` placeholder hint.

### Step 5.2: `/practice/tags` and `/practice/tags/[slug]`

Both pages:
- Container `2xl`.
- Eyebrow `TAGS` (index) or `TAG: <slug>` (detail).
- Tag chip rendering in lowercase monospace; existing `<TagPill>` already does this.
- Use `<ScrollableTable>` for the per-tag problem list if it's a table; else the standard card grid.

### Step 5.3: `/learn` lane index

In `app/learn/page.tsx`:

1. `<Container width="lg">` → `<Container width="2xl">`.
2. Add `<Eyebrow variant="bracket" className="mb-1">SQL FUNDAMENTALS</Eyebrow>` and `<Eyebrow variant="bracket" className="mb-1">DATA ENGINEERING CONCEPTS</Eyebrow>` above each lane section.
3. The lane sections themselves already exist (from the curriculum-v1 work); preserve them.

### Step 5.4: `/learn/tracks` and `/learn/tracks/[slug]`

- Index: `<Container width="2xl">`, eyebrow `TRACKS`.
- Detail page: keep `lg` width; no eyebrow needed (track title is the heading).

### Step 5.5: `/daily`

Open `app/daily/page.tsx`. If it's a server-side redirect (likely just `redirect(...)`), no UI changes. Add a comment confirming.

### Step 5.6: Smoke + verify

```bash
npm run dev
# Visit /practice, /practice/tags, /learn, /learn/tracks
```

Confirm: 4-column problem-card grids on `/practice` at ≥1440px viewport, lane eyebrows on `/learn`, etc.

```bash
./scripts/check-no-palette-colors.sh
./scripts/check-shadcn-token-definitions.sh
npx tsc --noEmit -p .
```

All exit 0.

### Step 5.7: Commit

```bash
git add app/practice app/learn app/daily
git commit -m "feat(public): UI v2 dashboard surfaces — 2xl width, eyebrows, stat blocks"
```

---

## Task 6: Article reader narrows to `md`; callouts get bracketed labels

The article reader is currently too wide for prose. Narrow it.

**Files:**
- Modify: `app/learn/[topicSlug]/page.tsx`
- Modify: `app/learn/[topicSlug]/[articleSlug]/page.tsx`

### Step 6.1: Narrow the article reader

In `app/learn/[topicSlug]/[articleSlug]/page.tsx`:

1. `<Container width="xl">` → `<Container width="md">`.
2. Above the title, add the topic name as a bracketed eyebrow:
   ```tsx
   <Eyebrow variant="bracket" className="mb-2">{topic.name.toUpperCase()}</Eyebrow>
   <h1 className="text-[32px] sm:text-[34px] font-bold tracking-tight leading-tight">{article.title}</h1>
   ```
3. The TOC right rail already exists; preserve.
4. The "Try these next" panel (RelatedProblemsPanel) — add a bracketed eyebrow above it: `<Eyebrow variant="bracket">PRACTICE</Eyebrow>`.

### Step 6.2: Topic detail page stays narrow

In `app/learn/[topicSlug]/page.tsx`:
- Keep `<Container width="md">`.
- Above the title, add `<Eyebrow variant="bracket">{lane === "SQL" ? "SQL FUNDAMENTALS" : "DATA ENGINEERING CONCEPTS"}</Eyebrow>`.

### Step 6.3: Smoke + commit

```bash
npm run dev
# Visit /learn/joins/how-a-join-works
```

Confirm: narrow column (~720px content width), bracket eyebrow above title, callouts inside the article body show bracketed labels (Task 4 already migrated `Callout.tsx`).

```bash
./scripts/check-no-palette-colors.sh
npx tsc --noEmit -p .
```

```bash
git add app/learn
git commit -m "feat(learn): UI v2 article reader — md width, bracket eyebrows"
```

---

## Task 7: Remaining public + contributor surfaces

Sweep the long-tail surfaces: home, profile, sign-in, legal, `/me/*`, `/[slug]`.

**Files:**
- Modify: `app/page.tsx`
- Modify: `app/profile/page.tsx`
- Modify: `app/auth/signin/page.tsx`
- Modify: `app/terms/page.tsx` (verify token re-tone renders correctly; likely no JSX change needed)
- Modify: `app/privacy/page.tsx` (verify token re-tone)
- Modify: `app/me/articles/page.tsx`, `app/me/articles/new/page.tsx`, `app/me/articles/[slug]/edit/page.tsx`
- Modify: `app/me/lists/page.tsx`, `app/me/lists/[id]/page.tsx`
- Modify: `app/[slug]/page.tsx` (verify renders correctly)

### Step 7.1: `/` (home)

Open `app/page.tsx`. Above the hero, add `<Eyebrow variant="plain">DATA LEARN</Eyebrow>` or similar (preserve existing brand voice — eyebrow is subtle). CTAs get inline `<Kbd>` hints where natural.

### Step 7.2: `/profile`

Stat block labels become eyebrow-style; submission history rows get `<StatusPill>` for accepted/rejected status.

### Step 7.3: `/auth/signin`

Above the brand mark / heading, `<Eyebrow variant="bracket">SIGN IN</Eyebrow>`. Provider buttons keep existing layout; chrome aligns with new tokens.

### Step 7.4: `/me/articles` group

- List page: `<Container width="lg">`, `<Eyebrow variant="bracket">MY ARTICLES</Eyebrow>`. Status pills per row using `<StatusPill>`. `hasVisualBlocks` badge — small `<Eyebrow>` chip above title.
- New/edit pages: same eyebrow pattern (`NEW ARTICLE` / `EDIT`). Forms continue to use the existing hand-rolled `<Field>` / `<Input>` patterns from `components/ui/`; do NOT migrate to shadcn Form here (Task 10 covers admin forms).

### Step 7.5: `/me/lists` group

- List page: `<Container width="lg">`, eyebrow `MY LISTS`.
- Detail page: eyebrow `LIST: {list.name}`, monospace problem IDs in the list items, drag-to-reorder behavior preserved.

### Step 7.6: `/[slug]` dynamic CMS page

No JSX changes required. The `<MarkdownRenderer>` migration in Task 4 already updated how content renders.

### Step 7.7: `/terms`, `/privacy`

Visual verification only. The token re-tone applies; ensure cards/paragraphs read well in dark and light.

### Step 7.8: Smoke + commit

```bash
npm run dev
# Visit each surface
```

```bash
./scripts/check-no-palette-colors.sh
./scripts/check-shadcn-token-definitions.sh
npx tsc --noEmit -p .
```

```bash
git add app/page.tsx app/profile app/auth app/me app/terms app/privacy 'app/[slug]'
git commit -m "feat(ui): UI v2 sweep — home, profile, signin, /me/*, legal"
```

---

## Task 8: New `/admin` dashboard

The current `/admin` is a list of links to subpages. Replace with a real overview: metric cards + recent activity feed + quick actions row.

**Files:**
- Create: `actions/admin-dashboard.ts`
- Create: `components/admin/AdminDashboard.tsx`
- Create: `components/admin/MetricCard.tsx`
- Create: `components/admin/RecentActivityFeed.tsx`
- Create: `components/admin/AdminQuickActions.tsx`
- Modify: `app/admin/page.tsx`

### Step 8.1: Define dashboard data queries

Create `actions/admin-dashboard.ts`:

```ts
"use server"

import { prisma } from "@/lib/prisma"

export type AdminMetric = {
    label: string
    value: number
    delta?: number // 7-day change, optional
    href: string
}

export type AdminActivityItem = {
    id: string
    kind: "submission" | "article-submitted" | "discussion-comment" | "problem-reported"
    label: string
    detail: string
    timestamp: Date
    href: string
}

export async function getAdminDashboardMetrics(): Promise<AdminMetric[]> {
    const [problemCount, articleCount, trackCount, submissionsLast7d, pendingReports, pendingArticles] = await Promise.all([
        prisma.sQLProblem.count(),
        prisma.article.count({ where: { status: "PUBLISHED" } }),
        prisma.track.count({ where: { status: "PUBLISHED" } }),
        prisma.submission.count({
            where: { createdAt: { gte: new Date(Date.now() - 7 * 24 * 3600 * 1000) } },
        }),
        prisma.problemReport.count({ where: { status: "OPEN" } }),
        prisma.article.count({ where: { status: "SUBMITTED" } }),
    ])
    return [
        { label: "Problems", value: problemCount, href: "/admin/problems" },
        { label: "Articles", value: articleCount, href: "/admin/articles" },
        { label: "Tracks", value: trackCount, href: "/admin/tracks" },
        { label: "Submissions (7d)", value: submissionsLast7d, href: "/admin/problems" },
        { label: "Open reports", value: pendingReports, href: "/admin/reports" },
        { label: "Pending review", value: pendingArticles, href: "/admin/articles?status=SUBMITTED" },
    ]
}

export async function getAdminRecentActivity(limit = 12): Promise<AdminActivityItem[]> {
    const since = new Date(Date.now() - 14 * 24 * 3600 * 1000)

    const [recentSubmissions, recentArticles, recentReports] = await Promise.all([
        prisma.submission.findMany({
            where: { createdAt: { gte: since }, status: "ACCEPTED" },
            take: limit,
            orderBy: { createdAt: "desc" },
            include: { user: { select: { name: true, email: true } }, problem: { select: { slug: true, number: true, title: true } } },
        }),
        prisma.article.findMany({
            where: { status: "SUBMITTED", updatedAt: { gte: since } },
            take: limit,
            orderBy: { updatedAt: "desc" },
            include: { author: { select: { name: true, email: true } } },
        }),
        prisma.problemReport.findMany({
            where: { createdAt: { gte: since } },
            take: limit,
            orderBy: { createdAt: "desc" },
            include: { problem: { select: { slug: true, number: true, title: true } } },
        }),
    ])

    const items: AdminActivityItem[] = []
    for (const s of recentSubmissions) {
        items.push({
            id: `submission-${s.id}`,
            kind: "submission",
            label: "Submission accepted",
            detail: `${s.user.name ?? s.user.email} · #${s.problem.number} ${s.problem.title}`,
            timestamp: s.createdAt,
            href: `/practice/${s.problem.slug}`,
        })
    }
    for (const a of recentArticles) {
        items.push({
            id: `article-${a.id}`,
            kind: "article-submitted",
            label: "Article submitted for review",
            detail: `${a.author.name ?? a.author.email} · ${a.title}`,
            timestamp: a.updatedAt,
            href: `/admin/articles/${a.slug}/edit`,
        })
    }
    for (const r of recentReports) {
        items.push({
            id: `report-${r.id}`,
            kind: "problem-reported",
            label: "Problem reported",
            detail: `#${r.problem.number} ${r.problem.title}`,
            timestamp: r.createdAt,
            href: `/admin/reports`,
        })
    }
    return items.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()).slice(0, limit)
}
```

Note: this assumes Prisma models `SQLProblem`, `Article`, `Track`, `Submission`, `ProblemReport` and their existing fields. If a field doesn't exist (e.g., `status` on `ProblemReport`), check the actual schema (`prisma/schema.prisma`) and adjust before running.

### Step 8.2: Create `MetricCard.tsx`

```tsx
import Link from "next/link"
import { Eyebrow } from "@/components/ui/Eyebrow"
import type { AdminMetric } from "@/actions/admin-dashboard"

export function MetricCard({ metric }: { metric: AdminMetric }) {
    return (
        <Link
            href={metric.href}
            className="block rounded-lg border border-border bg-surface p-4 transition-colors hover:border-border-strong"
        >
            <Eyebrow>{metric.label}</Eyebrow>
            <div className="mt-2 flex items-baseline gap-2">
                <span className="text-3xl font-semibold tabular-nums">{metric.value.toLocaleString()}</span>
            </div>
        </Link>
    )
}
```

### Step 8.3: Create `RecentActivityFeed.tsx`

```tsx
import Link from "next/link"
import { formatDistanceToNow } from "date-fns"
import { Eyebrow } from "@/components/ui/Eyebrow"
import type { AdminActivityItem } from "@/actions/admin-dashboard"

export function RecentActivityFeed({ items }: { items: AdminActivityItem[] }) {
    return (
        <div className="rounded-lg border border-border bg-surface">
            <div className="border-b border-border px-4 py-3">
                <Eyebrow variant="bracket">RECENT ACTIVITY</Eyebrow>
            </div>
            <ul className="divide-y divide-border">
                {items.length === 0 ? (
                    <li className="px-4 py-6 text-sm text-muted-foreground">No activity in the last 14 days.</li>
                ) : (
                    items.map((item) => (
                        <li key={item.id} className="px-4 py-3 text-sm hover:bg-surface-muted">
                            <Link href={item.href} className="block">
                                <div className="font-medium">{item.label}</div>
                                <div className="mt-0.5 text-[12px] text-muted-foreground">{item.detail}</div>
                                <div className="mt-1 text-[11px] text-muted-foreground-dim font-mono">
                                    {formatDistanceToNow(item.timestamp, { addSuffix: true })}
                                </div>
                            </Link>
                        </li>
                    ))
                )}
            </ul>
        </div>
    )
}
```

### Step 8.4: Create `AdminQuickActions.tsx`

```tsx
import Link from "next/link"
import { Kbd } from "@/components/ui/Kbd"

const actions = [
    { label: "+ new problem", href: "/admin/problems/new", shortcut: "P" },
    { label: "+ new article", href: "/admin/articles/new", shortcut: "A" },
    { label: "+ new track",   href: "/admin/tracks/new",   shortcut: "T" },
    { label: "+ new topic",   href: "/admin/topics",       shortcut: "O" },
]

export function AdminQuickActions() {
    return (
        <div className="flex flex-wrap items-center gap-2">
            {actions.map((a) => (
                <Link
                    key={a.href}
                    href={a.href}
                    className="inline-flex items-center gap-2 rounded-md border border-border bg-surface-muted px-3 py-1.5 text-[13px] font-medium hover:border-border-strong hover:bg-surface-elevated"
                >
                    <span>{a.label}</span>
                    <Kbd>⌥{a.shortcut}</Kbd>
                </Link>
            ))}
        </div>
    )
}
```

### Step 8.5: Create the top-level `AdminDashboard.tsx`

```tsx
import { Eyebrow } from "@/components/ui/Eyebrow"
import { MetricCard } from "@/components/admin/MetricCard"
import { RecentActivityFeed } from "@/components/admin/RecentActivityFeed"
import { AdminQuickActions } from "@/components/admin/AdminQuickActions"
import { getAdminDashboardMetrics, getAdminRecentActivity } from "@/actions/admin-dashboard"

export async function AdminDashboard() {
    const [metrics, activity] = await Promise.all([
        getAdminDashboardMetrics(),
        getAdminRecentActivity(),
    ])

    return (
        <div className="space-y-8">
            <header className="flex items-end justify-between gap-4 flex-wrap">
                <div>
                    <Eyebrow variant="bracket" className="mb-1">ADMIN</Eyebrow>
                    <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
                </div>
                <AdminQuickActions />
            </header>

            <section>
                <Eyebrow className="mb-3">OVERVIEW</Eyebrow>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                    {metrics.map((m) => (
                        <MetricCard key={m.label} metric={m} />
                    ))}
                </div>
            </section>

            <section>
                <RecentActivityFeed items={activity} />
            </section>
        </div>
    )
}
```

### Step 8.6: Wire into `app/admin/page.tsx`

Replace the existing contents with:

```tsx
import { Container } from "@/components/ui/Container"
import { AdminDashboard } from "@/components/admin/AdminDashboard"

export default async function AdminPage() {
    return (
        <Container width="2xl" className="py-10 sm:py-14">
            <AdminDashboard />
        </Container>
    )
}
```

(The admin auth check is already at the middleware + layout level; no per-page guard needed.)

### Step 8.7: Smoke

```bash
npm run dev
# Visit /admin (must be logged in as ADMIN)
```

Confirm: 6 metric cards in a row, quick actions row at top right, recent activity feed below. Page TTFB should feel snappy (≤ 500ms on a warm dev server).

### Step 8.8: Verify + commit

```bash
./scripts/check-no-palette-colors.sh
./scripts/check-shadcn-token-definitions.sh
npx tsc --noEmit -p .
```

```bash
git add actions/admin-dashboard.ts components/admin app/admin/page.tsx
git commit -m "feat(admin): UI v2 dashboard — metrics, activity feed, quick actions"
```

---

## Task 9: Admin list pages (broad sweep)

Migrate all admin list pages to a shared chrome: `2xl` Container, bracketed eyebrow, shadcn `Tabs` for status filters where applicable, `<ScrollableTable>` for wide tables, status pills, action `DropdownMenu`s where they exist.

**Files:**
- Create: `components/admin/AdminListShell.tsx`
- Modify: `app/admin/problems/page.tsx`
- Modify: `app/admin/articles/page.tsx`
- Modify: `app/admin/tracks/page.tsx`
- Modify: `app/admin/discussions/page.tsx`
- Modify: `app/admin/schemas/page.tsx`
- Modify: `app/admin/moderators/page.tsx`
- Modify: `app/admin/topics/page.tsx`
- Modify: `app/admin/tags/page.tsx`
- Modify: `app/admin/api-keys/page.tsx`
- Modify: `app/admin/contributors/page.tsx`
- Modify: `app/admin/reports/page.tsx`

### Step 9.1: Create the shared shell

`components/admin/AdminListShell.tsx`:

```tsx
import type { ReactNode } from "react"
import { Container } from "@/components/ui/Container"
import { Eyebrow } from "@/components/ui/Eyebrow"

interface AdminListShellProps {
    eyebrow: string  // uppercase; rendered inside [ ... ]
    title: string
    description?: string
    actions?: ReactNode  // typically a "+ new X" button
    children: ReactNode  // the list / table content
}

export function AdminListShell({ eyebrow, title, description, actions, children }: AdminListShellProps) {
    return (
        <Container width="2xl" className="py-10 sm:py-14">
            <header className="flex items-end justify-between gap-4 mb-6 flex-wrap">
                <div>
                    <Eyebrow variant="bracket" className="mb-1">{eyebrow}</Eyebrow>
                    <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
                    {description && (
                        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
                    )}
                </div>
                {actions && <div>{actions}</div>}
            </header>
            {children}
        </Container>
    )
}
```

### Step 9.2: Migration template per list page

For each admin list page, apply the same recipe (adapt content per page):

1. Replace the existing top-level layout with `<AdminListShell eyebrow="..." title="..." actions={...}>...</AdminListShell>`.
2. Wrap the existing table in `<ScrollableTable>`. If the table doesn't use `<table>` semantically yet (e.g., a CSS grid), keep current markup but ensure the wrapper `<div>` is the `<ScrollableTable>`.
3. Replace row-status indicators with `<StatusPill status={...}>`. For status enum values like `DRAFT|SUBMITTED|PUBLISHED|ARCHIVED`, map to `pill-draft|pill-pending|pill-accepted|pill-rejected` (or use a per-table mapping in a small helper).
4. If the page has client-side status filtering (e.g., `/admin/articles` filtering by `status`), replace the inline tab buttons with shadcn `<Tabs>` + `<TabsList>` + `<TabsTrigger value="draft|submitted|published|archived">`.
5. If the page has a search input, wrap in `<div className="relative">` and add a leading icon + trailing `<Kbd>/</Kbd>` hint (cosmetic).
6. If the page has destructive actions (delete buttons), open a shadcn `<AlertDialog>` for confirmation instead of `confirm()`.

### Step 9.3: Page-by-page deltas

These are the only per-page differences beyond the template:

- **`/admin/problems`** — eyebrow `PROBLEMS`. Tabs over status. Each row's problem ID rendered as `#001` in mono. Difficulty column uses `<DifficultyBadge>` (existing) or a `<StatusPill>`-compatible variant.
- **`/admin/articles`** — eyebrow `ARTICLES`. Tabs: `DRAFT / SUBMITTED / PUBLISHED / ARCHIVED`. `hasVisualBlocks` shown as a small `<Eyebrow>` chip in the row.
- **`/admin/tracks`** — eyebrow `TRACKS`. Tabs over status.
- **`/admin/discussions`** — eyebrow `MODERATION`. Pending count rendered as a `<StatusPill status="pending" label="N pending">`. Action column has `▸ APPROVE` / `✗ HIDE` buttons that open `AlertDialog`.
- **`/admin/schemas`** — eyebrow `SCHEMAS`. SQL preview blocks wrapped in `<ScrollableTable>` (already in the file, but with the new `ScrollableTable` component). Soft-wrap toggle from `<CodeBlock>` works here.
- **`/admin/moderators`** — eyebrow `MODERATORS`. Role pill column uses distinct token treatment per role:
   ```tsx
   const ROLE_TOKEN: Record<UserRole, { class: string; label: string }> = {
       ADMIN:       { class: "bg-primary/15 text-primary",     label: "admin" },
       MODERATOR:   { class: "bg-warning/15 text-warning",     label: "moderator" },  // distinct from contributor now
       CONTRIBUTOR: { class: "bg-accent/15 text-accent",       label: "contributor" },
       USER:        { class: "bg-muted-foreground/15 text-muted-foreground", label: "user" },
   }
   ```
   The role-change action uses shadcn `<DropdownMenu>`.
- **`/admin/topics`** — eyebrow `TOPICS`. Lane column rendered with `<Eyebrow>` per row (e.g., `SQL` / `DATA ENGINEERING`). `displayOrder` column uses `tabular-nums`. Inline edit for `lane` via a `DropdownMenu`; inline edit for `displayOrder` via a small `<Input>`.
- **`/admin/tags`** — eyebrow `TAGS`. `TagKind` column uses two pills: `pill-accepted` for `TOPIC`, `pill-rejected` for `COMPANY` (or invent a 5th pill variant `pill-info` if desired; not required for v2). Articles + problems count columns use `tabular-nums`.
- **`/admin/api-keys`** — eyebrow `API KEYS`. Each row's "reveal key" action opens an `AlertDialog` with a `<Kbd>` copy-shortcut hint.
- **`/admin/contributors`** — eyebrow `CONTRIBUTORS`. Article-count + problem-count columns use `tabular-nums`. Same role pill as moderators.
- **`/admin/reports`** — eyebrow `REPORTS`. Status: `OPEN / RESOLVED / DISMISSED` → pills `pending / accepted / draft`. Resolve action via `<AlertDialog>`.

### Step 9.4: Smoke each admin list page

```bash
npm run dev
# Visit each /admin/* list URL
```

Confirm:
- Container width is `2xl` (cards/tables fill the wider canvas).
- Bracketed eyebrow above the title.
- Status filtering uses shadcn `Tabs` where present.
- Tables show right-edge fade on overflow.
- Destructive actions open `AlertDialog` confirmations.

### Step 9.5: Verify + commit

```bash
./scripts/check-no-palette-colors.sh
./scripts/check-shadcn-token-definitions.sh
npx tsc --noEmit -p .
```

```bash
git add components/admin/AdminListShell.tsx app/admin
git commit -m "feat(admin): UI v2 list pages — shared shell, tabs, status pills"
```

---

## Task 10: Admin edit / new forms + supplementary admin surfaces

Re-template the admin forms to use shadcn `FieldGroup` + `Field` composition. Keep all existing form logic (RHF + server actions); only the layout primitives change.

**Files:**
- Modify: `app/admin/problems/new/page.tsx`, `app/admin/problems/[slug]/edit/page.tsx`
- Modify: `app/admin/articles/new/page.tsx`, `app/admin/articles/[slug]/edit/page.tsx`
- Modify: `app/admin/tracks/new/page.tsx`, `app/admin/tracks/[slug]/edit/page.tsx`
- Modify: `app/admin/topics/[slug]/edit/page.tsx`
- Modify: `app/admin/discussions/settings/page.tsx`
- Modify: `app/admin/daily/page.tsx`
- Modify: existing admin form components under `components/admin/` (per-feature)

### Step 10.1: Template — form layout migration

For each form page:

1. Wrap the entire form in a single `<form>` element if it isn't already.
2. Replace ad-hoc `<div className="space-y-4">` form wrappers with `<FieldGroup>` from `@/components/shadcn/field-group` (or wherever shadcn placed it — likely `@/components/shadcn/field`).
3. For each form control:
   ```tsx
   <Field>
       <FieldLabel htmlFor="title">Title</FieldLabel>
       <Input id="title" {...registerProps} aria-invalid={hasError} />
       {errorMessage && <FieldDescription>{errorMessage}</FieldDescription>}
   </Field>
   ```
4. For boolean toggles, swap `<Checkbox>` (existing) for shadcn `<Switch>` where the UI signals a state (publish toggles, etc.); keep `<Checkbox>` for selection-style boolean inputs.
5. For multi-select / dropdown inputs (dialect picker, topic picker, status picker), swap to shadcn `<Select>`.
6. For radio-style choices (difficulty: EASY/MEDIUM/HARD), swap to shadcn `<RadioGroup>`.

### Step 10.2: Page-specific deltas

- **`/admin/problems/{new, [slug]/edit}`** — eyebrow `NEW PROBLEM` / `EDIT`. Status pill in the edit-page header. Test runner sidebar uses the workspace chrome (Eyebrow `[ TESTS ]`, mono labels). The "Save and publish" button opens `<AlertDialog>` confirmation.
- **`/admin/articles/{new, [slug]/edit}`** — eyebrow `NEW ARTICLE` / `EDIT`. "My uploads" panel gets pill + stat treatment; preserve all existing upload mechanics. The approval flow (when an admin views a `SUBMITTED` article) shows `▸ APPROVE` / `✗ REJECT` buttons, each opening an `AlertDialog`.
- **`/admin/tracks/{new, [slug]/edit}`** — eyebrow `NEW TRACK` / `EDIT`. The drag-to-reorder problem list uses the same look as the workspace problem list (mono IDs, status pills).
- **`/admin/topics/[slug]/edit`** — eyebrow `EDIT TOPIC`. Fields: name, description, lane (`<RadioGroup>`), displayOrder (`<Input type="number">`).
- **`/admin/discussions/settings`** — eyebrow `SETTINGS`. All toggles use `<Switch>`.
- **`/admin/daily`** — eyebrow `DAILY`. Date picker (existing) preserved. Upcoming / past split via `<Tabs>`. Status column uses `<StatusPill>`.

### Step 10.3: Smoke each form

```bash
npm run dev
# Visit each /admin/.../new and /admin/.../[slug]/edit URL
```

Confirm:
- Field labels are properly associated (clicking a label focuses the input).
- Form validation errors show via `<FieldDescription>` with `aria-invalid` on the control.
- `<Switch>` toggles produce the correct boolean value on submit.
- Destructive actions open `AlertDialog`.

### Step 10.4: Verify + commit

```bash
./scripts/check-no-palette-colors.sh
./scripts/check-shadcn-token-definitions.sh
npx tsc --noEmit -p .
```

```bash
git add app/admin components/admin
git commit -m "feat(admin): UI v2 forms — FieldGroup + Field + Switch + AlertDialog"
```

---

## Task 11: Flip `next-themes` default to dark + visual regression sweep

The final commit. Switch the default theme to dark; sweep every migrated page in both modes for visual regressions; tag the PR for review.

**Files:**
- Modify: `components/layout/ThemeProvider.tsx`

### Step 11.1: Switch the default theme

Open `components/layout/ThemeProvider.tsx`. Find the `NextThemesProvider` invocation. Change:

```tsx
<NextThemesProvider attribute="class" defaultTheme="light" enableSystem>
```

To:

```tsx
<NextThemesProvider attribute="class" defaultTheme="dark" enableSystem>
```

If `enableSystem` is `true`, the user's OS preference still wins on first load — but for users with no preference, the default is now dark.

### Step 11.2: Run the verification suite one more time

```bash
./scripts/check-no-palette-colors.sh
./scripts/check-shadcn-token-definitions.sh
npx tsc --noEmit -p .
npm run build
```

All must exit 0.

### Step 11.3: Visual regression sweep — every page, both modes

In a real browser (not just curl), open each surface listed in the spec's page migration table (~41 routes). Toggle the theme via the `<ThemeToggle>` in the navbar. Confirm in BOTH modes:
- No layout shift, no z-index conflict on overlays.
- Card chrome, button contrast, badge legibility all readable.
- Status pills colored correctly.
- Tables don't lose their header backgrounds under the new tokens.
- Forms render with visible labels, descriptions, validation states.

Capture screenshots for the PR description. Recommended approach: open a Vercel preview, hit each route, screenshot both modes. Don't worry about pixel-perfect — eyeball for legibility regressions only.

### Step 11.4: Lighthouse contrast audit on 3 representative pages

```bash
# Local or against the Vercel preview URL — whichever has a live preview
npx lighthouse https://<preview-or-localhost>/practice --only-categories=accessibility
npx lighthouse https://<preview-or-localhost>/practice/joins/how-a-join-works --only-categories=accessibility
npx lighthouse https://<preview-or-localhost>/learn/joins/how-a-join-works --only-categories=accessibility
```

Expected: each report scores ≥ 95 on accessibility with zero color-contrast violations. If a violation appears, capture the token pair that failed and tune the offending HSL value in `app/globals.css`; re-test.

### Step 11.5: Googlebot smoke

```bash
curl -A "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)" \
    https://<preview-url>/practice/joins/how-a-join-works \
    | grep -E "<title>|<h1>|<h2>|table|schema" \
    | head -20
```

Expected: full problem markup visible in the HTML response (no Cmd-K / modal in the initial HTML).

### Step 11.6: Commit

```bash
git add components/layout/ThemeProvider.tsx
git commit -m "feat(ui): UI v2 dark default + visual regression sweep"
```

### Step 11.7: Push and open the PR

```bash
git push -u origin feat/ui-v2
gh pr create --base main --title "feat(ui): UI v2 — dark default, hybrid theme, shadcn, admin redesign" --body "$(cat <<'EOF'
## Summary

Full UI v2 rollout per `docs/superpowers/specs/2026-05-23-ui-v2-design.md`:

- Dark-default token system with WCAG AA-verified contrast.
- D+A hybrid theme: engineer-tool polish base with terminal flavor on code-adjacent surfaces.
- Container breathing (new `2xl` width for dashboards; article reader narrows to `md`).
- Overflow primitives: `ScrollableTable`, `CodeBlock` with soft-wrap toggle.
- shadcn/ui adoption: 18 components in `components/shadcn/` (Dialog, Sheet, Popover, Tooltip, Sonner, Command, DropdownMenu, Tabs, Form, Field, Switch, Select, Checkbox, RadioGroup, ToggleGroup, ScrollArea, AlertDialog, Separator).
- New admin dashboard: metrics, activity feed, quick actions.
- Every admin list page migrated to shared `AdminListShell`.
- Every admin form re-templated with `FieldGroup` / `Field` composition.
- CI guards: hardcoded palette denylist + shadcn token-definition completeness.

## Migration order

11 commits, smallest blast radius first. See `docs/superpowers/plans/2026-05-23-ui-v2-implementation.md` for the full breakdown.

## Verified

- [x] `scripts/check-no-palette-colors.sh` exits 0.
- [x] `scripts/check-shadcn-token-definitions.sh` exits 0.
- [x] `npx tsc --noEmit -p .` clean.
- [x] `npm run build` succeeds.
- [x] Lighthouse accessibility ≥ 95 on `/practice`, `/practice/joins/how-a-join-works`, `/learn/joins/how-a-join-works`.

## Test plan

- [ ] Vercel preview: visual regression sweep on every page in both dark and light modes (screenshots attached).
- [ ] Admin dashboard renders in ≤ 500ms locally.
- [ ] Sign-in modal (if anon-gating is also live) renders correctly inside `Dialog`.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Self-review

**Spec coverage check** — every section of `docs/superpowers/specs/2026-05-23-ui-v2-design.md`:

- Goal / non-goals → captured in plan header.
- Decisions table → encoded across tasks. shadcn base=radix in Task 1.14. `aliases.ui` = `@/components/shadcn` in Task 1.14. Dark default in Task 11.1.
- Token contract (compatibility invariant + value changes + class-on-html + shadcn map + contrast + decoration-only) → Tasks 1.2–1.6.
- Net-new tokens → Task 1.2 (`--muted-foreground-dim`).
- New utility classes → Task 1.6.
- New React primitives (`Eyebrow`, `Kbd`, `StatusPill`, `ScrollableTable`, `CodeBlock`) → Tasks 1.8–1.12.
- shadcn adoption (init, components, coexistence, rules) → Tasks 1.14–1.15.
- Page migration table → Tasks 4–10 cover every row.
- Reduced-motion + accessibility → Task 1.6 (`prefers-reduced-motion` for cursor), Task 11.4 (Lighthouse).
- Done criteria — every checkbox maps:
  - `app/globals.css` updated → Tasks 1.2–1.6.
  - `Container` 2xl → Task 1.7.
  - Hand-rolled new primitives → Tasks 1.8–1.12.
  - shadcn init with non-default alias → Task 1.14.
  - shadcn components added → Task 1.15.
  - shadcn skill rules applied → Tasks 4, 9, 10 (inline).
  - Token-definition check → Task 1.16–1.17.
  - Palette denylist + CI wiring → Tasks 3.
  - Lighthouse contrast → Task 11.4.
  - Admin full redesign → Tasks 8–10.
  - Role pill differentiation → Task 9.3 (moderators row).
  - `next-themes` default flip → Task 11.1.
  - Visual regression sweep → Task 11.3.
  - Googlebot smoke → Task 11.5.
- Migration order (11 commits, smallest-blast-first) → Tasks 1–11 in order.
- Risks → mitigations baked into tasks (per-commit shippability, no token renames, alias for shadcn, etc.).

**Placeholder scan:** searched the plan for `TBD`, `TODO`, `implement later`, `fill in details`, "Similar to Task N". None found. Code-block hand-waves explicitly avoided: every step that changes code shows the code or names the function being changed with surrounding context.

**Type consistency:** `Eyebrow.variant` type is `"plain" | "bracket"` everywhere. `StatusPill.status` is `"accepted" | "rejected" | "pending" | "draft"` everywhere. `AdminMetric` shape consistent across `actions/admin-dashboard.ts` exports and `MetricCard.tsx` props. `AdminActivityItem` likewise. Token names (`--muted-foreground-dim`, `--card`, etc.) referenced consistently between the spec and the plan code blocks.

**Known shortcuts in this plan that an implementer should be aware of:**

1. Tasks 9 and 10 use "template + per-page deltas" to avoid repeating boilerplate ~11–12 times. The template is fully spelled out (AdminListShell in 9.1; form layout in 10.1). The per-page deltas list every page-specific difference but rely on the template for the shared structure. Implementer should NOT skip pages — every row in the migration table must be touched.

2. The "smoke" steps assume a working dev server and a logged-in admin account. If you don't have local admin access, see `docs/DEPLOY.md` for the admin-bootstrap procedure.

3. Step 8.1 (`actions/admin-dashboard.ts`) assumes Prisma model field names. If a field doesn't exist (e.g., `ProblemReport.status` may be modeled differently), check `prisma/schema.prisma` and adjust the query.
