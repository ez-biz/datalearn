# SP2 — Console shell + graphite tokens

**Status:** design approved, not yet implemented
**Date:** 2026-08-06
**Sub-project:** SP2 of the 7-part learning-platform redesign (see [`2026-08-01-curriculum-spine-design.md`](./2026-08-01-curriculum-spine-design.md) for the decomposition)
**Blocks:** SP3 (reader), SP4 (index screens), SP5 (workspace), SP7 (admin)
**Depends on:** nothing. SP1 is merged but SP2 needs only its read path, which already exists.

---

## What this is

SP2 replaces two things at once, everywhere:

1. **The palette.** The current blue-tinted graphite (hue 220) with a teal primary becomes the handoff's near-hueless graphite (hue 240) with a green primary.
2. **The shell.** The 64px sticky top navbar becomes a 236px left sidebar that collapses to a 56px rail, and a 56px bottom tab bar below `lg`.

Set expectations up front: **SP2 ships no new screen.** It re-skins the 51 routes that already exist. The first visibly-new screen is SP3's lesson reader. Anyone expecting a payoff from SP2 alone will be disappointed — its value is that four other sub-projects cannot start without it.

### Source of truth

The design handoff at `~/Downloads/design_handoff_learning_platform 2/`:

- `README.md` — "Design tokens" and "The shell (build this first)" sections, plus the "Light theme" parity table
- `ConsoleSidebar.dc.html` / `ConsoleSidebarLight.dc.html` — 236px expanded, both themes
- `ConsoleRail.dc.html` — 56px collapsed
- `screenshots/` — 22 PNGs; `09`, `10`, `14`–`19` are the shell-relevant ones

Explicitly **not** targets, per the handoff's own file table:

- `ConsoleNav.dc.html` — the interim top bar, "superseded by the sidebar — do not build"
- `SiteNav.dc.html` / `SiteFooter.dc.html` — recreations of the *current* site, for before/after comparison only

---

## Decisions taken

| # | Decision | Rationale |
|---|---|---|
| 1 | **Big-bang on `main`, hold `production`** | One code path. `main` looks half-migrated until SP6/SP7, which is acceptable because `main` is integration-only. No `main → production` release PR until the redesign is coherent. |
| 2 | **Unbuilt nav destinations render disabled with a "soon" chip** | 8 of the sidebar's 14 destinations don't exist. Disabled-but-visible keeps the design's density and roadmap signal without dead links or 8 stub routes. Promotion later is a one-word edit. |
| 3 | **Scope = shell + tokens + repair pass** | Fix only what the swap breaks (contrast, hardcoded colours, width/height assumptions). No redesign — each later sub-project restyles its own screens. |
| 4 | **New vocabulary canonical, legacy tokens become aliases** | Re-skins all 51 routes with zero component edits, gives SP3–SP7 the precise names they need, and keeps one source of truth per theme. |
| 5 | **Collapse state in a cookie, not localStorage** | Correct width on first paint. The root layout already calls `headers()`, so it is already dynamic and a `cookies()` read costs nothing. localStorage would flash 236px→56px on every navigation. |
| 6 | **Shadows flatten to `none`** | The handoff is categorical: "No shadows anywhere. Elevation is expressed by surface value and 1px borders only." Exactly one exception, the active sidebar pill in light mode. |
| 7 | **SP2 does not touch `.github/workflows`** | The `gh` CLI token lacks `workflow` scope, which has blocked merges before. Guard scripts and `npm run` targets ship here; a separate one-line PR wires CI and is merged through the web UI. |
| 8 | **Verification is a driven browser review, not committed screenshot baselines** | Playwright baselines would churn wholesale through SP3–SP7 and generate noise. Chrome DevTools MCP review against the handoff PNGs, plus static guard scripts, fits the phase. |

---

## Part 1 — The token layer

### Structure

`app/globals.css` currently declares the dark palette **twice** — once in `:root`, once in `.dark` — then light in `.light`. The `.dark` duplicate is unnecessary: `@custom-variant dark (&:where(.dark, .dark *))` only needs the *class* to exist for `dark:` utilities to compile; it does not read declarations from a `.dark` block. Variables resolve from `:root`.

SP2 collapses this to two blocks:

- `:root` — dark values (the default, matching `defaultTheme="dark"`)
- `.light` — light values

This halves the maintenance surface and makes the parity guard a clean two-way comparison.

### The palette

Converted from the handoff's hex to the space-separated HSL triples `@theme inline` consumes.

| Token | Dark hex | Dark HSL | Light hex | Light HSL |
| --- | --- | --- | --- | --- |
| `--canvas` | `#0E0E11` | `240 10% 6%` | `#FAFAFB` | `240 11% 98%` |
| `--canvas-deep` | `#0A0A0C` | `240 9% 4%` | `#FFFFFF` | `0 0% 100%` |
| `--panel` | `#0B0B0E` | `240 12% 5%` | `#F4F4F6` | `240 10% 96%` |
| `--panel-raised` | `#111116` | `240 13% 8%` | `#FFFFFF` | `0 0% 100%` |
| `--panel-sunken` | `#0F0F13` | `240 12% 7%` | `#F7F7F9` | `240 14% 97%` |
| `--panel-hover` | `#141418` | `240 9% 8.6%` | `#EAEAEF` | `240 14% 93%` |
| `--panel-active` | `#16161A` | `240 8% 9.4%` | `#FFFFFF` | `0 0% 100%` |
| `--line` | `#26262B` | `240 6% 16%` | `#E3E3E8` | `240 10% 90%` |
| `--line-soft` | `#1C1C21` | `240 8% 12%` | `#EAEAEF` | `240 14% 93%` |
| `--line-faint` | `#1E1E24` | `240 9% 13%` | `#F0F0F3` | `240 11% 95%` |
| `--line-strong` | `#2C2C33` | `240 7% 19%` | `#D4D4DB` | `240 9% 85%` |
| `--text` | `#EDEDEA` | `60 8% 92%` | `#17171B` | `240 8% 10%` |
| `--text-2` | `#C4C4C8` | `240 4% 78%` | `#33333A` | `240 6% 21%` |
| `--text-3` | `#B4B4B8` | `240 3% 71%` | `#45454E` | `240 6% 29%` |
| `--text-muted` | `#82828A` | `240 3% 53%` | `#5C5C66` | `240 5% 38%` |
| `--text-dim` | `#6A6A72` | `240 4% 43%` | `#74747E` | `240 4% 47%` |
| `--text-gutter` | `#5A5A66` | `240 6% 38%` | `#9A9AA4` | `240 5% 62%` |
| `--primary` | `#4ADE9E` | `154 69% 58%` | `#0E9F6E` | `160 84% 34%` |
| `--primary-fg` | `#04231A` | `163 79% 8%` | `#FFFFFF` | `0 0% 100%` |
| `--primary-text` | `#4ADE9E` | `154 69% 58%` | `#0B6E4E` | `161 82% 24%` |
| `--primary-bg` | `#0D1D18` | `161 38% 8%` | `#ECFAF3` | `150 58% 95%` |
| `--primary-bg-subtle` | `#0C1512` | `160 27% 6%` | `#F4FCF8` | `150 57% 97%` |
| `--primary-border` | `#1F3A30` | `158 30% 17%` | `#B7E8D2` | `153 52% 81%` |
| `--primary-row` | `#12201C` | `163 28% 10%` | `#EAF8F1` | `150 50% 95%` |
| `--warning` | `#E2B44F` | `41 72% 60%` | `#B26A00` | `36 100% 35%` |
| `--warning-text` | `#E2B44F` | `41 72% 60%` | `#8A5200` | `36 100% 27%` |
| `--warning-bg` | `#14120B` | `47 29% 6%` | `#FFF7E8` | `39 100% 95%` |
| `--warning-border` | `#3A3218` | `46 41% 16%` | `#F0DDB4` | `41 67% 82%` |
| `--danger` | `#F08585` | `0 78% 73%` | `#C2352F` | `2 61% 47%` |
| `--danger-text` | `#F08585` | `0 78% 73%` | `#C2352F` | `2 61% 47%` |
| `--danger-bg` | `#1D0F0F` | `0 32% 9%` | `#FEF1F0` | `4 88% 97%` |
| `--danger-border` | `#3A2020` | `0 29% 18%` | `#F3CFCC` | `5 62% 88%` |
| `--accent-blue` | `#7AA2F7` | `221 89% 72%` | `#1F5FD0` | `218 74% 47%` |
| `--accent-violet` | `#A78BFA` | `255 92% 76%` | `#6D28D9` | `263 70% 50%` |
| `--icon-off` | `#3A3A42` | `240 6% 24%` | `#C4C4CC` | `240 7% 78%` |
| `--code-bg` | `#1A1A20` | `240 10% 11%` | `#F0F7F4` | `154 30% 95%` |
| `--code-text` | `#4ADE9E` | `154 69% 58%` | `#0B6E4E` | `161 82% 24%` |
| `--syntax-keyword` | `#7AA2F7` | `221 89% 72%` | `#1F5FD0` | `218 74% 47%` |
| `--syntax-function` | `#E2B44F` | `41 72% 60%` | `#A05A00` | `34 100% 31%` |
| `--syntax-literal` | `#4ADE9E` | `154 69% 58%` | `#0B6E4E` | `161 82% 24%` |
| `--syntax-comment` | `#5A5A62` | `240 4% 37%` | `#8A8A94` | `240 4% 56%` |
| `--syntax-plain` | `#C4C4C8` | `240 4% 78%` | `#33333A` | `240 6% 21%` |

**Two conversion notes:**

- `--panel-hover` and `--panel-active` both round to `9%` lightness at integer precision, which would silently collapse the hover and active states into one colour. They carry **one decimal place** (`8.6%` / `9.4%`) to stay distinct. No other pair collides.
- `--accent-violet` **light** (`#6D28D9`) is not specified in the handoff — the admin section only gives dark values. This value is carried over from the codebase's existing light `--accent`, which is already the admin colour. SP7 should confirm or replace it.

**Intentional duplicates** (not bugs, do not "fix"):

- Dark `--primary-text` equals `--primary`; light re-picks a darker green for contrast on tinted backgrounds.
- Light `--panel-raised`, `--panel-active` and `--canvas-deep` are all `#FFFFFF`. The active sidebar pill is distinguished by its shadow, not its fill — see below.
- Light `--panel-hover` and `--line-soft` are both `#EAEAEF`.

### Light is not an inversion

Two structural differences, both load-bearing:

1. **The surface hierarchy flips.** Dark: rails (`--panel`, 5%) are *darker* than content (`--panel-raised`, 8%). Light: rails (96%) are *darker* than content (100%). The reading column stays the brightest thing on screen in both themes. Any component that assumes "raised means lighter" is wrong in one theme.
2. **Semantic colours are re-picked, never lightened.** Light `--warning` is `#B26A00`, not a tint of `#E2B44F`. Light `--danger` is `#C2352F`, not a tint of `#F08585`.

### Legacy aliases

Every existing token is re-pointed at a new one. This is the change that re-skins all 51 routes without touching a component.

```css
--background:           var(--canvas);
--foreground:           var(--text);
--surface:              var(--panel-raised);
--surface-muted:        var(--panel-sunken);
--surface-elevated:     var(--panel-raised);
--border:               var(--line);
--border-strong:        var(--line-strong);
--muted:                var(--panel-sunken);
--muted-foreground:     var(--text-muted);
--muted-foreground-dim: var(--text-dim);
--primary-foreground:   var(--primary-fg);
--accent:               var(--accent-violet);
--accent-foreground:    var(--primary-fg);
--destructive:          var(--danger);
--destructive-foreground: var(--primary-fg);
--warning-foreground:   var(--primary-fg);
--success:              var(--primary);
--success-foreground:   var(--primary-fg);
--easy:   var(--primary);  --easy-bg:   var(--primary-bg);  --easy-fg:   var(--primary-text);
--medium: var(--warning);  --medium-bg: var(--warning-bg);  --medium-fg: var(--warning-text);
--hard:   var(--danger);   --hard-bg:   var(--danger-bg);   --hard-fg:   var(--danger-text);
--card: var(--surface);    --popover: var(--panel-raised);  --secondary: var(--panel-sunken);
--input: var(--line);      --ring: var(--primary);
```

`--primary-hover` has no handoff equivalent and is retained as an explicit value, one step darker than `--primary` in each theme: `154 69% 52%` dark, `160 84% 28%` light.

**Known imperfection, accepted:** `--surface` does double duty today for cards *and* panel-like chrome. Aliasing it to `--panel-raised` is correct for cards; the sidebar, rail and tab bar reference `--panel` explicitly rather than inheriting. Later sub-projects should migrate panel-ish uses of `bg-surface` to `bg-panel` as they touch each screen.

### `@theme inline`

Each new token gets a `--color-*` mapping so `bg-panel`, `text-text-dim`, `border-line-soft`, `bg-primary-row` etc. become real utilities. Naming follows the existing convention exactly (`--color-<token>: hsl(var(--<token>))`).

### Shadows

The handoff forbids shadows. `--shadow-xs` through `--shadow-xl` and `--shadow-primary` are kept as declared names — so every existing `shadow-*` utility still compiles — but flattened to `none` in both themes.

One new token for the single sanctioned exception:

```css
--shadow-sidebar-active: 0 1px 2px hsl(240 20% 10% / 0.06);  /* light only; none in dark */
```

**Consequence to handle in the repair pass:** popovers and dropdown menus currently rely on shadow for separation from the page. With shadows flattened they need a visible `--line` border. Known affected: `UserMenu`, `SignInDialog`, the list popovers in `components/lists/`.

### Guard scripts

| Script | Status | Job |
|---|---|---|
| `scripts/check-token-theme-parity.sh` | **new** | Every `--token` declared in `:root` must also be declared in `.light`, and vice versa. Given that both themes ship and light is not an inversion, a missing light value fails silently and looks broken only to users on that theme. |
| `scripts/check-no-palette-colors.sh` | **extend** | Already forbids Tailwind palette classes. Add rejection of raw hex literals in `className` strings — the handoff is ~200 hex values and pasting one is the obvious failure mode. |
| `scripts/check-shadcn-token-definitions.sh` | reuse as-is | Already verifies every `var(--X)` in the component tree has a declaration in `globals.css`. Its directory list already covers `components/layout`. This machine-checks the whole alias layer on day one. |

All three get `npm run` targets. **CI wiring is deliberately out of scope** (decision 7) — `check-no-palette-colors.sh` already runs at `.github/workflows/test.yml:58`; adding the other two is a follow-up PR merged via the web UI.

### Documentation to update

- `docs/design-system/colors_and_type.css` — described in CLAUDE.md as mirroring the live token contract. It must be regenerated or it becomes a lie.
- `docs/design-system/README.md` — palette and shadow sections.
- `CLAUDE.md` — the Tailwind bullet says "light is default"; `ThemeProvider` is `defaultTheme="dark"`. Stale today, and more misleading once the palette changes.

---

## Part 2 — The shell

### Layout model

The scroll model changes from "document scrolls under a sticky bar" to "fixed rail, scrolling content column".

```
<body class="h-dvh">                    ← was: min-h-screen flex flex-col
  ThemeProvider
    skip-link → #main-content
    ConsoleShell                         (server)
      ConsoleSidebar | ConsoleRail       (client, hidden below lg)
      <main id="main-content" class="flex-1 overflow-y-auto">
        {children}
        <Footer/>                        ← moves inside the scroll column
      </main>
      MobileTabBar                       (client, lg:hidden)
```

The sidebar renders in the DOM at every viewport and is hidden by CSS below `lg` — SSR cannot know the viewport, so there is no data saving on mobile, only no visual.

### Components

All new files under `components/layout/console/`.

| File | Kind | Responsibility |
|---|---|---|
| `ConsoleShell.tsx` | server | Sole fetcher: `auth()`, `cookies()`, `getNavLinks()`, `getTrackCurriculum()`. Composes the three chrome pieces around `children`. |
| `nav-model.ts` | pure, no React | The single nav definition driving sidebar, rail *and* tab bar. |
| `ConsoleSidebar.tsx` | client | 236px expanded: header row, nav tree, footer progress block. |
| `ConsoleRail.tsx` | client | 56px collapsed: same order, 34×34 icon buttons with `aria-label` + tooltip. |
| `MobileTabBar.tsx` | client | 4 items, 56px tall, fixed bottom. |
| `useSidebarCollapse.ts` | client hook | Optimistic local state + cookie write. |

**Deleted:** `components/layout/Navbar.tsx`, `MobileNav.tsx`, `NavLink.tsx`. Big-bang means one code path.
**Retained:** `UserMenu.tsx` (moves into the sidebar header dropdown), `Footer.tsx`, `ThemeProvider.tsx`.

### The nav model

```ts
type NavStatus = "live" | "soon"

interface NavItem {
  label: string
  icon: LucideIcon
  href?: string          // absent iff status === "soon"
  status: NavStatus
  match?: "exact" | "prefix"
  exclude?: string[]     // prefixes that must NOT select this item
  children?: NavItem[]
}
```

`exclude` exists for one real case: `/learn/tracks` is a prefix match on `/learn`, but must select **Tracks**, not Learn. Without it the two items light up together.

Order and icons are fixed by the handoff:

| Item | Icon | Status | Href |
|---|---|---|---|
| Home | `layout-grid` | live | `/` (exact) |
| Learn | `book-open` | live | `/learn` (prefix, excluding `/learn/tracks`) |
| Tracks | `route` | live | `/learn/tracks` (prefix) |
| Projects | `folder` | **soon** | — |
| Practice | `square-pen` | live | `/practice` (prefix) |
| → Coding problems | `code-xml` | live | `/practice` (prefix) |
| → Data modeling | `database` | **soon** | — |
| → Architecture design | `box` | **soon** | — |
| → Cloud labs | `cloud` | **soon** | — |
| Contests | `trophy` | live | `/contests` (prefix) |
| Blogs | `newspaper` | **soon** | — |
| Community | `message-circle` | **soon** | — |

Footer group: the track-progress block, then Updates (`megaphone`, **soon**), Help center (`circle-help`, **soon**), then any CMS `Page` rows from `getNavLinks()`.

**Practice children** expand only when Practice is the active section, indented 18px behind a 1px `--line-faint` left rule. The active child gets `--primary-row` background.

**"soon" items** render as `<span aria-disabled="true">` — not focusable, not in tab order, announced by screen readers, carrying a small mono "soon" chip in `--text-dim`. The `href`-absent-iff-soon invariant is unit-tested.

### Visual spec

Values from `ConsoleSidebar.dc.html` / `ConsoleRail.dc.html`, translated to tokens.

**Sidebar, expanded — 236px**, `--panel` background, 1px `--line-soft` right border, column flex, full height.

- **Header row**, 12px 12px 10px padding: 26px circular avatar (`--panel-hover` fill, `user` icon), name at 13.5px/600, `chevron-down`, and a `panel-left` collapse toggle. Everything `--text-dim` except the name. Signed out: this slot becomes the sign-in button and the progress block is omitted.
- **Nav**, 8px padding, 1px gaps. Items: 7px/9px padding, 5px radius, 13.5px/400, `--text-muted`, 15px icon, 10px gap. Hover `--panel-hover` + `--text`. Active `--panel-active` + `--text` + weight 500 + `--primary` icon; in light also `--shadow-sidebar-active`.
- **Footer**, `margin-top:auto`, 1px `--line-soft` top border: track progress block (mono "TRACK" label, `--primary` percentage, 3px bar with square ends on a `--line-faint` track, track name at 11px mono), then Updates and Help center at 13px.

**Rail, collapsed — 56px**, same background and border. 32px `panel-left` toggle, 24px hairline divider, then 34×34 buttons with 17px icons in the same order. Active: `--panel-active` background, `--primary` icon. Bottom: Updates, Help, then a 26px initials avatar.

**Mobile tab bar** — below `lg`, fixed bottom, 56px tall, `--panel-sunken` background, 1px `--line-soft` top border. 19px icon over an 11px/500 label. `--primary` when active, `--text-dim` otherwise. Hit targets ≥44px per the handoff's accessibility rules. Four items, all `status: "live"`:

| Item | Icon | Href |
|---|---|---|
| Learn | `book-open` | `/learn` |
| Practice | `square-pen` | `/practice` |
| Tracks | `route` | `/learn/tracks` |
| You | `user` | `/profile` |

Signed out, **You** routes to the sign-in dialog rather than `/profile`.

**Transitions:** 150ms ease on colour and border-colour only — never on width or layout.

### State and data flow

`ConsoleShell` fetches everything server-side and passes plain props down. The `auth()` call and the `menuStats` query already exist in `Navbar` today, so this is a move rather than a new cost.

**Collapse persistence:** cookie `dl:sidebar` = `collapsed` | `expanded`, 1 year, `SameSite=Lax`, `Path=/`, deliberately **not** `HttpOnly` so the client can write it. The toggle writes via `document.cookie` and flips local state optimistically — no server action, no round trip. Read server-side in `ConsoleShell` so the correct width renders on first paint.

**Track progress** comes from SP1's `getTrackCurriculum`. This makes SP2 the first real consumer of the curriculum read path. The seeded track ships `DRAFT`, so it returns `null` and the block renders nothing for every user — correct behaviour, not a bug, and it means SP2 quietly proves SP1's read path end to end.

### Failure modes

All biased toward "navigation still works":

| Condition | Behaviour |
|---|---|
| Cookie missing or unparseable | Default to expanded |
| `getTrackCurriculum` throws or returns `null` | Progress block absent. Wrapped so a curriculum failure can never break navigation. |
| `getNavLinks` fails | Already degrades to `{ success: false, data: [] }`; unchanged |
| No session | Sidebar renders; header slot becomes sign-in; progress block omitted |

### Accessibility

- Skip link retargets to the scrolling content column.
- Sidebar is `<nav aria-label="Primary">`; tab bar is `<nav aria-label="Primary mobile">`.
- Active item carries `aria-current="page"`.
- Rail buttons require `aria-label` — icon-only.
- `--text-dim` is the contrast floor for text; `--icon-off` is **non-text only** (unsolved circles, checkbox outlines). Enforced by review, per the handoff's stated rule that anything dimmer was rejected.
- Tab order must run: skip link → sidebar → content → tab bar.

### Not in SP2

- **Admin sidebar** (violet, grouped, badge counts) → SP7. Admin keeps its existing `AdminNav` *inside* the new shell.
- **Workspace** problems panel, lesson context bar, Solutions tab, collapsible schema → SP5. SP2 only repairs its broken height math.
- **`Container` defaults.** Re-centering content for a 236px sidebar is each screen's own sub-project.
- **Signed-out marketing home**, including the designed 4-column footer → SP6. `Footer.tsx` is carried unchanged inside the scroll column so `/privacy`, `/terms` and CMS pages keep their links.

---

## Part 3 — The repair pass

Fix what the swap breaks. Nothing else.

| # | Location | Break |
|---|---|---|
| 1 | `app/practice/[slug]/page.tsx:114` | `h-[calc(100vh-4rem)]` — the 4rem bar is gone |
| 2 | `app/auth/signin/page.tsx:47` | `min-h-[calc(100dvh-4rem)]` — same |
| 3 | `components/learn/TableOfContents.tsx:36` | `sticky top-24` — offset assumed the old bar |
| 4 | `app/practice/tags/page.tsx:58` | `sticky top-0` — now sticks to the content column, not the viewport |
| 5 | `UserMenu`, `SignInDialog`, `components/lists/` popovers | Need `--line` borders once shadows flatten |
| 6 | `components/sql/ResultTable.tsx:81` | Sticky `thead` uses `bg-surface-muted/95 backdrop-blur`; verify against the new sunken value in both themes |
| 7 | `app/layout.tsx:74` | Body classes `min-h-screen flex flex-col` → `h-dvh` |
| 8 | 1024–1280px, all routes | Horizontal overflow with 236px consumed |

This list is expected to grow during the browser review. Anything found that is *not* a break — merely "not yet redesigned" — is left for its own sub-project.

---

## Verification

### Automated

- **`scripts/test-console-nav.ts`** (`node --test`, matching repo convention), over the pure nav model:
  - **The exclusion case:** `/learn/tracks` selects Tracks and *not* Learn, while `/learn/sql-basics` selects Learn and not Tracks. This is the rule most likely to regress.
  - **Parent + child:** `/practice`, `/practice/tags` and `/practice/some-slug` each select Practice *and* its Coding-problems child — both lighting up is correct, matching the mockup.
  - **Exact vs prefix:** `/` selects Home; `/learn` does not.
  - **Isolation:** no route selects more than one top-level item, and `/contests` leaves Practice unselected.
  - **Invariant:** `status === "soon"` implies no `href`, for every item and child.
  - The tab bar's 4 items are all `status: "live"` and every href resolves to a route that exists.
- **`scripts/check-token-theme-parity.sh`** — `:root` / `.light` declaration parity.
- **`scripts/check-no-palette-colors.sh`** — extended with the hex-literal rule.
- **`scripts/check-shadcn-token-definitions.sh`** — every `var(--X)` resolves.
- `npm run build` (with `--webpack`; never drop it) and `npx tsc --noEmit`.

### Driven browser review

Local dev server against local Postgres, driven through the Chrome DevTools MCP. Six combinations — 402px / tablet / desktop × dark / light — over a representative route set:

`/` · `/learn` · `/practice` · `/practice/[slug]` · `/profile` · `/admin`

Checking, per combination:

1. Shell renders at the right dimensions (236 / 56 / bottom bar) and the correct piece is visible for the viewport.
2. Collapse toggle persists across a reload with **no width flash** on first paint.
3. Compared against handoff screenshots `09`, `10`, `14`–`19`.
4. No horizontal overflow.
5. Contrast: no text below the `--text-dim` floor; `--icon-off` used only on non-text glyphs.
6. Tab order runs skip link → sidebar → content → tab bar.

### Explicitly not verified here

- That the sidebar's track-progress block renders populated. It requires a `PUBLISHED` track; the seeded one is `DRAFT` by design. Publishing is a human action and stays one.
- Anything behind a Vercel preview URL — there is no preview database.

---

## Delivery

One branch, `feat/console-shell-tokens`, **`gh pr create --base main`** (the default base is `production`; a forgotten flag deploys unfinished work to live).

Sequence:

1. Tokens + aliases + `@theme inline` + shadow flattening + parity guard
2. `nav-model.ts` + `scripts/test-console-nav.ts`
3. `ConsoleSidebar` + `ConsoleRail` + `useSidebarCollapse`
4. `MobileTabBar`
5. `ConsoleShell` + root layout swap + delete `Navbar`/`MobileNav`/`NavLink`
6. Repair pass
7. Driven browser review, then fix what it surfaces
8. Docs: `colors_and_type.css`, design-system README, CLAUDE.md

Follow-up PR, merged via the web UI: wire `check-token-theme-parity.sh` and `check-shadcn-token-definitions.sh` into `.github/workflows/test.yml`.

---

## Open questions for later sub-projects

- **SP7** should confirm or replace light `--accent-violet` (`#6D28D9`), which this spec carried over from the existing light `--accent` because the handoff specifies admin violet only in dark.
- **SP3–SP7** should migrate panel-ish uses of `bg-surface` to `bg-panel` as they touch each screen, retiring the aliasing imperfection noted above.
- **SP6** replaces `Footer.tsx` with the designed 4-column marketing footer on `--panel`.
