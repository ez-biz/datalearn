# Data Learn

Practice SQL the way LeetCode does code. Real problems. Real schemas. A real database in your browser.

> **Live**: <https://datalearn-iota.vercel.app>
> Repo: <https://github.com/ez-biz/datalearn>

> ![Built with Next.js 16](https://img.shields.io/badge/Next.js-16-black) ![DuckDB-WASM](https://img.shields.io/badge/SQL-DuckDB--WASM-yellow) ![Postgres-WASM](https://img.shields.io/badge/SQL-PGlite-336791) ![Prisma 7](https://img.shields.io/badge/ORM-Prisma_7-blue) ![Status](https://img.shields.io/badge/status-beta-orange)

---

## Features

- **In-browser SQL execution** — DuckDB-WASM **and** PGlite (real Postgres compiled to WASM) both run client-side. Per-problem dialect array; learners pick which engine to solve in via a toggle in the editor header.
- **Instant validation** — submit a query and get an immediate accept / wrong-answer verdict, with row-level diffs on failure.
- **Curated problem library** — across e-commerce, HR, and SaaS schemas; Easy / Medium / Hard.
- **LeetCode-style workspace** — two-pane layout: tabbed Description / Hints / History on the left, Monaco editor + tabbed Results / Verdict on the right. Stable problem numbers (`#247.` LeetCode-style) on every surface.
- **Custom problem lists** — private user-curated collections at `/me/lists` with rename, delete, drag-and-drop reorder, sort options (recently added / recently solved / unsolved first / number), and a one-click bookmark popover on the workspace.
- **Daily problem** — a featured problem rotating daily on the home page; streak-friendly habit hook.
- **Per-user progress** — solved checkmarks on the problem list, "Solved" badge on the workspace, submission history with code recall, profile stats with by-difficulty breakdown.
- **Workspace polish** — `⌘↵` run, `⌘⇧↵` submit, draft autosave to localStorage, run timer, NULL-styled cells, tabular numerics.
- **Admin content portal** — `/admin/*` UI to author problems end-to-end. Type the solution, hit "Run & capture", and we run it against the schema in your browser and store the JSON. No more hand-writing expected output.
- **REST API for automation** — every admin operation is an HTTP endpoint under `/api/admin/*`, accepting either a session cookie or a bearer API key.
- **MCP server for AI authoring** — a stdio [Model Context Protocol](https://modelcontextprotocol.io) server in [`mcp-server/`](./mcp-server/) lets Claude Desktop / Cursor / any MCP-aware assistant author SQL problems through tool calls. Forced DRAFT on writes; full admin scope on reads. See [`mcp-server/README.md`](./mcp-server/README.md).
- **Dark mode** — full token-based theming, light is default, manual toggle in the nav.

## Stack

- **Next.js 16** (App Router, Turbopack for dev, **webpack for build** — see caveat)
- **TypeScript** strict
- **Prisma 7** with `prisma.config.ts`, **PostgreSQL**
- **NextAuth v5** (beta) — GitHub + Google providers
- **DuckDB-WASM** for in-browser query execution
- **Monaco** for the editor
- **Tailwind v4** with `@plugin "@tailwindcss/typography"`; HSL CSS-variable token system
- **next-themes** for dark/light
- **Inter** + **JetBrains Mono** via `next/font`
- Hand-rolled, shadcn-style primitives (no shadcn-cli)

## Local development

```bash
# 1. Clone, install, generate Prisma client
git clone https://github.com/ez-biz/datalearn.git
cd datalearn
npm install                  # also runs `prisma generate`

# 2. Set up local Postgres and copy .env.example -> .env
createdb datalearn           # or use Postgres.app / Docker
cp .env.example .env         # then fill in DATABASE_URL, AUTH_*, etc.

# 3. Apply migrations + seed the demo content
npx prisma migrate dev
npx tsx prisma/seed.ts       # seeds 23 problems, 3 schemas, 1 topic with 3 articles

# 4. Run
npm run dev                  # http://localhost:3000
```

After modifying `prisma/schema.prisma`, restart the dev server — the running process holds the old generated client.

### Becoming an admin

Sign in once via GitHub or Google to create your `User` row, then promote yourself with the bootstrap script (idempotent — safe to re-run):

```bash
node scripts/bootstrap-admin.mjs you@example.com
```

Then visit `/admin/problems` to author content. See [`docs/ADMIN.md`](./docs/ADMIN.md).

### Build

```bash
npm run build                # next build --webpack
npm run start
```

> **Build caveat:** `package.json` pins `--webpack` for both `build` and `vercel-build`. Turbopack hits an internal panic (`entered unreachable code` in `chunk_group.rs`) on this code shape in Next 16.1.1. Webpack build is clean. Will revisit when Turbopack ships a fix.

## Deploying

**Currently deployed to Vercel + Neon at <https://datalearn-iota.vercel.app>.**

Full first-time runbook (Neon project setup, OAuth callbacks per-environment, Vercel env-var matrix, seed flow, admin bootstrap, day-to-day workflow, schema-change patterns) is in [`docs/DEPLOY.md`](./docs/DEPLOY.md).

Quick reference of what runs on every deploy:

```
npm install (postinstall: prisma generate)
  → prisma migrate deploy   (against DIRECT_URL)
  → next build --webpack    (the production bundle)
```

Every push to `main` auto-deploys to production. Every push to a non-`main` branch gets its own per-PR preview URL.

### Note on first load

DuckDB-WASM downloads a ~30 MB WASM binary on first visit. PGlite (Postgres) lazy-loads ~3 MB only when a learner toggles to the Postgres engine. Both are cached by the browser after the first load.

## Project layout

```
app/
  api/admin/             REST endpoints (auth via session OR bearer key)
  admin/                 Admin UI — gated layout, problems CRUD, schemas, tags, API keys
  practice/              /practice list + /practice/[slug] workspace
  learn/                 Topic + article pages
  ...                    profile, dynamic [slug], 404, error
actions/                 Server actions (validateSubmission, getProblems, ...)
components/
  ui/                    Hand-rolled primitives (Button, Card, Badge, Input, ...)
  layout/                Navbar, Footer, ThemeProvider, MobileNav
  practice/              ProblemClient, ProblemPanel, PracticeList, HistoryPanel
  sql/                   SqlPlayground, SqlEditor, ResultTable, ValidationResult
  admin/                 AdminNav, ProblemForm, HintsEditor, TagPicker, ApiKeysClient
lib/
  prisma.ts              Prisma client singleton
  auth.ts                NextAuth setup (GitHub + Google + Prisma adapter)
  api-auth.ts            requireAdmin() — session OR bearer; withAdmin() route wrapper
  admin-validation.ts    Zod schemas for /api/admin/* payloads
  duckdb.ts              DuckDB-WASM bootstrap
  use-problem-db.ts      Shared DB hook (one connection per problem page)
  sql-validator.ts       Pure validator with epsilon + ordered/unordered modes
  utils.ts               cn()
prisma/
  schema.prisma          Models: User / Submission / SQLProblem / SqlSchema /
                         Tag / ApiKey / Topic / Article / Page / Account / Session
  migrations/
  seed.ts                Demo content
mcp-server/              Standalone stdio MCP server for AI-driven problem authoring
  src/                   index.ts (entry), client.ts, errors.ts, tools/
  tests/                 vitest unit tests (40 tests)
  README.md              Install + Claude Desktop config + authoring guide
```

## Documentation

- [`docs/TECHNICAL_DESIGN.md`](./docs/TECHNICAL_DESIGN.md) — **architecture reference** (subsystems, data flow, security model, schema, env, future considerations)
- [`docs/ROADMAP.md`](./docs/ROADMAP.md) — what's shipped and what's planned
- [`docs/API.md`](./docs/API.md) — REST API reference for `/api/admin/*` (auth, payloads, examples)
- [`docs/ADMIN.md`](./docs/ADMIN.md) — how to author problems via the admin portal (workflow + tips)
- [`mcp-server/README.md`](./mcp-server/README.md) — MCP server install + Claude Desktop config + per-tool data formats
- [`CLAUDE.md`](./CLAUDE.md) — project guide for AI-assisted contributors
- [GitHub Wiki](https://github.com/ez-biz/datalearn/wiki) — getting-started, contributor & admin guides, FAQ

## Contributing

See [`.github/CONTRIBUTING.md`](./.github/CONTRIBUTING.md) for the full guide — branching strategy, commit conventions, PR lifecycle, merge mode, hard rules, releases.

TL;DR: branch as `<type>/<description>`, open a PR, CI must be green, squash-merge. Don't `next build` without `--webpack` (see build caveat above).

## License

TBD — see repository owner.
