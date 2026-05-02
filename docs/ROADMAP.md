# 🚀 Antigravity Data Learning Platform — Long-Term Roadmap

> **Last updated:** 2026-05-02
> **Status:** Live — <https://www.learndatanow.com>
> **Version:** 0.4.0 (deployed)

## Recently shipped

### May 2026 — release flow + v0.4.0 (auth revamp + design system)

- **Release flow established** — two-branch model: `main` is integration (Preview deploys), `production` is live (auto-deploy to Vercel). Release PR is the explicit gate: `main → production` titled `release: vX.Y.Z`, merged + tagged. Documented in `.github/CONTRIBUTING.md` (PR #53). GitHub default branch later switched to `production` (PR #58) so the "Compare & pull request" banner stops firing after every release; **trade-off**: `gh pr create` now defaults to `base: production`, so feature PRs require explicit `--base main`.
- **v0.4.0 deployed** (PR #57, tag `v0.4.0`) — first release under the new flow. Promoted everything baking on `main` since v0.3.0:
  - **Auth flow revamp** (PR #54). Custom Data Learn sign-in page replacing default Auth.js screens. In-app sign-in dialog used by all gated surfaces. Provider buttons go through Auth.js v5 `signIn` POST/CSRF flow. Sign-out redirects home cleanly. Hardened E2E: `tests/e2e/login.spec.ts`, middleware-and-link-guard, security.
  - **Design-system foundations** (PR #55). Imported handoff bundle from claude.ai/design to `docs/design-system/` (brand voice, palette, typography, iconography spec + `ui_kits/web/` JSX reference for every screen). Shadow tokens (`--shadow-xs/sm/md/lg/xl/-primary`) added to `app/globals.css` for both themes. Staff badge on Admin in UserMenu. Submissions menu item with `/profile#submissions` deep-link. Footer mentions both engines (DuckDB-WASM + PGlite). Footer GitHub link → Privacy + Terms (placeholders — replace before public launch). Skip-to-main-content link for keyboard users (a11y §1).
  - **MCP authoring write tools** (PR #56). `update_problem` and `update_schema` MCP tools — assistants can now PATCH existing content, not just create new. Backed by new `app/api/admin/schemas/[id]/route.ts`.

### May 2026 — first prod deploy, V7 / V8 / Daily / Postgres engine

- **First production deploy** — Vercel + Neon at <https://datalearn-iota.vercel.app>. Auto-deploys from `main`; per-PR preview URLs hit the dev DB. `prisma migrate deploy` runs on every Vercel build so schema is always in sync with the code that's about to serve traffic. Health endpoint at `/api/health` pings the DB. Repo plumbing for first-time setup landed in PR #51 (`.env.example`, `prisma.config.ts` `DIRECT_URL` fallback, `scripts/bootstrap-admin.mjs`, `app/api/health/route.ts`, `docs/DEPLOY.md`).
- **Postgres engine alongside DuckDB-WASM** (PR #49). PGlite (real Postgres compiled to WASM) loads in-browser when the learner picks Postgres. Per-problem `dialects: Dialect[]` (default `[DUCKDB, POSTGRES]`); workspace shows a single-pill toggle in the editor header that flips engines on click. Schema parser, admin form, and MCP `list_problems` projection are all dialect-aware. Seed schemas standardized on portable `DOUBLE PRECISION`.
- **V7 — Stable problem numbers** (PR #43). `SQLProblem.number Int @unique`, minted as `MAX(number)+1` inside the existing create transaction, backfilled by `createdAt ASC`, never recycled. Surfaces the `#NNN.` prefix on the practice list, workspace header, UserHome cards, and `/profile` recents. `/practice/<n>` numeric URL redirects to the canonical slug. MCP `list_problems` projection includes `number`. Public `/practice` now sorts by `number ASC` to match the LeetCode reading order.
- **V8 — Custom problem lists** (PR #44). LeetCode-style "My Lists" — `ProblemList` + `ProblemListItem` with composite-PK dedupe and `position` column for reorder. Caps: 100 lists/user, 1000 items/list (pagination not needed in v1). Surfaces: `/me/lists` index, `/me/lists/[id]` detail with rename, delete, drag-and-drop reorder, sort menu (manual / recently added / recently solved / unsolved first / number), and per-row "Added X · Solved Y" / "Not solved" metadata. AddToListButton popover on the workspace header for one-click bookmarking. Last-solved info comes from a single indexed `Submission(userId, status)` groupBy — cheap even at the 1000-item cap.
- **Daily Problem v1** (PR #46). One stable UTC daily problem with auto-fill fallback and admin manual override. `/daily` resolves today and redirects to the normal practice workspace. Signed-in home, UserMenu, and mobile nav surface the daily entry point and solved-today state. Uses normal `Submission` rows, so the existing activity streak remains the only streak.
- **Repository governance baseline** (PR #28 + Phase B `gh api`). GitHub Flow + squash-only merges, branch protection on `main`. Later relaxed in solo phase: required-checks gate dropped (PR #48 — GitHub mergeable-state bug for solo no-reviewer repos), all three merge methods re-enabled (PR #50). Re-tighten when contributor #2 lands; CONTRIBUTING has the exact `gh api` one-liners.

### April 2026 — v0.1.0 foundation

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

### ✅ V7 — Stable problem numbers (`#247. Group Anagrams`) — SHIPPED v0.1.2 (PR #43)

**What:** Monotonic `SQLProblem.number Int @unique`, minted at create-time as `MAX(number)+1` inside the existing transaction. Backfilled on existing rows by `createdAt ASC`. Never recycled.

**Surfaces shipped:** `#NNN.` prefix on PracticeList rows, workspace ProblemPanel header, UserHome Continue/Recommended/Recent cards, `/profile` recent activity, admin `/admin/problems` table. `/practice/<n>` numeric URL redirects to canonical slug. MCP `list_problems` projection adds `number`. Public `/practice` sorts by `number ASC`.

**MCP-side:** `list_problems` minimal projection now includes `number`, README updated, e2e harness asserts a positive integer is minted on `create_problem`.

### ✅ V8 — Custom problem lists (private to user) — SHIPPED v0.1.2 (PR #44)

**What:** LeetCode-style "My Lists" — private named collections. Owner-only in v1; public sharing is a v2 of this section.

**Schema shipped:**
- `ProblemList { id, ownerId, name, description?, createdAt, updatedAt }`
- `ProblemListItem { listId, problemId, position, addedAt }` — composite PK `(listId, problemId)` so a problem can't appear twice in one list

**Caps (no pagination in v1):** 100 lists per user, 1000 items per list.

**Surfaces shipped:**
- `/me/lists` — index of the user's lists with item count + last-touched
- `/me/lists/[id]` — detail with rename, delete, drag-and-drop reorder, up/down arrows on mobile, per-row remove
- Sort menu — Manual (default, draggable) / Recently added / Recently solved / Unsolved first / Problem number. Sorting is a view option; never mutates stored position.
- Per-row metadata: solved indicator (green check / outline circle), "Added X · Solved Y / Not solved" timestamps. Last-solved comes from a single indexed `Submission(userId, status)` groupBy.
- `AddToListButton` popover on the workspace header — toggles list membership and lets you create a new list inline
- "My lists" entry in the UserMenu dropdown

**Server actions** in `actions/lists.ts`: create / rename / delete list, add / remove (idempotent on duplicate; mints `position = MAX+1`), reorder (single transaction restamps positions), getMyLists / getList (with lastSolvedAt) / getListIdsContainingProblem.

**Deferred to v2:** public sharing (slug + visibility), MCP integration (`list_my_lists`, `add_to_list`, `remove_from_list`) once the MCP path opens up beyond admin.

### ✅ Daily Problem v1 — SHIPPED v0.1.2 (PR #46)

**What:** One stable daily SQL challenge for each UTC calendar date. Admins can schedule a specific published problem, and the platform auto-fills a missing day so `/daily` always works when published problems exist.

**Surfaces shipped:** `/daily` redirects to the normal `/practice/[slug]` workspace, signed-in UserHome has a compact Daily Problem card, UserMenu and mobile nav link to `/daily`, and `/admin/daily` lets admins set or replace the daily problem.

**Streak behavior:** No separate daily streak in v1. Daily submissions write normal `Submission` rows, so the existing activity streak remains the only streak.

**Coverage shipped:** Pure UTC/selection helper tests plus Playwright E2E for auto-fill redirect, admin manual override, and solved-today state.

### V9 — Study plans / tracks

**What:** Curated multi-problem learning paths that the platform itself authors (and possibly contributors via the existing CONTRIBUTOR role). A track is an ordered sequence of problems + articles around a theme — "SQL aggregations from zero to ranking interview", "Window functions deep dive", "Joins for data engineers". Users opt in to a track and get progress, recommended-next, and an estimated completion time.

**Why:** Tags and topics describe what content *is*. Tracks describe a *path* — the problem sequence, the order of articles to read in between, the difficulty ramp. Without tracks, a new user faces a wall of 100+ problems and doesn't know where to start. With tracks, they have an opinionated guide.

**Components:**
- Schema: `Track { id, slug, name, description, difficulty, estimatedMinutes, createdAt }`, `TrackItem { trackId, kind: PROBLEM|ARTICLE, refId, position }`, `UserTrackProgress { userId, trackId, completedItemIds, currentItemId, startedAt, completedAt }`.
- Author surface: under the existing admin CMS — `/admin/tracks` to create + reorder items.
- Learner surface: `/learn/tracks` index with cover images and difficulty/length, `/learn/tracks/[slug]` detail showing the sequence + the user's progress, plus a sticky "Next item" affordance.
- Profile integration: the existing UserHome "Continue" card can promote the next item in an in-progress track ahead of the last individual problem.

**Dependencies:** Reuses Article + Problem; no new content models. Reuses `getUserStats` for some progress accounting.

**Scope estimate:** Medium. ~600 lines across the new admin and learn surfaces.

### V10 — Marketing & growth

**What:** A bundle of growth-side investments that the codebase mostly enables but doesn't yet pursue:

- **OG image generation** for every problem, article, badge, and contest result via `@vercel/og` so links to Data Learn render correctly when posted to LinkedIn / Twitter / Slack.
- **Social share buttons** on problems + articles + (eventually) earned badges (V3) and contest results (V2).
- **Public profile pages** at `/u/[handle]` that serve as a portable "data engineering portfolio" — problems solved, articles authored, badges earned, contest rating. SEO-indexed.
- **Newsletter** — "What's new on Data Learn this month" — shipped from a server action against the `Submission` / `Article` / `Contest` tables, sent via Resend or similar.
- **Content distribution channels** — cross-post curated articles to dev.to, Medium, Hashnode (manual at first; an admin tool later). RSS feed already exists.
- **Referral program** — explicit invite codes that grant the inviter a small Pro perk (V6) when invitees subscribe.

**Why:** Product-led growth needs growth surfaces. The platform is content-rich; if users can't easily share what they've made or solved, the network never starts.

**Components:** Mostly per-feature; each item above is small individually but the bundle is meaningful.

**Dependencies:** Public profile pages benefit from V3 Badges (visual richness) and V2 Contest (ratings to display). Newsletter benefits from cross-feature data — ship after at least V1 and V2 land.

**Scope estimate:** Medium overall, but spread across many small wins.

### V11 — Internal analytics portal

**What:** Admin-facing analytics surface (`/admin/analytics`) covering platform health and content performance. Distinct from the per-user `/profile` stats: this is for operators, not learners.

**Why:** We're flying blind today — there's no view of "which problem has the worst acceptance rate" or "which articles are read but not clicked through to practice" or "what fraction of users return weekly". Without analytics, every product decision is a guess.

**Components:**
- **Platform overview:** weekly active users, sign-ups, avg problems solved per active user, retention curves (D1 / D7 / D30), funnel from sign-up → first submission → first acceptance.
- **Content performance:** per-problem acceptance rate + abandonment rate (started but never submitted) + median time-to-accept; per-article views, time-on-page (estimated from reading-time vs return), click-through to linked problems.
- **Health:** error rates, slow queries, P95 page latencies (from existing Vercel Analytics integration if we expose them server-side).
- **Implementation note:** start with materialized views in Postgres updated on a daily cron; only graduate to a separate OLAP store (DuckDB locally / Athena / ClickHouse remotely) if the materialized views start straining the operational DB. Don't over-engineer v1.

**Dependencies:** None blocking. V2 Contest produces a lot of new analytics needs (rating distributions, contest participation curves) — those slot in here.

**Scope estimate:** Medium. The data exists; the visualization layer is the work.

### V12 — Support ticketing

**What:** A ticketing system inside the platform for general user support. Today we have `ProblemReport` for problem-specific reports — this generalizes to anything ("the editor froze", "I can't reset my draft", "billing question").

**Why:** As traffic grows, support routes through email or Twitter, both of which leak. A ticketing portal keeps issues attributable, traceable, and replyable inside the platform — and doubles as a feedback corpus for prioritization.

**Components:**
- Schema: `Ticket { id, userId, category, subject, body, status: OPEN|IN_PROGRESS|RESOLVED|CLOSED, priority, createdAt, resolvedAt }`, `TicketMessage { ticketId, authorId, body, isAdmin, createdAt }` for the conversation thread, `TicketAttachment` for file uploads (deferred — start text-only).
- User surface: `/support` to file new tickets + `/support/[id]` to view + reply to existing ones.
- Admin surface: `/admin/tickets` triage queue with filters by category / status / priority / assignee.
- Email pipeline: status-change emails ("your ticket has been resolved") via Resend; admin-side new-ticket pings.
- Reuse the existing rate-limit primitive for ticket creation.

**Dependencies:** None blocking. Benefits from V10 (newsletter infra includes the same Resend pipeline).

**Scope estimate:** Medium. ~500 lines + Prisma migrations.

### V13 — Virtual sessions (live & guest)

**What:** Platform-hosted live sessions. Two flavors:

1. **Free / community sessions** — community AMAs, "office hours with a senior data engineer", monthly contest debriefs.
2. **Paid / monetized sessions** — premium masterclasses (e.g., "Window Functions for Senior Interviews — 2-hour workshop with [Industry Guest]"), with bookings, capacity caps, and revenue split between platform and guest.

The session itself reuses **V4's live-interview platform** (collaborative whiteboard + synced SQL editor + presence) so two users in the same session see and interact with the same canvas. Guest hosts have elevated controls (mute attendees, raise-hand queue, share screen of the canvas).

**Why:** Live sessions are a strong retention loop and a meaningful source of revenue (V6) without commoditizing the existing free tier. They're also a recruiting funnel for guest experts who become content contributors.

**Components:**
- Schema: `Session { id, hostUserId, title, description, scheduledAt, durationMinutes, capacity, isPaid, priceCents?, status: SCHEDULED|LIVE|ENDED|CANCELLED, recordingUrl? }`, `SessionAttendee { sessionId, userId, role: HOST|COHOST|ATTENDEE, joinedAt, leftAt }`, `SessionPayment` for the paid case (Stripe charge id, amount, refunded).
- Surfaces: `/sessions` upcoming-sessions index (free + paid filter), `/sessions/[id]` detail + booking, `/sessions/[id]/live` the actual room (gated by attendee membership).
- Scheduling + reminders: emails 24h / 1h before via Resend.
- Recording: capture the canvas + audio (later phase; v1 can be live-only).
- Guest payout: at ship-time of v1, manual reconciliation against Stripe transfers; automate later.

**Dependencies:**
- **V4 live interview platform is the prerequisite** — the realtime canvas + synced editor + presence stack is what makes a session work. Without V4 this is just a calendar.
- V6 monetization for the paid case (Stripe + plan-gate primitive).
- V11 analytics for session-attendance signal.

**Scope estimate:** Large, mostly because it depends on V4 + V6 already existing. Once those are in, the Session-specific wiring is medium.

### V14 — AI hint system

**What:** When a learner is stuck on a problem, they can ask for progressive hints from a model. Three tiers: **nudge** (one-sentence direction without spoiling), **walkthrough** (the approach in plain English, no code), **solution** (the actual SQL with comments). Tiers unlock sequentially — you can't skip to "solution" on a first attempt — and each unlock is recorded so the validator/leaderboard can flag heavily-hinted submissions.

**Why:** The platform already has `solutionSql` (admin-only reference) and `expectedOutput` (correctness oracle). An AI layer between them turns a binary pass/fail into a real teaching loop: a learner who can't progress doesn't bounce — they get just enough scaffolding to keep going. This is the single most-aligned-with-mission feature on this list.

**Components:**
- **Prompt design:** the model sees `problem.description`, `schemaSql`, `expectedOutput`, learner's current draft, and the requested tier. System prompt enforces "do not reveal the full solution at the nudge tier".
- **Schema:** `HintRequest { id, userId, problemId, tier, createdAt, modelUsed }` — used for cost accounting + leaderboard flagging.
- **Cost guardrails:** per-user-per-day cap on hint requests; falls under V6 monetization (Pro = unlimited; Free = 5/day). Token budget per tier (nudge ≤ 200 output tokens, walkthrough ≤ 500, solution ≤ 1500).
- **Surface:** a "Stuck?" panel inside the workspace, expandable. Each tier renders progressively. Already-unlocked tiers persist per-problem-per-user.
- **Anti-gaming:** the existing `Submission.code` history makes it easy to flag "user requested solution-tier hint, then submitted a verbatim copy" — surface as a tone in profile (not a hard ban; it's a learning signal).

**Dependencies:** Benefits from V6 (rate limits / Pro gating), but a free-tier daily cap works without it.

**Scope estimate:** Medium. ~500 lines + a model integration + prompt tuning.

### V15 — Daily problem

**What:** One curated problem per day, surfaced in a sticky banner on the homepage, in the avatar dropdown, and via opt-in email. Solving the daily extends a separate **daily streak** (distinct from the activity streak in §10). Solving N consecutive dailies unlocks the corresponding "Daily Streak" badge (V3).

**Why:** A daily commitment is a known retention loop (LeetCode's Daily Challenge, Wordle, NYT Mini). It gives a casual user a reason to open the site every day without the activation cost of choosing what to solve. It also gives admins a curation surface — the daily can be tied to a topic to drive traffic to recently-published articles.

**Components:**
- Schema: `DailyProblem { date PK, problemId, theme?, articleId? }` — admins schedule the rotation in `/admin/daily`. Auto-fill from a "needs more eyes" rule if no manual schedule.
- Surfaces: homepage banner, avatar dropdown row, email digest opt-in.
- Profile placeholder: a daily-streak counter in the existing `ProfileSidebar`'s streak block.
- Email: same Resend pipeline as V12 / V10.

**Dependencies:** V3 Badges for the streak badges. None for v1 of the daily-problem mechanic itself.

**Scope estimate:** Small-medium. ~250 lines + a small admin surface.

### V16 — PWA / mobile experience

**What:** Make the existing site a Progressive Web App: installable, offline-capable for read-only browsing, push notifications. Don't ship a native app in v1 — SQL editing on a phone is genuinely poor UX, and a PWA covers the realistic mobile use cases (browse problems, read articles, check contest leaderboard, view profile, get notified when a daily / contest opens).

**Why:** Mobile traffic is non-negotiable in a content-heavy product. A PWA gets us 80% of native-app benefits for ~10% of the build cost. The 20% we lose (native push on iOS Safari is restricted, slightly less polished install flow) doesn't matter for the audience.

**Components:**
- `manifest.webmanifest` with icons + theme color + display mode + install handlers.
- Service worker (Workbox) that caches the article + problem-list shells offline, falls back gracefully on the workspace (which needs the network to validate against the API).
- Push notification opt-in (web-push) for: daily problem, contest start, ticket reply (V12), session reminder (V13).
- Mobile UX pass: the workspace already responsive but the bottom-pane geometry could use a phone-specific stack mode.

**Dependencies:** None blocking. Service worker shouldn't fight Next.js's ISR/caching — needs careful scoping.

**Scope estimate:** Medium. ~400 lines + a mobile UX audit pass.

### V17 — First-run onboarding

**What:** Replace the silent landing on `/` after sign-up with a 4-step onboarding: (1) welcome + name confirmation, (2) skill self-assessment (3 short SQL puzzles to bucket into Beginner / Intermediate / Advanced), (3) recommend a Track (V9) matching that level, (4) set up daily-problem opt-in (V15). End by dropping the user on the recommended Track or `/practice` filtered to their level.

**Why:** Right now a new user signs in and sees the same homepage everyone else does — the dashboard cards (PR #21) help, but they're built for users with submission history. New users have empty cards. An onboarding flow converts an account-creation event into an actual first attempt — the strongest predictor of D7 retention.

**Components:**
- `User.onboardingCompletedAt` column + a `<Onboarding>` modal triggered when the user is signed in but `completedAt` is null. Not a separate route — modal over `/`.
- Skill-assessment problems are a special tag (`onboarding-only`) and don't show in `/practice`.
- Tracking: each step records a timestamp so we can compute funnel drop-off (V11).

**Dependencies:** V9 Tracks for the recommendation step. V15 daily for step 4. Both are listed above; ship onboarding after them or land it with placeholder steps.

**Scope estimate:** Small-medium. ~400 lines.

### V18 — Companies tagging

**What:** Tag problems with the companies that ask them in interviews. "Asked at Stripe", "Asked at Meta data team", "Frequent at Snowflake interviews". A top-level filter on `/practice` lets a user generate "the FAANG SQL set" in one click. Companies are also a track (V9) source.

**Why:** Interview prep is an explicit job-to-be-done for a real fraction of the audience. They don't want every problem; they want the ones their target company asks. Without this, that user goes back to LeetCode (which has it).

**Components:**
- Schema: extend `Tag` with a `kind: TOPIC | COMPANY` enum (cleaner than a separate model) + display affordances per kind.
- Source: admin-curated, with optional "user-reported" via a small form on each problem ("Were you asked this in an interview? Which company?") that admins approve.
- Surfaces: `/practice` filter UI gets a "Companies" facet alongside difficulty + tags. Per-company landing pages (`/practice/companies/[slug]`) that double as SEO entry points.
- Privacy / accuracy: never publish a single user-reported attribution — require ≥3 independent reports before a company-tag becomes public.

**Dependencies:** None. Reuses Tag.

**Scope estimate:** Small-medium. ~300 lines + a small admin surface.

---

### Considered, not pursuing (yet)

Keeping the bar honest — these were thought about and intentionally **not** added as roadmap items because they don't fit the product or the cost outweighs the win at our stage:

- **Native iOS / Android app** — Real native apps on top of a web platform double maintenance for marginal value. PWA (V16) covers the realistic use cases.
- **General-language playground** — Out of scope. Data Learn is narrow on purpose: SQL → Python (V5) → maybe Spark. Not "leetcode for everything".
- **Live 1v1 head-to-head racing** — Sounds fun, builds nothing durable. The retention math doesn't work for a solo project.
- **Internationalization (i18n)** — Multiplies addressable market but also content-translation cost. Revisit when revenue (V6) actually exists to fund it.
- **Browser extension** — Niche audience, ongoing maintenance per browser, low ROI vs. a public read-only API + OG images (V10).
- **Custom themes** — Single emerald-on-slate theme keeps the brand tight. Theming is design debt, not a feature.

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
