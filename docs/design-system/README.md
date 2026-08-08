# Data Learn — Design System

> Practice SQL the way LeetCode does code. Real problems. Real schemas. A real
> database in your browser.

This design system captures the visual and content vocabulary of **Data Learn**, a
LeetCode-style SQL practice platform plus learning hub for data enthusiasts. It
exists so design and AI agents can produce on-brand mockups, slides, marketing
pages, and prototypes that look like they came out of the product itself.

---

## Index

| File / folder              | What's in it                                                       |
|----------------------------|--------------------------------------------------------------------|
| `README.md`                | This file. Brand voice, visual foundations, iconography, manifest. |
| `colors_and_type.css`      | CSS variables for color, type, spacing, radius, shadow.            |
| `SKILL.md`                 | Front-matter file for using this as a Claude Code skill.           |
| `assets/`                  | Logo SVGs, brand marks. (Iconography is sourced from Lucide.)      |
| `preview/`                 | Cards rendered into the Design System tab — type, color, etc.     |
| `ui_kits/web/`             | Hi-fi recreation of the web product (home, practice list, workspace, learn). |
| `preview/`                 | 21 design-system cards (colors, type, spacing, components, brand). |
| `assets/`                  | `logo.svg`, `logo-wordmark.svg` — Data·Learn brand marks.          |

The `colors_and_type.css` file mirrors the live token contract from
`datalearn/app/globals.css`. Tokens are HSL channels first, then resolved
`--color-*` variables, then semantic classes (`.h1`, `.lede`, `.eyebrow`,
`.code`, `.kbd`).

---

## Sources

| Source                                  | Path                                       | Access     |
|-----------------------------------------|--------------------------------------------|------------|
| Codebase (Next.js 16 + Tailwind v4)     | `datalearn/` (locally mounted)             | read-only  |
| Repo                                    | <https://github.com/ez-biz/datalearn>      | public     |
| Design tokens, source of truth          | `datalearn/app/globals.css`                | read-only  |
| Hand-rolled UI primitives               | `datalearn/components/ui/`                 | read-only  |
| Layout (console sidebar/rail, Footer)   | `datalearn/components/layout/`             | read-only  |
| SQL workspace (the heart of the app)    | `datalearn/components/sql/` + `practice/`  | read-only  |
| Project guide for AI contributors       | `datalearn/CLAUDE.md`                      | read-only  |

No Figma, no marketing brand kit, no slide template was attached — so this
system is **derived entirely from the working code**. If a marketing brand book
or motion guide exists elsewhere, please share it and we'll fold it in.

---

## What is Data Learn?

A single-product company. The product has three surfaces stitched together
under one roof:

1. **Practice** — `/practice` — a LeetCode-style problem list and a two-pane
   problem workspace (description / schema / hints / history on the left,
   Monaco SQL editor + tabbed Results / Verdict on the right). Queries run
   client-side in **DuckDB-WASM**; submissions get an immediate accept /
   wrong-answer verdict with row-level diffs.
2. **Learn** — `/learn` — a CMS-driven learning hub. Topics → articles, with
   markdown content, table of contents, and "related problems" links back
   into Practice.
3. **Admin / authoring** — `/admin/*` for staff to author problems and
   articles end-to-end, plus an MCP server so AI assistants can write
   problems too.

The vibe is **engineer-to-engineer**: confident, no-fluff, terminal-friendly.
The marketing surface (`app/page.tsx`) is happy to crack a joke ("That's it.
No environment to install.") but the in-product UI is brisk and informational.

---

## CONTENT FUNDAMENTALS

The product copy reads like a senior engineer wrote it for other engineers:
clear, opinionated, faintly dry. Below are the rules — pulled from real
strings in the codebase — that keep new copy on-brand.

### Voice

- **Direct, not breathless.** State the thing. No "supercharge", no
  "revolutionize", no "unleash".
  - ✅ "Practice SQL the way engineers do."
  - ✅ "Real problems. Real schemas. A real database in your browser."
  - ✅ "DuckDB-WASM runs your queries client-side. Zero server round-trips,
    zero waiting."
  - ❌ "Supercharge your data career with AI-powered SQL mastery."

- **Comfortable with technical specifics.** Mention DuckDB-WASM, Monaco,
  `cmd+enter`, "row-level diffs", "tabular numerics" — engineers respect
  precision and notice when it's missing.

- **Mild dry humour, used sparingly.** One small wink per page is enough.
  - ✅ "Open a problem, write SQL in the editor, hit Run. That's it. No
    environment to install."

### Person

- **Talks to the user as "you"**, not "we" or "users".
  - "Your output matches the expected result."
  - "You can keep typing while the engine loads."
- **Talks about the product as the bare noun**, not "we" or "the platform".
  - "DuckDB-WASM runs your queries…" (named subsystem, active voice)
  - "Every problem ships with expected results."

### Casing

- **Sentence case for everything**: page titles, button labels, badges, nav
  items.
  - ✅ "Featured problems", "Browse all problems", "Reveal hint 1 of 3"
  - ❌ "Featured Problems", "BROWSE ALL PROBLEMS"
- **Two intentional exceptions**: small caps / uppercase tracking is used as
  a **typographic device** (not as casing) for short labels — column headers
  in result tables, status badges (`EASY`, `MEDIUM`, `HARD`),
  `eyebrow` micro-headings ("ABOUT", "GET IN TOUCH"). The underlying word is
  always written in normal case in source; CSS does the uppercasing.

### Punctuation

- **Em dashes are loved.** "Real problems. Real schemas. A real database in
  your browser."
- **The Oxford comma is used.** Three-or-more lists.
- **Single spaces** after sentences. Not two.
- **No exclamation marks.** The product is too composed for them.
  Encouragement is shown with primary color, not `!`.

### Microcopy patterns

| Need                   | Pattern                                     | Example                               |
|------------------------|---------------------------------------------|---------------------------------------|
| Empty state            | Verb-led, points to a next action           | "No results yet. Run a query to see output here." |
| Error                  | Name the failure, then the cause            | "Query error" + the parser message    |
| Success verdict        | Past-tense status + plain-English fact      | "Accepted — your output matches the expected result." |
| Loading                | Present continuous, three dots              | "Engine loading…", "Running query…"   |
| Keyboard shortcut hint | Symbol kbd, short verb                      | "⌘ ↵ Run", "⌘ ⇧ ↵ Submit"            |
| Stat label             | Single word, sentence case                  | "Problems", "Topics", "Articles"      |

### Emoji

**No.** The CLAUDE.md is unambiguous: *"No emoji icons — use SVG (Lucide)."*
This rule extends to copy. The product never uses 🚀 or ✅ in text.
Status is communicated with semantic color, a Lucide icon, and a word.

### Length

- Hero headlines: ≤ 8 words.
- Hero subtitles: 1–2 sentences, ≤ 30 words.
- Buttons: 1–3 words, verb first ("Start solving", "Browse lessons", "Sign in",
  "Reveal hint", "Run", "Submit", "Reset").
- Toasts / verdicts: one sentence.

### Vibe summary

If the brand were a person it would be a senior data engineer who's seen too
many bad SQL screens, can build their own, and isn't going to oversell it.
Confident, technical, generous with shortcuts, allergic to jargon for jargon's
sake.

---

## VISUAL FOUNDATIONS

### Palette

A near-neutral **graphite** base (hue 240, almost no chroma) with **green**
as the sole brand color (primary, the "Learn" half of the wordmark and every
accept / success / progress / focus-ring signal). **Amber** carries warnings
and the "Medium" difficulty + hint highlights — a distinct role from the
legacy `--accent` token, which is now **violet** and reserved for admin
surfaces. A second functional accent, **blue**, is used only for SQL keyword
syntax highlighting. Note **dark is the product default**
(`ThemeProvider` ships `defaultTheme="dark"`), so the table below reads
dark-first.

| Role                              | Dark (default)                | Light                          | Where it shows up                 |
|------------------------------------|-------------------------------|---------------------------------|-----------------------------------|
| Background (`--canvas`)            | `hsl(240 10% 6%)` `#0E0E11`   | `hsl(240 11% 98%)` `#FAFAFB`   | Page surface                      |
| Foreground (`--text`)              | `hsl(60 8% 92%)` `#EDEDEA`    | `hsl(240 8% 10%)` `#17171B`    | Body text                         |
| Surface (`--panel-raised`)         | `hsl(240 13% 8%)` `#111116`   | `hsl(0 0% 100%)` `#FFFFFF`     | Cards, table headers              |
| Surface muted (`--panel-sunken`)   | `hsl(240 12% 7%)` `#0F0F13`   | `hsl(240 14% 97%)` `#F7F7F9`   | Toolbars, table rows              |
| Border (`--line`)                  | `hsl(240 6% 16%)` `#26262B`   | `hsl(240 10% 90%)` `#E3E3E8`   | Card / table borders              |
| **Primary** 🟢                     | `hsl(154 69% 58%)` `#4ADE9E`  | `hsl(160 84% 34%)` `#0E9F6E`   | CTAs, "Data·**Learn**", success, focus ring |
| **Warning** 🟠 (amber)             | `hsl(41 72% 60%)` `#E2B44F`   | `hsl(36 100% 35%)` `#B26A00`   | "Medium" difficulty, hints, warnings |
| **Accent** 🟣 (violet, legacy `--accent`) | `hsl(255 92% 76%)` `#A78BFA` | `hsl(263 70% 50%)` `#6D28D9` | Admin surfaces |
| **Accent blue**                    | `hsl(221 89% 72%)` `#7AA2F7`  | `hsl(218 74% 47%)` `#1F5FD0`   | SQL keyword syntax highlighting   |
| Danger / Hard                      | `hsl(0 78% 73%)` `#F08585`    | `hsl(2 61% 47%)` `#C2352F`     | Errors, "Hard" badge              |
| Easy bg / fg     | `hsl(161 38% 8%)` / `hsl(154 69% 58%)` | `hsl(150 58% 95%)` / `hsl(161 82% 24%)` | "Easy" pills    |
| Medium bg / fg   | `hsl(47 29% 6%)` / `hsl(41 72% 60%)`   | `hsl(39 100% 95%)` / `hsl(36 100% 27%)` | "Medium" pills  |
| Hard bg / fg     | `hsl(0 32% 9%)` / `hsl(0 78% 73%)`     | `hsl(4 88% 97%)` / `hsl(2 61% 47%)`     | "Hard" pills    |

The same primary green serves as `--ring` (focus outline) and `--success`.
This is intentional — focus and "you got it right" feel related.

Every pre-existing token name (`--background`, `--surface`, `--border`,
`--muted-foreground`, `--easy`, etc.) still resolves — each is now an alias
onto the graphite vocabulary above (`--canvas`, `--panel`, `--line`,
`--text`, …). See `colors_and_type.css` for the full raw-channel list,
including surface/line/text sub-ranks (`--panel-hover`, `--line-faint`,
`--text-dim`, …) and the code/syntax-highlighting tokens (`--code-bg`,
`--syntax-keyword`, `--syntax-function`, …) that have no legacy alias at all.

### Typography

- **Sans** — Inter (loaded via `next/font/google` in layout.tsx, with character
  variants `cv02 cv03 cv04 cv11` enabled for the alt-`a`, `g`, single-storey
  `i`, and crooked `7`). Inter is the only sans on the page.
- **Mono** — JetBrains Mono. Used for SQL, code, table cells, `<kbd>`,
  filenames in window chrome, and any number that wants to feel
  data-table-shaped. Ligatures **off** (`font-variant-ligatures: none`) so SQL
  operators like `<=`, `!=`, `||` read literally.
- **Tabular numerics** are explicit: `.tabular-nums` is sprinkled on every
  number that lives in a table or stat column.
- **Wrap rules**: `text-wrap: balance` on h1/h2/h3, `text-wrap: pretty` on
  paragraphs.
- **Tracking**: tight on display sizes (`-0.02em`), normal on body, wide
  (`0.06em`) + uppercase on `.eyebrow` / `.label` micro-headings.

### Spacing & rhythm

Tailwind's stock scale, but only a subset is in heavy use: `1 / 2 / 3 / 4 /
6 / 8 / 10 / 16 / 20`. Page sections breathe at `py-16` to `py-20` on
desktop, `py-10` to `py-14` on smaller screens.

### Corner radii

| Token         | Value | Used on                                     |
|---------------|-------|---------------------------------------------|
| `--radius-sm` | 4px   | Inline tabs, focus chips                    |
| `--radius-md` | 8px   | Buttons, inputs, badges (default radius)    |
| `--radius-lg` | 12px  | Cards, large buttons                        |
| `--radius-xl` | 16px  | Hero panels, modals                         |
| `--radius-full` | 9999px | Pills (difficulty), avatar, status dots  |

Difficulty badges and the brand logo's outer rect are noticeably more
rounded (`7px` on a 28px square = the `lg` rung) — that softness is part of
the brand.

### Cards

Cards are the **single most-used container** in the product (problem rows,
topic tiles, dashboard cells). The recipe is fixed:

```
border: 1px solid var(--color-border);
background: var(--color-surface);
border-radius: var(--radius-lg);    /* 12px */
```

No drop shadow at rest or on hover — `--shadow-md` and friends are
flattened to `none` (see Shadows below). The hover lift is the 0.5px
upward translate (`-translate-y-0.5`) plus a border-color shift to
`primary/40`; that's the only "alive" animation in the product.

The hero editor preview card on the homepage still carries a soft
brand-tinted blur halo
(`bg-gradient-to-br from-primary/15 via-transparent to-accent/10 blur-2xl`)
and an un-themed `shadow-2xl` (Tailwind's stock 2xl shadow, not one of the
flattened `--shadow-*` tokens — its paired `shadow-primary/5` is now inert
since `--shadow-primary` is `none`). That treatment is reserved for the
marketing hero and should not be repeated on regular cards.

### Borders

Borders do most of the visual separation work — shadows are restrained.
There are two weights:

- `--border` — default; subtle, light grey
- `--border-strong` — for scrollbar thumbs, focused divider edges

### Shadows

**Elevation is surface value and 1px borders only.** Every themed shadow
token (`--shadow-xs`, `--shadow-sm`, `--shadow-md`, `--shadow-lg`,
`--shadow-xl`, `--shadow-primary`) is flattened to `none` in both themes —
a raised surface reads as a lighter/darker fill plus a hairline border, not
a drop shadow.

The **sole exception** is the light-mode active sidebar pill: a white pill
on a grey rail has no border to define it, so it gets one real shadow
(`--sidebar-active-shadow`, exposed as the `shadow-sidebar-active` utility,
`0 1px 2px hsl(240 20% 10% / 0.06)`). It doesn't exist in dark mode — the
active pill there is defined by `--panel-active` fill instead.

### Backgrounds

The product is **mostly flat surfaces**. The hero is the rare exception:

- A soft radial gradient at the top
  `radial-gradient(ellipse_at_top, hsl(var(--primary)/0.08), transparent_60%)`
- A faint grid masked to a center ellipse
  `linear-gradient(...) bg-[size:48px_48px] [mask-image:radial-gradient(ellipse_at_center,black,transparent_70%)] opacity-40`

Both are 8% / 40% opacity and decorative-only (`aria-hidden`). Outside the
hero, **no gradients, no patterns, no textures**. Cards sit on flat
`--surface` over flat `--background`.

### Imagery

The product ships with **zero photography or illustrations**. Visual interest
comes from:

- Real-looking SQL code in stylized cards (token-coloured monospace)
- Real-looking result tables (sticky header, NULL italicised, tabular numerics)
- Lucide icons in a soft brand-tinted square (`bg-primary/10` + green icon)
- Difficulty pills

If imagery is later required, prefer **product screenshots** over stock
illustrations. Avoid AI hand-drawn line art and gradient blobs.

### Animation

Restrained. The whole transition vocabulary in the product is:

- `transition-colors` (150ms) on nav links, table rows, list rows
- `transition-[border-color,box-shadow,translate]` (200ms ease-out) on hover
  cards in `/learn` — the lift is `-translate-y-0.5`
- The theme toggle (sidebar footer row, rail footer icon, mobile account
  menu — logic shared via `lib/use-hydrated-theme.ts`) is a plain
  conditional Sun/Moon icon swap; no scale/rotate transition
- `animate-spin` on `<Loader2>` Lucide icon — the only true animation
- `transition-[width]` (500ms ease-out) on progress bars in the user
  dashboard

There is a **`@media (prefers-reduced-motion: reduce)`** override that
collapses every animation/transition to 0.01ms. Honour it on any new motion.

### Hover states

- Links / nav: foreground colour shifts from `--muted-foreground` →
  `--foreground`.
- Primary buttons: background → `--primary-hover` (just a tick darker).
- List rows: background → `--surface-muted/60`. The arrow `<ArrowRight>` to
  the right of the row picks up `--primary` and translates `0.5px` right.
- Cards (in `/learn`): `border-color` → `primary/40`, `translate-y -0.5px`
  (the paired `shadow-md` class is still applied in code but resolves to
  `none` — see Shadows above).
- Ghost buttons: background → `--surface-muted`.

### Press / active

- All buttons: `active:scale-[0.96]`. Nothing more.
- No "ripple" motif, no colour flash.

### Focus ring

`outline: 2px solid hsl(var(--ring))` (the primary green) with `2px` offset
and a 4px radius. Defined globally on `:focus-visible`. Never removed.

### Transparency & blur

- The left console sidebar/rail is a solid `bg-panel` fixed column with a
  1px `border-line-soft` edge — no transparency or blur. (The old sticky,
  translucent `<Navbar>` no longer exists; it was replaced by the sidebar
  in the Console shell rework.)
- Primary / accent overlays use opacity (`primary/10`, `primary/20`) for
  ring tints, soft icon backgrounds, focus halos.
- Scrolling result tables use `bg-surface-muted/95 backdrop-blur` on the
  sticky header.

That's it. No frosted-glass cards, no hero image overlays.

### Data tables (a load-bearing motif)

Result tables, problem lists, schema previews — they all share a pattern:

- Sticky header on `bg-surface-muted/95` with `backdrop-blur`
- `text-[11px] uppercase tracking-wide text-muted-foreground` column labels
- Row body in `font-mono`, `text-[13px]`
- `whitespace-nowrap` cells, horizontal scroll if needed (`scrollbar-thin`)
- NULL rendered as italic, sans-serif, `text-muted-foreground/60`
- Numeric cells: `tabular-nums text-right`
- Row hover: `bg-surface-muted/50`

### Layout

- Single max-width container: `max-w-7xl` (~1280px), gutters `px-4 sm:px-6
  lg:px-8`.
- Top-of-page rhythm: small eyebrow / breadcrumb if any, then `h1`, then
  one-line `lede`, then content.
- Two-pane workspace (`/practice/[slug]`) is `40% / 60%` on desktop,
  stacked on mobile.

---

## ICONOGRAPHY

**System: [Lucide](https://lucide.dev/) (`lucide-react` package).** No second
icon family is allowed. `CLAUDE.md` enshrines this:

> *"No emoji icons — use SVG (Lucide)."*

Used in the product, observed across `app/`, `components/home/`,
`components/practice/`, `components/sql/`, `components/layout/`:

- Navigation / chrome: `Sun`, `Moon`, `PanelLeft` (sidebar collapse),
  `LogIn`, `Github`, `Shield`, `PenSquare`, `User`, `Search`
- Actions: `Play`, `Send`, `RotateCcw`, `ArrowRight`, `ChevronRight`,
  `ChevronDown`, `Plus`, `Trash`, `Settings`
- Status / feedback: `CheckCircle2`, `XCircle`, `AlertCircle`, `Loader2`
  (always paired with `animate-spin`), `Sparkles`
- Subject icons (lessons, schema, code): `BookOpen`, `Database`, `Terminal`,
  `FileText`, `Lightbulb`, `History`, `Clock`, `Compass`, `Gauge`, `Zap`,
  `Table2`

Style:

- **Stroke-based, 1.5px stroke** (Lucide default — never override the stroke
  weight to "make a logo").
- **Currentcolor only**: icon color = ambient text color. No filled glyphs
  except the brand mark.
- **Icon size pairs with type**: 14px (`h-3.5 w-3.5`) inline with body /
  micro-headings, 16px (`h-4 w-4`) with buttons, 20px (`h-5 w-5`) with
  section subjects, 32px (`h-8 w-8`) for hero subject icons.
- **Soft tinted square** is the recurring icon container — `h-10 w-10
  rounded-lg bg-primary/10 text-primary`.

For HTML mockups, load Lucide once via CDN and use the data-attribute API:

```html
<script src="https://unpkg.com/lucide@latest/dist/umd/lucide.min.js"></script>
<i data-lucide="check-circle-2"></i>
<script>lucide.createIcons();</script>
```

We did not embed copies of the icon SVGs — Lucide's CDN is the canonical
source and the codebase simply imports them. If we move offline, snapshot
the subset above into `assets/icons/`.

### Logo

- `assets/logo.svg` — square mark only (32×32). Soft green-tinted
  rounded-square frame, the letter "D" filled in primary, a small "L" stem
  to the right (the wordmark in iconographic form).
- `assets/logo-wordmark.svg` — mark + "Data·**Learn**". The "Data" is
  foreground, "Learn" is primary.

Lifted directly from `datalearn/components/ui/Logo.tsx`. Use the wordmark in
nav, the mark alone for favicons / avatar slots / tight spaces.

### Emoji & unicode glyphs

- **Emoji:** never. Status uses Lucide + colour + a word.
- **Unicode glyphs:** sparingly, for keyboard hints — `⌘`, `↵`, `⇧`, `→`,
  `·` (middle dot as a visual separator in stat strings: "3 rows · 0.04s").

---

## Caveats & known gaps

- **Inter** + **JetBrains Mono** are loaded from Google Fonts in
  `colors_and_type.css`. The product loads them via `next/font` from the
  same source — no custom WOFF2 files exist in the repo. No substitution
  was made.
- No marketing brand book or motion specification was attached. Animation
  rules above are derived from observed code, not a written guide.
- No slide template / deck assets exist, so `slides/` is **omitted**
  intentionally — instructions said "If no sample slides were given, don't
  create them."
- Lucide icons are not pre-copied into `assets/icons/`; the product uses
  the npm package and we recommend the CDN for HTML mocks.

---

## Want to iterate?

- Should we mint a brand-specific illustration system (e.g. SQL
  whiteboard scribbles for empty states) or stay screenshot-only?
- A motion guide — anything beyond the 150–200ms `transition-colors` /
  `translate-y` vocabulary the codebase already uses?
- A slide template — title slide, problem deep-dive, comparison, big
  quote? Easy to add once you've decided on a tone for decks.
