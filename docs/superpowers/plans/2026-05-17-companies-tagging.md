# Companies tagging (V18) — Implementation Plan

**Date:** 2026-05-17
**Status:** Plan, approved (not yet implemented)
**Branch:** `feat/companies-tagging` (to be created)
**Depends on:** v0.4.10 tag-discovery (shipped)
**Approved decisions:**
- **Section order:** Companies *above* Topics on `/practice/tags` (stronger search intent for interview prep).
- **Launch gate:** Companies section is hidden until ≥ 5 distinct companies have ≥ 3 PUBLISHED problems each. Enforced server-side in the page render, not a feature flag — no DB toggle, just a count threshold.
- **No `Company` model in this PR** — flat `Tag` with `kind=COMPANY`. Revisit only if a designed company-detail page lands.

## Goal

Tag problems with the companies that ask them in interviews ("Asked at Stripe", "Asked at Meta data team"). Surface a "Browse by company" view so learners can generate "the FAANG SQL set in one click." This is the V18 roadmap item, and it's cheap to land now because the tag infrastructure shipped in v0.4.10.

## Why now

- Tag infra is already wired end-to-end (`/practice/tags`, `/practice/tags/[slug]`, `TagPill`, `getPublicTags`, `getProblemsByTag`, MCP authoring).
- Marketing leverage: every company tag becomes an SEO landing page ("Stripe SQL interview questions"). Long-tail organic traffic.
- Compounds with V9 Tracks — a "FAANG track" is just a company tag + an editorial title.
- Low blast radius: a one-column schema migration + UI split. No data backfill.

## Non-goals

- **Don't** model `Company` as a separate entity yet (logo URL, description, careers link). Use a flat tag with `kind=COMPANY`. If we later need company metadata, a `Company` table can join in.
- **Don't** build a top-level inline "Companies" dropdown on `/practice` in this PR. The split index page is enough discovery for v1; the dropdown is a v2 follow-up after we see what actually gets clicked.
- **Don't** auto-tag problems. The mapping from problem → companies is editorial; MCP-driven authoring is the workflow.

## Scope

### In

- Schema: add `Tag.kind` enum (`TOPIC | COMPANY`) defaulting to `TOPIC`. One-column migration.
- Actions: `getPublicTags()` returns kind; new `getPublicTagsByKind()` for split views.
- UI: `/practice/tags` splits into two sections — **Browse by topic** and **Browse by company**. Empty company list gracefully hidden in v1 (until the editorial pass lands).
- UI: `TagPill` learns to optionally show a building/company glyph for `COMPANY` tags.
- UI: `/practice/tags/[slug]` title format adapts by kind ("Stripe SQL problems" vs "Window Functions SQL problems"). Meta description does too.
- Admin form (`/admin/tags/new`): kind selector. Default `TOPIC`.
- MCP server: `create_tag` tool gains an optional `kind` parameter (default `TOPIC`); `list_tags` returns kind.
- Tests: unit tests for the new action + kind-aware projections; e2e for the split index.

### Out (defer)

- `Company` model with `logoUrl`, `description`, `careersUrl` etc. — bring in only when we have a designed company-detail page that needs them.
- Top-level "Companies" filter dropdown inline on `/practice` (composable with difficulty/search).
- Auto-suggested company tags from problem text — too noisy without curation.
- Company-tag aliases ("Meta" vs "Facebook") — keep one canonical slug per company.
- `kind=SKILL` / `kind=DIFFICULTY_AREA` etc. — easy to add later; not needed now.

## Schema migration

```prisma
enum TagKind {
  TOPIC
  COMPANY
}

model Tag {
  // ... existing fields ...
  kind      TagKind      @default(TOPIC)
  // ...
}
```

Single column, default value means **no backfill**. All 8 existing tags become `TOPIC` automatically. Migration is safe in production.

Prisma migration name: `add_tag_kind`.

## File-by-file plan

### `prisma/schema.prisma`
- Add `enum TagKind { TOPIC COMPANY }`.
- Add `kind TagKind @default(TOPIC)` to `Tag`.
- `npx prisma migrate dev --name add_tag_kind` locally.

### `actions/problems.ts`
- Extend `PublicTagSummary` with `kind: "TOPIC" | "COMPANY"`.
- Update `getPublicTags()` projection to include `kind`.
- New: `getPublicTagsByKind(kind)` — same shape as `getPublicTags()` but filtered. Internally just `getPublicTags().filter(t => t.kind === kind)` — or a fresh Prisma query for tag-page detail. Same sort order. Same ghost-tag exclusion.
- Update tag projection in `getProblems()` to include `kind` so PracticeList can render company pills with the right glyph.

### `app/practice/tags/page.tsx`
Split into two sections with **Companies above Topics**:

```tsx
const tags = await getPublicTags()
const companies = tags.filter(t => t.kind === "COMPANY")
const topics    = tags.filter(t => t.kind === "TOPIC")

// Launch gate: Companies section is hidden until enough editorial work exists.
// Threshold: ≥ COMPANY_MIN_COUNT distinct companies, each with
// ≥ COMPANY_MIN_PROBLEMS published problems. Computed from the same
// `problemCount` already in the projection — no extra query.
const COMPANY_MIN_COUNT = 5
const COMPANY_MIN_PROBLEMS = 3
const showCompanies =
    companies.filter(c => c.problemCount >= COMPANY_MIN_PROBLEMS).length
    >= COMPANY_MIN_COUNT
```

Render order:

1. **Header** unchanged ("Browse by tag").
2. **In-page anchor nav** (only when `showCompanies && topics.length > 0`): `Companies · Topics`. Sticky-on-scroll with subtle border-bottom.
3. **Section 1: Companies** (only when `showCompanies`) — anchor `#companies`. Grid of company cards. Card content: `<Building2 />` icon prefix + name + "N problems". Hover treatment matches Topics cards.
4. **Section 2: Topics** — anchor `#topics`. Existing grid behavior, unchanged.
5. **Empty state** if `topics.length === 0` (won't happen in practice but keep the existing copy for defensive symmetry).

When `showCompanies` is false (the typical state during editorial buildout), the page renders exactly as today — Topics only, no header change, no broken anchor links. The gate is invisible to learners; it just delays the unveil.

### `app/practice/tags/[slug]/page.tsx`
- `generateMetadata` uses kind to format:
  - `COMPANY`: `title: "Stripe SQL interview questions"`, description references "interview problems from Stripe".
  - `TOPIC` (current): `title: "Window Functions SQL problems"`.
- Page heading mirrors the title.
- Add an optional "tagline" line below the h1 for `COMPANY` tags: "Common SQL questions from Stripe interviews."

### `components/ui/TagPill.tsx`
- Add `kind?: "TOPIC" | "COMPANY"` to the props.
- For `COMPANY`, prefix with a small `<Building2 />` lucide icon and use a slightly different border/background token to make companies scannable in a problem row.

### `components/practice/PracticeList.tsx`
- Update the `Problem` interface tag shape to include `kind`.
- Pass `kind` through to `TagPill`.
- Mobile cap of 2 pills already in place — no change needed.

### `app/admin/tags/new/page.tsx` (or wherever the admin tag form lives)
- Add a `kind` radio/select. Default `TOPIC`. Two options for now.

### `lib/admin-validation.ts`
- Add `kind: z.enum(["TOPIC", "COMPANY"]).default("TOPIC")` to the tag-create schema.

### `mcp-server/src/tools/tags.ts`
- `create_tag` tool: add optional `kind` parameter (zod enum), default `TOPIC`.
- `list_tags` tool: return `kind` in the response. Useful so the LLM can see whether a tag already exists in the right category before creating a duplicate.

### `scripts/audit-tags.ts`
- Group output by kind (Companies / Topics). Same duplicate detection, but partitioned. Helps spot e.g. `company-stripe` vs `stripe-payments` overlap.

## Editorial workflow (out of code scope, required for launch)

This is what actually makes the feature visible. The code ships dark — the launch-gate threshold (≥ 5 companies × ≥ 3 problems each, see above) keeps the Companies section hidden until editorial catches up. Two passes:

### Pass 1 — Seed canonical company tags

Create exactly 15 tags with `kind=COMPANY`. Slug is lowercase-kebab; name uses canonical brand casing.

| Slug | Display name |
|---|---|
| `meta` | Meta |
| `amazon` | Amazon |
| `apple` | Apple |
| `netflix` | Netflix |
| `google` | Google |
| `microsoft` | Microsoft |
| `stripe` | Stripe |
| `airbnb` | Airbnb |
| `uber` | Uber |
| `linkedin` | LinkedIn |
| `doordash` | DoorDash |
| `snowflake` | Snowflake |
| `databricks` | Databricks |
| `spotify` | Spotify |
| `coinbase` | Coinbase |

Seed via MCP (preferred — repeatable) or admin UI. Either way, no problems attached yet → Companies section stays hidden due to launch gate.

### Pass 2 — Attach companies to problems

For each of the 39 PUBLISHED problems, decide which companies ask that style of question. Some problems will have zero companies attached — that's fine, the absence is also signal.

**MCP-driven workflow:**
- For each problem, ask Claude (via the MCP server) to read title + description and propose 0-3 company tags from the canonical list, with one-sentence justification per proposal.
- Manual review pass before publish — reject the speculative ones.
- Realistic estimate: 30-60 min human-in-the-loop for all 39 problems.

**Launch milestone:** the moment ≥ 5 companies have ≥ 3 problems each, the gate flips and the Companies section appears on the next page render (no deploy needed). Verify by visiting `/practice/tags` and seeing the new section + nav anchor.

### Post-launch ops

- Telemetry: count clicks on Companies cards vs. Topics cards to see whether the section earns its real estate.
- If a company underperforms in editorial (e.g. only 1 problem ever gets tagged "DoorDash"), the launch gate keeps it visually consistent — it appears in the section once the *whole* gate is met, but a single-problem company looks weird. Soft-rule for editors: tag at least 3 problems per company you create, or skip the company.

## Tests

### Unit (`scripts/test-companies-tagging.ts`, node:test)

1. **Schema default**: a tag created without `kind` defaults to `TOPIC`.
2. **`getPublicTags` returns kind on every tag** — existing tags after the migration have `kind=TOPIC`.
3. **`getPublicTagsByKind('COMPANY')`** filters correctly + still sorts by count desc / name asc.
4. **`getPublicTagsByKind('TOPIC')`** symmetric.
5. **`getProblemsByTag(companySlug)`** returns problems with their full tag projection including kind.
6. **Admin validation rejects unknown kind values** ("MOVIE" → 400).

### E2E (`tests/e2e/companies-tags.spec.ts`)

Tests seed both kinds with the `e2e-co-` prefix and clean up after. Each case sets up the minimum DB state it needs:

1. **Launch gate below threshold → Companies section hidden.** Seed 4 companies × 3 problems each (or 5 × 2). Visit `/practice/tags`. Assert no `Companies` heading. Topics still renders unchanged.
2. **Launch gate met → Companies section visible above Topics.** Seed 5 companies × 3 published problems each. Visit `/practice/tags`. Assert:
   - "Companies" heading is visible and appears before the "Topics" heading in the DOM order.
   - In-page anchor nav (`Companies · Topics`) is present.
3. **Company tag detail page uses kind-specific copy.** Click into one company card; assert h1 contains "Stripe SQL interview questions" (or whatever the seeded company name is) and the page title matches.
4. **Topic tag detail page is unchanged.** Regression check — same shape as the existing `tests/e2e/tags.spec.ts` happy path.
5. **Section is hidden when company tags exist but none reach the per-tag minimum.** Seed 5 companies, each with only 1-2 problems (below `COMPANY_MIN_PROBLEMS`). Assert section hidden. Proves the per-tag threshold, not just the count threshold.

## Verification checklist

- [ ] `npx prisma migrate dev --name add_tag_kind` runs clean on local DB.
- [ ] `npm run test:companies-tagging` — all unit tests pass.
- [ ] `npm run test:tag-discovery` — still passes (no regression).
- [ ] `npx tsc --noEmit` clean.
- [ ] `npm run build` (`--webpack`) clean.
- [ ] `npm run test:e2e` — full suite still green.
- [ ] Manual smoke (dev): create a `kind=COMPANY` tag via admin UI; attach to a problem; visit `/practice/tags` and confirm it appears in the Companies section; click in; confirm h1 + meta title use the company phrasing.
- [ ] MCP smoke: run `npm run mcp:e2e-test` and confirm `create_tag` accepts and roundtrips `kind`.
- [ ] `audit:tags` output groups by kind.

## Risks

- **Casing / branding nits.** "DoorDash" vs "Doordash", "Snowflake" (capital S) etc. Mitigation: editorial pass fixes the name field; slug is always lowercase-kebab so URL aesthetics aren't affected.
- **Tag namespace collision.** Topic tag `stripe` (the technique, doesn't exist today but could) vs company `stripe`. The `kind` column disambiguates server-side; the URL is the same; we'd just need to pick a canonical slug. Today there's no conflict — defer the resolution policy.
- **Editorial gap.** If only Stripe gets tagged in v1, the Companies section looks like a Stripe ad. Mitigation: don't ship the Companies section until ≥ 5 companies × ≥ 3 problems each. Feature-flag via the same "hide empty section" check.
- **SEO duplicate content.** Tag pages have generic-ish meta descriptions. Verify Google doesn't see two pages with identical descriptions. Mitigation: kind-aware copy in `generateMetadata` (already in scope).
- **MCP tool back-compat.** Adding an optional `kind` parameter to `create_tag` is back-compatible — old callers default to `TOPIC`. No breaking change.

## Estimate

- Code: ~250-400 LOC.
- ~4 hours implementation + tests + manual verification.
- ~30-60 min editorial pass (separate, after code lands).
- One PR.

## Sequencing

1. **PR**: schema migration + actions + UI + admin form + MCP tool change + tests. Ships as **v0.4.11**.
2. **After merge**: editorial pass via MCP — create the 15 company tags, attach to problems.
3. **Optional follow-up PR**: if telemetry shows the Companies section gets > 20% of `/practice/tags` clicks, build the inline "Companies" dropdown filter on `/practice`. Otherwise, skip.

## Resolved decisions

- **Section order:** Companies above Topics. Confirmed — stronger search intent for interview-prep traffic.
- **Launch gate strictness:** Enforced. Hide Companies until ≥ 5 companies have ≥ 3 published problems each. Implemented as a server-side count check, not a feature flag.
- **No second "Asked at: …" line on problem rows.** The company `TagPill` carries that signal. Two truths are worse than one.
- **Brand-alias redirects (Facebook → Meta) deferred.** Worth doing only if/when search traffic justifies a 301-redirect map. Out of scope for v1.
