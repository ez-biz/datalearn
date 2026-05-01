# Data Learn

Practice SQL the way LeetCode does code. Real problems. Real schemas. A real database in your browser.

> ![Built with Next.js 16](https://img.shields.io/badge/Next.js-16-black) ![DuckDB-WASM](https://img.shields.io/badge/SQL-DuckDB--WASM-yellow) ![Prisma 7](https://img.shields.io/badge/ORM-Prisma_7-blue) ![Status](https://img.shields.io/badge/status-beta-orange)

Repo: <https://github.com/ez-biz/datalearn>

---

## Features

- **In-browser SQL execution** — DuckDB-WASM runs every query client-side. Zero round-trips, zero waiting.
- **Instant validation** — submit a query and get an immediate accept / wrong-answer verdict, with row-level diffs on failure.
- **Curated problem library** — across e-commerce, HR, and SaaS schemas; Easy / Medium / Hard.
- **LeetCode-style workspace** — two-pane layout: tabbed Description / Schema / Hints / History on the left, Monaco editor + tabbed Results / Verdict on the right.
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

# 2. Set up local Postgres and copy env.example -> .env
createdb datalearn           # or use Postgres.app / Docker
cp env.example .env          # then fill in DATABASE_URL, AUTH_*, etc.

# 3. Apply migrations + seed the demo content
npx prisma migrate dev
npx tsx prisma/seed.ts       # seeds 11 problems, 3 schemas, 1 topic with 3 articles

# 4. Run
npm run dev                  # http://localhost:3000
```

After modifying `prisma/schema.prisma`, restart the dev server — the running process holds the old generated client.

### Becoming an admin

Sign in once via GitHub or Google to create your `User` row, then promote yourself:

```bash
psql "$DATABASE_URL" -c "UPDATE \"User\" SET role='ADMIN' WHERE email='you@example.com';"
```

Then visit `/admin/problems` to author content. See [`docs/ADMIN.md`](./docs/ADMIN.md).

### Build

```bash
npm run build                # next build --webpack
npm run start
```

> **Build caveat:** `package.json` pins `--webpack` for both `build` and `vercel-build`. Turbopack hits an internal panic (`entered unreachable code` in `chunk_group.rs`) on this code shape in Next 16.1.1. Webpack build is clean. Will revisit when Turbopack ships a fix.

## Deploying to Vercel + Neon

1. Create a Neon project (free tier is fine). Copy the **pooled** and **direct** connection strings.
2. In Vercel, import this repo. Set the following env vars under Project Settings → Environment Variables:
   - `DATABASE_URL` — Neon pooled connection string (used at runtime)
   - `DIRECT_URL` — Neon direct connection string (used by `prisma migrate deploy` during build)
   - `NEXTAUTH_URL` — your production URL (e.g. `https://datalearn.vercel.app`)
   - `AUTH_SECRET` — generate with `openssl rand -base64 32`
   - `AUTH_GITHUB_ID`, `AUTH_GITHUB_SECRET` — from a GitHub OAuth app with callback `https://<your-domain>/api/auth/callback/github`
   - `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET` — from a Google OAuth client with the equivalent callback
3. Vercel auto-runs `vercel-build` from `package.json`: `prisma migrate deploy && next build --webpack`.
4. After the first deploy, seed the production DB once:
   ```bash
   DATABASE_URL="<direct-url>" npx tsx prisma/seed.ts
   ```
5. Promote your user to admin in production via `psql` against the production DB.

### Note on first load

DuckDB-WASM downloads a ~30 MB WASM binary on first visit. Expect a slow first load on mobile; subsequent visits are cached by the browser.

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

Open a PR from a feature branch. Conventional-ish commit prefixes (`feat:`, `fix:`, `feat(ui):`, `chore:`, `docs:`). PR descriptions list **Verified** (what you actually checked) and **Not yet verified** (what the reviewer should click through).

Don't `next build` without `--webpack` — see the build caveat above.

## License

TBD — see repository owner.
