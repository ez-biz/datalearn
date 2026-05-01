# Data Learn — project guide for Claude

LeetCode-style SQL practice platform. Users write SQL in a Monaco editor, queries run in-browser via DuckDB-WASM, results are validated against expected output, and submissions are tracked per user.

## Stack

- **Next.js 16** (App Router) on Node, TypeScript strict
- **Prisma 7** with `prisma.config.ts` (env loaded via `dotenv/config`)
- **PostgreSQL** (local dev: `postgresql://anchitgupta@localhost:5432/datalearn`)
- **NextAuth v5 (beta)** with Prisma adapter; GitHub + Google providers
- **DuckDB-WASM** for in-browser query execution (`lib/duckdb.ts`, `lib/use-problem-db.ts`)
- **Tailwind v4** with `@plugin "@tailwindcss/typography"`; HSL CSS variable tokens in `app/globals.css`
- **next-themes** for dark/light toggle (light is default)
- **Monaco** editor (`@monaco-editor/react`)
- **Inter** + **JetBrains Mono** via `next/font`

## Project shape

- `app/` — App Router pages
- `actions/` — server actions (`"use server"` files)
- `components/ui/` — primitives (Button, Card, Badge, Input, Skeleton, Logo, ThemeToggle, Container, EmptyState)
- `components/layout/` — Navbar, Footer, ThemeProvider, MobileNav
- `components/practice/` — workspace pieces (ProblemClient, ProblemPanel, PracticeList, HistoryPanel)
- `components/sql/` — SQL UI (SqlPlayground, SqlEditor, ResultTable, ValidationResult)
- `lib/` — shared modules (`auth.ts`, `prisma.ts`, `sql-validator.ts`, `duckdb.ts`, `use-problem-db.ts`, `utils.ts`, `admin-validation.ts` — kept Prisma-free; imported by `mcp-server/`, `schema-parser.ts` — server-side parser that pre-computes table info from `SqlSchema.sql` so the problem page doesn't wait on DuckDB for the Schema/INPUT panels)
- `prisma/` — `schema.prisma`, migrations, `seed.ts`
- `mcp-server/` — standalone stdio MCP server (own `package.json`, tsup-bundled). Lets MCP-aware assistants author SQL problems via the `/api/admin/*` REST surface using a Bearer key. Imports `lib/admin-validation.ts` directly; the bundler inlines it.
- `scripts/mcp-e2e-test.mjs` — end-to-end harness that spawns the built MCP server with a freshly-seeded admin API key and exercises all 9 tools against the live API. Run with the dev server up.

## Conventions

- **No emoji icons** — use SVG (Lucide). The custom DL logo lives in `components/ui/Logo.tsx`.
- **Hand-rolled shadcn-style primitives** — keep them in `components/ui/`. No shadcn-cli, no Radix peer deps unless we add them deliberately.
- **Color tokens** — always reference semantic tokens (`bg-primary`, `text-muted-foreground`, `border-border`, `bg-easy`, etc.). Don't hardcode hex or `slate-*` / `blue-*` Tailwind palette names — they break dark mode.
- **Inter character variants enabled** via `font-feature-settings: "cv02", "cv03", "cv04", "cv11"` on body. Use `tabular-nums` utility for numeric columns.
- **Workspace state lives in `ProblemClient`** — the editor query, draft autosave (localStorage `dl:draft:<slug>`), DB connection (via `useProblemDB`), and submission history all flow through it. `SqlPlayground` is fully controlled.
- **Validation flow** — `validateSubmission` server action compares user rows against `SQLProblem.expectedOutput` (JSON) using `lib/sql-validator.ts`. It also writes a `Submission` row when the user is authed.

## Things to avoid

- **Don't `next build` without `--webpack`** — Turbopack hits an internal panic (`entered unreachable code` in `chunk_group.rs`) on this code shape in Next 16.1.1. `package.json` already pins `--webpack` for `build` and `vercel-build`. Revisit when fixed upstream.
- **Don't initialize DuckDB-WASM twice on a page.** Use the shared `useProblemDB` hook; pass `runQuery` / `dbReady` / `dbError` down. Two inits = two WASM downloads + two engines.
- **Don't store decimal types in seed schemas as `DECIMAL`** — DuckDB-WASM's Arrow→JSON conversion returns raw integer mantissas. Use `DOUBLE` for currency in seeds.
- **Don't filter Prisma queries with `select` and forget new fields.** When adding a column to `SQLProblem` or similar, audit `actions/problems.ts` etc.
- **`session.user.id` and `session.user.role`** are available; the augmentation lives in `types/next-auth.d.ts` and the values are populated in `lib/auth.ts` `session` callback. Don't cast around them.
- **Don't seed the local DB with the wrong Postgres user.** Local trust auth uses `anchitgupta`, not `postgres`.
- **Don't add Prisma or Next/server imports to `lib/admin-validation.ts`.** The MCP server bundles this file via tsup; pulling in Prisma would balloon the bundle and break the stdio runtime. Comment at the top of the file states this contract.
- **Don't bypass the MCP `create_problem` DRAFT guard.** The tool input schema deliberately omits `status`; the handler hardcodes `status: "DRAFT"` after spreading user input. If you add a new write tool, follow the same omit-then-inject pattern for any field that must be controlled by humans.
- **Don't add INSERT shapes the schema parser doesn't recognize without falling back gracefully.** `lib/schema-parser.ts` handles only single-row `INSERT INTO foo VALUES (...)` because that's the seed format we emit. If you add multi-row INSERTs or computed defaults to `SqlSchema.sql`, the parser returns `null` and the page transparently falls back to DuckDB introspection — but you'll regress the first-paint UX win. Either keep the seed shape consistent or extend the parser + tests in `scripts/test-schema-parser.ts`.

## Running locally

```bash
npm install                    # also runs prisma generate
npx prisma migrate dev         # apply schema changes
npm run dev                    # next dev (Turbopack — fine for dev)
npm run build                  # next build --webpack (do not drop --webpack)
```

After modifying `prisma/schema.prisma`, restart the dev server — the running process holds the old generated client.

## Subagent routing policy

To keep token cost down, delegate to the right tier instead of handling everything in the main session:

- **`file-explorer` (haiku)** — use for any read-only investigation that takes more than 1–2 tool calls: "where does X live", "what files import Y", "how is Z wired", broad codebase tours. Don't run those searches inline in the main session.
- **`code-reviewer` (sonnet)** — use after finishing a non-trivial feature or before opening a PR. It reviews diffs, flags bugs and missing edge cases. Don't run on tiny one-line fixes.
- **Main session (Opus/Sonnet)** — keep for synthesis, design, multi-file edits, and anything requiring the full conversation context.

Rules of thumb:
- If a task is "find / read / report", that's `file-explorer`.
- If you're about to grep for the same string twice in two messages, you should have delegated.
- For known paths (e.g. "read `app/layout.tsx`"), skip the agent and use `Read` directly.

## Commit / PR style

- Conventional-ish prefixes (`feat:`, `fix:`, `feat(ui):`, `chore:`).
- PR descriptions list **Verified** (what you actually checked) and **Not yet verified** (what the reviewer should click through). Don't claim things you didn't run.
- Don't add `--no-verify` or skip hooks. Don't push directly to `main` — open a PR.
