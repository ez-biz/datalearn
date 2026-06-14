# Handoff — UI v2 spec + implementation plan committed (not pushed); anon-gating PR #130 merged

**Date:** 2026-05-23
**From:** Claude session that audited the UI cohesion, ran a 7-pass Codex review of the UI v2 spec (catching 16 distinct findings), expanded scope mid-stream to include the full admin redesign + shadcn adoption, and produced the 1954-line implementation plan.
**Continues:** `docs/superpowers/handoff/2026-05-23-anon-gating-spec-handoff.md`.
**For:** the next AI / engineer.

## TL;DR

Three things this session:

1. **Anon-gating PR #130 merged to main.** Two cleanup commits from the earlier pass (review nits closed) shipped with it. The anon-gating spec + plan now lives on `main`. Implementation Task 1 (HMAC helpers + unit tests) is the natural next-execution step for that work.

2. **UI cohesion audit** found the codebase is unusually disciplined (no hardcoded hex, all semantic tokens). Surfaced one big visible issue (container gutters at ≥1440px viewport), a few medium-leverage opportunities (Prism syntax theme is design-system-foreign; no `<Headline>` JSX primitive; dark mode unverified visually), and several nits. User-driven follow-up: build a "UI v2" effort covering container breathing, overflow primitives, and a new "hacky" theme direction.

3. **Massive UI v2 spec + plan, 7 Codex passes, scope expanded to every page including admin redesign + shadcn adoption.** 825-line spec + 1954-line implementation plan, 14 local commits on `docs/ui-v2-spec`, NOT pushed yet. Estimated ~2 weeks of implementation work (11-commit migration order). Spec is comprehensive enough that any subagent should be able to execute from it.

## Where things stand

### Production
- v0.5.0.2 still live (merged 2026-05-22). CSP allows mermaid + analytics on `/learn/**`.
- Topic lanes infrastructure merged; **production seed (Task 20 of the curriculum plan) still not run** — `/learn` on prod still shows alphabetical ordering without lane sections. Carried forward from prior handoff; still pending.

### `main`
- HEAD includes PR #130 merge (anon-gating spec + plan, merged 2026-05-23T02:59Z). Now ahead of `production` by the curriculum-infra commits + anon-gating docs.
- No new release PR has been opened against production since v0.5.0.2.

### Open PRs (project-wide)
- **#117** lucide-react 0.562 → 1.16 dependabot, sitting since 2026-05-18. Still pending upgrade-guide pass.

### Local branch (not pushed)
- **`docs/ui-v2-spec`** — 14 commits ahead of `main`. Two doc files:
  - `docs/superpowers/specs/2026-05-23-ui-v2-design.md` — 825 lines.
  - `docs/superpowers/plans/2026-05-23-ui-v2-implementation.md` — 1954 lines.
- Commit chain:
  - `149faeb` — initial UI v2 spec
  - `e6b522a` — Codex pass 1 fixes (token compat + admin)
  - `d37e479` — pass 2 fixes (WCAG AA + CI guard)
  - `306d550` — pass 3 fixes (dark: variants + accent-fg + denylist)
  - `ae5e582` — pass 4 fixes (.dark contradiction + warning AA)
  - `6645e19` — adopt shadcn/ui (user-requested scope add)
  - `35ec8a7` — pass 5 fix (shadcn token compat gap)
  - `3f7f0ae` — user-requested scope expansion: every page incl. admin redesign
  - `f84670e` — sweep stale UI v3 refs after the scope expansion
  - `a61e269` — pass 6 fixes (real route inventory + shadows + NewsFeed)
  - `64eb358` — pass 6 stragglers
  - `5c20d85` — pass 7 fixes (case collision + form set + grep verification)
  - `8df43e7` — implementation plan (11 tasks, 1954 lines)

### Other untouched local state
- Untracked carryovers: `.claude/scheduled_tasks.lock`, `.codex/`, `AGENTS.md`, `docs/superpowers/handoff/` (gitignored).
- Stashed `.env*.local` gitignore change still in `git stash list`.

## What shipped this session

| Artifact | Where | What |
|---|---|---|
| PR #130 anon-gating nits | merged 2026-05-23T02:59Z | Two cleanup commits (architectural reset fix + minor nits) from the prior pass-7 review. |
| UI cohesion audit | this transcript | file-explorer agent inventoried tokens + primitives. Codebase is unusually disciplined; no hardcoded colors found. |
| Container-breathing preview | `/tmp/datalearn-ui-breathing-preview.html` | Side-by-side mockup showing current vs proposed widths + ScrollableTable fade-edge + narrower article reader. |
| Theme-direction demos | `/tmp/datalearn-theme-demos.html` | 4 stacked theme variants (Terminal/CLI · Cyberpunk · Brutalist · Engineer polish). User picked D + asked for a hybrid. |
| D+A hybrid preview | `/tmp/datalearn-theme-hybrid.html` | Three-surface preview showing the "D base + A flavor on code-adjacent surfaces" mixing rule. |
| UI v2 spec | `docs/superpowers/specs/2026-05-23-ui-v2-design.md` | 825 lines. Token contract (44 vars), 41-route migration table, shadcn adoption (18 components), admin redesign included. |
| UI v2 plan | `docs/superpowers/plans/2026-05-23-ui-v2-implementation.md` | 1954 lines. 11 sequential tasks, bite-sized steps, full code blocks for new primitives + admin dashboard. |

## Decisions locked this session (don't relitigate)

### UI v2 theme
- **Hybrid: D (engineer-tool polish) base + A (terminal flavor) on code-adjacent surfaces only.** Workspace gets max A; marketing prose, forms, navigation stay clean D.
- **Dark becomes default** via `next-themes` `defaultTheme: "dark"`. Light retained as inverted toggle. Existing user prefs honored via localStorage.
- **`.dark` selector preserved** (not renamed). Tokens live in `:root` AND `.dark` (Tailwind variant trigger) AND `.light` (inverted toggle).

### UI v2 architecture
- **Container `2xl` variant added** (max-w-screen-2xl = 1536px). Dashboard pages widen to it; article reader narrows from `xl` to `md` for reading line length.
- **shadcn/ui adopted** with `base: "radix"`. Critical: `aliases.ui: "@/components/shadcn"` (NOT `@/components/ui`) to avoid macOS-vs-Linux case-collision with existing PascalCase primitives like `Button.tsx` vs shadcn's `button.tsx`.
- **18 shadcn components added in commit 1**: `dialog`, `tooltip`, `sonner`, `popover`, `command`, `dropdown-menu`, `tabs`, `separator`, `alert-dialog`, `sheet`, `form`, `field`, `switch`, `select`, `checkbox`, `radio-group`, `toggle-group`, `scroll-area`.
- **Existing hand-rolled primitives stay** in `components/ui/`. shadcn primitives sit alongside in `components/shadcn/`. Future v2.1+ may migrate; out of v2 scope.

### UI v2 scope (mid-spec expansion)
- **Admin redesign included in v2**, not deferred to v3. New `/admin` dashboard (metrics + recent activity + quick actions), all 12 admin list / new / edit surfaces migrated.
- **Net total: 41 routes migrated** (inventoried from `find app -name page.tsx`).
- **Estimated effort: ~2 weeks** of focused work (vs ~3 days for the v2-without-admin baseline). The user accepted the trade.

### UI v2 tokens
- **Compatibility invariant**: every existing CSS variable name preserved. UI v2 changes only values, not names.
- **One net-new token**: `--muted-foreground-dim` (decoration-only; below AA, banned from content text).
- **Seven shadcn alias tokens**: `--card`, `--card-foreground`, `--popover`, `--popover-foreground`, `--secondary`, `--secondary-foreground`, `--input` — each aliased to an existing surface / border via `var(--…)`.
- **Six shadow tokens** (`--shadow-xs/sm/md/lg/xl/primary`) re-toned for the new dark default.
- **WCAG AA verified** for every text-on-surface pair via the contrast matrix in the spec; light-mode HSL values tuned darker after pass 2 caught 3.71:1 / 3.33:1 / 3.60:1 fails.

### UI v2 CI guards
- **`scripts/check-no-palette-colors.sh`** denies the full Tailwind palette × all color-utility prefixes × all shades, plus absolute `white`/`black`. Wired into `.github/workflows/test.yml`.
- **`scripts/check-shadcn-token-definitions.sh`** verifies every `var(--X)` reference in components has a matching `^\s*--X\s*:` declaration in `globals.css`. Required after every shadcn `add`.

## What Codex caught across 7 review passes (16 findings)

For posterity — these are the failure modes the spec mitigates. Don't relax them.

| Pass | # | Severity | Finding |
|---|---|---|---|
| 1 | 1 | high | Token contract invented names the live app doesn't use |
| 1 | 2 | medium | Admin out of scope but global token flip hits admin |
| 2 | 3 | high | WCAG AA contrast failures (4 tokens; 11px label territory needs 4.5:1) |
| 2 | 4 | medium | CI lint guard claimed to "catch palette regressions" but doesn't exist |
| 3 | 5 | high | Tailwind `dark:` variants would silently no-op under dark-default rollout |
| 3 | 6 | medium | `--accent-foreground` on `--accent` measured 2.23:1 |
| 3 | 7 | medium | Palette denylist too narrow; would miss `bg-white`/`text-red-500` |
| 4 | 8 | high | Three places in spec contradicted the `.dark`-preserved class-on-html contract |
| 4 | 9 | medium | Light-mode `--warning` pair measured 3.09:1 |
| 5 | 10 | high | shadcn primitives need `--card`/`--popover`/`--secondary`/`--input` tokens our globals.css doesn't define |
| 6 | 11 | high | Migration table missed real routes (`/admin/api-keys`, `/admin/contributors`, `/admin/daily`, `/admin/reports`, `/admin/tags`, `/admin/topics`, `/me/*`, `/practice/tags`) and listed nonexistent ones (`/admin/users`, `/admin/articles/[slug]/review`) |
| 6 | 12 | medium | NewsFeed had 5 palette violations not 2 |
| 6 | 13 | medium | Shadow tokens omitted from compatibility invariant |
| 7 | 14 | high | shadcn lowercase filenames vs existing PascalCase primitives = macOS-vs-Linux build trap |
| 7 | 15 | medium | Form re-templating referenced Field/FieldGroup/Switch but those weren't in the install list |
| 7 | 16 | medium | Token completeness check used substring grep; would pass undefined tokens |

Every finding led to a concrete spec edit + a Risks-table row. Don't accidentally undo any of these.

## Open follow-ups (priority order)

1. **Push `docs/ui-v2-spec` and open the docs PR.** 14 local commits. The branch is doc-only (no code changes). Either land it as a docs PR for stakeholder review first, OR proceed directly to executing the plan and let the spec land alongside implementation. I'd lean: push as a docs PR first so the stakeholder can react to the scope-expansion (admin redesign in v2) before week-long implementation kicks off.

2. **Decide UI v2 execution mode.** Two options:
   - **Subagent-driven** (recommended) — fresh subagent per task, two-stage review, fast iteration. Best fit because 11 tasks, each substantial; admin dashboard work in Task 8 is net-new code.
   - **Inline** — `superpowers:executing-plans` with checkpoints. Cheaper but risk of context drift across 11 tasks.

3. **Production seed for curriculum v1** (carryover from prior handoff). `/learn` on prod still alphabetical. Run:
   ```bash
   vercel env pull .env.production.local
   DOTENV_CONFIG_PATH=.env.production.local npm run seed:curriculum-topics
   DOTENV_CONFIG_PATH=.env.production.local npm run seed:curriculum-tags
   ```

4. **Anonymous gating implementation can start now.** Spec + plan merged to main in PR #130. Plan Task 1 (HMAC helpers + unit tests) is the natural kickoff.

5. **Carryovers from older handoffs (all still open):**
   - PR #117 lucide-react major upgrade.
   - MCP-server typecheck still not in CI.
   - MCP e2e smoke for article tools.
   - Drop legacy `solutionSql` / `expectedOutput` columns.
   - Admin abuse-delete `hasVisualBlocks` recompute.
   - De-hardcode seed admin email in `prisma/seed-visual-lesson.ts`.
   - `npm run lint` ESLint plugin error.
   - Stashed `.env*.local` gitignore change.
   - v0.6 mermaid → static SVG pre-rendering project (so we can drop `'unsafe-eval'`).

## Footguns to avoid during UI v2 implementation

| Footgun | Why it matters |
|---|---|
| **Running `shadcn init` without `--no-overwrite`** | Would wipe `app/globals.css` and erase the UI v2 token work. The plan's Task 1.14 explicitly uses `--no-overwrite`. |
| **Letting shadcn default to `@/components/ui` as the components alias** | macOS dev would silently overwrite the existing PascalCase `Button.tsx`/`Card.tsx`/`Input.tsx`. Linux CI would then see two distinct files with the same lowercase resolution and break unpredictably. The plan's Task 1.14 mandates `@/components/shadcn` and verifies it post-init. |
| **Removing the `.dark` selector when adding the `:root` dark tokens** | Six existing files use `dark:prose-invert` and similar variants. Without the `.dark` class on `<html>`, those silently no-op. Article prose renders light typography on dark surfaces. |
| **Using `--muted-foreground-dim` for content text** | Below WCAG AA (2.6:1 on white, 2.9:1 on dark surface-muted). Decoration only — bracket characters, dot separators. Spec spells this out in the "Decoration-only contract" subsection. |
| **Skipping the `scripts/check-shadcn-token-definitions.sh` step after each shadcn `add`** | A shadcn component pulling in `--sidebar-foreground` (not in our token set) would silently render with the variable undefined → blank background. The check exits 1 on any missing declaration. |
| **Renaming any existing CSS variable** | Compatibility invariant says no renames, only value changes. Hundreds of components use `bg-background`, `bg-surface-muted`, `hover:bg-primary-hover`, `text-destructive`, `bg-easy-bg`, `text-easy-fg`, `border-border`, `border-border-strong`, `shadow-sm`, `shadow-lg`, `shadow-primary/5` etc. Renaming any one breaks a class of components silently. |
| **Forgetting to fix all 5 NewsFeed.tsx violations before wiring the CI guard** | CI guard would fail on the same PR it lands. Task 2 of the plan explicitly fixes all five before Task 3 enables the guard. |
| **Assuming the article approval flow is a separate `/admin/articles/[slug]/review` route** | It's inside the edit page. Codex pass 6 caught this. The plan's Task 10 puts the approval flow's `AlertDialog` inside the edit page. |
| **Implementing the dashboard metrics queries naively** | `actions/admin-dashboard.ts` (Task 8.1) uses Prisma `count()` and aggregate queries with `Promise.all` for parallelism. Don't fan out 6 sequential queries; use the parallel pattern in the plan. |
| **Skipping the visual regression sweep in Task 11.3** | The 41-route inventory + 2-mode requirement is the only catch for an admin form that breaks under a dark-toggle. Skipping it ships broken admin UX. |

## To resume execution

```bash
# 1. Confirm state
git status
git branch --show-current  # docs/ui-v2-spec
git log --oneline -3

# 2. Decide PR strategy
# Option A — push docs PR first:
git push -u origin docs/ui-v2-spec
gh pr create --base main --title "docs: UI v2 spec + implementation plan" --body "..."

# Option B — go straight to implementation:
# Read docs/superpowers/plans/2026-05-23-ui-v2-implementation.md
# Invoke superpowers:subagent-driven-development with the plan
# Task 1.1 cuts a fresh feat/ui-v2 branch off main

# 3. Anon-gating implementation can start in parallel on a separate branch:
git checkout main
git pull origin main
git checkout -b feat/anonymous-access-gating
# Read docs/superpowers/plans/2026-05-23-anonymous-access-gating-implementation.md
# Start at Task 1: HMAC helpers + unit tests

# 4. Production curriculum seeds (independent of all the above):
vercel env pull .env.production.local
DOTENV_CONFIG_PATH=.env.production.local npm run seed:curriculum-topics
DOTENV_CONFIG_PATH=.env.production.local npm run seed:curriculum-tags
```

## How to ask the user

Same as prior handoffs. Terse, decisive. Single-character / single-digit replies common; they pick by option number when offered A/B/C/D choices. They'll redirect immediately if a call is wrong.

This session pulled scope in twice (theme refresh → mid-stream shadcn adoption → mid-stream admin redesign). Each expansion was decisive and accepted. The pattern: user proposes a direction with a few words; assistant builds a tight option list; user picks; assistant integrates and runs another Codex review. Eight Codex passes total (1 on anon-gating, 7 on UI v2). User invests heavily in adversarial review; never accepts a spec without at least one pass.

## Reference docs

- **UI v2 spec:** `docs/superpowers/specs/2026-05-23-ui-v2-design.md` (825 lines, local-only)
- **UI v2 plan:** `docs/superpowers/plans/2026-05-23-ui-v2-implementation.md` (1954 lines, local-only)
- **Anon-gating spec:** `docs/superpowers/specs/2026-05-23-anonymous-access-gating-design.md` (merged via PR #130, on main)
- **Anon-gating plan:** `docs/superpowers/plans/2026-05-23-anonymous-access-gating-implementation.md` (merged via PR #130, on main)
- **Curriculum spec:** `docs/superpowers/specs/2026-05-22-learn-curriculum-design.md` (on main)
- **Curriculum infra plan:** `docs/superpowers/plans/2026-05-22-learn-curriculum-infrastructure.md` (mostly executed; Task 20 production seed still pending)
- **Prior session handoff:** `docs/superpowers/handoff/2026-05-23-anon-gating-spec-handoff.md`
- **Existing design system to extend in UI v2:** `docs/design-system/README.md`
- **Tokens to edit:** `app/globals.css`
- **Theme provider to flip default on:** `components/layout/ThemeProvider.tsx`
- **Existing hand-rolled primitives that MUST NOT be touched:** `components/ui/{Button,Card,Badge,Input,Container,EmptyState,Skeleton,TagPill,ThemeToggle,Logo}.tsx`
- **Pre-existing palette-violation target:** `components/NewsFeed.tsx` (5 hits, all enumerated in Task 2.1)

Session in a clean stopping state — 14 commits locally on `docs/ui-v2-spec`, ready to push or pivot to execution.
