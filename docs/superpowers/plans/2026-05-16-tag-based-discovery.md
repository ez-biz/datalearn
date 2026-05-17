# Tag-based Problem Discovery — Implementation Plan

**Date:** 2026-05-16
**Status:** Plan (not yet implemented)
**Branch:** `feat/tag-discovery` (to be created)
**Spec:** none (small enough to skip — design lives in this plan)

## Goal

Make the 39+ problem catalog navigable by tag. Today the only filters on `/practice` are search, difficulty, and solved/unsolved. Tags exist on every problem (`SQLProblem.tags Tag[]`) but aren't surfaced anywhere learner-facing. This PR closes that gap with two public routes, inline tag pills on every problem row, and SEO-friendly tag landing pages.

## Why this and not curated lists

The `ProblemList` model requires `ownerId` (all lists are user-private). Building "official curated lists" needs a schema migration + admin authoring UI + per-list slug/description/ordering, and is a larger investment we should make only after seeing whether tag discovery actually drives engagement. Tag pages are strictly additive — no schema migration, no new model, no admin UI — and reuse the existing `PracticeList` component.

## Scope

### In

- `app/practice/tags/page.tsx` — index of all tags with PUBLISHED-problem counts.
- `app/practice/tags/[slug]/page.tsx` — pre-filtered problem list for one tag.
- `actions/problems.ts` — extend `getProblems()` projection to include tags; add `getProblemsByTag(slug)` and `getPublicTags()` actions.
- `components/practice/PracticeList.tsx` — accept an optional list of tag pills per problem; render them clickable.
- `components/ui/TagPill.tsx` — new primitive: small clickable pill matching the existing design tokens.
- Navigation: link `/practice/tags` from the practice page header.
- SEO: `generateMetadata` on the tag detail page with tag name + problem count.
- Tests: unit tests for the two new actions + an E2E test that clicks a tag pill and verifies the filtered view.

### Out (defer)

- **Tag dropdown filter inline on `/practice`** — composable with difficulty/search/status filters. Worth doing once tag pages prove valuable; not required to make tags discoverable.
- **Tag descriptions / authoring UI** — admins can already create tags via the admin API and MCP. Tag editorial copy ("Self-joins are useful when…") is content work that should follow demand.
- **"Popular tags" widget on the home page** — separate PR, low priority until we know which tags trend.
- **Official curated lists** — the larger ProblemList refactor described in the previous PM discussion. Tag pages are the bet that simple thematic browsing is enough.
- **Tag-based recommendations** ("you solved 3 window-function problems, try X next") — depends on tag pages existing first.

## File-by-file plan

### `actions/problems.ts`

Two changes:

1. **Extend `getProblems()` projection** to include a minimal tag shape per problem:

   ```ts
   tags: { select: { slug: true, name: true } }
   ```

   This adds ~1 join per query; tags are already eagerly fetched by Prisma. Keep the existing PUBLISHED filter and ordering.

2. **Add two new actions:**

   ```ts
   export async function getPublicTags(): Promise<{
       slug: string
       name: string
       problemCount: number
   }[]>

   export async function getProblemsByTag(slug: string): Promise<{
       tag: { slug: string; name: string } | null
       problems: PublicProblem[]  // same shape getProblems() returns
   }>
   ```

   - `getPublicTags()` joins `Tag` with the count of `SQLProblem` rows where `status = PUBLISHED`. Returns sorted by `problemCount` desc, then `name` asc. **Excludes tags with zero published problems** so the index doesn't show ghost entries.
   - `getProblemsByTag(slug)` returns the tag metadata + the problems (with the same projection as `getProblems`) where the join matches `tag.slug = $1` AND `status = PUBLISHED`. If the slug doesn't exist or has no published problems, returns `{ tag: null, problems: [] }` so the page can 404 cleanly.

### `app/practice/tags/page.tsx` (new)

Server component. Fetches `getPublicTags()`, renders a grid of cards. Each card shows: tag name, problem count, link to `/practice/tags/<slug>`.

Sections to consider:

- **Header**: "Browse by tag" + one-line description.
- **Grid**: 2–3 columns responsive. Each card uses `Card` from `components/ui/` and `TagPill` for visual consistency. Hover → primary text color (matches existing patterns from `PracticeList`).
- **Empty state**: if no tags, render `EmptyState` with copy "No tags yet — admins can attach tags via /admin." (Should never happen post-MCP run.)

Metadata: `title: "Browse problems by tag"`, generic description.

### `app/practice/tags/[slug]/page.tsx` (new)

Server component. Fetches `getProblemsByTag(slug)` + `getSolvedSlugs()`. If `tag` is null, calls `notFound()` (404).

Renders:

- Breadcrumb / back link: `← All tags`
- Header: tag name as h1 + problem count + maybe difficulty mix.
- The existing `<PracticeList>` component, passed problems + solved slugs.

`generateMetadata(props)`: dynamic — title = `"<TagName> SQL problems"`, description includes count. This is the SEO surface.

### `components/ui/TagPill.tsx` (new)

```tsx
"use client" // only because clickable; could also be a server-rendered <Link>

interface TagPillProps {
    slug: string
    name: string
    size?: "sm" | "md"
}
```

Renders an inline `<Link href={`/practice/tags/${slug}`}>` styled like a small pill — matches the existing `Badge` primitive's visual weight but uses muted-foreground / surface tokens. Stops click propagation so clicking a pill inside a problem row doesn't navigate to the problem itself (`onClick={(e) => e.stopPropagation()}`).

### `components/practice/PracticeList.tsx`

Two changes:

1. **Update the `Problem` interface** to optionally include `tags: { slug: string; name: string }[]`.
2. **Render tag pills** on each row, wrapped in a small flex container under the title. On mobile, hide all but the first 2 to avoid wrapping chaos.

The existing search/difficulty/status filters remain unchanged. Tag pills are display-only here; the dropdown filter is deferred.

### Practice page header link

`app/practice/page.tsx` — add a small "Browse by tag →" link in the header next to the solved counter (or in a small toolbar row). Minimal UI weight, just a navigation seed.

## Tests

### Unit (Node test runner via tsx)

`scripts/test-tag-discovery.ts`:

1. **`getPublicTags returns only tags with PUBLISHED problems`** — seed a tag with only DRAFT problems → should not appear in the result.
2. **`getPublicTags counts PUBLISHED problems correctly`** — tag with 3 PUBLISHED + 1 DRAFT problems → count is 3.
3. **`getPublicTags sorts by count desc then name asc`** — deterministic ordering.
4. **`getProblemsByTag returns null tag for unknown slug`** — caller can 404.
5. **`getProblemsByTag excludes DRAFT problems`** — security: matches the existing PUBLISHED gate.
6. **`getProblemsByTag preserves number-asc ordering inside the tag`** — same ordering invariant as `getProblems`.

Wire into `package.json` (`test:tag-discovery`) + `.github/workflows/test.yml`.

### E2E (Playwright)

Append to an existing or new e2e file:

1. **Tag pill click navigates to the tag page** — load `/practice`, find a known tag pill, click, assert URL is `/practice/tags/<slug>` and the heading matches.
2. **Tag detail page lists only that tag's problems** — assert problem count matches the filter.
3. **Unknown tag returns 404** — `/practice/tags/does-not-exist` should 404.

## Verification checklist

- [ ] `npm run test:tag-discovery` — all unit tests pass.
- [ ] `npx tsc --noEmit` clean.
- [ ] `npm run build` clean (no new warnings).
- [ ] `npm run test:e2e` — full suite still green.
- [ ] Manual smoke on local dev: `/practice/tags` shows tags with counts; clicking a tag goes to the detail page; tag pills on the main `/practice` list are clickable; tag pills on the home page (if any are featured there) — N/A this PR.
- [ ] SEO: view source on `/practice/tags/window-functions` → `<title>` contains the tag name, meta description references it.

## Risks

- **Tag explosion.** If the catalog has 50+ tags (likely after the MCP run), the index page becomes a wall of cards. Mitigation: sort by problemCount desc so the most useful tags surface first; consider a follow-up to group tags by "company", "skill", "schema" once we see what actually gets created.
- **Tag name conflicts / casing.** The Tag model has `slug` (unique) and `name`. If MCP authors created two tags that differ only in casing (`window-functions` vs `window functions`), the index will show both. **Action item**: a separate clean-up pass to consolidate similar tags before this lands, or a follow-up PR.
- **Empty-tag query cost.** `getPublicTags` does a count join across all problems. With 39 problems this is trivial; at 500+ we'd want to denormalize the count or add an index. Note this in the action's JSDoc but don't pre-optimize.
- **PracticeList prop churn.** Adding `tags` to the projection means a few more bytes per problem in the public list payload. Negligible (slug + name × ~2 tags per problem).

## Estimate

- ~250–400 LOC, mostly UI + a couple of server actions.
- ~3 hours of implementation + tests + manual verification.
- One PR. No schema migration.

## Open questions

- Should the index page show *all* tags or just tags with ≥ 2 problems? (Recommend: all, sorted by count — long tail still useful for SEO.)
- Should solved tags get a checkmark indicator on the index page? (Recommend: defer — adds a per-user query for limited value.)
- Should `/practice` itself show a tag pill cluster at the top ("Popular: window-functions · uber · joins") for discoverability? (Recommend: defer — index page link is enough for v1.)
