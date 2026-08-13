# SP2 — Console Shell + Graphite Tokens Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the app's palette and navigation shell in one pass — hue-220 teal tokens become hue-240 graphite with a green primary, and the 64px sticky navbar becomes a 236px sidebar that collapses to a 56px rail, with a bottom tab bar below `lg`.

**Architecture:** The handoff's token vocabulary becomes canonical in `app/globals.css`; every existing token is re-pointed at it as an alias, so all 51 routes re-skin without a single component edit. A new server component `ConsoleShell` does all shell data fetching and composes three presentational client components driven by one shared nav model. Collapse state lives in a cookie so the correct width renders on first paint.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript strict, Tailwind v4 (`@theme inline` over HSL CSS variables), `lucide-react`, `next-themes`, `node --test` via `tsx` for unit tests, POSIX `sh` + `ripgrep` for guard scripts.

**Spec:** [`docs/superpowers/specs/2026-08-06-console-shell-tokens-design.md`](../specs/2026-08-06-console-shell-tokens-design.md)

**Branch:** `feat/console-shell-tokens` (already created; the spec is committed there as `4a3e6ab`)

## Global Constraints

- **Never run `next build` without `--webpack`.** Turbopack panics on this codebase in Next 16.1.1. `npm run build` already pins it — use the npm script, never a bare `next build`.
- **Never use hardcoded Tailwind palette classes** (`bg-slate-800`, `text-green-400`, `bg-white`, `text-black`). Semantic tokens only. Enforced by `scripts/check-no-palette-colors.sh`.
- **Never use raw hex literals in `className` strings.** The handoff is ~200 hex values; every one must be translated to a token. Enforced by Task 3.
- **No emoji icons.** SVG only, via `lucide-react`.
- **Both themes ship.** Every colour token declared in `:root` must also be declared in `.light`. Light is *not* an inversion — see the spec's parity table.
- **Transitions are 150ms ease on `color` and `border-color` only.** Never animate width or layout.
- **`--text-dim` is the contrast floor for text.** `--icon-off` is for non-text glyphs only (unsolved circles, checkbox outlines) and must never colour text.
- **PR base is `main`, explicitly.** `gh pr create --base main`. The repo default is `production`; a forgotten flag deploys unfinished work to the live site.
- **Do not touch `.github/workflows/`.** The `gh` CLI token lacks `workflow` scope and the PR would become unmergeable from the CLI. CI wiring is a deliberate follow-up.
- **Indentation is 4 spaces** in `.ts`/`.tsx`, matching the existing codebase.

---

## File Structure

**Created:**

| Path | Responsibility |
|---|---|
| `scripts/check-token-theme-parity.sh` | Guard: `:root` and `.light` declare the same token set |
| `components/layout/console/nav-model.ts` | Pure nav definition + active-state matching. No React. |
| `components/layout/console/sidebar-cookie.ts` | Pure cookie name/parse/serialise helpers |
| `components/layout/console/useSidebarCollapse.ts` | Client hook: optimistic state + cookie write |
| `components/layout/console/ConsoleSidebar.tsx` | 236px expanded sidebar |
| `components/layout/console/ConsoleRail.tsx` | 56px collapsed rail |
| `components/layout/console/MobileTabBar.tsx` | 56px bottom tab bar, below `lg` |
| `components/layout/console/ConsoleChrome.tsx` | Client component: owns collapse state, picks sidebar vs rail |
| `components/layout/console/ConsoleShell.tsx` | Server component: fetches, composes |
| `lib/curriculum-featured.ts` | `FEATURED_TRACK_SLUG` constant |
| `scripts/test-console-nav.ts` | Unit tests for `nav-model` + `sidebar-cookie` |

**Modified:** `app/globals.css`, `app/layout.tsx`, `scripts/check-no-palette-colors.sh`, `package.json`, plus the eight repair-pass files in Task 10 and three docs in Task 11.

**Deleted:** `components/layout/Navbar.tsx`, `components/layout/MobileNav.tsx`, `components/layout/NavLink.tsx`.

---

### Task 1: Theme parity guard

Build the guard *before* the palette so it is proven to detect a real gap rather than passing vacuously.

**Files:**
- Create: `scripts/check-token-theme-parity.sh`
- Modify: `package.json` (scripts block)

**Interfaces:**
- Consumes: nothing
- Produces: `npm run check:token-parity` — exit 0 clean, exit 1 with `MISSING IN .light: --x` / `MISSING IN :root: --x` lines

- [ ] **Step 1: Write the guard script**

Create `scripts/check-token-theme-parity.sh`:

```sh
#!/bin/sh
# Both themes ship and light is NOT an inversion of dark, so a token declared
# in one block and forgotten in the other fails silently — it looks broken
# only to users on that theme. Compare the two declaration sets directly.
#
# Run: npm run check:token-parity

set -e

CSS="app/globals.css"

# Deliberately theme-invariant: declared once in :root, inherited unchanged.
THEME_INVARIANT="--radius"

extract() {
    # $1 = selector regex. Pull `--token:` names from the brace block it opens.
    awk "/^$1 \{/,/^\}/" "$CSS" \
        | grep -oE '^[[:space:]]*--[a-z0-9-]+[[:space:]]*:' \
        | sed -E 's/^[[:space:]]*(--[a-z0-9-]+)[[:space:]]*:/\1/' \
        | sort -u
}

root=$(extract ':root')
light=$(extract '\.light')

if [ -z "$root" ] || [ -z "$light" ]; then
    echo "Could not extract token blocks from $CSS — check the selectors."
    exit 1
fi

exit_code=0

for token in $root; do
    case " $THEME_INVARIANT " in *" $token "*) continue ;; esac
    if ! echo "$light" | grep -qx -- "$token"; then
        echo "MISSING IN .light: $token"
        exit_code=1
    fi
done

for token in $light; do
    case " $THEME_INVARIANT " in *" $token "*) continue ;; esac
    if ! echo "$root" | grep -qx -- "$token"; then
        echo "MISSING IN :root: $token"
        exit_code=1
    fi
done

exit $exit_code
```

- [ ] **Step 2: Make it executable and run it against the CURRENT stylesheet**

```bash
chmod +x scripts/check-token-theme-parity.sh && ./scripts/check-token-theme-parity.sh; echo "exit=$?"
```

Expected: **exit=0**. `--radius` is the only `:root`-only token and the allowlist covers it.

If it reports anything else missing, that is a genuine pre-existing bug in `app/globals.css` — record it and fix it in this task.

- [ ] **Step 3: Prove the guard actually detects a gap**

Temporarily delete the `--ring: var(--primary);` line from the `.light` block in `app/globals.css`, then:

```bash
./scripts/check-token-theme-parity.sh; echo "exit=$?"
```

Expected: `MISSING IN .light: --ring` and **exit=1**.

- [ ] **Step 4: Restore the deleted line**

```bash
git checkout app/globals.css && ./scripts/check-token-theme-parity.sh; echo "exit=$?"
```

Expected: **exit=0**.

- [ ] **Step 5: Add the npm script**

In `package.json`, alongside the other `check:`-less script entries, add:

```json
"check:token-parity": "./scripts/check-token-theme-parity.sh",
```

- [ ] **Step 6: Verify through npm**

```bash
npm run check:token-parity; echo "exit=$?"
```

Expected: **exit=0**.

- [ ] **Step 7: Commit**

```bash
git add scripts/check-token-theme-parity.sh package.json
git commit -m "test: guard that :root and .light declare the same token set"
```

---

### Task 2: The graphite palette

**Files:**
- Modify: `app/globals.css` (replace the `:root`, `.dark` and `.light` blocks; extend `@theme inline`)

**Interfaces:**
- Consumes: `npm run check:token-parity` from Task 1
- Produces: the full token vocabulary — `--panel`, `--panel-raised`, `--panel-sunken`, `--panel-hover`, `--panel-active`, `--line{,-soft,-faint,-strong}`, `--text{,-2,-3,-muted,-dim,-gutter}`, `--primary{,-fg,-text,-bg,-bg-subtle,-border,-row}`, `--warning{,-text,-bg,-border}`, `--danger{,-text,-bg,-border}`, `--accent-{blue,violet}`, `--icon-off`, `--code-{bg,text}`, `--syntax-{keyword,function,literal,comment,plain}`, `--sidebar-active-shadow`; plus `--color-*` utilities for each and the `shadow-sidebar-active` utility

- [ ] **Step 1: Delete the redundant `.dark` block**

`app/globals.css` currently declares the dark palette twice — in `:root` (lines 7–70) and again in `.dark` (lines 72–118). The duplicate is unnecessary: `@custom-variant dark (&:where(.dark, .dark *))` at line 5 only needs the *class* to exist for `dark:` utilities to compile; it does not read declarations from a `.dark` block. Variables resolve from `:root`.

Delete the entire `.dark { ... }` block. Leave the `@custom-variant` line untouched.

- [ ] **Step 2: Replace the `:root` block**

```css
:root {
    /* ---- surfaces ---- */
    --canvas:              240 10% 6%;      /* #0E0E11 page background */
    --canvas-deep:         240 9% 4%;       /* #0A0A0C editor, code blocks */
    --panel:               240 12% 5%;      /* #0B0B0E sidebar, rails */
    --panel-raised:        240 13% 8%;      /* #111116 cards, table headers */
    --panel-sunken:        240 12% 7%;      /* #0F0F13 toolbars, table rows */
    --panel-hover:         240 9% 8.6%;     /* #141418 nav hover */
    --panel-active:        240 8% 9.4%;     /* #16161A nav active */

    /* ---- lines ---- */
    --line:                240 6% 16%;      /* #26262B card + control borders */
    --line-soft:           240 8% 12%;      /* #1C1C21 structural dividers */
    --line-faint:          240 9% 13%;      /* #1E1E24 inner dividers, row rules */
    --line-strong:         240 7% 19%;      /* #2C2C33 hover + secondary borders */

    /* ---- text ---- */
    --text:                60 8% 92%;       /* #EDEDEA primary */
    --text-2:              240 4% 78%;      /* #C4C4C8 body prose */
    --text-3:              240 3% 71%;      /* #B4B4B8 secondary body */
    --text-muted:          240 3% 53%;      /* #82828A supporting copy */
    --text-dim:            240 4% 43%;      /* #6A6A72 CONTRAST FLOOR for text */
    --text-gutter:         240 6% 38%;      /* #5A5A66 editor line numbers only */

    /* ---- primary (green) ---- */
    --primary:             154 69% 58%;     /* #4ADE9E */
    --primary-fg:          163 79% 8%;      /* #04231A text on primary */
    --primary-hover:       154 69% 52%;
    --primary-text:        154 69% 58%;     /* #4ADE9E on tinted surfaces */
    --primary-bg:          161 38% 8%;      /* #0D1D18 */
    --primary-bg-subtle:   160 27% 6%;      /* #0C1512 */
    --primary-border:      158 30% 17%;     /* #1F3A30 */
    --primary-row:         163 28% 10%;     /* #12201C selected curriculum row */

    /* ---- warning (amber) ---- */
    --warning:             41 72% 60%;      /* #E2B44F */
    --warning-text:        41 72% 60%;      /* #E2B44F */
    --warning-bg:          47 29% 6%;       /* #14120B */
    --warning-border:      46 41% 16%;      /* #3A3218 */

    /* ---- danger (red) ---- */
    --danger:              0 78% 73%;       /* #F08585 */
    --danger-text:         0 78% 73%;       /* #F08585 */
    --danger-bg:           0 32% 9%;        /* #1D0F0F */
    --danger-border:       0 29% 18%;       /* #3A2020 */

    /* ---- accents ---- */
    --accent-blue:         221 89% 72%;     /* #7AA2F7 SQL keywords */
    --accent-violet:       255 92% 76%;     /* #A78BFA admin surfaces */

    /* ---- glyphs + code ---- */
    --icon-off:            240 6% 24%;      /* #3A3A42 NON-TEXT ONLY */
    --code-bg:             240 10% 11%;     /* #1A1A20 */
    --code-text:           154 69% 58%;     /* #4ADE9E */
    --syntax-keyword:      221 89% 72%;     /* #7AA2F7 */
    --syntax-function:     41 72% 60%;      /* #E2B44F */
    --syntax-literal:      154 69% 58%;     /* #4ADE9E */
    --syntax-comment:      240 4% 37%;      /* #5A5A62 */
    --syntax-plain:        240 4% 78%;      /* #C4C4C8 */

    /* ---- legacy aliases: these re-skin all 51 existing routes ---- */
    --background:            var(--canvas);
    --foreground:            var(--text);
    --surface:               var(--panel-raised);
    --surface-muted:         var(--panel-sunken);
    --surface-elevated:      var(--panel-raised);
    --border:                var(--line);
    --border-strong:         var(--line-strong);
    --muted:                 var(--panel-sunken);
    --muted-foreground:      var(--text-muted);
    --muted-foreground-dim:  var(--text-dim);
    --primary-foreground:    var(--primary-fg);
    --accent:                var(--accent-violet);
    --accent-foreground:     var(--primary-fg);
    --destructive:           var(--danger);
    --destructive-foreground: var(--primary-fg);
    --warning-foreground:    var(--primary-fg);
    --success:               var(--primary);
    --success-foreground:    var(--primary-fg);
    --easy:                  var(--primary);
    --easy-bg:               var(--primary-bg);
    --easy-fg:               var(--primary-text);
    --medium:                var(--warning);
    --medium-bg:             var(--warning-bg);
    --medium-fg:             var(--warning-text);
    --hard:                  var(--danger);
    --hard-bg:               var(--danger-bg);
    --hard-fg:               var(--danger-text);
    --card:                  var(--panel-raised);
    --card-foreground:       var(--text);
    --popover:               var(--panel-raised);
    --popover-foreground:    var(--text);
    --secondary:             var(--panel-sunken);
    --secondary-foreground:  var(--text);
    --input:                 var(--line);
    --ring:                  var(--primary);
    --radius: 0.5rem;

    /* Elevation is surface value + 1px borders. No shadows. */
    --shadow-xs: none;
    --shadow-sm: none;
    --shadow-md: none;
    --shadow-lg: none;
    --shadow-xl: none;
    --shadow-primary: none;
    /* Deliberately NOT named --shadow-sidebar-active: @theme inline maps a
       utility of that name onto this var, and same-name would be circular. */
    --sidebar-active-shadow: none;
}
```

- [ ] **Step 3: Replace the `.light` block**

Light is not an inversion. Note that `--panel` (96%) is *darker* than `--panel-raised` (100%) — the reading column stays brightest in both themes — and that the semantic colours are re-picked for contrast on white, never lightened.

```css
.light {
    --canvas:              240 11% 98%;     /* #FAFAFB */
    --canvas-deep:         0 0% 100%;       /* #FFFFFF */
    --panel:               240 10% 96%;     /* #F4F4F6 rails are the TINTED layer */
    --panel-raised:        0 0% 100%;       /* #FFFFFF content is the BRIGHTEST */
    --panel-sunken:        240 14% 97%;     /* #F7F7F9 */
    --panel-hover:         240 14% 93%;     /* #EAEAEF */
    --panel-active:        0 0% 100%;       /* #FFFFFF — defined by shadow, not fill */

    --line:                240 10% 90%;     /* #E3E3E8 */
    --line-soft:           240 14% 93%;     /* #EAEAEF */
    --line-faint:          240 11% 95%;     /* #F0F0F3 */
    --line-strong:         240 9% 85%;      /* #D4D4DB */

    --text:                240 8% 10%;      /* #17171B */
    --text-2:              240 6% 21%;      /* #33333A */
    --text-3:              240 6% 29%;      /* #45454E */
    --text-muted:          240 5% 38%;      /* #5C5C66 */
    --text-dim:            240 4% 47%;      /* #74747E */
    --text-gutter:         240 5% 62%;      /* #9A9AA4 */

    --primary:             160 84% 34%;     /* #0E9F6E */
    --primary-fg:          0 0% 100%;       /* #FFFFFF */
    --primary-hover:       160 84% 28%;
    --primary-text:        161 82% 24%;     /* #0B6E4E */
    --primary-bg:          150 58% 95%;     /* #ECFAF3 */
    --primary-bg-subtle:   150 57% 97%;     /* #F4FCF8 */
    --primary-border:      153 52% 81%;     /* #B7E8D2 */
    --primary-row:         150 50% 95%;     /* #EAF8F1 */

    --warning:             36 100% 35%;     /* #B26A00 */
    --warning-text:        36 100% 27%;     /* #8A5200 */
    --warning-bg:          39 100% 95%;     /* #FFF7E8 */
    --warning-border:      41 67% 82%;      /* #F0DDB4 */

    --danger:              2 61% 47%;       /* #C2352F */
    --danger-text:         2 61% 47%;       /* #C2352F */
    --danger-bg:           4 88% 97%;       /* #FEF1F0 */
    --danger-border:       5 62% 88%;       /* #F3CFCC */

    --accent-blue:         218 74% 47%;     /* #1F5FD0 */
    --accent-violet:       263 70% 50%;     /* #6D28D9 — SP7 to confirm */

    --icon-off:            240 7% 78%;      /* #C4C4CC */
    --code-bg:             154 30% 95%;     /* #F0F7F4 */
    --code-text:           161 82% 24%;     /* #0B6E4E */
    --syntax-keyword:      218 74% 47%;     /* #1F5FD0 */
    --syntax-function:     34 100% 31%;     /* #A05A00 */
    --syntax-literal:      161 82% 24%;     /* #0B6E4E */
    --syntax-comment:      240 4% 56%;      /* #8A8A94 */
    --syntax-plain:        240 6% 21%;      /* #33333A */

    /* ---- legacy aliases (identical mapping to :root) ---- */
    --background:            var(--canvas);
    --foreground:            var(--text);
    --surface:               var(--panel-raised);
    --surface-muted:         var(--panel-sunken);
    --surface-elevated:      var(--panel-raised);
    --border:                var(--line);
    --border-strong:         var(--line-strong);
    --muted:                 var(--panel-sunken);
    --muted-foreground:      var(--text-muted);
    --muted-foreground-dim:  var(--text-dim);
    --primary-foreground:    var(--primary-fg);
    --accent:                var(--accent-violet);
    --accent-foreground:     var(--primary-fg);
    --destructive:           var(--danger);
    --destructive-foreground: var(--primary-fg);
    --warning-foreground:    var(--primary-fg);
    --success:               var(--primary);
    --success-foreground:    var(--primary-fg);
    --easy:                  var(--primary);
    --easy-bg:               var(--primary-bg);
    --easy-fg:               var(--primary-text);
    --medium:                var(--warning);
    --medium-bg:             var(--warning-bg);
    --medium-fg:             var(--warning-text);
    --hard:                  var(--danger);
    --hard-bg:               var(--danger-bg);
    --hard-fg:               var(--danger-text);
    --card:                  var(--panel-raised);
    --card-foreground:       var(--text);
    --popover:               var(--panel-raised);
    --popover-foreground:    var(--text);
    --secondary:             var(--panel-sunken);
    --secondary-foreground:  var(--text);
    --input:                 var(--line);
    --ring:                  var(--primary);

    --shadow-xs: none;
    --shadow-sm: none;
    --shadow-md: none;
    --shadow-lg: none;
    --shadow-xl: none;
    --shadow-primary: none;
    /* The ONLY shadow in either theme: a white active pill on a grey rail
       has no border to define it. */
    --sidebar-active-shadow: 0 1px 2px hsl(240 20% 10% / 0.06);
}
```

- [ ] **Step 4: Extend `@theme inline` with the new utilities**

Add these inside the existing `@theme inline { ... }` block, keeping the established `--color-<token>: hsl(var(--<token>))` convention. Leave every existing mapping in place.

Deliberately **not** mapped: `--canvas` (use `bg-background`), `--text` (use `text-foreground`), `--primary-fg` (use `text-primary-foreground`) — each already has a working utility through its alias, and a second name for the same thing invites drift.

```css
  --color-canvas-deep: hsl(var(--canvas-deep));
  --color-panel: hsl(var(--panel));
  --color-panel-raised: hsl(var(--panel-raised));
  --color-panel-sunken: hsl(var(--panel-sunken));
  --color-panel-hover: hsl(var(--panel-hover));
  --color-panel-active: hsl(var(--panel-active));
  --color-line: hsl(var(--line));
  --color-line-soft: hsl(var(--line-soft));
  --color-line-faint: hsl(var(--line-faint));
  --color-line-strong: hsl(var(--line-strong));
  --color-text-2: hsl(var(--text-2));
  --color-text-3: hsl(var(--text-3));
  --color-text-muted: hsl(var(--text-muted));
  --color-text-dim: hsl(var(--text-dim));
  --color-text-gutter: hsl(var(--text-gutter));
  --color-primary-text: hsl(var(--primary-text));
  --color-primary-bg: hsl(var(--primary-bg));
  --color-primary-bg-subtle: hsl(var(--primary-bg-subtle));
  --color-primary-border: hsl(var(--primary-border));
  --color-primary-row: hsl(var(--primary-row));
  --color-warning-text: hsl(var(--warning-text));
  --color-warning-bg: hsl(var(--warning-bg));
  --color-warning-border: hsl(var(--warning-border));
  --color-danger: hsl(var(--danger));
  --color-danger-text: hsl(var(--danger-text));
  --color-danger-bg: hsl(var(--danger-bg));
  --color-danger-border: hsl(var(--danger-border));
  --color-accent-blue: hsl(var(--accent-blue));
  --color-accent-violet: hsl(var(--accent-violet));
  --color-icon-off: hsl(var(--icon-off));
  --color-code-bg: hsl(var(--code-bg));
  --color-code-text: hsl(var(--code-text));
  --color-syntax-keyword: hsl(var(--syntax-keyword));
  --color-syntax-function: hsl(var(--syntax-function));
  --color-syntax-literal: hsl(var(--syntax-literal));
  --color-syntax-comment: hsl(var(--syntax-comment));
  --color-syntax-plain: hsl(var(--syntax-plain));
```

Also replace the six `--shadow-*` declarations inside `@theme inline` (they currently carry literal light-mode values) with `none`:

```css
  --shadow-xs: none;
  --shadow-sm: none;
  --shadow-md: none;
  --shadow-lg: none;
  --shadow-xl: none;
  --shadow-primary: none;
  --shadow-sidebar-active: var(--sidebar-active-shadow);
```

The last line is why the underlying variable is named `--sidebar-active-shadow` and not `--shadow-sidebar-active`: `@theme inline` emits its value directly, so mapping a token onto a `:root` variable of the *same* name would be a circular reference. The differing names make `shadow-sidebar-active` a real utility that resolves to `none` in dark and to the pill shadow in light.

- [ ] **Step 5: Run all three guards**

```bash
npm run check:token-parity; echo "parity=$?"
./scripts/check-no-palette-colors.sh; echo "palette=$?"
./scripts/check-shadcn-token-definitions.sh; echo "tokens=$?"
```

Expected: all three **exit 0**. The third is the important one — it proves every `var(--X)` referenced anywhere in the component tree still resolves after the rewrite.

- [ ] **Step 6: Typecheck and build**

```bash
npx tsc --noEmit && npm run build
```

Expected: both succeed. Use `npm run build`, never a bare `next build`.

- [ ] **Step 7: Commit**

```bash
git add app/globals.css
git commit -m "feat(ui): replace the palette with the graphite token system

Adds the handoff's full token vocabulary in both themes and re-points
every existing token at it as an alias, so all 51 routes re-skin without
a component edit. Collapses the duplicate .dark block into :root — the
dark custom-variant matches on the class, not on declarations. Flattens
shadows to none per the handoff, keeping the token names so existing
shadow-* utilities still compile, with one sanctioned exception for the
light-mode active sidebar pill."
```

---

### Task 3: Hex-literal guard

**Files:**
- Modify: `scripts/check-no-palette-colors.sh`

**Interfaces:**
- Consumes: nothing
- Produces: the existing guard, extended to reject `#RRGGBB` / `#RGB` inside `className` strings

- [ ] **Step 1: Add the hex rule**

In `scripts/check-no-palette-colors.sh`, after the `pattern2` definition, add:

```sh
# Raw hex literals inside className strings. The design handoff is ~200 hex
# values; pasting one instead of translating it to a token is the obvious
# failure mode, and it silently breaks the other theme.
pattern3='className=("|\{`)[^"`]*#[0-9a-fA-F]{3,8}'
```

Then add `-e "$pattern3"` to the existing `rg` invocation and update the failure message to:

```sh
    echo "Hardcoded palette classes or hex literals found. Use semantic tokens instead."
```

- [ ] **Step 2: Prove the new rule fires**

Create a throwaway file:

```bash
cat > components/ui/__hexprobe.tsx <<'EOF'
export function Probe() {
    return <div className="flex bg-[#0B0B0E] p-2" />
}
EOF
./scripts/check-no-palette-colors.sh; echo "exit=$?"
```

Expected: the probe file is listed and **exit=1**.

- [ ] **Step 3: Remove the probe and confirm the tree is clean**

```bash
rm components/ui/__hexprobe.tsx
./scripts/check-no-palette-colors.sh; echo "exit=$?"
```

Expected: **exit=0**. If any real file trips the new rule, fix that file — it is a genuine violation.

- [ ] **Step 4: Commit**

```bash
git add scripts/check-no-palette-colors.sh
git commit -m "test: reject raw hex literals in className strings"
```

---

### Task 4: The nav model

Pure data and matching logic, no React. This is the piece every shell component reads, so it is built and tested first.

**Files:**
- Create: `components/layout/console/nav-model.ts`
- Create: `components/layout/console/sidebar-cookie.ts`
- Create: `scripts/test-console-nav.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes: nothing
- Produces:
  - `type NavStatus = "live" | "soon"`
  - `interface NavItem { key, label, icon, href?, status, match?, exclude?, children? }`
  - `const PRIMARY_NAV: NavItem[]`, `const FOOTER_NAV: NavItem[]`, `const TAB_BAR: NavItem[]`
  - `function isNavItemActive(item: NavItem, pathname: string): boolean`
  - `function activeNavKey(pathname: string): string | null`
  - `const SIDEBAR_COOKIE = "dl:sidebar"`, `type SidebarState = "expanded" | "collapsed"`
  - `function parseSidebarState(raw: string | undefined): SidebarState`
  - `function sidebarCookieString(state: SidebarState): string`

- [ ] **Step 1: Write the failing tests**

Create `scripts/test-console-nav.ts`:

```ts
// Unit tests for the pure console-nav matching logic and sidebar cookie
// helpers. No React, no DOM, no database.
//
// Run: node --import tsx --test scripts/test-console-nav.ts

import { describe, it } from "node:test"
import assert from "node:assert/strict"
import {
    PRIMARY_NAV,
    FOOTER_NAV,
    TAB_BAR,
    activeNavKey,
    isNavItemActive,
    type NavItem,
} from "../components/layout/console/nav-model"
import {
    SIDEBAR_COOKIE,
    parseSidebarState,
    sidebarCookieString,
} from "../components/layout/console/sidebar-cookie"

function find(key: string): NavItem {
    const flat: NavItem[] = []
    for (const item of [...PRIMARY_NAV, ...FOOTER_NAV]) {
        flat.push(item)
        for (const child of item.children ?? []) flat.push(child)
    }
    const hit = flat.find((i) => i.key === key)
    assert.ok(hit, `no nav item with key "${key}"`)
    return hit
}

describe("isNavItemActive — the exclusion case", () => {
    // The rule most likely to regress: /learn/tracks is a prefix match on
    // /learn but must select Tracks, not Learn.
    it("selects Tracks and not Learn for /learn/tracks", () => {
        assert.equal(isNavItemActive(find("tracks"), "/learn/tracks"), true)
        assert.equal(isNavItemActive(find("learn"), "/learn/tracks"), false)
    })

    it("selects Tracks for a track detail page", () => {
        assert.equal(
            isNavItemActive(find("tracks"), "/learn/tracks/analyst-interview-prep"),
            true,
        )
        assert.equal(
            isNavItemActive(find("learn"), "/learn/tracks/analyst-interview-prep"),
            false,
        )
    })

    it("selects Learn and not Tracks for an ordinary topic", () => {
        assert.equal(isNavItemActive(find("learn"), "/learn/sql-basics"), true)
        assert.equal(isNavItemActive(find("tracks"), "/learn/sql-basics"), false)
    })

    it("selects Learn for the learn hub itself", () => {
        assert.equal(isNavItemActive(find("learn"), "/learn"), true)
    })
})

describe("isNavItemActive — exact vs prefix", () => {
    it("matches Home only on the root path", () => {
        assert.equal(isNavItemActive(find("home"), "/"), true)
        assert.equal(isNavItemActive(find("home"), "/learn"), false)
        assert.equal(isNavItemActive(find("home"), "/practice"), false)
    })
})

describe("isNavItemActive — parent and child together", () => {
    // Matching the mockup: on a practice route both Practice and its
    // Coding-problems child light up.
    for (const path of ["/practice", "/practice/tags", "/practice/two-sum"]) {
        it(`selects Practice and Coding problems for ${path}`, () => {
            assert.equal(isNavItemActive(find("practice"), path), true)
            assert.equal(isNavItemActive(find("coding-problems"), path), true)
        })
    }
})

describe("isNavItemActive — isolation", () => {
    const routes = [
        "/",
        "/learn",
        "/learn/sql-basics",
        "/learn/tracks",
        "/practice",
        "/practice/two-sum",
        "/contests",
    ]

    for (const path of routes) {
        it(`selects at most one top-level item for ${path}`, () => {
            const hits = PRIMARY_NAV.filter((i) => isNavItemActive(i, path))
            assert.ok(
                hits.length <= 1,
                `${path} selected: ${hits.map((h) => h.key).join(", ")}`,
            )
        })
    }

    it("leaves Practice unselected on /contests", () => {
        assert.equal(isNavItemActive(find("practice"), "/contests"), false)
        assert.equal(isNavItemActive(find("contests"), "/contests"), true)
    })
})

describe("activeNavKey", () => {
    it("returns the matching top-level key", () => {
        assert.equal(activeNavKey("/learn/tracks"), "tracks")
        assert.equal(activeNavKey("/practice/two-sum"), "practice")
        assert.equal(activeNavKey("/"), "home")
    })

    it("returns null for a route outside the nav", () => {
        assert.equal(activeNavKey("/privacy"), null)
    })
})

describe("soon items", () => {
    it("never carry an href", () => {
        const flat: NavItem[] = []
        for (const item of [...PRIMARY_NAV, ...FOOTER_NAV]) {
            flat.push(item)
            for (const child of item.children ?? []) flat.push(child)
        }
        for (const item of flat) {
            if (item.status === "soon") {
                assert.equal(
                    item.href,
                    undefined,
                    `"${item.key}" is soon but has href ${item.href}`,
                )
            }
        }
    })

    it("are never active", () => {
        assert.equal(isNavItemActive(find("projects"), "/projects"), false)
    })
})

describe("tab bar", () => {
    it("has exactly four items, all live with an href", () => {
        assert.equal(TAB_BAR.length, 4)
        for (const item of TAB_BAR) {
            assert.equal(item.status, "live", `${item.key} is not live`)
            assert.ok(item.href, `${item.key} has no href`)
        }
    })
})

describe("sidebar cookie", () => {
    it("defaults to expanded when unset or unrecognised", () => {
        assert.equal(parseSidebarState(undefined), "expanded")
        assert.equal(parseSidebarState(""), "expanded")
        assert.equal(parseSidebarState("nonsense"), "expanded")
    })

    it("round-trips both states", () => {
        assert.equal(parseSidebarState("collapsed"), "collapsed")
        assert.equal(parseSidebarState("expanded"), "expanded")
    })

    it("serialises a year-long, path-wide, Lax cookie", () => {
        const s = sidebarCookieString("collapsed")
        assert.ok(s.startsWith(`${SIDEBAR_COOKIE}=collapsed`))
        assert.match(s, /Path=\//)
        assert.match(s, /Max-Age=31536000/)
        assert.match(s, /SameSite=Lax/)
    })

    it("is not HttpOnly — the client must be able to write it", () => {
        assert.doesNotMatch(sidebarCookieString("expanded"), /HttpOnly/i)
    })
})
```

- [ ] **Step 2: Add the npm script**

In `package.json`, beside the other `test:` entries:

```json
"test:console-nav": "node --import tsx --test scripts/test-console-nav.ts",
```

- [ ] **Step 3: Run the tests to verify they fail**

```bash
npm run test:console-nav
```

Expected: FAIL — `Cannot find module '../components/layout/console/nav-model'`.

- [ ] **Step 4: Write `sidebar-cookie.ts`**

Create `components/layout/console/sidebar-cookie.ts`:

```ts
// Sidebar collapse state lives in a cookie rather than localStorage so the
// server can render the correct width on first paint. The root layout is
// already dynamic (it reads headers() for the CSP nonce), so the cookie read
// costs nothing extra.
//
// Pure string helpers — no React, no next/headers — so they are unit
// testable and usable from both server and client.

export const SIDEBAR_COOKIE = "dl:sidebar"

export type SidebarState = "expanded" | "collapsed"

/** Anything unrecognised means expanded. Never throws. */
export function parseSidebarState(raw: string | undefined): SidebarState {
    return raw === "collapsed" ? "collapsed" : "expanded"
}

/**
 * Deliberately NOT HttpOnly: the collapse toggle writes this from the client
 * via document.cookie, with no round trip.
 */
export function sidebarCookieString(state: SidebarState): string {
    return `${SIDEBAR_COOKIE}=${state}; Path=/; Max-Age=31536000; SameSite=Lax`
}
```

- [ ] **Step 5: Write `nav-model.ts`**

Create `components/layout/console/nav-model.ts`:

```ts
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
```

- [ ] **Step 6: Run the tests to verify they pass**

```bash
npm run test:console-nav
```

Expected: PASS, all assertions green.

- [ ] **Step 7: Deliberately break the exclusion rule to confirm the test bites**

Temporarily remove the `exclude: ["/learn/tracks"]` line from the `learn` item and re-run:

```bash
npm run test:console-nav
```

Expected: FAIL on "selects Tracks and not Learn for /learn/tracks" **and** on the isolation test. Restore the line and confirm green again.

- [ ] **Step 8: Commit**

```bash
git add components/layout/console/nav-model.ts components/layout/console/sidebar-cookie.ts scripts/test-console-nav.ts package.json
git commit -m "feat(nav): add the console nav model and sidebar cookie helpers"
```

---

### Task 5: Collapse hook

**Files:**
- Create: `components/layout/console/useSidebarCollapse.ts`

**Interfaces:**
- Consumes: `SidebarState`, `sidebarCookieString` from Task 4
- Produces: `function useSidebarCollapse(initial: SidebarState): { collapsed: boolean; toggle: () => void }`

- [ ] **Step 1: Write the hook**

Create `components/layout/console/useSidebarCollapse.ts`:

```ts
"use client"

import { useCallback, useState } from "react"
import { sidebarCookieString, type SidebarState } from "./sidebar-cookie"

/**
 * Collapse state, seeded from the server-rendered cookie value so there is no
 * width flash on first paint. The toggle updates local state optimistically
 * and writes the cookie directly — no server action, no round trip.
 */
export function useSidebarCollapse(initial: SidebarState) {
    const [state, setState] = useState<SidebarState>(initial)

    const toggle = useCallback(() => {
        setState((prev) => {
            const next: SidebarState = prev === "collapsed" ? "expanded" : "collapsed"
            document.cookie = sidebarCookieString(next)
            return next
        })
    }, [])

    return { collapsed: state === "collapsed", toggle }
}
```

- [ ] **Step 2: Typecheck**

```bash
npx tsc --noEmit
```

Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add components/layout/console/useSidebarCollapse.ts
git commit -m "feat(nav): add the sidebar collapse hook"
```

---

### Task 6: Expanded sidebar

**Files:**
- Create: `components/layout/console/ConsoleSidebar.tsx`
- Create: `lib/curriculum-featured.ts`

**Interfaces:**
- Consumes: `PRIMARY_NAV`, `FOOTER_NAV`, `isNavItemActive`, `activeNavKey` (Task 4); `useSidebarCollapse` (Task 5)
- Produces: `<ConsoleSidebar {...ConsoleSidebarProps} />` and `interface TrackProgress { name: string; percent: number }`; `const FEATURED_TRACK_SLUG: string`

- [ ] **Step 1: Add the featured-track constant**

`getTrackCurriculum` takes a slug and the product has no "active track" concept yet, so the sidebar names one explicitly. It duplicates `TRACK_SLUG` from `prisma/seed-analyst-track.ts` **on purpose** — app code must not import from seed scripts.

Create `lib/curriculum-featured.ts`:

```ts
/**
 * The track the console sidebar reports progress for.
 *
 * There is no per-user "active track" concept yet; when one arrives this
 * constant is what it replaces. Deliberately duplicated from
 * `prisma/seed-analyst-track.ts` rather than imported — application code
 * must not depend on seed scripts.
 *
 * Note this track ships DRAFT. `getTrackCurriculum` returns null for
 * unpublished tracks, so the sidebar progress block renders nothing until a
 * human publishes it. That is correct, not a bug.
 */
export const FEATURED_TRACK_SLUG = "analyst-interview-prep"
```

- [ ] **Step 2: Write the sidebar**

Create `components/layout/console/ConsoleSidebar.tsx`:

```tsx
"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { PanelLeft } from "lucide-react"
import { cn } from "@/lib/utils"
import {
    FOOTER_NAV,
    PRIMARY_NAV,
    activeNavKey,
    isNavItemActive,
    type NavItem,
} from "./nav-model"

export interface TrackProgress {
    name: string
    percent: number
}

interface ConsoleSidebarProps {
    // No `userName` prop: identity display is entirely `headerSlot`'s job.
    trackProgress: TrackProgress | null
    /** CMS pages from getNavLinks, rendered in the footer group. */
    pageLinks: Array<{ slug: string; title: string }>
    onToggle: () => void
    /** Rendered in the header slot: UserMenu when signed in, sign-in button otherwise. */
    headerSlot: React.ReactNode
}

const ROW =
    "flex items-center gap-2.5 rounded-[5px] px-2.5 py-[7px] text-[13.5px] transition-colors duration-150"

function NavRow({ item, pathname, nested }: { item: NavItem; pathname: string; nested?: boolean }) {
    const active = isNavItemActive(item, pathname)
    const Icon = item.icon

    if (item.status === "soon") {
        return (
            <span
                aria-disabled="true"
                className={cn(ROW, "cursor-default text-text-dim", nested && "text-[13px]")}
            >
                <Icon className={nested ? "h-3.5 w-3.5" : "h-[15px] w-[15px]"} aria-hidden />
                {item.label}
                <span className="ml-auto font-mono text-[9px] uppercase tracking-[0.14em] text-text-dim">
                    soon
                </span>
            </span>
        )
    }

    return (
        <Link
            href={item.href!}
            aria-current={active ? "page" : undefined}
            className={cn(
                ROW,
                nested && "text-[13px]",
                active
                    ? nested
                        ? "bg-primary-row text-foreground"
                        : "bg-panel-active font-medium text-foreground shadow-sidebar-active"
                    : "text-text-muted hover:bg-panel-hover hover:text-foreground",
            )}
        >
            <Icon
                className={cn(
                    nested ? "h-3.5 w-3.5" : "h-[15px] w-[15px]",
                    active && "text-primary",
                )}
                aria-hidden
            />
            {item.label}
        </Link>
    )
}

export function ConsoleSidebar({
    trackProgress,
    pageLinks,
    onToggle,
    headerSlot,
}: ConsoleSidebarProps) {
    const pathname = usePathname()
    const openKey = activeNavKey(pathname)

    return (
        <div className="hidden w-[236px] shrink-0 flex-col border-r border-line-soft bg-panel lg:flex">
            <div className="flex items-center gap-2.5 px-3 pb-2.5 pt-3">
                <div className="min-w-0 flex-1">{headerSlot}</div>
                <button
                    type="button"
                    onClick={onToggle}
                    aria-label="Collapse sidebar"
                    className="text-text-dim transition-colors duration-150 hover:text-foreground"
                >
                    <PanelLeft className="h-[15px] w-[15px]" aria-hidden />
                </button>
            </div>

            <nav aria-label="Primary" className="flex flex-col gap-px px-2 py-1.5">
                {PRIMARY_NAV.map((item) => (
                    <div key={item.key} className="flex flex-col gap-px">
                        <NavRow item={item} pathname={pathname} />
                        {item.children && openKey === item.key && (
                            <div className="my-0.5 ml-[18px] flex flex-col gap-px border-l border-line-faint pl-2.5">
                                {item.children.map((child) => (
                                    <NavRow key={child.key} item={child} pathname={pathname} nested />
                                ))}
                            </div>
                        )}
                    </div>
                ))}
            </nav>

            <div className="mt-auto flex flex-col gap-px border-t border-line-soft p-2">
                {trackProgress && (
                    <div className="mx-2.5 mb-2.5 mt-1.5">
                        <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.14em] text-text-dim">
                            <span>Track</span>
                            <span className="tabular-nums text-primary">
                                {trackProgress.percent}%
                            </span>
                        </div>
                        <div className="mt-[7px] h-[3px] bg-line-faint">
                            <div
                                className="h-full bg-primary"
                                style={{ width: `${trackProgress.percent}%` }}
                            />
                        </div>
                        <div className="mt-1.5 font-mono text-[11px] tabular-nums text-text-dim">
                            {trackProgress.name}
                        </div>
                    </div>
                )}

                {FOOTER_NAV.map((item) => (
                    <NavRow key={item.key} item={item} pathname={pathname} />
                ))}

                {pageLinks.map((page) => (
                    <Link
                        key={page.slug}
                        href={`/${page.slug}`}
                        className={cn(ROW, "text-[13px] text-text-muted hover:bg-panel-hover hover:text-foreground")}
                    >
                        {page.title}
                    </Link>
                ))}
            </div>
        </div>
    )
}
```

- [ ] **Step 3: Typecheck and run the guards**

```bash
npx tsc --noEmit
./scripts/check-no-palette-colors.sh; echo "palette=$?"
./scripts/check-shadcn-token-definitions.sh; echo "tokens=$?"
```

Expected: clean, both guards exit 0.

- [ ] **Step 4: Commit**

```bash
git add components/layout/console/ConsoleSidebar.tsx lib/curriculum-featured.ts
git commit -m "feat(nav): add the expanded console sidebar"
```

---

### Task 7: Collapsed rail

**Files:**
- Create: `components/layout/console/ConsoleRail.tsx`

**Interfaces:**
- Consumes: `PRIMARY_NAV`, `FOOTER_NAV`, `isNavItemActive` (Task 4)
- Produces: `<ConsoleRail onToggle initials />`

- [ ] **Step 1: Write the rail**

Icon-only controls need accessible names, so every button carries an `aria-label` and a `title`. "soon" items render as non-focusable spans exactly as in the sidebar.

Create `components/layout/console/ConsoleRail.tsx`:

```tsx
"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { PanelLeft } from "lucide-react"
import { cn } from "@/lib/utils"
import { FOOTER_NAV, PRIMARY_NAV, isNavItemActive, type NavItem } from "./nav-model"

interface ConsoleRailProps {
    onToggle: () => void
    /** Two-letter avatar fallback, e.g. "AK". Null when signed out. */
    initials: string | null
}

const CELL =
    "flex h-[34px] w-[34px] items-center justify-center rounded-md transition-colors duration-150"

function RailItem({ item, pathname }: { item: NavItem; pathname: string }) {
    const Icon = item.icon

    if (item.status === "soon") {
        return (
            <span
                aria-disabled="true"
                title={`${item.label} — coming soon`}
                className={cn(CELL, "cursor-default text-icon-off")}
            >
                <Icon className="h-[17px] w-[17px]" aria-hidden />
            </span>
        )
    }

    const active = isNavItemActive(item, pathname)
    return (
        <Link
            href={item.href!}
            aria-label={item.label}
            title={item.label}
            aria-current={active ? "page" : undefined}
            className={cn(
                CELL,
                active
                    ? "bg-panel-active text-primary shadow-sidebar-active"
                    : "text-text-dim hover:bg-panel-active hover:text-foreground",
            )}
        >
            <Icon className="h-[17px] w-[17px]" aria-hidden />
        </Link>
    )
}

export function ConsoleRail({ onToggle, initials }: ConsoleRailProps) {
    const pathname = usePathname()

    return (
        <div className="hidden w-14 shrink-0 flex-col items-center gap-0.5 border-r border-line-soft bg-panel py-3 lg:flex">
            <button
                type="button"
                onClick={onToggle}
                aria-label="Expand sidebar"
                className="flex h-8 w-8 items-center justify-center rounded-md text-text-dim transition-colors duration-150 hover:text-foreground"
            >
                <PanelLeft className="h-4 w-4" aria-hidden />
            </button>

            <span className="my-1.5 h-px w-6 bg-line-faint" />

            <nav aria-label="Primary" className="flex flex-col items-center gap-0.5">
                {PRIMARY_NAV.map((item) => (
                    <RailItem key={item.key} item={item} pathname={pathname} />
                ))}
            </nav>

            <div className="mt-auto flex flex-col items-center gap-0.5">
                {FOOTER_NAV.map((item) => (
                    <RailItem key={item.key} item={item} pathname={pathname} />
                ))}
                {initials && (
                    <span className="mt-1 flex h-[26px] w-[26px] items-center justify-center rounded-full bg-panel-hover text-[10px] font-semibold text-text-muted">
                        {initials}
                    </span>
                )}
            </div>
        </div>
    )
}
```

- [ ] **Step 2: Typecheck and guards**

```bash
npx tsc --noEmit && ./scripts/check-no-palette-colors.sh && ./scripts/check-shadcn-token-definitions.sh; echo "exit=$?"
```

Expected: **exit=0**.

- [ ] **Step 3: Commit**

```bash
git add components/layout/console/ConsoleRail.tsx
git commit -m "feat(nav): add the collapsed console rail"
```

---

### Task 8: Mobile tab bar

**Files:**
- Create: `components/layout/console/MobileTabBar.tsx`

**Interfaces:**
- Consumes: `TAB_BAR`, `isNavItemActive` (Task 4)
- Produces: `<MobileTabBar signedIn onSignInClick />`

- [ ] **Step 1: Write the tab bar**

Hit targets must be ≥44px per the handoff's accessibility rules; the 56px bar height satisfies this. Signed out, "You" opens the sign-in dialog rather than routing to `/profile`.

Create `components/layout/console/MobileTabBar.tsx`:

```tsx
"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { TAB_BAR, isNavItemActive } from "./nav-model"

interface MobileTabBarProps {
    signedIn: boolean
    /** Rendered in place of the "You" link when signed out. */
    signInSlot: React.ReactNode
}

const CELL =
    "flex flex-1 flex-col items-center justify-center gap-1 py-2 text-[11px] font-medium transition-colors duration-150"

export function MobileTabBar({ signedIn, signInSlot }: MobileTabBarProps) {
    const pathname = usePathname()

    return (
        <nav
            aria-label="Primary mobile"
            className="fixed inset-x-0 bottom-0 z-50 flex h-14 border-t border-line-soft bg-panel-sunken lg:hidden"
        >
            {TAB_BAR.map((item) => {
                const Icon = item.icon

                if (item.key === "tab-you" && !signedIn) {
                    return (
                        <div key={item.key} className={cn(CELL, "text-text-dim")}>
                            {signInSlot}
                        </div>
                    )
                }

                const active = isNavItemActive(item, pathname)
                return (
                    <Link
                        key={item.key}
                        href={item.href!}
                        aria-current={active ? "page" : undefined}
                        className={cn(CELL, active ? "text-primary" : "text-text-dim")}
                    >
                        <Icon className="h-[19px] w-[19px]" aria-hidden />
                        {item.label}
                    </Link>
                )
            })}
        </nav>
    )
}
```

- [ ] **Step 2: Typecheck and guards**

```bash
npx tsc --noEmit && ./scripts/check-no-palette-colors.sh && ./scripts/check-shadcn-token-definitions.sh; echo "exit=$?"
```

Expected: **exit=0**.

- [ ] **Step 3: Commit**

```bash
git add components/layout/console/MobileTabBar.tsx
git commit -m "feat(nav): add the mobile tab bar"
```

---

### Task 9: Shell composition and layout swap

The task that actually replaces the navbar. It is one commit because a half-applied swap leaves the app with no navigation at all.

**Files:**
- Create: `components/layout/console/ConsoleShell.tsx`
- Modify: `app/layout.tsx`
- Delete: `components/layout/Navbar.tsx`, `components/layout/MobileNav.tsx`, `components/layout/NavLink.tsx`

**Interfaces:**
- Consumes: everything from Tasks 4–8; `auth()`, `getNavLinks()`, `getTrackCurriculum()`, `getExistingDailyStatusForCurrentUser()`, `UserMenu`, `SignInDialogButton`
- Produces: `<ConsoleShell>{children}</ConsoleShell>`

- [ ] **Step 1: Write the shell's client wrapper**

The collapse toggle needs client state, but the data fetching must stay on the server. Split accordingly — create `components/layout/console/ConsoleChrome.tsx`:

```tsx
"use client"

import { ConsoleRail } from "./ConsoleRail"
import { ConsoleSidebar, type TrackProgress } from "./ConsoleSidebar"
import { MobileTabBar } from "./MobileTabBar"
import { useSidebarCollapse } from "./useSidebarCollapse"
import type { SidebarState } from "./sidebar-cookie"

interface ConsoleChromeProps {
    initialState: SidebarState
    initials: string | null
    signedIn: boolean
    trackProgress: TrackProgress | null
    pageLinks: Array<{ slug: string; title: string }>
    headerSlot: React.ReactNode
    signInSlot: React.ReactNode
    children: React.ReactNode
}

export function ConsoleChrome({
    initialState,
    initials,
    signedIn,
    trackProgress,
    pageLinks,
    headerSlot,
    signInSlot,
    children,
}: ConsoleChromeProps) {
    const { collapsed, toggle } = useSidebarCollapse(initialState)

    return (
        <div className="flex h-dvh overflow-hidden">
            {collapsed ? (
                <ConsoleRail onToggle={toggle} initials={initials} />
            ) : (
                <ConsoleSidebar
                    trackProgress={trackProgress}
                    pageLinks={pageLinks}
                    onToggle={toggle}
                    headerSlot={headerSlot}
                />
            )}
            {children}
            <MobileTabBar signedIn={signedIn} signInSlot={signInSlot} />
        </div>
    )
}
```

- [ ] **Step 2: Write the server shell**

Create `components/layout/console/ConsoleShell.tsx`. This is the sole fetcher — the `auth()` call and `menuStats` query are moved verbatim from the deleted `Navbar`, so this is a relocation rather than a new cost.

```tsx
import { getExistingDailyStatusForCurrentUser } from "@/actions/daily"
import { getNavLinks } from "@/actions/nav"
import { getTrackCurriculum } from "@/actions/curriculum"
import { auth } from "@/lib/auth"
import { excludeLockedProblems } from "@/lib/contest-locks"
import { prisma } from "@/lib/prisma"
import { FEATURED_TRACK_SLUG } from "@/lib/curriculum-featured"
import { SignInDialogButton } from "@/components/auth/SignInDialog"
import { UserMenu } from "@/components/layout/UserMenu"
import { cookies } from "next/headers"
import { ConsoleChrome } from "./ConsoleChrome"
import { parseSidebarState, SIDEBAR_COOKIE } from "./sidebar-cookie"
import type { TrackProgress } from "./ConsoleSidebar"

function initialsOf(name: string | null, email: string | null): string | null {
    const source = name?.trim() || email?.trim()
    if (!source) return null
    const parts = source.split(/[\s@.]+/).filter(Boolean)
    return parts.slice(0, 2).map((p) => p[0]!.toUpperCase()).join("")
}

export async function ConsoleShell({ children }: { children: React.ReactNode }) {
    const [{ data: pages }, session, cookieStore] = await Promise.all([
        getNavLinks(),
        auth(),
        cookies(),
    ])

    const initialState = parseSidebarState(cookieStore.get(SIDEBAR_COOKIE)?.value)

    let menuStats: { solved: number; total: number; dailySolved: boolean } | null = null
    if (session?.user?.id) {
        const [solvedRows, total, dailyStatus] = await Promise.all([
            prisma.submission.findMany({
                where: { userId: session.user.id, status: "ACCEPTED" },
                select: { problemId: true },
                distinct: ["problemId"],
            }),
            prisma.sQLProblem.count({
                where: excludeLockedProblems({ status: "PUBLISHED" }),
            }),
            getExistingDailyStatusForCurrentUser(),
        ])
        menuStats = {
            solved: solvedRows.length,
            total,
            dailySolved: dailyStatus.solvedToday,
        }
    }

    // The featured track ships DRAFT, so this returns null and the progress
    // block renders nothing. Wrapped so a curriculum failure can never take
    // down navigation.
    let trackProgress: TrackProgress | null = null
    try {
        const curriculum = await getTrackCurriculum(FEATURED_TRACK_SLUG)
        if (curriculum) {
            trackProgress = {
                name: curriculum.name,
                percent: curriculum.rollup.percent,
            }
        }
    } catch {
        trackProgress = null
    }

    const headerSlot = session?.user ? (
        <UserMenu
            name={session.user.name ?? null}
            email={session.user.email ?? null}
            image={session.user.image ?? null}
            role={session.user.role ?? "USER"}
            solved={menuStats?.solved ?? 0}
            total={menuStats?.total ?? 0}
            dailySolved={menuStats?.dailySolved ?? false}
        />
    ) : (
        <SignInDialogButton className="inline-flex h-8 w-full items-center justify-center rounded-[5px] bg-primary px-3 text-xs font-medium text-primary-foreground transition-colors duration-150 hover:bg-primary-hover">
            Sign in
        </SignInDialogButton>
    )

    const signInSlot = (
        <SignInDialogButton
            className="flex flex-col items-center gap-1 text-[11px] font-medium text-text-dim"
            panelLabel="Sign in from navigation"
        >
            Sign in
        </SignInDialogButton>
    )

    return (
        <ConsoleChrome
            initialState={initialState}
            initials={initialsOf(session?.user?.name ?? null, session?.user?.email ?? null)}
            signedIn={Boolean(session?.user)}
            trackProgress={trackProgress}
            pageLinks={pages ?? []}
            headerSlot={headerSlot}
            signInSlot={signInSlot}
        >
            {children}
        </ConsoleChrome>
    )
}
```

- [ ] **Step 3: Rewrite the root layout**

In `app/layout.tsx`: change the imports, the body classes, and the tree. The `<main>` element is the scroll container — page-level `sticky` now sticks to it, which Task 10 accounts for. The bottom padding on mobile clears the fixed tab bar.

Replace the `Navbar` import with `ConsoleShell`, drop the `Footer` import from the top level (it moves inside the scroll column), and replace lines 73–92 with:

```tsx
            <body
                className={`${inter.variable} ${jetbrainsMono.variable} antialiased h-dvh overflow-hidden bg-background text-foreground`}
            >
                <ThemeProvider nonce={nonce}>
                    <a
                        href="#main-content"
                        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:text-primary-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    >
                        Skip to main content
                    </a>
                    <ConsoleShell>
                        <main
                            id="main-content"
                            tabIndex={-1}
                            className="flex-1 overflow-y-auto pb-14 focus:outline-none lg:pb-0"
                        >
                            {children}
                            <Footer />
                        </main>
                    </ConsoleShell>
                </ThemeProvider>
```

Keep `Footer` imported — it is now rendered inside `<main>`. Keep the `Analytics` / `SpeedInsights` / `GoogleAnalytics` block below `ThemeProvider` unchanged.

- [ ] **Step 4: Delete the old navigation**

```bash
git rm components/layout/Navbar.tsx components/layout/MobileNav.tsx components/layout/NavLink.tsx
```

- [ ] **Step 5: Find and fix any stragglers**

```bash
rg -n "Navbar|MobileNav|layout/NavLink" app components lib --glob '!**/node_modules/**'
```

Expected: no results. Anything found must be updated — a stale import will fail the build.

- [ ] **Step 6: Typecheck, guards, build**

```bash
npx tsc --noEmit && npm run test:console-nav && npm run check:token-parity \
  && ./scripts/check-no-palette-colors.sh && ./scripts/check-shadcn-token-definitions.sh \
  && npm run build; echo "exit=$?"
```

Expected: **exit=0**.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(nav): replace the top navbar with the console shell

Every route now renders inside a fixed sidebar (or 56px rail) with the
content column as the scroll container, and a bottom tab bar below lg.
ConsoleShell is the sole fetcher; the auth() call and menuStats query
move across from the deleted Navbar unchanged. Footer moves inside the
scroll column so legal links survive until SP6 replaces it."
```

---

### Task 10: Repair pass

Fix what the swap breaks. **Nothing else** — anything that is merely "not yet redesigned" belongs to its own sub-project.

**Files:**
- Modify: `app/practice/[slug]/page.tsx:114`, `app/auth/signin/page.tsx:47`, `components/learn/TableOfContents.tsx:36`, `app/practice/tags/page.tsx:58`, `components/sql/ResultTable.tsx:81`, `components/layout/UserMenu.tsx`, `components/auth/SignInDialog.tsx`, `components/lists/*`

- [ ] **Step 1: Fix the viewport-height subtractions**

Three files subtract the old 64px bar from the viewport. The content column is now the full height of its flex parent, so the subtraction is wrong in both directions.

In `app/practice/[slug]/page.tsx:114`, change `h-[calc(100vh-4rem)]` to `h-full`.

In `app/auth/signin/page.tsx:47`, change `min-h-[calc(100dvh-4rem)]` to `min-h-full`.

- [ ] **Step 2: Fix the sticky offsets**

In `components/learn/TableOfContents.tsx:36`, `sticky top-24` was clearing the old bar. Change to `sticky top-6`.

In `app/practice/tags/page.tsx:58`, `sticky top-0` now sticks to the scrolling `<main>` rather than the viewport — which is the correct behaviour. Verify visually in Task 12; no code change expected.

- [ ] **Step 3: Give popovers borders**

Shadows are now `none`, so anything that relied on elevation for separation needs a 1px line. Add `border border-line` to the floating panel in each of:

- `components/layout/UserMenu.tsx` — the dropdown panel
- `components/auth/SignInDialog.tsx` — the dialog panel
- `components/lists/` — any popover panel (`rg -l "absolute.*z-" components/lists`)

Each already uses `bg-popover`; only the border is missing.

- [ ] **Step 4: Check the sticky table header**

`components/sql/ResultTable.tsx:81` uses `bg-surface-muted/95 backdrop-blur`. `--surface-muted` now aliases `--panel-sunken`, which in light mode is `#F7F7F9` — nearly white, so a translucent header over white rows may lose definition. Add `border-b border-line-faint` to the `<thead>` row so it reads in both themes.

- [ ] **Step 5: Verify the full suite**

```bash
npx tsc --noEmit && npm run test:console-nav && npm run check:token-parity \
  && ./scripts/check-no-palette-colors.sh && ./scripts/check-shadcn-token-definitions.sh \
  && npm run build; echo "exit=$?"
```

Expected: **exit=0**.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "fix(ui): repair layout and elevation assumptions broken by the shell swap"
```

---

### Task 11: Documentation

**Files:**
- Modify: `docs/design-system/colors_and_type.css`, `docs/design-system/README.md`, `CLAUDE.md`

- [ ] **Step 1: Regenerate the design-system token mirror**

`CLAUDE.md` describes `docs/design-system/colors_and_type.css` as mirroring the live token contract. Replace its `:root` / `.light` colour blocks with the exact blocks now in `app/globals.css` so it stops being a lie.

- [ ] **Step 2: Update the design-system README**

In `docs/design-system/README.md`, update the palette section to the graphite values and replace the shadow-scale guidance with the new rule: *elevation is surface value and 1px borders only; the sole shadow is the light-mode active sidebar pill.*

- [ ] **Step 3: Fix the two stale CLAUDE.md claims**

In the Stack section, `next-themes` for dark/light toggle says "light is default". `ThemeProvider` is and was `defaultTheme="dark"`. Change to "dark is default".

In the same section, update the Tailwind line to mention that the token vocabulary is the graphite Console system, and add a bullet under **Things to avoid**:

```markdown
- **Don't add a token to `:root` without adding it to `.light`.** Both themes ship and light is not an inversion — a missing light value fails silently and only for users on that theme. `npm run check:token-parity` enforces this.
```

- [ ] **Step 4: Commit**

```bash
git add docs/design-system CLAUDE.md
git commit -m "docs: update the token contract and correct the default-theme claim"
```

---

### Task 12: Driven browser review

The verification that actually matters — SP2 is almost entirely visual.

**Files:** whatever the review surfaces.

- [ ] **Step 1: Start the dev server against local Postgres**

`npm run dev` binds to `.env.local`, which points at the production Neon branch. Override it explicitly:

```bash
DATABASE_URL='postgresql://anchitgupta@localhost:5432/datalearn' npm run dev
```

- [ ] **Step 2: Review six viewport × theme combinations**

Drive Chrome through the devtools MCP. Viewports: **402×874** (mobile), **834×1112** (tablet), **1440×900** (desktop). Themes: dark and light. Routes: `/`, `/learn`, `/practice`, `/practice/<any-published-slug>`, `/profile`, `/admin`.

For each combination, confirm:

1. The right chrome is visible — 236px sidebar or 56px rail at ≥1024px, bottom tab bar below it, never both.
2. No horizontal overflow: `document.documentElement.scrollWidth <= window.innerWidth`.
3. Content is not hidden behind the fixed tab bar on mobile.
4. Compare against handoff screenshots `09`, `10`, `14`–`19` in `~/Downloads/design_handoff_learning_platform 2/screenshots/`.

- [ ] **Step 3: Verify collapse persistence has no flash**

Collapse the sidebar, reload, and confirm the rail renders at 56px on **first paint** — no 236px frame first. This is the single most visible thing the cookie decision is protecting; if it flashes, the cookie is not being read server-side.

- [ ] **Step 4: Check contrast and focus order**

Confirm no text renders below the `--text-dim` floor, and that `--icon-off` appears only on non-text glyphs. Tab from the top of the page and confirm the order runs: skip link → sidebar → content → tab bar.

- [ ] **Step 5: Fix what the review surfaces, then re-verify**

Anything found that is a genuine break gets fixed here. Anything that is merely un-redesigned is left for its sub-project — note it in the PR description instead.

```bash
npx tsc --noEmit && npm run test:console-nav && npm run check:token-parity \
  && ./scripts/check-no-palette-colors.sh && ./scripts/check-shadcn-token-definitions.sh \
  && npm run build; echo "exit=$?"
```

Expected: **exit=0**.

- [ ] **Step 6: Commit and open the PR**

```bash
git add -A
git commit -m "fix(ui): resolve issues found in cross-viewport shell review"
git push -u origin feat/console-shell-tokens
gh pr create --base main --title "feat(ui): console shell and graphite token system (SP2)"
```

**The `--base main` flag is mandatory.** The repo default is `production`; without it this deploys unfinished work to the live site.

Follow the template at `.github/PULL_REQUEST_TEMPLATE.md`. Under **Not yet verified**, state plainly:

- The sidebar track-progress block has never been seen populated — it needs a `PUBLISHED` track and the seeded one is `DRAFT` by design.
- Page interiors are still SP1-era; SP2 re-skins them but does not redesign them.

---

## Follow-up (separate PR, merged via the web UI)

The `gh` CLI token lacks `workflow` scope, so this cannot be part of the branch above.

Add two steps to `.github/workflows/test.yml` beside the existing `check-no-palette-colors.sh` step at line 58:

```yaml
      - name: Check token theme parity
        run: ./scripts/check-token-theme-parity.sh

      - name: Check token definitions resolve
        run: ./scripts/check-shadcn-token-definitions.sh

      - name: Console nav unit tests
        run: npm run test:console-nav
```
