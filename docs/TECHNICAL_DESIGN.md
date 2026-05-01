# Data Learn — Technical Design Document

> **Version:** 2.1
> **Last updated:** 2026-05-01
> **Owner:** Anchit Gupta
> **Repo:** <https://github.com/ez-biz/datalearn>

A LeetCode-style SQL practice platform with an integrated learning hub, admin CMS, and external MCP integration. Queries execute in the browser via DuckDB-WASM; metadata, auth, and content live in Postgres behind Next.js Server Components and a small REST surface.

This document is the canonical reference for **how the system is built**. For product roadmap and shipped/planned features see [`ROADMAP.md`](./ROADMAP.md). For the admin REST surface see [`API.md`](./API.md). For end-user docs see the [GitHub Wiki](https://github.com/ez-biz/datalearn/wiki).

---

## 1. System Overview

Data Learn is a single Next.js 16 application backed by Postgres. The runtime architecture has three planes:

- **Server plane** — Next.js Server Components, Route Handlers, and Server Actions. Talks to Postgres via Prisma; runs NextAuth for sessions; gates admin routes at the edge.
- **Browser plane** — Server-rendered HTML, hydrated client components for the SQL workspace, the avatar dropdown, the SQL editor, and a few interactive widgets. **Learner SQL queries execute here** via DuckDB-WASM — they never touch Postgres.
- **External integration plane** — Standalone MCP server (`mcp-server/`) that talks to the platform's `/api/admin/*` REST endpoints over Bearer auth. Lets MCP-aware AI assistants author content via tool calls.

### High-level architecture

```
                    ┌────────────────────────────────────────────┐
                    │  Browser (the learner / admin / contributor) │
                    │  · DuckDB-WASM runs all learner SQL          │
                    │  · Monaco editor, validated submissions      │
                    └────────────┬───────────────────────────────┘
                                 │  HTTP (HTTPS in prod)
                                 ▼
   ┌─────────────────────────────────────────────────────────────┐
   │  Next.js 16 (App Router)                                    │
   │                                                             │
   │   ┌────────────┐   ┌──────────────┐   ┌────────────────┐    │
   │   │ middleware │ → │ Route segments│ → │ Server actions │    │
   │   │ (edge gate)│   │ (RSC + Client)│   │ + Route handlers│    │
   │   └────────────┘   └──────────────┘   └────────┬───────┘    │
   │                                                │             │
   │   NextAuth v5 ◄─── session cookie     ┌────────▼───────┐    │
   │   (Prisma adapter)                    │ Prisma 7 client │    │
   │                                       └────────┬───────┘    │
   └────────────────────────────────────────────────┼───────────┘
                                                    │  pg pool
                                                    ▼
                                           ┌─────────────────┐
                                           │  PostgreSQL     │
                                           │  (Neon in prod, │
                                           │   local in dev) │
                                           └─────────────────┘
                                                    ▲
                                                    │  Bearer key
                                                    │  via /api/admin/*
                                           ┌────────┴─────────┐
                                           │  mcp-server/     │
                                           │  stdio MCP       │
                                           │  (Claude Desktop │
                                           │   / Cursor / …)  │
                                           └──────────────────┘
```

### Major subsystems (covered in detail below)

| § | Subsystem | What it owns |
|---|---|---|
| 4 | Database schema | Users, sessions, problems, schemas, submissions, articles, topics, tags, API keys, problem lists |
| 5 | Auth & authorization | NextAuth config, edge middleware, role-based access (USER / CONTRIBUTOR / ADMIN), CSRF + Origin gate |
| 6 | SQL execution engine | DuckDB-WASM bootstrap, shared-DB hook, validator, expected-output capture |
| 7 | Learn CMS | Topics, articles, status state machine, snapshot-on-publish, contributor authoring |
| 8 | Admin REST API | `/api/admin/*` endpoints, Bearer-key auth, validation pipeline |
| 9 | MCP server | Standalone stdio process, 9 tools, forced-DRAFT writes |
| 10 | Profile & stats | Activity heatmap, streaks, solved donut, skills-by-tag |
| 11 | Custom problem lists | Private user-curated collections — `/me/lists`, drag-drop reorder, sort options, add-from-workspace popover |
| 12 | Security posture | Threat model, mitigations, audit log of shipped fixes |

---

## 2. Technology Stack

### Runtime

| Layer | Technology | Notes |
|---|---|---|
| Framework | **Next.js 16** (App Router) | Webpack build pinned (`--webpack`); Turbopack dev only |
| Language | **TypeScript** strict | `noEmit` + Bundler resolution |
| Runtime | **Node.js 20+** | Edge middleware uses Node runtime so Prisma session adapter works |
| ORM | **Prisma 7** with `prisma.config.ts` | `@prisma/adapter-pg` + `pg.Pool` |
| Database | **PostgreSQL 14+** | Neon in prod (pooled URL at runtime, direct URL for migrate) |
| Auth | **NextAuth v5** (beta) | Prisma adapter, GitHub + Google OAuth |
| In-browser SQL | **DuckDB-WASM** | One shared connection per problem page via `useProblemDB` |
| Editor | **Monaco** (`@monaco-editor/react`) | Lazy-loaded via `next/dynamic` |
| UI tokens | **Tailwind v4** + `@plugin "@tailwindcss/typography"` | HSL CSS variables; light + full dark mode |
| Theming | **next-themes** | Light default, manual toggle in nav |
| Fonts | **Inter** + **JetBrains Mono** | `next/font/google`, character variants `cv02/cv03/cv04/cv11` enabled |
| Icons | **Lucide** | Single icon family across the product; no emoji icons |

### External integrations

| Integration | Where it lives | Purpose |
|---|---|---|
| **MCP server** | `mcp-server/` (own `package.json`, tsup-bundled) | AI authoring via Claude Desktop / Cursor over stdio |
| **Vercel Analytics** | `app/layout.tsx` | Page-view + web vitals telemetry |
| **GitHub OAuth** | `lib/auth.ts` provider config | One sign-in path |
| **Google OAuth** | `lib/auth.ts` provider config | Second sign-in path; `allowDangerousEmailAccountLinking: true` is gated by signIn callback (see §5.4) |

### Dev / CI

| Tool | Purpose |
|---|---|
| **Playwright** | E2E test harness (~41 tests, runs in 2s); CI gate |
| **`node:test` + tsx** | Unit tests for pure helpers (`schema-parser`, `profile-stats`); zero new deps |
| **GitHub Actions** | Postgres service container, `npx tsc --noEmit`, `npm run build`, `npx playwright test` on every PR |
| **CodeQL** | High-severity static analysis (e.g., the clear-text-logging finding caught on the MCP harness) |
| **`tsup`** | Bundles `mcp-server/` to a single `dist/index.js` |
| **`vitest`** | MCP server unit tests (40 cases) |

---

## 3. Application Architecture

### 3.1 Directory structure

```
datalearn/
├── app/                          App Router pages (RSC by default)
│   ├── layout.tsx                Root layout: Inter + JetBrains Mono, Navbar, Footer, ThemeProvider, Vercel Analytics
│   ├── page.tsx                  Homepage — branches on auth(): UserHome dashboard for signed-in, marketing for anonymous
│   ├── globals.css               Tailwind v4 entry, HSL token system, prefers-reduced-motion clamp
│   ├── practice/
│   │   ├── page.tsx              Problem list (filters by difficulty, search, status)
│   │   └── [slug]/page.tsx       Problem workspace shell — server-renders ProblemPanel + dynamically imports SqlPlayground
│   ├── learn/
│   │   ├── page.tsx              Topic listing
│   │   └── [topicSlug]/[articleSlug]/page.tsx  Article render w/ TOC, reading time, prev/next, related problems
│   ├── me/articles/              Contributor authoring surface (CONTRIBUTOR + ADMIN only)
│   ├── me/lists/                 Custom problem lists — index + [id] detail (any signed-in user)
│   ├── admin/                    Admin CMS — gated by middleware + AdminLayout
│   ├── profile/page.tsx          Two-column profile: heatmap, donut, skills, recent activity, placeholder cards
│   ├── api/
│   │   ├── auth/[...nextauth]/   NextAuth route handler
│   │   ├── admin/                Admin REST surface (Bearer or session) — see API.md
│   │   └── me/articles/          Contributor REST surface (session-only, no Bearer)
│   └── …                         Pages, profile, dynamic [slug]
├── actions/                      Server actions ("use server")
│   ├── problems.ts               Public problem listing + detail (no expectedOutput leak); getSlugByNumber for /practice/<n> redirect
│   ├── submissions.ts            validateSubmission, getUserStats, getSolvedSlugs, getProblemHistory
│   ├── content.ts                Public articles + topics
│   ├── profile.ts                getProfileData — composes 8 cheap Prisma calls for /profile
│   ├── lists.ts                  Custom problem lists — create / rename / delete / add / remove / reorder; getMyLists, getList, getListIdsContainingProblem
│   └── nav.ts                    Dynamic navbar links
├── components/
│   ├── ui/                       Hand-rolled primitives (Button, Card, Badge, Input, Skeleton, Logo, ThemeToggle, Container, EmptyState)
│   ├── layout/                   Navbar, Footer, ThemeProvider, MobileNav, UserMenu (avatar dropdown)
│   ├── practice/                 ProblemClient (workspace state), ProblemPanel, PracticeList, HistoryPanel, RelatedArticlesPanel, ReportDialog
│   ├── lists/                    CreateListButton (popover), ListDetail (rename/delete/reorder/sort), AddToListButton (workspace popover), AddProblemsPicker (search-and-add)
│   ├── sql/                      SqlPlayground (Monaco + Run/Submit), SqlEditor, ResultTable, ValidationResult, SqlPlaygroundSkeleton
│   ├── home/                     UserHome (logged-in dashboard with continue / progress / recommended / recent cards)
│   ├── profile/                  ProfileSidebar, ActivityHeatmap, SolvedDonut, SkillsByTag, PlaceholderCard
│   ├── learn/                    Cross-link panels, article rendering
│   └── admin/                    AdminNav, ProblemForm, HintsEditor, TagPicker, ArticleEditor, ContributorsClient, ApiKeysClient
├── lib/
│   ├── auth.ts                   NextAuth setup; signIn callback guards account-link takeover
│   ├── api-auth.ts               requireAdmin / requireContributor; Bearer + session paths; Origin/CSRF gate
│   ├── prisma.ts                 Prisma client singleton with PrismaPg adapter
│   ├── duckdb.ts                 DuckDB-WASM bootstrap (CDN-hosted bundles)
│   ├── use-problem-db.ts         Shared per-page DB hook (one connection, schema bootstrapped once)
│   ├── sql-validator.ts          Pure validator: epsilon for floats, ordered/unordered modes
│   ├── admin-validation.ts       Zod schemas — kept Prisma-free (imported by mcp-server/)
│   ├── schema-parser.ts          Server-side parser for SqlSchema.sql → TableInfo[] (skips DuckDB roundtrip)
│   ├── profile-stats.ts          Pure helpers: toDayKey / buildHeatmap / computeStreaks
│   ├── article-versions.ts       Snapshot-on-publish for ArticleVersion / ProblemVersion
│   ├── markdown-toc.ts           TOC extraction for /learn articles
│   └── seed-data*.ts             Seeded SQL schemas (e-commerce, HR)
├── prisma/
│   ├── schema.prisma             Source of truth for all models
│   ├── seed.ts                   Demo content; admin email seeded at role=USER (non-destructive)
│   └── migrations/               Migration history
├── middleware.ts                 Edge gating for /admin/* and /api/admin/* (Node runtime)
├── mcp-server/                   Standalone MCP server — see §9
├── tests/e2e/                    Playwright E2E tests
├── scripts/
│   ├── mcp-e2e-test.mjs          End-to-end harness for the MCP server
│   ├── test-schema-parser.ts     node:test for the parser
│   └── test-profile-stats.ts     node:test for heatmap + streak helpers
└── docs/                         This document, ROADMAP, API, ADMIN, etc.
```

### 3.2 Data flow patterns

#### Server Components (RSC)

The default. Pages call server actions which talk to Prisma; rendered HTML ships to the browser. No client JS needed unless the surface has interactivity.

```
GET /practice → app/practice/page.tsx (RSC) → getProblems() → prisma.sQLProblem.findMany → render → HTML
```

#### Client Component (DuckDB workspace)

The SQL playground must run client-side (WASM). Pattern:

```
GET /practice/[slug] → page.tsx (RSC, fetches problem + history) → ProblemClient (client) → SqlPlayground (dynamic import, ssr:false) → DuckDB-WASM
```

`SqlPlayground` is dynamically imported with a layout-matched `SqlPlaygroundSkeleton` (PR #20) so the right pane never collapses to blank during chunk-parse.

#### Server-side schema parsing

The Schema panel and INPUT example previews on the problem page used to wait on DuckDB to boot, then run `DESCRIBE` + `SELECT * LIMIT N`. As of PR #20 the page calls `parseSchema(problem.schema?.sql)` server-side (`lib/schema-parser.ts`) and passes pre-computed `tableInfos` down. Schema + INPUT render at first paint with no DuckDB dependency. Falls back to the DuckDB-driven path if the parser returns `null` for an unrecognized schema shape.

---

## 4. Database Schema

Prisma is the source of truth (`prisma/schema.prisma`). High-level relationships:

```
User ──┐
       ├── 1:N ──> Submission ──N:1 ──> SQLProblem ──N:1 ──> SqlSchema
       │                          \
       │                           \─ N:M ──> Tag
       ├── 1:N ──> Account            (ProblemTags)
       ├── 1:N ──> Session
       ├── 1:N ──> Article (as author) ──N:1 ──> Topic
       │              \
       │               └─ 1:N ──> ArticleVersion (snapshot-on-publish)
       ├── 1:N ──> ApiKey (createdBy)
       ├── 1:N ──> ProblemReport
       └── 1:N ──> ProblemList ── 1:N ──> ProblemListItem ──N:1 ──> SQLProblem
```

### Key models

- **User** — id, email, name, image, role (`USER` / `CONTRIBUTOR` / `ADMIN`), accounts, sessions, submissions, authored articles, created API keys.
- **Session** — NextAuth-managed; database session strategy.
- **SQLProblem** — `number` (stable display ID, `Int @unique`, minted as `MAX(number)+1` in the create transaction; never recycled), slug, title, difficulty, status (`DRAFT` / `BETA` / `PUBLISHED` / `ARCHIVED`), description, schemaDescription, ordered, hints[], expectedOutput (JSON-stringified array of row objects), solutionSql (admin-only reference), schemaId, tags M:N.
- **SqlSchema** — name, sql (CREATE TABLE + INSERT VALUES — **not** stored as separate DDL/seed columns).
- **Submission** — userId, problemId, status (`ACCEPTED` / `WRONG_ANSWER`), code, reason, createdAt.
- **Tag** — slug, name; M:N to Problem and to Article.
- **Topic + Article** — Learn CMS; Article has status (`DRAFT` / `SUBMITTED` / `PUBLISHED` / `ARCHIVED`), authorId, topicId, content (markdown), readingMinutes, M:N to Tag and a `ProblemArticleLinks` cross-link table.
- **ArticleVersion / ProblemVersion** — immutable snapshots written on publish, so PUBLISHED content can be referenced/cited even after edits.
- **ApiKey** — Bearer keys for `/api/admin/*`. SHA-256 hash at rest; plaintext only shown at creation; createdById, prefix, expiresAt, revokedAt, lastUsedAt, name.
- **ProblemReport** — per-user reports against problems (anonymous variant rate-limited).
- **ProblemList** — `{ id, ownerId, name, description?, createdAt, updatedAt }`. Cascade-deletes with the User. Indexed on `(ownerId, updatedAt)` for the index page sort.
- **ProblemListItem** — `{ listId, problemId, position, addedAt }` with composite PK `(listId, problemId)` so the same problem can't appear twice in one list. `position` is mutated by `reorderList` in a single transaction; never auto-managed. Indexed on `(listId, position)` for the detail-page render.

### Design decisions

- **`expectedOutput` is a JSON-stringified array** of row objects. Validated by Zod refinements at the API boundary (`ProblemCreateInput`).
- **Submissions are append-only.** No edit, no delete from user surfaces. Acceptance rate is a derived metric.
- **Status state machine on Article**: `DRAFT → SUBMITTED → PUBLISHED → ARCHIVED`. Approve/reject are explicit verbs; publish triggers an `ArticleVersion` snapshot.
- **Tag is shared between Problems and Articles** via two M:N relations (`ProblemTags`, `ArticleTags`) so cross-linking is explicit, not tag-similarity-heuristic.
- **Schemas are stored as one `sql` string** (DDL + seed `INSERTs` together). Keeps the model simple at the cost of needing the schema parser (`lib/schema-parser.ts`) for fast first-paint introspection.
- **Problem numbers are minted in-transaction, never recycled.** `SQLProblem.number` is set as `MAX(number)+1` inside the same `prisma.$transaction` that creates the row, so concurrent creates can't collide; the DB-side `UNIQUE` constraint is the ultimate guard. Even after `ARCHIVED`, the number stays — external links, search results, and shared screenshots remain stable forever.
- **Custom lists dedupe at the DB level.** `ProblemListItem` uses a composite PK `(listId, problemId)`, so `addToList` is idempotent — a duplicate insert raises `P2002` and the action treats it as success. No application-level dedupe logic.

---

## 5. Authentication & Authorization

### 5.1 NextAuth config (`lib/auth.ts`)

- **Strategy:** database sessions via `PrismaAdapter`.
- **Providers:** GitHub, Google.
- **`allowDangerousEmailAccountLinking: true` on Google only.** GitHub does not require email verification, so we explicitly do NOT auto-link there to prevent takeover via secondary unverified emails on a throwaway GitHub account.
- **`signIn` callback** refuses OAuth auto-link onto an existing User row that has elevated role (`!= USER`) AND zero `Account` rows. This closes a takeover path where a pre-seeded ADMIN/CONTRIBUTOR row could be claimed by anyone who later controls the seeded email.
- **`session` callback** copies `user.id` and `user.role` onto `session.user` so server actions can read them without re-querying. Type augmentation in `types/next-auth.d.ts`.

### 5.2 Edge middleware (`middleware.ts`)

Bounces unauthorized requests to `/admin/*` and `/api/admin/*` **before** any rendering or DB query in those segments runs.

- Runs on the Node runtime (not Edge) so the Prisma session adapter works.
- Anonymous → 307 redirect to `/api/auth/signin?callbackUrl=...` (pages) or 401 JSON (API).
- Non-admin USER → 307 to `/` (pages) or 403 JSON (API).
- Bearer-token requests to `/api/admin/*` bypass the session check and are validated downstream by `withAdmin` against the `ApiKey` table.
- This is **defense-in-depth.** `withAdmin` and `AdminLayout` still do their own checks; the middleware closes a small DoS / race window.

### 5.3 `requireAdmin` / `requireContributor` (`lib/api-auth.ts`)

Two route wrappers. Both:

- **Reject malformed `Authorization` headers** explicitly (any value not starting with `Bearer ` returns 401 with a "Malformed" message). Surfaces misconfigured proxies/clients quickly.
- **Apply an Origin-header CSRF gate** on the session path. Requests with an `Origin` that doesn't match `req.headers.host` (or `NEXTAUTH_URL` host) get 403. Bearer-key requests bypass (attackers can't set Authorization cross-origin from a browser).
- **Return distinct error messages** today (`"Invalid API key"` / `"…revoked"` / `"…expired"`). A planned hardening collapses these into one generic to remove a key-state oracle (deferred — see §13).

`requireContributor` additionally:
- Rejects **any** `Authorization` header on `/api/me/*`. Bearer is admin-only — accepting it on the contributor surface would let a leaked admin key forge contributor authorship.

### 5.4 Roles

| Role | Access |
|---|---|
| `USER` | Public site + per-user submissions and profile |
| `CONTRIBUTOR` | + `/me/articles` authoring (own articles only); article submission for admin review |
| `ADMIN` | + Admin CMS, role grant API, API key management, contributor management, full content control |

Role grants are admin-only via `/api/admin/users/[id]/role`. ADMIN role changes are deliberately UI-blocked (psql-only) so an admin can't accidentally demote themselves.

---

## 6. SQL Execution Engine

### 6.1 Why DuckDB-WASM

- Free at scale: zero server-side compute per learner query.
- Instant feedback: no network round-trip per query.
- Postgres-ish dialect: covers JOINs, window functions, CTEs, GROUP BY, etc. — everything in our problem set.

### 6.2 Bootstrap (`lib/duckdb.ts`, `lib/use-problem-db.ts`)

- WASM bundle loaded from CDN at first visit (~30 MB; cached after).
- One DuckDB connection per problem page, exposed via the `useProblemDB(schemaSql)` hook. The hook bootstraps the schema (DDL + seed `INSERT`s) once on init, then keeps the connection alive for as many `runQuery` calls as the page makes.
- Two inits on the same page would mean two WASM downloads + two engines. **Don't initialize twice.**

### 6.3 Validator (`lib/sql-validator.ts`)

Pure function. Compares user rows against `expectedOutput`:

- **Ordered mode** (`SQLProblem.ordered = true`): row-by-row positional comparison.
- **Set mode** (default): canonicalize rows to a sorted JSON form and compare as multisets.
- **Float epsilon**: numbers compared with `Math.abs(a - b) < 1e-6` to avoid float-precision false negatives.
- **Column projection**: only columns named in `expectedOutput[0]` are compared; extra columns in the user result are flagged.

`validateSubmission` (server action, `actions/submissions.ts`) runs the validator and writes a `Submission` row when the user is signed in.

### 6.4 Workspace UX (`components/practice/ProblemClient.tsx`, `components/sql/SqlPlayground.tsx`)

- Editor renders immediately; **only `Run` and `Submit` are gated on `dbReady`** so the user can read the problem and start typing while DuckDB downloads (PR #20).
- Layout-matched skeleton (`SqlPlaygroundSkeleton`) covers the brief dynamic-import window so the right pane never collapses to blank.
- Draft autosave: localStorage `dl:draft:<slug>`, debounced 400 ms.
- Submission history is fetched server-side and threaded down; updated optimistically on submit.

### 6.5 Limitations

- Cold start can take 1–3 s on a fresh visit (WASM download). Subsequent visits are ~200 ms.
- Currently single-dialect (DuckDB ≈ Postgres-flavored). Multi-dialect support (MySQL / Hive / explicit Postgres) is on the roadmap; would require either PGlite-style WASM swap or server-side ephemeral Postgres branches (Neon is a strong fit for this — see §13).

---

## 7. Learn CMS

### 7.1 Models

`Topic` (1:N) → `Article` (M:N) → `Tag`. Articles also have an explicit cross-link table to `SQLProblem` (`ProblemArticleLinks`) so the Practice and Learn surfaces can show related content without tag-similarity heuristics.

### 7.2 Article state machine

```
DRAFT ────submit────► SUBMITTED ────approve────► PUBLISHED ───archive──► ARCHIVED
   ▲                       │
   └──────reject/edit──────┘
```

- Authors can edit DRAFT freely. SUBMITTED locks editing pending review.
- Approve writes an `ArticleVersion` snapshot of the content at the moment of publish, so external citations remain stable even after the live article is later edited.
- Reject returns the article to DRAFT with a feedback note attached.

### 7.3 Reading polish

- Server-extracted TOC (`lib/markdown-toc.ts`) rendered in a sticky right rail.
- Reading time computed on save and stored in `Article.readingMinutes`.
- Prev/next navigation within a topic.
- Cross-linking: every problem page shows a "Read more" panel of related articles; every article shows a "Practice problems" panel.

### 7.4 Contributor authoring (`/me/articles`)

- CONTRIBUTOR users can create / edit / submit their own articles.
- Strict ownership gates: every `/api/me/articles/[slug]/*` route checks `authorId === session.user.id`.
- The status field is **not** writable from the contributor surface — admins control PUBLISHED.
- See `lib/api-auth.ts::requireContributor` for the auth wrapper.

---

## 8. Admin REST API

Full reference in [`docs/API.md`](./API.md). Highlights:

- All admin endpoints under `/api/admin/*`.
- Two auth paths: **session cookie** (admin UI) or **`Authorization: Bearer <key>`** (automation, MCP).
- Bearer keys are SHA-256 hashed at rest; plaintext shown **once** at creation. Default 90-day expiry, capped at 365 days.
- Validation pipeline: every endpoint runs `Zod.safeParse` on the request body and returns `{ error: "Validation failed", details: <treeified> }` on failure with HTTP 400.
- Response envelope: `{ data: ... }` on success, `{ error, details? }` on failure.

This surface is what the MCP server talks to (§9).

---

## 9. MCP Server (`mcp-server/`)

### 9.1 Why

A standalone stdio server lets an MCP-aware AI assistant (Claude Desktop, Cursor) author SQL problems on the platform via tool calls instead of hand-written REST scripts. Spec: [`docs/superpowers/specs/2026-04-26-mcp-server-design.md`](./superpowers/specs/2026-04-26-mcp-server-design.md).

### 9.2 Architecture

- Sibling project in this repo with its own `package.json`, `tsconfig.json`, and `tsup` config. Bundled into a single `mcp-server/dist/index.js` (1.55 MB self-contained).
- Imports `lib/admin-validation.ts` directly via a relative path; the bundler inlines it. **Why `admin-validation.ts` must stay Prisma-free** — pulling Prisma into that file would bloat the MCP bundle and break the stdio runtime.
- Talks to the platform's `/api/admin/*` endpoints over HTTPS. Authenticates with a Bearer key passed via the `DATALEARN_API_KEY` env var. Base URL via `DATALEARN_BASE_URL`.
- Localhost-only `http://` rule: `DATALEARN_BASE_URL=http://...` is rejected at construction time unless the host is `localhost` / `127.0.0.1` / `[::1]`. Prevents leaking the key over plaintext to a misconfigured prod URL.

### 9.3 v1 tool surface (9 tools)

| Tool | What it does |
|---|---|
| `list_topics` / `create_topic` | Article topics |
| `list_tags` / `create_tag` | Problem tags |
| `list_schemas` / `create_schema` | SQL schemas (DDL + seed in one `sql` string) |
| `list_problems` | Minimal projection (slug, title, difficulty, status, tags); excludes `expectedOutput`/`solutionSql` |
| `get_problem` | Full record by slug; returns `{found:false}` on 404 |
| `create_problem` | **Forced DRAFT** — the tool input shape omits `status`, the handler hardcodes it. Verified four ways (omit-then-inject + Zod default-strip + spread-order + API-side revalidation). |

### 9.4 Error mapping (`mcp-server/src/errors.ts`)

| API status | MCP error |
|---|---|
| 400 | `InvalidParams` with the API's validation message — AI sees it and self-corrects |
| 401 / 403 | `InvalidRequest` with `"auth failed (check DATALEARN_API_KEY): …"` |
| 5xx and unmapped | `InternalError` with **generic** `"upstream error (HTTP <status>)"`; the original message is logged to stderr, not surfaced to the MCP client. Prevents leaking paths/stack traces. |
| Existing `McpError` | Passed through (per-tool handlers can pre-translate before this generic mapper sees the error) |

### 9.5 Verification

- 40 unit tests (`vitest`) cover the HTTP client, error mapping, and each tool's wiring.
- `scripts/mcp-e2e-test.mjs` is an end-to-end harness that seeds an admin API key, drives all 9 tools over real stdio JSON-RPC against a running Next dev server, asserts the privilege boundary (smuggling `status: "PUBLISHED"` still lands as DRAFT), then revokes the key and deletes test records. **14/14 checks** pass on `main`.
- Wire-protocol smoke (`initialize` + `tools/list`) verified `create_problem`'s `inputSchema.properties` does not contain `status` at the wire level — the safety guarantee holds end-to-end, not just in code.

---

## 10. Profile & Stats Subsystem

### 10.1 Server-side data (`actions/profile.ts::getProfileData`)

Single async function. Composes 8 cheap parallel Prisma calls per profile load:

1. `User.findUniqueOrThrow` — name/email/image/role/createdAt
2. `Submission.findMany` — last-365-day createdAt timestamps for the heatmap
3. `Submission.count` — total submissions
4. `Submission.count` (status=ACCEPTED) — total accepted
5. `Submission.findMany` (top 10) — recent activity feed
6. `Submission.findMany` (status=ACCEPTED, distinct by problemId) — distinct solved problems with their tags
7. `SQLProblem.groupBy` — totals by difficulty (denominator)
8. `Tag.findMany` with `_count.problems` — tag metadata for the skills section

### 10.2 Pure helpers (`lib/profile-stats.ts`)

- `toDayKey(Date)` — UTC `YYYY-MM-DD` to avoid timezone wobble.
- `buildHeatmap(dates, windowDays = 365, today?)` — returns exactly `windowDays` entries, oldest first, with `count: number` per day.
- `computeStreaks(heatmap)` — current streak (with **one-day grace** so today-empty + yesterday-active still counts) and longest streak (max-run scan).

12 unit tests in `scripts/test-profile-stats.ts` (`node:test`).

### 10.3 Components (`components/profile/`)

- **`ProfileSidebar`** — avatar, name, role pill, joined date, streak.
- **`ActivityHeatmap`** — 53-week × 7-day SVG grid; intensity scale built on `--easy` token so dark-mode auto-themes; `aria-label` + per-cell `<title>` for screen readers and hover tooltips; legend with "Less ←→ More" scale ticks.
- **`SolvedDonut`** — three colored arcs proportional to user's solved-by-difficulty (NOT the field composition); legend shows X/Y per difficulty; center always shows `<solved> / <total> SOLVED`.
- **`SkillsByTag`** — top tertile = Advanced, middle = Intermediate, bottom = Fundamental, computed from the user's own ranked-by-count distribution (no global thresholds — works for new users).
- **`PlaceholderCard`** — sized placeholders for the deferred sections (Contests, Languages/DBs, Work, Education, Resume, Links) so the layout doesn't collapse and a "Coming soon" pill makes it clear the slot is intentional, not broken.

### 10.4 Logged-in homepage (`components/home/UserHome.tsx`)

Branches `app/page.tsx` on `auth()`. For signed-in users the homepage is a four-card dashboard:
- **Continue / Recently solved** — last attempted problem, deep-linked.
- **Your progress** — bars per difficulty (uses the same data source as `/profile`).
- **Recommended next** — first PUBLISHED problem the user hasn't solved.
- **Recent activity** — last 5 submissions.

Anonymous traffic still gets the full marketing page unchanged.

### 10.5 Avatar dropdown (`components/layout/UserMenu.tsx`)

Replaces the navbar's previous direct link to `/profile` with a popover that contains a profile chip, a "Problems solved X/Y" stats banner, and links (Profile / My lists / My articles / Admin / Sign out) gated by role. Accessible: `aria-haspopup="menu"`, Escape closes and refocuses trigger, click-outside via document `pointerdown` listener.

---

## 11. Custom Problem Lists

Private, user-curated collections — LeetCode-style "My Lists". Visible only to the owner in v1; public sharing is deferred (would need a `visibility` column + slug + share page).

### 11.1 Models

- **`ProblemList`** — owner-cascading row, indexed on `(ownerId, updatedAt)` for the index sort.
- **`ProblemListItem`** — composite PK `(listId, problemId)` (DB-level dedupe), `position` (mutated by reorder), `addedAt`. Indexed on `(listId, position)` for the detail-page render and on `problemId` for the future "lists containing this problem" lookup.

### 11.2 Server actions (`actions/lists.ts`)

| Action | What it does | Concurrency notes |
|---|---|---|
| `createList` | Cap-checks `count(ProblemList) < 100`, creates row, revalidates `/me/lists` | — |
| `renameList` | `updateMany(where: {id, ownerId})` so a missing/foreign-owned id returns 0 instead of leaking existence | — |
| `deleteList` | Same `updateMany` ownership-guard pattern; cascade clears items | — |
| `addToList` | Cap-checks `count(items) < 1000`, looks up problem, mints `position = MAX+1`, inserts. Catches P2002 as silent success (idempotent) | Race: two concurrent adds can collide on `position`, but `(listId, problemId)` PK + retry on caller is enough; not worth a transaction |
| `removeFromList` | Single `deleteMany` keyed by `(listId, problem.id)` | — |
| `reorderList` | `prisma.$transaction` of N `update` calls, restamping every `position`. Caller sends the full ordering after a drag-drop | Transaction so we never observe a half-reordered list |
| `getMyLists` | Index projection with `_count: { items: true }` | — |
| `getList` | List + items + per-item `lastSolvedAt` via one `prisma.submission.groupBy` over `problemId IN (...)` keyed by `userId, status='ACCEPTED'` | Uses existing `Submission(userId, status)` index — cheap even at 1000-item cap |
| `getListIdsContainingProblem` | Powers the AddToListButton popover's checked state; one indexed query | — |

### 11.3 Surfaces

- **`/me/lists`** — index. Sorted by `updatedAt DESC`. Empty state points to the top-right "New list" popover.
- **`/me/lists/[id]`** — detail. Header has rename / delete / add-problems. Sort menu (Manual / Recently added / Recently solved / Unsolved first / Problem number). When sort = Manual, drag-and-drop is enabled (native HTML5 DnD with a `GripVertical` handle on desktop, up/down arrows on mobile). Each row shows the solved indicator (green check / outline circle), `#NNN`, title, "Added X · Solved Y / Not solved" timestamps, difficulty, remove button.
- **`AddToListButton`** — popover on the practice workspace header. Lists all the user's lists with checked-state for those already containing the problem; toggle to add/remove. Inline "New list" inside the popover so a user can create + add in one flow.
- **UserMenu** — "My lists" entry between Profile and My articles.

### 11.4 Caps + reasoning

- **100 lists per user** — UX threshold, not a DB one. Without it the index would need pagination.
- **1000 items per list** — same. The `getList` payload is the realistic ceiling for what's renderable in one DOM tree without virtualization. Hit this cap and the UX would deteriorate before the DB notices.

Both caps are checked at write-time in `addToList` / `createList` and surface a friendly error to the user.

### 11.5 What's not in v1

- Public sharing (slug + visibility + share page).
- MCP tools (`list_my_lists`, `add_to_list`, `remove_from_list`) — today the MCP path is admin-only; opens up when we extend MCP for contributors.
- Bulk operations (move N problems between lists).
- "Lists containing this problem" surface on the practice page — the `getListIdsContainingProblem` query exists but is only consumed by AddToListButton today.

---

## 12. Security Posture

A consolidated view of the threat surface and the mitigations shipped to date.

### 11.1 Threat model

| Threat | Vector | Status |
|---|---|---|
| Answer-key leak in the wire | `expectedOutput` / `solutionSql` exposed in public APIs | Mitigated — explicit `select` projections in `actions/problems.ts`; `list_problems` MCP tool excludes them |
| Account takeover | OAuth auto-link onto pre-seeded elevated-role User row | Mitigated — `signIn` callback (§5.1); seed creates admin at role=USER with non-destructive update |
| CSRF on writes | Cookie auto-sent cross-origin | Mitigated — Origin gate on session path in `requireAdmin` / `requireContributor`; Bearer requests bypass |
| Admin DoS | Non-admin requests trigger admin-page Prisma calls before being rejected | Mitigated — edge middleware rejects before render |
| Bearer-key abuse via `/api/me/*` | A leaked admin key could forge contributor authorship | Mitigated — `requireContributor` rejects any `Authorization` header |
| Bearer-key leak via logs | API key embedded in stderr / response | Mitigated — env-only; full project audit performed; `URL.origin` strips basic-auth credentials before logging in MCP |
| 5xx upstream message leak via MCP | API error `error` field could contain paths/stack traces | Mitigated — `toMcpError` returns generic `"upstream error (HTTP <status>)"`; original logged to stderr only |
| Path-segment escape via `get_problem(slug=".")` | URL normalization could hit a sibling endpoint | Mitigated — slug validated against `SlugSchema` in MCP (PR #18 followup) |
| Rate abuse on submissions / reports | Unbounded per-user write traffic | Partially mitigated — per-user submission rate limit + anonymous report rate limit; admin-API keys not yet rate-limited |

### 11.2 Hardening shipped (chronological)

| PR | What |
|---|---|
| #11 | Critical/high security pass: removed `expectedOutput`/`solutionSql` from public listings; removed `allowDangerousEmailAccountLinking` from GitHub provider; CSRF Origin gate on `/api/admin/*`; security headers in `next.config.ts` |
| #12 | Medium followups: API key default 90-day expiry, capped at 365; per-user submission rate limit; anonymous report rate limit; slug guards |
| #17 | Edge middleware gating; signIn auto-link guard; explicit malformed-Authorization-header rejection |
| #18 (followups) | Slug validation in MCP `get_problem`; localhost-only `http://`; basic-auth strip in MCP startup log; 5xx upstream message masking; Prisma-free contract documented at top of `lib/admin-validation.ts` |
| Audit | Full project grep for `console.*` + key/Bearer references — only the e2e harness leaked partial key data; CodeQL caught it; fixed |

### 11.3 Pending hardening (deferred, not blocking)

- **Collapse 401/403/revoked/expired key messages** into one generic — touches `lib/api-auth.ts` which serves all admin API callers, so it's its own follow-up PR (cited as I-2 in the MCP audit).
- **Lint / CI rule enforcing `lib/admin-validation.ts` stays Prisma-free** — currently a top-of-file comment + manual review (cited as I-3).
- **API key scopes** — currently full-admin. Roadmap calls for read-only and write-only variants.

---

## 13. Environment & Configuration

### Required env vars

```bash
# Database
DATABASE_URL=postgresql://user:pass@host:5432/datalearn       # runtime (pooled in prod)
DIRECT_URL=postgresql://user:pass@host:5432/datalearn         # used by `prisma migrate deploy` only

# NextAuth
NEXTAUTH_URL=https://datalearn.app                            # or http://localhost:3000 in dev
AUTH_SECRET=<openssl rand -base64 32>
AUTH_TRUST_HOST=true                                          # required for Auth.js v5 on custom hosts (CI uses this)

# OAuth
AUTH_GITHUB_ID=...
AUTH_GITHUB_SECRET=...
AUTH_GOOGLE_ID=...
AUTH_GOOGLE_SECRET=...

# API key hashing — server-side secret for HMAC-SHA-256 in lib/api-auth.ts.
# Required at runtime. Generate with `openssl rand -base64 32`. Rotating
# this invalidates every existing API key, so set once and keep stable.
API_KEY_HASH_SECRET=<openssl rand -base64 32>
```

### MCP server env vars (set by the MCP client, not the platform)

```bash
DATALEARN_API_KEY=dl_live_...                                 # Bearer key from /admin/api-keys
DATALEARN_BASE_URL=https://datalearn.app                      # or http://localhost:3000
```

### Prisma config

`prisma.config.ts` uses `import "dotenv/config"` so seed scripts and migrations pick up `DATABASE_URL` automatically. Local dev uses Postgres trust auth as user `anchitgupta`.

### Build

```bash
npm run dev                  # next dev (Turbopack — fine for dev)
npm run build                # next build --webpack — DO NOT drop --webpack
                             # Turbopack hits 'entered unreachable code' in chunk_group.rs on this code
                             # shape in Next 16.1.1; revisit when upstream fixes it.
npm run start
```

### Vercel deploy

`vercel-build` script runs `prisma migrate deploy && next build --webpack` so migrations land before each deploy. After the first deploy, seed once with `DATABASE_URL="<direct-url>" npx tsx prisma/seed.ts`.

---

## 14. Future Architecture Considerations

### 14.1 Multi-dialect SQL (MySQL / Postgres / Hive)

Two paths, in increasing order of complexity:

1. **PGlite** (Postgres compiled to WASM, same browser-side architecture as DuckDB) — drop-in for any problem that needs Postgres-specific syntax. Workspace plumbing (`lib/duckdb.ts`, `use-problem-db.ts`) gets a sibling module; the rest of the stack is unchanged. Zero infrastructure change.
2. **Server-side ephemeral Postgres** — Neon's branch-per-submission API spins up copy-on-write database clones in milliseconds. Run user SQL against a branch, drop it. Strategically, this is why **Neon is the recommended provider over Supabase** even though we currently only use it as a metadata DB — branching is the unlock for this architecture.

### 14.2 MCP server v2

- Article-authoring tools (`create_article`, `submit_article`, `approve_article`).
- `update_problem`, `archive_problem`, `publish_problem` (currently UI-only).
- `validate_problem` pre-flight that runs `solutionSql` against `schemaInline` and surfaces row mismatches before persistence.
- HTTP/SSE remote MCP transport so the server can run as a Vercel route and not require a local install.
- Extract `mcp-server/` to its own npm package (`@datalearn/mcp`).

### 14.3 Profile schema work (deferred)

The placeholder cards on `/profile` (Contests / Languages-DBs / Work / Education / Resume / Links) ship today as sized placeholders so the layout doesn't shift later. Wiring them up requires:

- New models: `WorkExperience`, `Education`, `UserLink`, `ResumeUpload` (file storage decision).
- New User fields: `bio`, `location`.
- A profile-edit surface (only the user themselves can edit).
- Visibility toggle (public profile vs private).

### 14.4 Real-time collaboration

Originally scoped for "Phase 3" of the older roadmap. Not started. If/when it lands, the natural place is a Y.js / WebRTC layer over the existing `ProblemClient` state, with NextAuth providing presence identity. Out of scope for current work.

---

## 15. Known Technical Debt

### Resolved (since v1.0 of this doc, 2026-02-16)

- ~~No tests~~ — Playwright E2E (~41 tests) gating CI; node:test for pure helpers; vitest for MCP server (40 cases).
- ~~No input validation~~ — Zod validators throughout (`lib/admin-validation.ts`).
- ~~No CSRF~~ — Origin gate on session path; Bearer is auth-bound; security headers in `next.config.ts`.
- ~~No rate limiting~~ — Per-user submission rate limit; anonymous report rate limit.
- ~~Hardcoded admin email ADMIN-promoted in seed~~ — Seed now creates the admin email at role=USER with non-destructive update.
- ~~`@ts-ignore` for NextAuth role~~ — Augmentation in `types/next-auth.d.ts`.
- ~~No error handling on RSC failures~~ — `actions/profile.ts`, `getUserStats`, etc. all return `null` on DB blip and pages render fall-back UI.

### Open

| Item | Severity | Notes |
|---|---|---|
| Webpack-pinned build | Low | Turbopack panics on this code shape in Next 16.1.1. Revisit when upstream ships a fix. |
| Auth message oracle (invalid / revoked / expired) | Medium | Documented as deferred follow-up (§11.3). Touches a shared lib so it's its own PR. |
| No lint enforcement of Prisma-free `lib/admin-validation.ts` | Low | Top-of-file comment + manual review; ESLint `no-restricted-imports` rule planned. |
| API key scopes | Medium | All keys are full-admin. Roadmap item: read-only / write-only / problems-only / articles-only scopes. |
| Profile placeholder sections lack schema | Low | `WorkExperience`, `Education`, `UserLink`, `ResumeUpload` — deferred (§13.3). |
| MCP server v2 (articles, updates, HTTP transport) | Medium | Out of v1 scope; tracked in `ROADMAP.md`. |
| MCP server has no published npm package | Low | Local install only. Extraction deferred until external collaborators need it. |
| Schema parser falls back to DuckDB on any unrecognized shape | Low | If admins author a multi-row INSERT, the page works but loses the first-paint UX win. Documented in CLAUDE.md. |

---

## Document conventions

- Section numbers are stable across versions; new content is added under existing sections rather than renumbering.
- Each subsystem section follows the same skeleton: **Why → Architecture → Implementation → Verification / Limits**.
- Citations to PRs use the `#NN` form; spec/plan files live under `docs/superpowers/specs/` and `docs/superpowers/plans/`.
- Keep this document **accurate**, not historical. Move history to `ROADMAP.md`'s "Recently shipped" sections.
