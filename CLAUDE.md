# Data Learn — project guide for Claude

LeetCode-style SQL practice platform. Users write SQL in a Monaco editor; queries run in-browser via DuckDB-WASM **or** PGlite (real Postgres compiled to WASM, learner-toggleable per problem). Results are validated against expected output, and submissions are tracked per user.

**Live**: <https://www.learndatanow.com> (also <https://datalearn-iota.vercel.app>) — Vercel + Neon. **`main` is integration; `production` is what's live and is the GitHub default branch.** Pushes to `main` (and any branch) deploy to a Preview URL only. Production deploys when a `main → production` PR merges (titled `release: vX.Y.Z`). **Feature PRs MUST pass `--base main` to `gh pr create`** — otherwise they target the default `production` branch and a forgotten flag deploys unfinished work to live. `prisma migrate deploy` runs on every Vercel build. Health endpoint: `/api/health`. Full runbook in [`docs/DEPLOY.md`](./docs/DEPLOY.md); release runbook in [`.github/CONTRIBUTING.md`](./.github/CONTRIBUTING.md#releases).

## Stack

- **Next.js 16** (App Router) on Node, TypeScript strict
- **Prisma 7** with `prisma.config.ts` (env loaded via `dotenv/config`)
- **PostgreSQL** (local dev: `postgresql://anchitgupta@localhost:5432/datalearn`)
- **NextAuth v5 (beta)** with Prisma adapter; GitHub + Google providers
- **DuckDB-WASM** for in-browser query execution (`lib/duckdb.ts`, `lib/use-problem-db.ts`)
- **Tailwind v4** with `@plugin "@tailwindcss/typography"`; HSL CSS variable tokens in `app/globals.css` — the graphite Console token system (`--canvas`, `--panel`, `--line`, `--text`, `--primary`, etc.), with every pre-existing token (`--background`, `--surface`, `--border`, `--muted-foreground`, `--easy`, etc.) now aliased onto it
- **next-themes** for dark/light toggle (dark is default)
- **Monaco** editor (`@monaco-editor/react`)
- **Inter** + **JetBrains Mono** via `next/font`

## Project shape

- `app/` — App Router pages
- `actions/` — server actions (`"use server"` files), e.g. `curriculum.ts` — session-resolving curriculum reads (`getTrackCurriculum`) and writes (`recordLessonProgress`)
- `components/ui/` — primitives (Button, Card, Badge, Input, Skeleton, Logo, Container, EmptyState)
- `components/layout/` — Footer, ThemeProvider, UserMenu (avatar dropdown); `console/` — the left sidebar/rail console shell (`ConsoleShell` server component, `ConsoleChrome` client wrapper, `ConsoleSidebar`, `ConsoleRail`, `MobileTabBar`, `MobileSignInMenu`, `nav-model.ts`, `focus-route.ts` — the pure predicate that decides which routes opt out of the shell, `sidebar-cookie.ts`, `useSidebarCollapse.ts`, `MainScrollRestoration.tsx`)
- `components/learn/reader/` — the lesson reader rendered by `/learn/tracks/[slug]/[lessonSlug]`, the app's only focus route (`LessonHeader` carrying the `banner` landmark, `ReaderProgressProvider` owning the scroll listener + the percent + the writes, presentational `ReadingProgressBar`, `CurriculumRail`, `LessonBody` — shared with the topic article route so both stay typographically identical, `LessonAsideRail`, `ContentsSheet` for mobile, `CheckpointBlock`, `LessonPrevNext`, `LessonSignInNudge`, `lesson-nav.ts` — pure curriculum flattening and prev/next resolution)
- `components/practice/` — workspace pieces (ProblemClient, ProblemPanel, PracticeList, HistoryPanel)
- `components/sql/` — SQL UI (SqlPlayground, SqlEditor, ResultTable, ValidationResult)
- `components/lists/` — custom problem lists (CreateListButton popover, ListDetail with rename/delete/reorder/sort, AddToListButton workspace popover, AddProblemsPicker search-and-add). All client components consuming `actions/lists.ts`.
- `lib/` — shared modules (`auth.ts`, `prisma.ts`, `sql-validator.ts`, `duckdb.ts`, `use-problem-db.ts`, `utils.ts`, `admin-validation.ts` — kept Prisma-free; imported by `mcp-server/`, `schema-parser.ts` — server-side parser that pre-computes table info from `SqlSchema.sql` so the problem page doesn't wait on DuckDB for the Schema/INPUT panels, `curriculum-progress.ts` — pure, Prisma-free rollup/unlock math (`rollUpModule`, `rollUpTrack`, `isModuleUnlocked`, `clampProgressPercent`), `curriculum-write.ts` — userId-parameterised `LessonProgress` writer, deliberately NOT a server action, `admin-curriculum.ts` — Module/ModuleLesson/LessonCheckpoint CRUD shared by the admin API routes, MCP tools, and seed scripts)
- `prisma/` — `schema.prisma`, migrations, `seed.ts`, `seed-analyst-track.ts` — idempotent seed for the 17-lesson "Analyst Interview Prep" track
- `mcp-server/` — standalone stdio MCP server (own `package.json`, tsup-bundled). Lets MCP-aware assistants author SQL problems via the `/api/admin/*` REST surface using a Bearer key. Imports `lib/admin-validation.ts` directly; the bundler inlines it.
- `scripts/mcp-e2e-test.mjs` — end-to-end harness that spawns the built MCP server with a freshly-seeded admin API key and exercises the tool surface against the live API (40 tools as of v0.8.0). Run with the dev server up.

## Conventions

- **No emoji icons** — use SVG (Lucide). The custom DL logo lives in `components/ui/Logo.tsx`.
- **Hand-rolled shadcn-style primitives** — keep them in `components/ui/`. No shadcn-cli, no Radix peer deps unless we add them deliberately.
- **Color tokens** — always reference semantic tokens (`bg-primary`, `text-muted-foreground`, `border-border`, `bg-easy`, etc.). Don't hardcode hex or `slate-*` / `blue-*` Tailwind palette names — they break dark mode.
- **Inter character variants enabled** via `font-feature-settings: "cv02", "cv03", "cv04", "cv11"` on body. Use `tabular-nums` utility for numeric columns.
- **Workspace state lives in `ProblemClient`** — the editor query, draft autosave (localStorage `dl:draft:<slug>`), DB connection (via `useProblemDB`), and submission history all flow through it. `SqlPlayground` is fully controlled.
- **Validation flow** — `validateSubmission(slug, userResult, dialect)` server action compares user rows against `SQLProblem.expectedOutputs[<dialect>]` (JSON), falling back to the legacy `expectedOutput` field when missing (transition window through the cleanup release). Comparator is `lib/sql-validator.ts`. Also writes a `Submission` row when the user is authed.
- **Per-dialect canonical solutions** (v0.4.2+) — `SQLProblem.solutions: Json` and `SQLProblem.expectedOutputs: Json` are maps keyed by `Dialect`. Every entry of `dialects[]` should have a corresponding key in both maps. `solutionSql` and `expectedOutput` (singular) remain as legacy fallback fields and will be dropped in the cleanup release. Audit current data with `npm run audit:dialects`.
- **Stable problem numbers** — `SQLProblem.number Int @unique` is minted at create-time as `MAX(number)+1` inside the same transaction that creates the row; never recycled. When adding new code that surfaces problems, include `number` in the projection and prefix the title with `<n>. Title` to match LeetCode parlance.
- **Custom lists are private and v1-deduped at the DB level** — `ProblemListItem` has composite PK `(listId, problemId)`. `addToList` is idempotent and catches `P2002` as silent success. Caps: 100 lists/user, 1000 items/list, enforced at write-time.

## Things to avoid

- **Don't `next build` without `--webpack`** — Turbopack hits an internal panic (`entered unreachable code` in `chunk_group.rs`) on this code shape in Next 16.1.1. `package.json` already pins `--webpack` for `build` and `vercel-build`. Revisit when fixed upstream.
- **Don't initialize DuckDB-WASM twice on a page.** Use the shared `useProblemDB` hook; pass `runQuery` / `dbReady` / `dbError` down. Two inits = two WASM downloads + two engines.
- **Don't store decimal types in seed schemas as `DECIMAL`** — DuckDB-WASM's Arrow→JSON conversion returns raw integer mantissas. Use `DOUBLE` for currency in seeds.
- **Don't filter Prisma queries with `select` and forget new fields.** When adding a column to `SQLProblem` or similar, audit `actions/problems.ts`, `actions/profile.ts`, `actions/submissions.ts`, `actions/lists.ts`, and any admin route's `select` projections.
- **Don't try to mutate `SQLProblem.number`.** It's set once at create-time and is the public stable ID. The admin API rejects `number` in `PATCH` bodies and `POST` does not accept it. Same rule for `ProblemListItem.position` outside the `reorderList` transaction.
- **`session.user.id` and `session.user.role`** are available; the augmentation lives in `types/next-auth.d.ts` and the values are populated in `lib/auth.ts` `session` callback. Don't cast around them.
- **Don't seed the local DB with the wrong Postgres user.** Local trust auth uses `anchitgupta`, not `postgres`.
- **Don't add Prisma or Next/server imports to `lib/admin-validation.ts`.** The MCP server bundles this file via tsup; pulling in Prisma would balloon the bundle and break the stdio runtime. Comment at the top of the file states this contract.
- **Don't bypass the MCP `create_problem` DRAFT guard.** The tool input schema deliberately omits `status`; the handler hardcodes `status: "DRAFT"` after spreading user input. If you add a new write tool, follow the same omit-then-inject pattern for any field that must be controlled by humans.
- **Don't add INSERT shapes the schema parser doesn't recognize without falling back gracefully.** `lib/schema-parser.ts` handles single-row and multi-row `INSERT INTO foo VALUES (...)`. If you add computed defaults, subqueries, or other unfamiliar DDL forms, the parser returns `null` and the page transparently falls back to DuckDB introspection — but you'll regress the first-paint UX win. Extend the parser + tests in `scripts/test-schema-parser.ts` rather than ship a fallback regression.
- **Never write `Module.position`, `ModuleLesson.position`, or `LessonCheckpoint.position` outside their reorder transactions** (`reorderModules` / `reorderModuleLessons` / `reorderCheckpoints` in `lib/admin-curriculum.ts`). Same rule as `ProblemListItem.position` above — positions move only through the dedicated reorder path so a partial write can never leave gaps or duplicates.
- **Never enforce module unlocking.** `isModuleUnlocked` (`lib/curriculum-progress.ts`) is advisory only — it drives the "Locked until module 02" UI copy and nothing else. It must never gate a route, reject a server action, or block a checkpoint submission; skipping ahead is always allowed by design.
- **Never export a `userId`-parameterised writer from a `"use server"` file.** Every export of a `"use server"` module becomes a client-callable RPC endpoint, so a function that takes `userId` as a caller-supplied argument (rather than reading it from the session) would let any client write data as any other user. `lib/curriculum-write.ts` deliberately has no `"use server"` directive for this reason — `actions/curriculum.ts` resolves the session and delegates to it. Follow the same split for any future writer that needs an explicit `userId`.
- **`npm run dev` binds to `.env.local`, not `.env`.** Unlike test scripts, the dev server does not default to local Postgres — prefix an explicit `DATABASE_URL='postgresql://anchitgupta@localhost:5432/datalearn'` when you need it against local data, or you'll be silently working against whatever `.env.local` points at.
- **Under `@prisma/adapter-pg`, a P2002 error's `meta.target` is always `undefined`.** The offending column names instead live at `meta.driverAdapterError.cause.constraint.fields`, and they arrive partly quoted (e.g. `["\"trackId\"", "slug"]`). Strip quotes before comparing. See `isUniqueViolationOn` in `lib/admin-curriculum.ts` for the pattern that checks both this shape and the query-engine-binary `meta.target` shape.
- **Don't add a token to `:root` without adding it to `.light`.** Both themes ship and light is not an inversion — a missing light value fails silently and only for users on that theme. `npm run check:token-parity` enforces this.
- **Don't render page content outside `<main>` on non-focus routes.** `ConsoleChrome` owns `#app-scroll`, `<main id="main-content">` and `<Footer>`. Focus routes (`isFocusRoute`, today only the lesson reader) opt out and must supply their own `<header>` + `<main id="main-content">` pair — ARIA forbids `banner` inside `main`, which is why the header cannot simply live in the page body of a normal route.

## Running locally

```bash
npm install                    # also runs prisma generate
npx prisma migrate dev         # apply schema changes
npm run dev                    # next dev (Turbopack — fine for dev)
npm run build                  # next build --webpack (do not drop --webpack)
```

After modifying `prisma/schema.prisma`, restart the dev server — the running process holds the old generated client.

The UI guards below are the ones to run after any shell, nav or reader change. All four unit suites are pure — no database, no DOM.

```bash
npm run test:console-nav          # nav model + the isFocusRoute predicate
npm run test:lesson-nav           # curriculum flattening, prev/next, breadcrumbs
npm run test:reading-progress     # scroll-percent maths + persistence boundaries
npm run test:scroll-restoration   # #app-scroll restore-on-pop rules
npm run check:token-parity        # every :root token also defined in .light
npm run test:e2e -- lesson-reader # reader landmarks, draft gate, live progress
```

## Subagent routing policy

To keep token cost down, delegate to the right tier instead of handling everything in the main session:

- **`file-explorer` (haiku)** — use for any read-only investigation that takes more than 1–2 tool calls: "where does X live", "what files import Y", "how is Z wired", broad codebase tours. Don't run those searches inline in the main session.
- **`code-reviewer` (sonnet)** — use after finishing a non-trivial feature or before opening a PR. It reviews diffs, flags bugs and missing edge cases. Don't run on tiny one-line fixes.
- **Main session (Opus/Sonnet)** — keep for synthesis, design, multi-file edits, and anything requiring the full conversation context.

Rules of thumb:
- If a task is "find / read / report", that's `file-explorer`.
- If you're about to grep for the same string twice in two messages, you should have delegated.
- For known paths (e.g. "read `app/layout.tsx`"), skip the agent and use `Read` directly.

## Where to find things

- [`docs/TECHNICAL_DESIGN.md`](./docs/TECHNICAL_DESIGN.md) — current architecture: subsystems (auth, SQL engine, Learn CMS, MCP server, profile), data flow, security posture, env, technical debt. Read this first when joining the project or planning anything cross-cutting.
- [`docs/ROADMAP.md`](./docs/ROADMAP.md) — shipped work + planned. Updated when something ships.
- [`docs/API.md`](./docs/API.md) — `/api/admin/*` REST reference with curl examples.
- [`docs/DEPLOY.md`](./docs/DEPLOY.md) — first-time Vercel + Neon setup runbook, env-var matrix, migration + seed flow, admin bootstrap, health check, day-to-day workflow.
- [`docs/design-system/`](./docs/design-system/) — exported handoff bundle from Claude Design (claude.ai/design). `README.md` is the brand voice + visual foundations spec (palette, typography, spacing, component recipes, copy rules). `colors_and_type.css` mirrors the live `app/globals.css` token contract. `ui_kits/web/` has hi-fi React/JSX recreations of every screen (Home, Practice, SignIn, Profile, Admin, Learn, ArticleReader, TopicDetail) — read these before making cross-cutting UI changes so new work matches the design language.
- [`docs/ADMIN.md`](./docs/ADMIN.md) — admin-portal walkthrough.
- [`mcp-server/README.md`](./mcp-server/README.md) — MCP install, Claude Desktop config, per-tool data formats. Source-of-truth for the AI-authoring contract.
- [`docs/superpowers/specs/`](./docs/superpowers/specs/) and [`docs/superpowers/plans/`](./docs/superpowers/plans/) — design specs and implementation plans for major features (e.g. MCP server v1).
- GitHub Wiki — friendlier onboarding docs for contributors / admins.

## Commit / PR style

Source of truth: [`.github/CONTRIBUTING.md`](./.github/CONTRIBUTING.md). Highlights for fast lookup:

- Branches: `<type>/<short-description>` where `type` is `feat / fix / sec / perf / refactor / docs / test / chore / ci / build`.
- Commit messages: conventional-ish (`feat:`, `fix:`, `feat(ui):`, `chore:`, `docs:`). For squash merges, branch commits can be messy (they get erased); for merge / rebase, every branch commit lands on `main` so write each one cleanly.
- PR titles become the commit message on `main` for squash merges, and also feed `gh release create --generate-notes` — keep them clean and conventional.
- PR descriptions follow the template at `.github/PULL_REQUEST_TEMPLATE.md`: Summary / Verified / Not yet verified, plus screenshots for UI changes.
- Hard rules: no direct push to `main`, no `--no-verify`, no force-push to `main`. One PR = one logical change.
- Merge modes: **all three enabled** — Squash & merge (default for most), Merge commit (preserve a multi-commit story), Rebase & merge (clean linear replay). Branches auto-delete on merge.
