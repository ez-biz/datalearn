# Study plans / Tracks (V9) — Implementation Plan

**Date:** 2026-05-17
**Status:** Plan (not yet implemented)
**Branch:** `feat/tracks` (to be created)
**Depends on:** existing `SQLProblem`, `Submission`, `Article`, `User` models. No blocking work.
**Approved decisions** (defaults I'm picking — flip any in this section before I start):
- **Problems-only items in v1.** Skip the `ARTICLE` kind on TrackItem for now. Article-view tracking doesn't exist (Submission table tracks problems; no analogous "article read" event). Adding it raises scope materially. Tracks compose articles later in a v1.5 PR once we have read-tracking infra.
- **No hard sequencing gate.** Items render in order; we surface a "Next" affordance and disable nothing. Hard gates create churn and gate the learner's *exploration*, which is the opposite of what curricula are for.
- **Computed progress, no `UserTrackProgress` table in v1.** Progress is `count of TrackItems where (userId, problemId) has an ACCEPTED submission` over `count of TrackItems`. Saves a model + write path. Add the explicit row later if/when we need notifications, streak credit, or recommendation hooks.
- **Admin-only authoring.** Mirror `Topic`'s admin-only model — CONTRIBUTOR role can author articles, not tracks. Curriculum design is a different muscle.
- **No profile integration in v1.** Don't touch `UserHome` or the "Continue" card. That's a v2 polish PR after we see whether anyone actually starts a track.
- **Slug under `/learn`, not `/practice`.** Tracks are about *structured learning intent*, even if v1 items are problems. Roadmap V9 says `/learn/tracks/[slug]`; keep it.

## Goal

Give a new learner a curated path through the catalog — "Window Functions from Zero to Interview", "FAANG SQL Set", "Joins for Data Engineers". Each track is an ordered sequence of problems around a theme. Replaces the wall-of-100-problems landing with opinionated entry points.

## Why now

- Editorial tag work just shipped (v0.4.11). Tracks compose tags with sequence + intent. The marginal cost of a track is editorial, not infrastructural.
- V17 onboarding (3-step welcome → skill assessment → land on a track) is the next big lever. It can't ship without Tracks existing.
- Pre-Q3 milestone: complete Phase 2 of the roadmap.

## Non-goals

- **No `Company` model.** Reuse the `kind=COMPANY` tag we just shipped.
- **No payment gating** ("Pro-only tracks"). V6 monetization is a separate lane.
- **No multi-user collaboration** on tracks. Authoring is admin-only; learners just consume.
- **No fork/clone** ("save this track to my lists"). Tracks are editorial; lists already exist for personal curation.
- **No automated track generation** ("AI-suggest a track for this user"). V14 territory; out of scope.

## Schema

```prisma
enum TrackDifficulty {
  EASY
  MEDIUM
  HARD
  MIXED
}

enum TrackStatus {
  DRAFT
  PUBLISHED
  ARCHIVED
}

model Track {
  id                 String          @id @default(cuid())
  slug               String          @unique
  name               String
  /// One-line tagline shown on the index card.
  summary            String          @db.Text
  /// Long-form description shown on the detail page. Plain text or
  /// MDX (markdown-only initially). Renders above the item list.
  description        String          @db.Text
  difficulty         TrackDifficulty @default(MEDIUM)
  status             TrackStatus     @default(DRAFT)
  /// Admin-curated; not auto-computed. Roughly "minutes to finish all
  /// items assuming median problem-solve time".
  estimatedMinutes   Int             @default(60)
  /// Optional URL to a cover image. No upload pipeline in v1 — admin
  /// pastes a URL (Cloudinary / Vercel Blob / wherever).
  coverImageUrl      String?
  items              TrackItem[]
  createdAt          DateTime        @default(now())
  updatedAt          DateTime        @updatedAt

  @@index([status])
}

model TrackItem {
  id        String  @id @default(cuid())
  trackId   String
  track     Track   @relation(fields: [trackId], references: [id], onDelete: Cascade)
  /// Reference to the problem this item points at. v1 is problems-only.
  /// Add `articleId` (nullable, mutually exclusive) when articles join.
  problemId String
  problem   SQLProblem @relation(fields: [problemId], references: [id])
  /// 0-indexed display position within the track. Maintained explicitly
  /// (not auto-computed) so reordering is cheap.
  position  Int

  @@unique([trackId, problemId])   // a problem appears at most once per track
  @@unique([trackId, position])    // no two items share a slot
  @@index([trackId])
}
```

Migration name: `add_tracks`.

**Why no `UserTrackProgress` row in v1:** progress = `SELECT count(*) FROM Submission WHERE userId=? AND status='ACCEPTED' AND problemId IN (track item ids)`. One query, no write path, no consistency risk. Trade: we lose `startedAt`, `currentItemId`, `completedAt`. We don't need those for v1 — the "next item" is computed deterministically from the first un-completed `TrackItem.position`.

## Scope

### In

- `Track` + `TrackItem` Prisma models + migration.
- Server actions: `getPublishedTracks()`, `getTrackBySlug(slug)`, `getTrackProgress(trackId, userId)` (returns `{ completedCount, totalCount, nextItem }`).
- Admin REST endpoints: `GET / POST /api/admin/tracks`, `GET / PATCH / DELETE /api/admin/tracks/[slug]`, `POST /api/admin/tracks/[slug]/reorder` (atomic batch reorder), plus `POST / DELETE /api/admin/tracks/[slug]/items/[itemId]` for add / remove single items.
- Admin UI: `/admin/tracks` index + `/admin/tracks/new` create form + `/admin/tracks/[slug]/edit` editor with reorderable item list (drag handle, plus an "add problem" search-and-add picker borrowed from the existing `AddProblemsPicker` in `components/lists/`).
- Learner UI: `/learn/tracks` index of PUBLISHED tracks (grid of cards w/ cover image + name + summary + count + difficulty + estimated minutes), `/learn/tracks/[slug]` detail page with description + ordered item list + progress bar + sticky "Continue" affordance (jumps to the next un-solved problem).
- Nav: a "Tracks" link in the Learn page header and a "Tracks" mention in the Practice page header next to "Browse by tag".
- MCP server: `list_tracks`, `get_track`, `create_track`, `update_track` (parallel to existing topic/tag/problem tools). Lets editorial authoring happen via Claude Desktop the same way it does for problems.
- Tests: unit tests for the new actions + e2e for the index/detail/admin-create flow.
- SEO: `generateMetadata` on the track detail page; tracks become indexable landing pages.

### Out (deferred)

- **Article items** (`TrackItem.kind = ARTICLE`). Schema is structured so we can add a nullable `articleId` later without breaking changes — just relax the `@@unique([trackId, problemId])` constraint and add a CHECK that exactly one of the two refs is set.
- **User-visible "in progress" badge on `/profile`** and the "Continue" card on `/me`. Polish PR after launch.
- **Hard sequencing** (gate later items behind earlier completion). UX choice; revisit after seeing how learners use tracks.
- **Track tags** (`kind=TRACK` tag, or `Track.tags Tag[]`). Useful for "FAANG track" → company, "Window Functions track" → topic. Punt to v1.5; the slug + name carry enough signal initially.
- **AI-recommended next track.** V14 area.
- **Public sharing / fork.** Tracks are editorial; user lists already cover personal curation.

## File-by-file plan

### `prisma/schema.prisma`
Add `enum TrackDifficulty`, `enum TrackStatus`, `model Track`, `model TrackItem` as specified above. Add `tracks TrackItem[]` to the existing `SQLProblem` model so the inverse relation works. Run `npx prisma migrate dev --name add_tracks`.

### `lib/admin-validation.ts`
Add Zod schemas:
- `TrackCreateInput`: `{ name, slug?, summary, description, difficulty?, status?, estimatedMinutes?, coverImageUrl? }`.
- `TrackUpdateInput`: same shape with all optional.
- `TrackReorderInput`: `{ itemIds: string[] }` — the new order, validated against current member set.
- `TrackItemAddInput`: `{ problemSlug: string, position?: number }` — position optional (default = append).

### `actions/tracks.ts` (new)
```ts
// All "use server".
export async function getPublishedTracks(): Promise<PublicTrack[]>
export async function getTrackBySlug(slug: string): Promise<TrackDetail | null>
export async function getTrackProgress(trackId: string): Promise<{
    completedCount: number
    totalCount: number
    nextItemId: string | null  // first un-solved TrackItem in position order
}>
```
`getTrackProgress` reads `auth()` for the current user; returns zero-progress for unauthed.

### `app/api/admin/tracks/route.ts` (new)
GET list (all statuses, admin only). POST create. Uses `TrackCreateInput`; slug minted from name when omitted.

### `app/api/admin/tracks/[slug]/route.ts` (new)
GET single (admin), PATCH update, DELETE archive (soft — sets `status = ARCHIVED`, hard delete only for empty drafts).

### `app/api/admin/tracks/[slug]/reorder/route.ts` (new)
POST a new `itemIds` array; server validates membership + length, runs an atomic Prisma transaction that rewrites `position` on every row. Mirrors the existing `reorderList` action in `actions/lists.ts`.

### `app/api/admin/tracks/[slug]/items/route.ts` (new)
POST add a problem (by slug); DELETE not allowed (use per-item route below).

### `app/api/admin/tracks/[slug]/items/[itemId]/route.ts` (new)
DELETE remove a single item.

### `app/admin/tracks/page.tsx` (new)
Admin index: table of all tracks (all statuses), with "New track" CTA.

### `app/admin/tracks/new/page.tsx` (new)
Create form (name, slug, summary, description textarea, difficulty radio, estimated minutes input, cover URL).

### `app/admin/tracks/[slug]/edit/page.tsx` (new)
Editor:
- Track metadata form (same fields as Create + status).
- Items list with drag-handle reordering (reuse the `react-beautiful-dnd`-style pattern from `components/lists/ListDetail.tsx` if present; otherwise a simple up/down button list).
- "Add problem" picker — borrow `components/lists/AddProblemsPicker.tsx`.

### `app/learn/tracks/page.tsx` (new)
Learner index. Server component. Fetches `getPublishedTracks()` and renders a card grid: cover image (or generated gradient), name, summary, item count, difficulty pill, estimated minutes.

### `app/learn/tracks/[slug]/page.tsx` (new)
Learner detail. Server component. Fetches `getTrackBySlug(slug)` and `getTrackProgress(trackId)`. Renders:
- Hero: cover image + name + summary + difficulty + count + estimated minutes + progress bar.
- Description block (rendered as markdown via the existing `lib/markdown` if available, else plain text).
- Items list — each row shows position number, problem title, difficulty pill, and a per-item solved checkmark.
- Sticky "Continue" button at the top that links to `/practice/<nextItem.slug>`. Renders "Start" when no items solved yet; "Review" when all done.

### `components/learn/TrackCard.tsx`, `components/learn/TrackProgressBar.tsx`, `components/learn/TrackItemRow.tsx`
Small presentational pieces. Server-renderable. No client JS unless needed for hover state.

### Nav surfaces
- `app/learn/page.tsx` — add a "Tracks" CTA in the header (or below the topic list, depending on existing layout).
- `app/practice/page.tsx` — add a "Tracks" link next to the existing "Browse by tag" link.

### `mcp-server/src/tools/tracks.ts` (new)
Four tools, paralleling the existing `topics.ts` / `tags.ts`:
- `list_tracks` — returns all tracks with status.
- `get_track` — by slug, returns metadata + ordered item list.
- `create_track` — minimum: name, summary, description; rest defaults.
- `update_track` — by slug, accepts the same fields. `tagSlugs` (deferred) when track tags ship.
- Add an `add_track_item` / `remove_track_item` / `reorder_track_items` set if MCP-driven curriculum design becomes a regular workflow. For v1, surface only `create_track` + `update_track` and let editorial use the admin UI for ordering.

Register in `mcp-server/src/index.ts`.

### `scripts/test-tracks.ts` (new)
Integration tests, same pattern as `scripts/test-tag-discovery.ts` and `scripts/test-companies-tagging.ts`. ~10 tests:

1. **`getPublishedTracks` returns only PUBLISHED tracks** — DRAFT track excluded.
2. **`getPublishedTracks` orders by createdAt desc** (or by editorial `position`? Pick deterministic).
3. **`getTrackBySlug` returns ordered items by position asc.**
4. **`getTrackBySlug` returns null for unknown slug.**
5. **`getTrackBySlug` returns null for DRAFT track** (so the public detail page 404s).
6. **`getTrackProgress` returns `{0, N, firstItemId}` for unauthed user.**
7. **`getTrackProgress` counts ACCEPTED submissions across the user's history** (not just one per problem — distinct on problem).
8. **`getTrackProgress` nextItemId picks the first un-solved item in position order.**
9. **Reorder endpoint** rewrites positions atomically; partial input rejected.
10. **Add item endpoint** rejects duplicate problem.

### `tests/e2e/tracks.spec.ts` (new)
~5 tests:
1. **Public index lists PUBLISHED tracks with correct counts.**
2. **Click into a track → detail page shows ordered items, "Continue" button visible.**
3. **Unknown slug returns 404.**
4. **Logged-in user sees correct progress after seeding one ACCEPTED submission.**
5. **Admin create-track flow** — open form, fill name + summary + description, submit, land on edit page with empty items list. (Skip the MCP path here; the unit tests cover it.)

### `.github/workflows/test.yml`
Add `npm run test:tracks` as a CI step. Mirror the `test:tag-discovery` and `test:companies-tagging` entries.

### `package.json`
Add `"test:tracks": "node --import tsx --test scripts/test-tracks.ts"`.

### `docs/ROADMAP.md`
Mark V9 as shipped in the release that ships this (likely v0.5.x or v0.6.0). Add Recently-shipped entry.

## Tests

See file-by-file above. Cumulative target: ~10 unit + ~5 e2e tests.

## Verification checklist

- [ ] `npx prisma migrate dev --name add_tracks` runs clean.
- [ ] `npm run test:tracks` — all unit tests pass.
- [ ] `npm run test:tag-discovery` + `npm run test:companies-tagging` still pass (no regression on tag projections).
- [ ] `npx tsc --noEmit` clean.
- [ ] `npm run build` (`--webpack`) clean.
- [ ] `npm run test:e2e` — full suite still green.
- [ ] MCP smoke: `npm run mcp:e2e-test` (extend the harness to include track tools).
- [ ] Manual dev smoke:
  - Create a DRAFT track via admin UI → confirm it's invisible on `/learn/tracks`.
  - Promote to PUBLISHED → confirm it appears.
  - Add 3-5 problem items, reorder.
  - As anon user, visit detail page; "Start" CTA shows.
  - Solve one item; refresh detail page; progress bar advances; "Continue" CTA now points to item 2.
- [ ] SEO: `/learn/tracks/<slug>` `<title>` and `<meta description>` use the track name + summary.

## Risks

- **Schema commitment.** Once `Track` + `TrackItem` exist, future structural changes (adding article items, hard gating, multi-author) are migrations not refactors. Mitigation: the `TrackItem` shape leaves room for a nullable `articleId` later without breaking changes.
- **Reorder race.** Two admins editing the same track simultaneously could clobber each other's reorder. Mitigation: low risk in practice (admin team is small); add optimistic concurrency (an `updatedAt` precondition on PATCH) if it becomes a real issue.
- **Progress query cost.** `getTrackProgress` joins Submissions × TrackItems. With 1k tracks × 20 items × 10k submissions it's still a single indexed query, but if track-progress lands on the home page for every signed-in user, we'd want to batch. Note in JSDoc; don't pre-optimize.
- **Editorial bandwidth.** Code ships dark unless someone authors tracks. Plan to seed 3 tracks with the v1 PR (`Window Functions Deep Dive`, `FAANG SQL Set`, `Joins for Data Engineers`) so the index page isn't empty on launch.
- **Discoverability.** Without nav prominence, learners won't find `/learn/tracks`. Mitigation: link from Practice header (next to "Browse by tag") and from the Learn page itself.

## Estimate

- Schema migration + actions + admin REST + admin UI + learner UI + MCP tools + tests = ~800-1,200 LOC across 25-30 files.
- ~1.5-2 weeks of focused work.
- Sequence as **two PRs to minimize review surface**:
  - **PR 1 — Backend + admin** (~half the LOC): schema, actions, admin REST, admin UI, MCP tools, unit tests. Ships behind no public route. Reviewable as plumbing.
  - **PR 2 — Learner surfaces + nav + e2e** (~the other half): `/learn/tracks` index + detail, nav links, e2e tests. Ships the user-visible feature.
- Release: PR 1 ships dark in **v0.4.12** (or alongside v0.5.0 cleanup if those bundle). PR 2 ships in **v0.5.0** (or **v0.5.1** if separately tracked).
- Editorial pass to seed 3 tracks: ~1-2 hours of human-in-loop with MCP after PR 2 lands.

## Sequencing within the feature branch

I'll work in this order so each commit is independently reviewable:

1. **Schema commit** — Prisma models + migration + types regenerated. No code consumers yet. Builds + typechecks cleanly because nothing imports the new models yet.
2. **Actions commit** — `actions/tracks.ts` + unit tests for the actions (TDD: tests first, watch them fail, implement). No routes yet.
3. **Admin REST commit** — `/api/admin/tracks/*` endpoints + zod schemas. Curl-testable.
4. **Admin UI commit** — `/admin/tracks` pages. Hand-test in dev.
5. **MCP tools commit** — `mcp-server/src/tools/tracks.ts`. Rebuild + smoke via `mcp-e2e-test`.
6. **Learner pages commit** — `/learn/tracks` index + detail + nav links.
7. **E2E commit** — tests/e2e/tracks.spec.ts + CI wiring.
8. **Docs commit** — ROADMAP update, plan-doc reference.

Each commit type-checks and builds on its own. The PR boundary between 1-5 (backend) and 6-7 (learner UI) is the natural split point if we want PR 1 + PR 2 separation.

## Open decisions (kicking back to user)

None blocking the start — the "Approved decisions" block at the top captures the load-bearing calls. Two cosmetic ones I'd appreciate input on before I draw the UI:

- **Cover image — required or optional in v1?** I'm planning optional with a gradient fallback. If you want a clean look at launch, we can require it and lean on Vercel/Unsplash for 3 seed images.
- **Track tagging** (e.g. "FAANG track" → company:meta+amazon+... tags). Lean: skip in v1; the track's slug + name carry the signal. Revisit when we have 10+ tracks and need browse-by-theme.
