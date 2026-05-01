# 🚀 Antigravity Data Learning Platform — Long-Term Roadmap

> **Last updated:** 2026-04-26
> **Status:** Active Development
> **Version:** 0.1.0 (Beta)

## Recently shipped (April 2026)

- **Learn CMS v1** — admin/contributor article authoring with approval queue, cross-linking from `/learn` and `/practice`, reading-time recompute on save, TOC and prev/next.
- **CONTRIBUTOR role** — role-grant UI in `/admin/contributors`, `/me/articles` authoring surface for contributors gated by admin approval.
- **Admin security hardening** — edge middleware gating `/admin/*` and `/api/admin/*`, NextAuth signIn guard against pre-seeded-admin auto-link takeover, malformed-Authorization-header rejection, full E2E coverage.
- **MCP server v1** — stdio Model Context Protocol server in `mcp-server/`. 9 tools (`list_topics`, `create_topic`, `list_tags`, `create_tag`, `list_schemas`, `create_schema`, `list_problems`, `get_problem`, `create_problem`) for Claude Desktop / Cursor / any MCP-aware client. Forced DRAFT on `create_problem` so AI-authored content always passes through human review.
- **Problem-page first-paint UX** — pure-function schema parser (`lib/schema-parser.ts`) pre-computes column types + INPUT sample rows server-side from `SqlSchema.sql`, so the Schema panel and INPUT example tables render immediately instead of waiting on DuckDB-WASM init (~200 ms cached, 1–3 s on first visit). Falls back to DuckDB introspection for schemas the parser doesn't recognize. SqlPlayground also renders the editor immediately and gates only Run/Submit on `dbReady` so users can start typing right away.

---

## Vision Statement

Build the **go-to open platform** for data engineering education — combining interactive SQL challenges, curated learning content, live collaboration tools, and system design practice into a single, beautifully designed experience. Zero setup required.

---

## Current State Summary

| Area | Status | Notes |
|------|--------|-------|
| Authentication (GitHub / Google) | ✅ Done | NextAuth 5 beta with Prisma adapter |
| Learning Hub (Topics → Articles) | ✅ Done | Markdown rendering with syntax highlighting |
| SQL Question Bank | ✅ Done | 3 seeded problems (Easy / Medium / Hard) |
| SQL Playground (DuckDB-WASM) | ✅ Done | Monaco Editor + browser-side execution |
| Admin Panel (Page CRUD) | ✅ Done | Basic page creation, stats cards |
| Dynamic Navigation (DB-driven) | ✅ Done | Navbar fetches pages from DB |
| News Aggregator (RSS) | ✅ Done | Data Engineering Weekly feed |
| User Profile Page | ✅ Done | Shows session data |
| Testing | ❌ None | No tests exist yet |
| CI/CD | ❌ None | No GitHub Actions or deployment pipeline |

---

## Phase Roadmap

### 🟩 Phase 1 — Content Core (MVP) `CURRENT — 90% Complete`

**Goal:** Establish the learning repository and user access.

| Task | Status | Priority |
|------|--------|----------|
| Auth (GitHub + Google OAuth) | ✅ Done | P0 |
| User profile management | ✅ Done | P0 |
| Blog / Learning Hub (Topic-wise) | ✅ Done | P0 |
| Markdown rendering with code snippets | ✅ Done | P0 |
| SQL Question Bank (list + detail views) | ✅ Done | P0 |
| Admin Panel v1 (CRUD for pages) | ✅ Done | P1 |
| **Admin Panel: CRUD for Topics** | ⬜ Todo | P1 |
| **Admin Panel: CRUD for Articles** | ⬜ Todo | P1 |
| **Admin Panel: CRUD for SQL Problems** | ⬜ Todo | P1 |
| **Progress tracking (saved articles, solved problems)** | ⬜ Todo | P2 |
| **UI/UX polish — design system, dark mode** | ⬜ Todo | P2 |
| **Seed more Topics & Articles** | ⬜ Todo | P2 |

---

### 🟨 Phase 2 — Interactive Engine `IN PROGRESS — 40% Complete`

**Goal:** Enable users to run code and test skills interactively.

| Task | Status | Priority |
|------|--------|----------|
| Browser SQL Engine (DuckDB-WASM) | ✅ Done | P0 |
| Monaco Editor integration | ✅ Done | P0 |
| News Aggregator (RSS feed) | ✅ Done | P1 |
| Dynamic Navigation from Admin | ✅ Done | P1 |
| **Query validation — compare against expected output** | ⬜ Todo | P0 |
| **Multiple RSS feed sources (admin-managed)** | ⬜ Todo | P1 |
| **Hint system for SQL problems** | ⬜ Todo | P2 |
| **Solution reveal / editorial** | ⬜ Todo | P2 |
| **Execution history / save user queries** | ⬜ Todo | P2 |
| **Python code playground (Pyodide)** | ⬜ Todo | P3 |
| **Admin Panel v2: News source management** | ⬜ Todo | P2 |

---

### 🟥 Phase 3 — Collaboration & Community `NOT STARTED`

**Goal:** Real-time features for interview prep and system design.

| Task | Status | Priority |
|------|--------|----------|
| **Interview Prep: Peer-to-peer coding** | ⬜ Todo | P1 |
| **Shared code editor (WebSocket/Socket.io)** | ⬜ Todo | P1 |
| **System Design Whiteboard (Excalidraw-based)** | ⬜ Todo | P1 |
| **Real-time cursor & presence** | ⬜ Todo | P2 |
| **Room creation & management** | ⬜ Todo | P1 |
| **Component library for system design** | ⬜ Todo | P2 |

---

### 🟦 Phase 4 — Platform Maturity `PLANNED`

**Goal:** Production readiness, community features, and analytics.

| Task | Status | Priority |
|------|--------|----------|
| **Testing suite (unit + integration + E2E)** | ⬜ Todo | P0 |
| **CI/CD pipeline (GitHub Actions)** | ⬜ Todo | P0 |
| **Vercel deployment with preview environments** | ⬜ Todo | P0 |
| **User analytics dashboard (admin)** | ⬜ Todo | P1 |
| **Content moderation tools** | ⬜ Todo | P2 |
| **Leaderboard / gamification** | ⬜ Todo | P3 |
| **Community forums / discussions** | ⬜ Todo | P3 |
| **SEO optimization** | ⬜ Todo | P1 |
| **Performance monitoring (Sentry/Vercel Analytics)** | ⬜ Todo | P2 |
| **Accessibility audit (WCAG 2.1 AA)** | ⬜ Todo | P2 |
| **Mobile responsiveness audit** | ⬜ Todo | P1 |

---

### 🟪 MCP server roadmap

| Task | Status | Notes |
|------|--------|-------|
| **MCP v1: problem authoring tools** | ✅ Done | 9 tools, stdio transport, forced DRAFT on writes. |
| **MCP v2: article authoring tools** | ⬜ Todo | `create_article`, `submit_article`, plus update flows. |
| **MCP v2: problem update / archive / publish** | ⬜ Todo | Currently editable only via admin UI after the AI lands a DRAFT. |
| **MCP v2: `validate_problem` pre-flight** | ⬜ Todo | Run `solutionSql` against `schemaInline` and surface mismatches before persistence. |
| **MCP: HTTP / remote transport** | ⬜ Todo | Today's stdio transport requires local install. Hosted SSE/HTTP MCP would let it run as a Vercel route. |
| **MCP: extract to npm package** | ⬜ Todo | When external collaborators need it. Currently a sibling project in this repo. |

---

## 🌌 Vision items (long-term, scoped but undated)

Major platform expansions that take Data Learn from "SQL practice + learning hub" to a full data-engineering career platform. Each is large enough to be its own phase. Listed in roughly the order they make sense to pursue, but the order is negotiable based on user signal.

### V1 — Discuss (community forum)

**What:** Reddit-style discussion surface inside the platform. Categories: `For You` (personalized), `Career`, `Contest`, `Compensation`, `Feedback`, `Interview`. Posts support upvotes, view counts, comment threads with their own upvotes, markdown body, code blocks, problem-link embeds.

**Why:** Community is the long-term moat. LeetCode's "Discuss" tab is where the actual learning compounds — problem-specific tips, interview experiences, comp data points. Without it, Data Learn is a content-consumption surface; with it, users have a reason to come back daily.

**Components:**
- Schema: `Post`, `Comment`, `PostVote`, `CommentVote`, `PostView`; categories as an enum or `Category` table; M:N to `Tag`.
- Listing surfaces: per-category feeds, hot/new/top sort, search.
- Anti-spam: rate limits per user (already have the primitive); shadow-banning; report flow (reuse the `ProblemReport` pattern).
- Notifications: replies to your post / comment, mentions.
- Moderation: admin tooling to lock/unlock, pin, remove.

**Dependencies:** None blocking; can be greenfield. Probably wants the existing CONTRIBUTOR/ADMIN role split extended with a `MODERATOR` tier. Would benefit from email notifications (current platform has none).

**Scope estimate:** Medium-large. Schema + REST + UI for posting/listing/voting is the v1 floor. Search and notifications are v2 of this section.

### V2 — Contest

**What:** Weekly + monthly timed contests with multiple problems, a leaderboard, and a **mathematically-backed rating system** that updates each user's rating after every contest. Rating shown on the profile page (the placeholder card already exists).

**Why:** Contests turn the platform into a sport. They give users a reason to be present at a specific time, create cohort rivalries, and seed the Discuss > Contest category with post-mortems.

**Components:**
- **Rating system: Glicko-2** (more responsive than ELO, used by chess.com and Codeforces; well-documented). Per-user state: `rating`, `ratingDeviation`, `volatility`, `lastContestAt`. Update happens server-side in a transactional batch when a contest closes.
- **Contest model:** `Contest`, `ContestProblem` (M:N with offset/score), `ContestSubmission`, `ContestLeaderboard` (materialized).
- **Problem locking:** problems used in a contest must not appear in the public `/practice` list while the contest is live; surface them only inside the contest UI. Existing status state machine extends with `CONTEST_LOCKED`.
- **Live leaderboard:** server-rendered with progressive enhancement; refreshes on a tick, not real-time pushed (avoid websockets on v1).
- **Anti-cheat baselines:** rate limits per user during contest, IP fingerprint logging, identical-solution detection (cosine similarity on tokenized SQL), public submissions only revealed *after* contest ends.
- **Profile integration:** rating + ratingDeviation pill on the existing `Contests` placeholder card; contest history list with score + rank + delta per contest.

**Dependencies:** Discuss helps for post-contest discussion but isn't a blocker. Would benefit from email notifications ("Your weekly contest starts in 1 hour").

**Scope estimate:** Large. Rating math + contest runtime + UI. Plan a 4–6 PR sequence.

### V3 — Custom badges (animated, shareable)

**What:** Achievement badges users earn for milestones. **Animated** (subtle SVG/Lottie loops), with a "shining" treatment for rare badges. Each badge has a public share page with OG image generation so it renders nicely when posted to LinkedIn / Twitter / Discord.

**Why:** Badges are cheap motivation. The shareability piece is the actual growth lever — a user posting "I just earned the SQL Aggregation Pro badge on Data Learn" pulls in friends.

**Components:**
- Schema: `Badge` (slug, name, description, rarity, animation_url), `UserBadge` (userId, badgeId, earnedAt). Rarity tiers determine the visual treatment.
- Earning rules: declarative `BadgeRule` table or hardcoded predicates evaluated in a server action after each submission. Examples: 10 Easy solved, 5-day streak, first contest, top 100 in any contest, 100% acceptance on a topic, first published article (CONTRIBUTOR).
- Animation: prefer SVG (scalable, no Lottie runtime cost) with subtle CSS keyframes. The "shining" treatment is a moving gradient overlay — keep it tasteful, respect `prefers-reduced-motion`.
- Share surface: `/badges/[slug]/[user-handle]` public page with OG image (`@vercel/og`). Embed in profile sidebar.
- Profile placeholder card already exists; this fills it in.

**Dependencies:** None. Can be greenfield. Some badges become more meaningful after Contests ship.

**Scope estimate:** Medium. Schema + a handful of rule predicates + share-page rendering.

### V4 — Interview prep

**What:** A new top-level surface (`/interview`) bundling four pieces:

1. **Resume builder** — opinionated templates for data engineers; in-browser editor; PDF export. Sections pre-wired for the data-eng story (Roles → Projects → Skills → Education).
2. **Resume rater** — paste/upload resume, get an AI critique with section-level scores (impact, clarity, keyword density, ATS-friendliness) and concrete rewrite suggestions. Model call sits behind a server action; rate-limit per user.
3. **System design for data engineers** — curated set of system-design problems specific to the data domain (build a data lake, design an analytics platform, partition a 100B-row table, choose between Kafka and Kinesis). Each problem ships with reference solutions + multiple valid approaches + tradeoff discussions.
4. **Live interview platform** — built-in collaborative whiteboard (Excalidraw/draw.io-style) and a synced SQL editor where interviewer + candidate share the same session. Real-time, presence-aware. Use case: practice mock interviews; eventually serve as a tool companies could use to actually conduct interviews on.

**Why:** This is what turns Data Learn into a career platform. Discuss gives users a reason to come back daily; Interview Prep gives them a reason to pay (see V6 below). It's also the natural intersection of everything else: SQL practice + system design + community + content.

**Components:**
- Resume builder: schema for resume sections, templates as React components, PDF export via Puppeteer or `react-pdf`.
- Resume rater: model integration (OpenAI / Anthropic / local), prompt engineering, structured output (Zod schema for the score breakdown), rate limit + abuse prevention. Model cost = ~$0.05/resume; needs a freemium gate.
- System design: content-only at first (markdown articles), grows into an interactive canvas later.
- Live interview platform: hardest piece — needs realtime infra (Y.js + WebSocket or LiveKit data channels), RBAC (interviewer vs candidate roles for the session), persistence (replay finished sessions). Whiteboard: integrate Excalidraw as a library or build over `tldraw`. Synced SQL editor reuses our existing playground but in a multi-cursor mode.

**Dependencies:** Resume builder + rater can ship independently. System design content piggybacks on the existing Learn CMS. Live interview needs realtime infra (not in the stack today).

**Scope estimate:** XL. Plan as 4 separate sub-phases (one per piece). Live interview is its own multi-month project.

### V5 — Multi-language: data + Python

**What:** Expand beyond SQL to Python (pandas / pyspark) and eventually general data tooling. Each problem can specify accepted languages; the workspace adapts.

**Why:** "Data engineering" is bigger than SQL. Pandas + PySpark are the obvious next steps; their problem sets overlap heavily with SQL (joins, aggregations, window functions) but with different syntax and gotchas.

**Components:**
- **Pyodide** for in-browser Python (parallel architecture to DuckDB-WASM). Pandas works out of the box; PySpark needs a server-side runner.
- Server-side execution path for runtimes that can't run in the browser (Spark, Hive). Neon-branching pattern from the existing Postgres roadmap (§13.1 in TECHNICAL_DESIGN.md) generalizes here.
- Validator extension: tabular-output comparison stays the same; add support for non-tabular outputs (single value, plot, JSON blob).
- UI: language picker on the workspace toolbar; language-aware Monaco modes; per-language hint sets.

**Dependencies:** Some refactor of the workspace to be language-aware (currently DuckDB-coupled). The schema parser and validator generalize naturally.

**Scope estimate:** Large. Pyodide is the easiest first step; PySpark on the server is the heavy one.

### V6 — Plans & monetization

**What:** Tiered pricing on top of the platform. Tentative shape:

- **Free** — Public problem library, public articles, sign-in, profile, MCP self-serve. Effectively today's product.
- **Pro** — Premium problem packs (FAANG-curated, advanced topics), Resume Rater (V4), full Interview Prep (V4), private contests, no rate limits on AI tooling.
- **Teams** — Shared problem libraries, hiring portal (use Live Interview to actually interview candidates), org-level analytics on team practice.

**Why:** Sustainability. Hosting + Anthropic/OpenAI API costs scale with usage; free-forever doesn't. Monetization also unlocks investing in V4 (Resume Rater + Live Interview both have real per-use cost).

**Components:**
- **Stripe integration** for subscription management. Webhook handlers for plan changes.
- **Plan gate primitive** — a `requirePlan('PRO')` helper layered on `requireAdmin`/`requireContributor`. Server-side; never trust client. Plan stored on `User.plan`.
- **Premium content marker** — `Article.plan` and `SQLProblem.plan` columns; surfaces lock with a "Pro" pill on free tier.
- **Billing UI** — `/billing` surface with current plan, payment method, invoice history. Stripe Customer Portal embed for the messy parts.
- **Free tier preservation** — monetization should make Pro better, not Free worse. Existing problems and articles stay free forever.

**Dependencies:** V4 (Resume Rater + Live Interview) is the core Pro value prop; without it, Pro is too thin. So sequence: ship V4 → ship V6.

**Scope estimate:** Medium for the Stripe integration + plan gates; the hard part is figuring out what's actually worth charging for.

---

## Quarterly Goals (2026)

### Q1 2026 (Jan–Mar)
- ✅ Project bootstrapped, Phase 1 MVP implemented
- 🔲 Complete Phase 1 remaining (Admin CRUD, progress tracking)
- 🔲 Query validation for SQL playground
- 🔲 Testing infrastructure + CI/CD
- 🔲 Deploy to Vercel (production)

### Q2 2026 (Apr–Jun)
- 🔲 Complete Phase 2 (hints, solutions, multi-feed news)
- 🔲 UI/UX overhaul — design system, animations, dark mode
- 🔲 Begin Phase 3 — real-time collaboration (Socket.io)
- 🔲 Seed 50+ SQL problems across 5 difficulty tiers

### Q3 2026 (Jul–Sep)
- 🔲 Complete Phase 3 — system design whiteboard
- 🔲 Python playground (Pyodide)
- 🔲 User analytics + content moderation

### Q4 2026 (Oct–Dec)
- 🔲 Phase 4 — production maturity
- 🔲 Leaderboard, gamification, community features
- 🔲 Performance, SEO, accessibility audits

---

## Tech Stack Evolution

| Layer | Current | Planned Evolution |
|-------|---------|-------------------|
| Framework | Next.js 16 (App Router) | Stay current with Next.js releases |
| Styling | Tailwind CSS 4 | Add design system (CSS variables + components) |
| Database | PostgreSQL + Prisma 7 | Add Redis for sessions/caching |
| SQL Engine | DuckDB-WASM (client-side) | Consider server-side PostgreSQL sandbox |
| Auth | NextAuth 5 beta | Upgrade to stable release when available |
| Real-time | — | Socket.io / Liveblocks / PartyKit |
| Whiteboard | — | Excalidraw or tldraw |
| Python | — | Pyodide (WASM) |
| Testing | — | Vitest + Playwright |
| CI/CD | — | GitHub Actions |
| Hosting | — | Vercel (frontend) + Railway/Supabase (DB) |

---

## Key Metrics to Track

1. **Content volume:** Number of topics, articles, SQL problems
2. **User engagement:** Active users, problems solved, articles read
3. **Platform quality:** Test coverage, build time, Lighthouse score
4. **SEO:** Organic traffic, Core Web Vitals
5. **Collaboration:** Rooms created, collaborative sessions count
