# 🚀 Antigravity Data Learning Platform — Long-Term Roadmap

> **Last updated:** 2026-06-15
> **Status:** Live — <https://www.learndatanow.com>
> **Version:** 0.8.0 (current)

## Recently shipped

### v0.7.0 — MCP enhancements (article workflow + ops + assets)

Three stacked PRs that take the MCP server from 23 → 40 tools, closing every coverage gap an AI-authoring user would hit short of discussion moderation (which intentionally stays out — see below).

- **Article review workflow (PR #139, v0.6.0)** — 4 new tools (`submit_article`, `approve_article`, `reject_article`, `archive_article`) that drive DRAFT → SUBMITTED → PUBLISHED transitions with Layer 2 directive validation server-side. `approve_article` formats per-directive validation errors as multi-line messages so authors fix issues in one round-trip. Added `DataLearnClient.requestRaw` for endpoints that reply with `{ ok, status }` instead of `{ data }`. Central `toMcpError` now maps 409 conflicts to `InvalidRequest` with the upstream message so state-conflict errors are actionable instead of masked.
- **Ops + admin lifecycle (PR #140, v0.7.0)** — 11 new tools covering admin API keys (list/create/revoke; `create_api_key` returns plaintext once with an explicit save-now warning bolted onto the response), users (list/role-update with ADMIN transitions rejected at the schema level), moderators (list/grant/permissions/revoke), and lifecycle deletes (`delete_topic` blocks on referencing articles; `delete_track` soft-archives when non-empty). `delete_problem` and `delete_article` stay deliberately out — archive-only for history + version preservation.
- **Asset management (PR #141, v0.8.0)** — 2 new tools (`list_assets`, `delete_asset`). `delete_asset` strips `:::figure` references from referencing articles and snapshots affected PUBLISHED article versions, so cleaning up orphan uploads doesn't silently break live content. Discussion-moderation tools were drafted then removed during Codex review: `/api/admin/discussions*` routes use session-cookie auth that explicitly rejects Bearer headers, and adding bearer auth would weaken the CSRF + audit-log guarantees moderation expects. Tracked as a separate design conversation.
- **e2e harness** — full article state-machine assertion (DRAFT → SUBMITTED → DRAFT[reject] → SUBMITTED → PUBLISHED → ARCHIVED), API-key roundtrip with plaintext-shape check, ops list smoke checks, delete_topic / delete_track. Safety net: the test-created API key is captured at outer scope so the `finally` block direct-revokes it even if `revoke_api_key` itself errors mid-test.
- **Bundle isolation maintained** — `lib/admin-validation.ts` stays Prisma-free; bundle isolation check at 24 modules. `tsup` build at 1.92 MB. 53 vitest tests pass.

### v0.5.0 — Learn v2 visual articles

Learner-facing reveal for visual Learn content. This ties the asset upload foundation and directive renderer into the article publishing flow, then ships a reference lesson that demonstrates the full system.

- **Visual article directives** — public Learn articles now render `figure`, `mermaid`, `steps`, `side-by-side`, and `callout` directive blocks through the shared directive-aware Markdown renderer while preserving heading IDs for the table of contents.
- **Publish-time validation** — new `Article.hasVisualBlocks` denormalized flag plus Prisma-aware Layer 2 validation. Admin create/update, admin approve, and contributor submit paths validate directive syntax before publication; Blob-backed figures must point at active assets owned by the article author, while `/learn/` seed assets are allowed.
- **Editor tools** — admin and contributor article forms include an insert menu for all directive types and a My uploads panel that inserts uploaded active assets as figure directives.
- **Listing UX** — Learn topic cards and topic article lists show a Visual pill whenever a published article contains visual directive blocks.
- **Seed lesson** — `npm run seed:visual` creates the published "How a JOIN works" lesson under the Joins topic, backed by five small SVGs in `public/learn/img/`.
- **Verification gates** — CI seeds the visual lesson, runs article publish validation and route wiring tests, checks MCP bundle isolation, and covers the visual lesson plus Mermaid lazy-loading in Playwright.

### v0.4.13 — Asset infrastructure (ships dark)

Foundation for Learn v2 visual articles. New `Asset` table + `UserAssetQuota`, two-phase upload at `/api/me/uploads`, admin abuse-delete with retry at `/api/admin/assets`, daily GC cron with reconciliation sweeps. No learner-facing change.

### May 2026 — v0.4.12: Study plans / tracks (V9)

GitHub Release: <https://github.com/ez-biz/datalearn/releases/tag/v0.4.12>. Curated multi-problem learning paths — the platform's first opinionated entry into the catalog. Shipped as a two-PR sequence: backend ships dark in #112, learner-facing reveal lands in #113.

- **Schema: `Track` + `TrackItem` (PR #112)** — new Prisma models behind migration `add_tracks`. Track holds editorial metadata (`name`, `slug`, `summary`, `description`, `difficulty`, `status`, `estimatedMinutes`, optional `coverImageUrl`). TrackItem references a `SQLProblem` with explicit `position` ordering and a `@@unique([trackId, position])` constraint so reorders are atomic. No `UserTrackProgress` table — progress is computed live from `Submission` rows.
- **Admin REST + UI (PR #112)** — `/api/admin/tracks/*` endpoints (list, create, update, archive, atomic reorder, item add/remove). `/admin/tracks` index + `/admin/tracks/new` create form + `/admin/tracks/[slug]/edit` editor with drag-handle reordering and the `AddProblemsPicker` borrowed from custom lists.
- **MCP authoring (PR #112)** — new `list_tracks` / `get_track` / `create_track` / `update_track` tools so editorial track design happens in Claude Desktop the same way problem authoring does.
- **Learner surfaces (PR #113)** — public `/learn/tracks` card grid (cover image, name, summary, count, difficulty, estimated minutes), `/learn/tracks/[slug]` detail page with description, ordered item rows, computed progress bar, sticky Start/Continue/Review CTA that jumps to the next un-solved problem, per-item solved checkmarks, kind-aware SEO metadata.
- **Nav surfaces (PR #113)** — "Tracks" CTA on the Learn page header and a "Tracks" link in the Practice page header next to "Browse by tag".
- **Tests (PRs #112 + #113)** — 11 unit tests in `scripts/test-tracks.ts` (filter PUBLISHED, ordered items, anonymous + signed-in progress, admin validation, reorder atomicity, dup-item rejection), 4 e2e tests in `tests/e2e/tracks.spec.ts` (index, detail, anonymous, signed-in-with-progress, 404). Wired into CI.

### May 2026 — v0.4.11: Companies tagging (V18)

GitHub Release: <https://github.com/ez-biz/datalearn/releases/tag/v0.4.11>. Builds on the v0.4.10 tag infrastructure to let learners browse problems by interviewing company.

- **Schema: `Tag.kind` enum (PR #110)** — added `kind TagKind @default(TOPIC)` with values `TOPIC | COMPANY`. One-column migration, no backfill — every existing tag becomes `TOPIC` automatically. Migration: `20260517080000_add_tag_kind`.
- **`/practice/tags` split (PR #110)** — Companies above Topics, with a sticky `Companies · Topics` anchor nav when both sections are non-empty. Server-side launch gate: the Companies section stays hidden until ≥ 5 distinct companies have ≥ 3 PUBLISHED problems each. Editorial pass happens after merge; code ships dark and reveals itself automatically once the threshold is met.
- **`TagPill` kind-aware styling (PR #110)** — `COMPANY` pills render a `<Building2 />` glyph and a subtle primary-tinted border so they're scannable on a busy problem row.
- **`/practice/tags/[slug]` kind-aware metadata (PR #110)** — `generateMetadata` formats the title as "Stripe SQL interview questions" for companies vs. "Window Functions SQL problems" for topics. Detail page heading + tagline adapt similarly.
- **Admin + MCP authoring (PR #110)** — new `TagCreateForm` with a kind selector; MCP `create_tag` tool accepts an optional `kind` parameter (default `TOPIC`); `list_tags` returns it.
- **Tests + audit (PR #110)** — 7 new unit tests in `scripts/test-companies-tagging.ts` covering kind projections + launch-gate maths; 5 new e2e tests in `tests/e2e/companies-tags.spec.ts` covering section visibility, ordering, and per-kind copy. `scripts/audit-tags.ts` now partitions output by kind so editors can spot dupes inside a single namespace.

### May 2026 — v0.4.10: tag-based problem discovery + dependency refresh

GitHub Release: <https://github.com/ez-biz/datalearn/releases/tag/v0.4.10>. First surfaces the existing `Tag` taxonomy to learners and rolls a batch of routine dependency bumps.

- **Tag-based problem discovery (PR #106)** — new `/practice/tags` index of tags with PUBLISHED-problem counts (sorted by count desc / name asc, ghost tags excluded). New `/practice/tags/[slug]` filtered list with `generateMetadata` for SEO. Clickable `TagPill` pills under each problem row on `/practice` and the detail page. New `getPublicTags()` + `getProblemsByTag(slug)` server actions; `getProblems()` projection extended to include tags. New `scripts/audit-tags.ts` (`npm run audit:tags`) for taxonomy hygiene. 9 unit + 3 e2e tests; no schema migration.
- **Top-level dependency bumps (PR #101)** — 12 minor/patch updates across runtime dependencies.
- **MCP server dependency bumps (PR #107)** — zod, @types/node, vitest in `mcp-server/`.
- **eslint 9 → 10 (PR #64)** — major version bump on the dev tool. `eslint-config-next@16.2.4` declares `>=9.0.0` compatibility so the bump is transparent.

### May 2026 — v0.4.9: SQL engine cold-load hotfix

GitHub Release: <https://github.com/ez-biz/datalearn/releases/tag/v0.4.9>. Fixes a P0 regression introduced in v0.4.8 that broke `/practice/<slug>` engine init for every cold-load visitor.

- **Absolute URLs for self-hosted bundle (PR #104)** — `getSelfHostedBundles()` builds full URLs with `window.location.origin`. Blob workers can't resolve root-relative paths through `importScripts`, so v0.4.8's relative URLs silently failed.
- **Explicit Content-Type headers (PR #104)** — `application/wasm` and `application/javascript; charset=utf-8` on `/_dl/sql-engine/` paths via `next.config.ts`. `next start` doesn't auto-detect MIME for `public/` assets, and our `nosniff` header forces wasm to refuse anything else.
- **CDN fallback on instantiation failure (PR #104)** — `createDuckDbInitializer(deps)` wraps the self-hosted path in try/catch; on any failure (selectBundle, worker creation, db.instantiate), the failed worker is terminated and the init retries against jsDelivr. Two new unit tests cover both paths.
- **Wasm preload race removed (PR #104)** — `<link rel="preload" as="fetch">` for the wasm in `app/practice/layout.tsx` was racing the worker's own request on busy CI runners and leaving the engine init hanging. Worker preload remains.
- **CI trace artifacts (PR #104)** — Playwright now uses `[github, html]` reporter on CI so trace artifacts upload on failure.

### May 2026 — v0.4.8: DuckDB-WASM self-host (Phase 1) + cache headers

GitHub Release: <https://github.com/ez-biz/datalearn/releases/tag/v0.4.8>. Moves the DuckDB-WASM bundle from jsDelivr to our own origin to flatten cold-load latency and cut a third-party dependency from the critical path. **Initial cut shipped broken**; the cold-load fix landed in v0.4.9 the same day — see runbook below.

- **Self-hosted DuckDB-WASM bundle (PR #99)** — `scripts/copy-sql-engine-assets.ts` runs as `prebuild` and copies the `@duckdb/duckdb-wasm` distribution into `public/_dl/sql-engine/`. Production loads from our origin; dev/SSR/fallback still uses jsDelivr.
- **Cache headers on bundle (PR #103)** — `next.config.ts` sets `Cache-Control: public, max-age=86400` on `/_dl/sql-engine/*.wasm` and `*.js`. URLs aren't content-hashed yet, so `immutable` is deferred until hashed-URL work in Phase 2.
- **PGlite warm-up (PR #98)** — `lib/sql-engine/warmup.ts` opportunistically pre-imports PGlite for learners who used Postgres mode on any prior problem.

### May 2026 — v0.4.7: solution explanation panel + multi-row schema parser

GitHub Release: <https://github.com/ez-biz/datalearn/releases/tag/v0.4.7>.

- **Solution explanation panel (PR #102)** — after a successful submission, the workspace surfaces the canonical solution alongside the learner's. Per-dialect, copy-button, side-by-side layout. Tied to the per-dialect `solutions` JSON map so the right canonical surfaces for whichever engine the learner solved with.
- **Multi-row INSERT support in schema parser (PR #96)** — `lib/schema-parser.ts` now handles `INSERT INTO foo VALUES (...), (...), (...);`, unlocking schemas seeded with bulk inserts and keeping the first-paint optimization that pre-computes table info without waiting on DuckDB.

### May 2026 — v0.4.6: PGlite persistence + telemetry + dep hardening

GitHub Release: <https://github.com/ez-biz/datalearn/releases/tag/v0.4.6>. Bundles the SQL Engine v2 Phase 1 close-out (telemetry harness) plus the first Phase 3 slice (PGlite IndexedDB persistence) and security/housekeeping work.

- **PGlite IndexedDB persistence (PR #86)** — Postgres-mode workspaces now persist their per-problem PGlite database in IndexedDB, keyed by `sha256(slug + schemaSql + PGLITE_CACHE_VERSION)`. Schema replay only runs on first visit and after schema or PGlite-version changes; subsequent visits hit the persisted database. Memory-mode fallback covers private browsing, missing platform APIs, and the `localStorage.dl:pglite-cache:off` learner opt-out. DuckDB-WASM persistence is intentionally out of scope today — DuckDB-WASM has no OPFS persistence story.
- **Engine timing telemetry harness (PR #85)** — browser engine sessions now emit typed timing events for init start, init ready, first successful query, and disposal. Dev builds log to `console.debug`; production builds send sampled beacons to `/api/telemetry/sql-engine`, with `localStorage.dl:telemetry:off` as the learner opt-out. Phase 3 startup-responsiveness PRs use this for before/after measurement.
- **DuckDB bundle size investigation spec (PR #87)** — design doc for PR 3.4 covering measurement methodology, decision criteria, and out-of-scope items. Follow-up PR runs the actual measurements and decides whether to switch the variant or self-host.
- **Dependabot alert clearance + override pin (PR #84 + #88)** — bumped transitive `fast-uri`, `hono`, `ip-address` to patched versions and added `overrides` blocks in both root `package.json` and `mcp-server/package.json` so future installs cannot drift back.

### May 2026 — v0.4.5: SQL Engine v2 foundation + Phase 1 hardening

GitHub Release: <https://github.com/ez-biz/datalearn/releases/tag/v0.4.5>.

- **Browser engine session boundary (PR #75)** — added `lib/sql-engine/browser-session.ts` so DuckDB-WASM and PGlite now sit behind the same `{ runQuery, dispose }` contract. `useProblemDB` remains the React lifecycle wrapper instead of owning engine-specific initialization and row conversion.
- **Shared result normalization (PR #75)** — new `lib/sql-engine/normalize.ts` converts engine-specific row values (`Date`, safe/unsafe `bigint`, object wrappers) into JSON-safe values before rows reach the results table or submission payload.
- **Schema statement helper (PR #75)** — schema replay now uses a tested `splitSqlStatements()` helper in `lib/sql-engine/statements.ts`, keeping browser engine setup behavior explicit.
- **Dialect audit CI gate (PR #75)** — `npm run audit:dialects:ci` now runs in the GitHub Actions test workflow after migrations and seed. Published `(problem, dialect)` pairs fail the build when canonical SQL, schema, or expected output is missing or mismatched. Seed problems 1-11 now include per-dialect `solutions` / `expectedOutputs` so fresh CI data is fully auditable.
- **Result row cap with display/validate split (PR #76)** — learner `Run` caps rendered results at 1,000 rows and shows a truncation warning instead of letting large result sets overload the results table. `Submit` uses a per-problem validation cap of `max(2 × expectedOutput rows, 1,000)`; if that cap is exceeded, the workspace returns a "result too large" verdict locally instead of silently truncating into an incorrect answer.
- **Query timeout and engine reset (PR #77)** — learner queries now time out after 10 seconds by default. Timed-out DuckDB-WASM/PGlite sessions reset by disposing and recreating the in-browser engine, then the workspace shows a clear timeout message and allows the next query to run against a fresh replayed schema.
- **JSON + TIMESTAMPTZ validator robustness (PR #79)** — expected-output validation now deep-compares JSON object/array cells with stable key ordering, rejects nested JSON value mismatches correctly, and treats equivalent timezone timestamp strings as the same instant.
- **Tokenizer-aware read-only guard (PR #80)** — learner `Run` and `Submit` now split statements with a lightweight tokenizer that ignores semicolons and write keywords inside comments, string literals, quoted identifiers, and dollar-quoted literals. It still rejects mutating statements, including CTE-wrapped DML and `EXPLAIN ANALYZE` around DML.
- **Vercel Speed Insights + Google Analytics (PR #81)** — observability instrumentation in `app/layout.tsx` (`G-B9RFQWH2JC`).
- Design/plan docs: [`docs/superpowers/specs/2026-05-05-sql-engine-v2-foundation-design.md`](./superpowers/specs/2026-05-05-sql-engine-v2-foundation-design.md) and [`docs/superpowers/plans/2026-05-05-sql-engine-v2-foundation.md`](./superpowers/plans/2026-05-05-sql-engine-v2-foundation.md).
- Broader roadmap docs: [`docs/superpowers/specs/2026-05-05-sql-engine-v2-roadmap-design.md`](./superpowers/specs/2026-05-05-sql-engine-v2-roadmap-design.md) and [`docs/superpowers/plans/2026-05-05-sql-engine-v2-roadmap.md`](./superpowers/plans/2026-05-05-sql-engine-v2-roadmap.md).

### May 2026 — v0.4.4: problem discussions v1 + workspace safety

- **Learner Discussion tab** — added to the practice workspace next to Description, Hints, and History. Published problems show Discussion when global discussions are enabled and the problem is not `HIDDEN`. Signed-out learners can read; signed-in learners can post comments, reply one level deep, vote, report, edit inside the edit window, and soft-delete their own visible comments.
- **Markdown + code formatting** — comments and replies use the shared safe Markdown renderer with inline code, fenced code blocks, and SQL highlighting where available. Accepted submissions expose `Share approach`, which pre-fills a discussion comment with the accepted SQL in a fenced code block.
- **Spam controls and reputation tiers** — DB-backed `DiscussionSettings` controls global availability, report threshold, edit window, duplicate cooldown, body length, hourly/per-problem limits, vote limits, and reputation thresholds. Accepted solves, vote events, hidden comments, and confirmed spam write auditable `UserReputationEvent` rows.
- **Admin moderation queue** — `/admin/discussions` groups comments into needs-review, hidden, dismissed-reports, and spam queues. Report threshold uses the count of OPEN reports; crossing the threshold does not auto-hide. Actions are hide, restore, dismiss reports, and mark spam.
- **Moderator role with assignable permissions** — `MODERATOR` is a separate role, but capabilities are permission-based: view queue, hide/restore comments, dismiss reports, mark spam, lock problem discussions, and hide problem discussions. Only admins can grant/revoke moderator permissions through `/admin/moderators`.
- **Per-problem controls** — problem edit forms and moderator APIs can set discussion mode to `OPEN`, `LOCKED`, or `HIDDEN`. `LOCKED` keeps discussion readable but blocks new mutations; `HIDDEN` removes the learner-facing tab.
- **Default availability fix** — discussions are enabled by default at the DB/schema level, while admins can still disable globally from settings or hide/lock individual problems.
- **Workspace read-only guard** — learner `Run` and `Submit` now reject DDL/DML/DCL, transaction-control, extension/config, and procedure-execution statements before they reach the browser database, preserving seeded schema state and blocking mutation-based answer-key bypasses.
- Verification coverage: `npm run test:discussion` plus targeted E2E coverage for learner discussion flows, signed-out gating, locked/hidden modes, report queue threshold, moderator permissions, and admin API security.
- Design/plan docs: [`docs/superpowers/specs/2026-05-03-problem-discussions-design.md`](./superpowers/specs/2026-05-03-problem-discussions-design.md) and [`docs/superpowers/plans/2026-05-03-problem-discussions.md`](./superpowers/plans/2026-05-03-problem-discussions.md).

### May 2026 — v0.4.2: per-dialect solutions schema groundwork (PR #65 + #66)

- **`SQLProblem.solutions Json` + `expectedOutputs Json`** — new per-dialect maps keyed by `Dialect` (`{ "DUCKDB": "...", "POSTGRES": "..." }`). Legacy `solutionSql` / `expectedOutput` columns kept for back-compat through the cleanup release that drops them. Migration backfills new columns from old for every existing problem.
- **Zod refines** — keys must subset `dialects[]`; PUBLISHED requires non-empty entries for every listed dialect (DRAFT/BETA/ARCHIVED tolerate partial). `getMissingPublishedDialectMapEntries()` helper used by both POST and PATCH gates.
- **Admin form rebuilt** — per-dialect tabs, "Copy from `<other>`" button, auto-copy on dialect-toggle-on, Run & capture uses the active dialect's engine.
- **`validateSubmission(slug, userResult, dialect)`** — server action accepts `dialect` param, reads `expectedOutputs[dialect]` with fallback to legacy `expectedOutput`.
- **MCP `create_problem` + `update_problem`** — accept new `solutions` / `expectedOutputs` records (preferred); legacy single fields still accepted with deprecation note. Bundle rebuilt.
- **`scripts/audit-all-dialects.ts` (new) + `scripts/sync-from-prod.sh` (new)** — `npm run audit:dialects` validates every (problem × dialect) pair against its engine. `npm run db:sync-prod` mirrors prod data to local while preserving local schema (useful when local is on a feature branch ahead of prod's migration state). 46/46 (problem × dialect) pairs pass on local DB.
- Plan doc: [`docs/superpowers/plans/2026-05-03-per-dialect-solutions.md`](./superpowers/plans/2026-05-03-per-dialect-solutions.md).

### May 2026 — v0.4.1: cross-dialect date validator fix (PR #60)

- **Critical correctness fix** — DuckDB-WASM emits dates as epoch ms; PGlite emits Date objects (which `Object.toString()` was rendering as locale strings, not ISO). `lib/sql-validator.ts` `normalizeCell` now handles `instanceof Date` before the generic `toString` fallback, and `cellEqual` / `canonicalCell` get a date-equivalence fallback via a new `toIsoIfDate()` helper. Live users solving date problems in Postgres were getting WRONG_ANSWER on correct queries; fixed.
- **Audit + dual-engine validation tooling** — `scripts/audit-postgres-compatibility.ts` (later renamed to `audit-all-dialects.ts` in v0.4.2), `scripts/validate-problem.ts` runs each problem's solution against both engines + cross-engine equivalence. Also added `@duckdb/node-api` as a devDep for offline DuckDB validation. Probed AVG over DOUBLE PRECISION exhaustively — no drift; both engines produce byte-identical doubles.

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
| Problem Discussions | ✅ Done | Problem-level tab with replies, votes, reports, moderation queue, and per-problem modes |
| Testing | ✅ Partial | Playwright E2E coverage plus targeted helper tests for core shipped flows; dialect audit helper coverage |
| CI/CD | ✅ Done | GitHub Actions test workflow runs typecheck, build, E2E, and SQL dialect audit |

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
| **Testing suite (unit + integration + E2E)** | ✅ Done | P0 |
| **CI/CD pipeline (GitHub Actions)** | ✅ Done | P0 |
| **Vercel deployment with preview environments** | ⬜ Todo | P0 |
| **User analytics dashboard (admin)** | ⬜ Todo | P1 |
| **Problem discussion moderation tools** | ✅ Done | P2 |
| **Leaderboard / gamification** | ⬜ Todo | P3 |
| **Problem-specific discussions** | ✅ Done | P3 |
| **Site-wide community forums** | ⬜ Todo | P3 |
| **SEO optimization** | ⬜ Todo | P1 |
| **Performance monitoring (Sentry/Vercel Analytics)** | ⬜ Todo | P2 |
| **Accessibility audit (WCAG 2.1 AA)** | ⬜ Todo | P2 |
| **Mobile responsiveness audit** | ⬜ Todo | P1 |

---

### 🟪 MCP server roadmap

| Task | Status | Notes |
|------|--------|-------|
| **MCP v1: problem authoring tools** | ✅ Done | 9 tools, stdio transport, forced DRAFT on writes. |
| **MCP v0.4.12: track authoring tools** | ✅ Done | `list_tracks`, `get_track`, `create_track`, `update_track`, `add_track_item`, `remove_track_item`, `reorder_track_items`. |
| **MCP v0.5.0: article authoring tools** | ✅ Done | `create_article`, `update_article` (DRAFT-only at create). |
| **MCP v0.6.0: article review workflow** | ✅ Done | `submit_article`, `approve_article`, `reject_article`, `archive_article`. Layer 2 directive validation surfaced as multi-line per-directive errors. |
| **MCP v0.7.0: ops + admin lifecycle** | ✅ Done | API keys, users, moderators, `delete_topic`, `delete_track`. ADMIN role transitions rejected at schema level. |
| **MCP v0.8.0: asset management** | ✅ Done | `list_assets`, `delete_asset` (strips `:::figure` refs + snapshots PUBLISHED articles). |
| **MCP: problem update / archive / publish** | ✅ Done | Shipped with v0.5.0 `update_problem`. `update_problem` accepts `status` transitions. |
| **MCP: `validate_problem` pre-flight** | ⬜ Todo | Run `solutionSql` against `schemaInline` and surface mismatches before persistence. |
| **MCP: pagination + filters on list_problems / list_articles** | ⬜ Todo | Admin REST endpoints don't currently accept `cursor`/`limit`; needs joint API + tool change. |
| **MCP: discussion moderation tools** | ⬜ Todo (design needed) | `/api/admin/discussions*` routes use session-cookie auth that rejects Bearer headers. Adding a Bearer path weakens CSRF + audit-log guarantees; needs a separate security design before implementation. |
| **MCP: HTTP / remote transport** | ⬜ Todo | Today's stdio transport requires local install. Hosted streamable-HTTP MCP at `mcp.learndatanow.com` would unblock ChatGPT custom connectors and zero-install Claude.ai usage. |
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

**Status:** Phase 1 foundation shipped 2026-05-24 (PR #145). Phase 2 server-side judge shipped 2026-05-26 (PR #150): sandboxed DuckDB + PGlite worker, AST-based SQL validation, transactional submit pipeline with DB-backed idempotency, hidden-data admin routes with audit log, and MCP tools for hidden datasets + publish readiness. Escape-attempt regression corpus is now the security gate. Standings table shipped 2026-06-14 (PR #157). **Phase 3 — contest play UI** (in progress 2026-06-14): a dedicated `/contests/[slug]/[problemSlug]` page so registered learners can actually submit to the judge during a live contest, with a verdict panel, a live countdown, and timezone-correct times. Source: `docs/superpowers/specs/2026-06-14-contest-play-design.md`. Phases 4-7 follow. Source plan/spec: `docs/superpowers/specs/2026-05-24-contests-design.md`. **Judge warm-up** (2026-06-14): the official judge forks a fresh worker per submission, so the first fork on a cold serverless instance loads the native DuckDB/PGlite binaries and ate >30s for whoever submitted first. `warmUpJudge()` (`lib/contest-judge.ts`) runs one debounced throwaway no-op fork; the play client pings `GET /api/contests/[slug]/submit` on mount (same function as the submit POST) so that cold fork is pre-paid during think-time. Custom (practice-judged, in-browser) contests are unaffected.

**Deferred follow-ups (after Phase 3 play UI):**
- **Live-refreshing standings:** standings are currently fresh-on-load only; add tick-based refresh during a live contest (no websockets).
- **Per-problem ICPC grid:** richer standings with a column per problem showing solve time / wrong-attempt count, on top of the current summary table.
- **Mobile standings layout:** the standings table needs a stacked/card treatment below `sm` (it can overflow on phones today).
- **Closed-contest submission review:** let a participant review their own submissions + verdicts after a contest ends.
- **Rating / Glicko-2:** see the rating component below — the `ratingBefore/After/Delta` columns exist but are unpopulated.
- **Contest email notifications:** "your contest starts in 1 hour" (see Dependencies).

**What:** Weekly + monthly timed contests with multiple problems, a leaderboard, and a **mathematically-backed rating system** that updates each user's rating after every contest. Rating shown on the profile page (the placeholder card already exists).

**Why:** Contests turn the platform into a sport. They give users a reason to be present at a specific time, create cohort rivalries, and seed the Discuss > Contest category with post-mortems.

**Components:**
- **Rating system: Glicko-2** (more responsive than ELO, used by chess.com and Codeforces; well-documented). Per-user state: `rating`, `ratingDeviation`, `volatility`, `lastContestAt`. Update happens server-side in a transactional batch when a contest closes.
- **Contest model:** `Contest`, `ContestProblem` (M:N with offset/score), `ContestSubmission`, `ContestLeaderboard` (materialized).
- **Problem locking:** problems used in an official contest do not appear in public browse/search surfaces while locked. Locking lives in `ContestProblemLock`, not the `ProblemStatus` enum, so existing `PUBLISHED`/`DRAFT` semantics stay intact.
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

### ✅ V9 — Study plans / tracks — SHIPPED v0.4.12 (PR #112 + #113)

Curated multi-problem learning paths. `Track` + `TrackItem` schema shipped behind admin authoring (admin REST, `/admin/tracks` editor, MCP tools) in PR #112; learner-facing `/learn/tracks` index, `/learn/tracks/[slug]` detail with computed progress + Start/Continue/Review CTA, and Learn/Practice entry links landed in PR #113. Progress is computed live from `Submission` rows — no `UserTrackProgress` table in v1, which keeps progress consistent with normal problem solves and avoids a second write path. Editorial seed of 3 starter tracks happens post-deploy via MCP.

**Deferred to v1.5/v2:** article items (`TrackItem.kind = ARTICLE`), profile/home continuation cards, hard sequencing gates, track tags (e.g. tagging a "FAANG track" with `kind=COMPANY` slugs), AI-recommended tracks, public sharing/forking, and an explicit `UserTrackProgress` row if notifications or recommendation hooks need it.

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

### ✅ V18 — Companies tagging — SHIPPED v0.4.11 (PR #110)

`Tag` gained a `kind: TOPIC | COMPANY` enum and `/practice/tags` now splits Companies above Topics. Code is gated server-side (≥ 5 companies × ≥ 3 PUBLISHED problems each) so the section reveals itself automatically once editorial catches up. MCP `create_tag` accepts `kind`, so company tagging is part of the AI-authoring flow. Per-company landing pages live at `/practice/tags/<company-slug>` and use kind-aware metadata for SEO.

**Deferred to v2:**
- User-reported attribution form on each problem ("Were you asked this in an interview? Which company?") with the ≥ 3-reports-before-public guard. Worth doing once editorial has seeded the canonical company list and we have organic submissions.
- Top-level inline "Companies" dropdown filter on `/practice` itself (composable with difficulty/search/status). Only worth building if telemetry shows the tag-index page splits learner attention significantly.
- Brand-alias redirects (`/practice/tags/facebook` → `/practice/tags/meta`). Defer until search traffic justifies a 301 map.

### V19 — Share a solved problem to social media (with result)

**What:** After a learner gets an Accepted verdict, a **Share result** action generates a branded card — problem (`#NNN. Title`), difficulty, the "Accepted" verdict, and (once V20 lands) runtime/memory percentile — and shares it to LinkedIn / X / Reddit / WhatsApp or copies a link. The shared URL unfurls richly via an OG image. Never embeds the learner's SQL — verdict + metadata only.

**Why:** The solve is the moment of pride, and capturing it into a shareable artifact is the cheapest growth lever the platform has. Every "I just solved #142 on Data Learn" post is a free impression to a high-intent audience (peers prepping for the same interviews). This is the problem-result slice of V10's social-share bundle, pulled forward because it rides on the most emotionally charged moment in the product.

**Components:**
- **OG image generation** via `@vercel/og` — a `/api/og/result` route that renders the card from params (number, title, difficulty, verdict, optional rank/runtime). **HMAC-sign the params** so a fake "Accepted" card can't be forged.
- **Share surface:** a Share button in the workspace solved/solution panel with platform targets (LinkedIn, X, Reddit, WhatsApp, copy link) using standard share intents + the Web Share API on mobile.
- **Result permalink + privacy:** unfurl points at the public problem page (or a lightweight share page); the card carries no solution SQL, and a profile "private" toggle suppresses sharing.

**Dependencies:** Folds into V10 (OG images + social share buttons). Synergizes with V3 Badges (share earned badges) and V2 Contest (share contest results). No hard blockers.

**Scope estimate:** Small-medium. The OG route + share button is the core; HMAC-signing the verdict params is the only fiddly bit.

### V20 — Per-problem performance leaderboard (fastest runtime + least memory)

**What:** A LeetCode-style per-problem leaderboard ranking accepted submissions by **execution time** and **memory used**, with a percentile badge ("Faster than 87% · Less memory than 74%"). A Leaderboard tab on the workspace shows the top submissions for that problem (per dialect) and the learner's own standing.

**Why:** A binary Accepted/Wrong verdict doesn't reward writing a *better* query. A runtime/memory ranking gives advanced learners a reason to revisit solved problems and optimize — the loop that keeps strong users engaged long after they can already pass.

**Components:**
- **Fair measurement requires server-side execution.** Client-side timing/memory is device-dependent and trivially gamed, so the numbers must come from the controlled judge — **generalize the V2 contest server-side sandbox** (sandboxed DuckDB + PGlite worker) to ordinary practice submissions, recording `runtimeMs` + peak memory.
- **Schema:** best accepted submission per `(userId, problemId, dialect)` — `{ runtimeMs, memoryBytes, submissionId, achievedAt }`, indexed for top-N + percentile queries.
- **Ranking:** precompute the per-`(problem, dialect)` distribution on a cron or incrementally on submit; surface "Faster than X% / Less memory than Y%".
- **Surface:** a Leaderboard tab in the workspace + a percentile pill on the accepted-verdict panel.
- **Anti-gaming:** exclude submissions flagged as solution-tier AI-hinted (V14), rate-limit, and dedupe identical queries.

**Dependencies:** **Server-side judge is the prerequisite** — reuse/generalize the V2 contest sandbox; today's practice execution is client-side and not comparable across users. Benefits from V14 (hint flagging); feeds V3 (optimization badges) and V11 (per-problem performance analytics).

**Scope estimate:** Large — generalizing the server-side judge to every practice submission is the heavy part; the leaderboard UI on top is medium.

### V21 — Readiness Score (per topic + per company)

> Sourced from the datadriven.io teardown — see [`research/datadriven-io.md`](./research/datadriven-io.md) IDEA 2.

**What:** A quantified "are you interview-ready?" signal, computed per topic tag and per company tag (V18). Surfaced as a profile panel ("You're 72% ready for Stripe SQL") and used to drive recommendations. Blends, over time, with AI mock-interview verdicts (folds into V4).

**Why:** A binary solved/unsolved count doesn't answer the question users actually have — *am I ready for the interview?* A readiness metric turns the practice surface into an interview product, gives users a reason to return (close the gap), and feeds onboarding (V17) and adaptive recommendations (V9). It's also the cheapest high-value item on this list: the raw data already exists.

**Components:**
- **Scoring function** over existing data: solve rate × difficulty mix × recency decay per `Tag`, no new write path. Company readiness reuses `Tag.kind = COMPANY` (V18).
- **Profile panel** — fills an existing placeholder card; per-topic bars + a per-company readiness view.
- **Recency decay** so stale solves don't read as "ready"; a spaced-repetition review queue (V9-adjacent) resurfaces decayed topics.
- Later: blend in mock-interview rubric scores once V4's AI interview ships.

**Dependencies:** None blocking — computed from `Submission` + `Tag` + `difficulty`. Complements V11 (analytics) and V17 (onboarding bucketing).

**Scope estimate:** Medium — mostly a scoring function + a profile panel over data we already store.

### V22 — Programmatic interview-prep landing pages (company / role / round)

> Sourced from the datadriven.io teardown — see [`research/datadriven-io.md`](./research/datadriven-io.md) IDEA 4. Highest-leverage growth borrow.

**What:** Programmatically generated high-intent landing pages: per-company (`/<company>-sql-interview-questions`), per-role (Junior→Staff, Analytics/ML DE), per-round, and "Top-N / FAANG questions" hubs. Each page bundles a curated weighted problem set, difficulty mix, reported questions (V23), company-specific constraints, and an OG image (V10).

**Why:** This is the distribution moat competitors compound over time — organic search is where high-intent interview-prep traffic originates, and starting late is expensive. We already have the substrate: company tags (V18), a stable-numbered catalog, and tracks (V9). Role paths ship as packaged tracks.

**Components:**
- **Page templates** for company / role / round, generated from tag + catalog data; `generateMetadata` for SEO (extends the V18 pattern).
- **Curated weighted problem sets** per page, weighting derived from the interview-report corpus (V23).
- **Content-depth gate** — pages need real prose (process, comp, constraints) or Google reads them as thin/templated; MCP can author the prose at volume, but a quality bar is mandatory.
- OG images via `@vercel/og` (shared with V10 / V19).

**Dependencies:** V18 (company tags) and V9 (tracks as role paths) exist. Best paired with V23 (reports) for the "real reported questions" credibility marker. Enhances V10.

**Scope estimate:** Medium — templating + content generation. The risk is editorial depth, not engineering.

### V23 — Crowdsourced interview reports

> Sourced from the datadriven.io teardown — see [`research/datadriven-io.md`](./research/datadriven-io.md) IDEA 5. This is V18's deferred attribution form, generalized.

**What:** A structured submission where users report a real interview: company, role, round, questions asked, difficulty, outcome. One corpus with three payoffs — it (a) seeds the Discuss > Interview category (V1), (b) populates the company/role SEO pages (V22), and (c) derives company-weighted problem frequency ("most-asked at Stripe").

**Why:** Authentic "what they actually asked" data is the credibility layer that makes interview prep concrete instead of generic, and it's the fuel for both the SEO engine (V22) and the community (V1). It's a compounding, defensible asset.

**Components:**
- Schema: `InterviewReport { userId, companyTagId, role, round, questions[], difficulty, outcome, createdAt }` with the existing ≥N-reports-before-public guard (mirrors V18's planned attribution gate).
- Submission surface (a post-interview prompt) + moderation reuse from discussions (V0.4.4).
- Derivation jobs: per-company question frequency → weighted problem sets for V22.
- **Cold-start strategy** — needs seeding (editorial + an early-contributor incentive, e.g. a badge V3); the corpus is worthless until it has volume.

**Dependencies:** V18 (company tags). Feeds V22 (SEO) and V1 (Discuss). Moderation primitives exist.

**Scope estimate:** Medium — schema + form + derivation. The hard part is cold-start, not code.

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
