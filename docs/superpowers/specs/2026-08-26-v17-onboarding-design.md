# V17 — First-run onboarding (design)

**Status:** approved, ready for planning
**Date:** 2026-08-26
**Roadmap item:** V17 (`docs/ROADMAP.md`)
**Baseline:** `main` @ `7bd7b09` (post-v0.12.0)

## Why

A new user signs in and lands on `/`, which renders `SignedInHome` — a seven-card dashboard built for someone with submission history. A brand-new account has none, so every card degrades to its fallback at once. SP6 made those fallbacks honest, which is why the page is not embarrassing; it does not make it useful.

The roadmap states the goal: converting an account-creation event into an actual first attempt is the strongest predictor of D7 retention. V11 shipped the funnel that measures it (sign-up → first submission → first acceptance) but nothing yet acts on it.

This spec adds the smallest surface that turns "you have an account" into "you are on a specific lesson": one question, one destination.

## Scope decisions

The roadmap sketches four steps. Three of them are cut or changed, each for a reason that survives review.

**The skill assessment is one tap, not three SQL puzzles.** V17's sketch proposes three short puzzles to bucket the learner. That fails twice. It fights the goal — asking someone to solve three problems *before* they have seen a problem page adds friction to the exact moment the feature exists to smooth, and a puzzle that feels wrong is a plausible abandon point. And it fights the architecture: the flow renders on a route with no database, so real puzzles mean booting DuckDB-WASM — a multi-megabyte WASM download — during signup. `useProblemDB` exists, but no non-workspace route initializes it, and CLAUDE.md is explicit that two inits on a page is a bug. A self-declared level costs one tap, needs no engine, and authors no problems.

Because the assessment is self-declared, the sketch's `onboarding-only` problem tag is **not** introduced. No new `Tag.kind`, no problems hidden from `/practice`.

**Step 1 (name confirmation) is cut.** GitHub and Google both supply a name at sign-in. There is no public profile surface for it to matter to yet — V10's `/u/[handle]` is unbuilt — so confirming it is a screen that changes nothing.

**Step 4 (daily-problem opt-in) is cut.** There is no email infrastructure in this repository: no Resend, no nodemailer, no notification-preference model, no send path anywhere under `lib/`, `app/` or `actions/`. An opt-in checkbox would write a preference that nothing reads. The project's fallback rule — *a block that would render empty must show an honest alternative or not render at all* — applies to controls as much as to cards. When V10 or V12 brings the Resend pipeline, this becomes a two-line addition to an existing flow.

The daily mechanic itself **is** shipped (`lib/daily-utils.ts`, `actions/daily.ts`, and the dashboard's `DailyCard`), despite V15 being listed as unshipped further down the roadmap. That contradiction is a documentation bug, not a missing feature; it should be fixed when the roadmap is next touched.

**The flow is a route, not a modal.** The roadmap says "Not a separate route — modal over `/`". Overridden. A four-screen-turned-two-screen flow with a resume path is a page: refresh-safety, back-button behaviour and deep-linkability come free, the e2e test is an ordinary page test rather than a portal-plus-focus-trap test, and it never renders a brand-new user's emptiest dashboard behind a scrim. The cost is one static match added to `isFocusRoute`, which `test:console-nav` already guards.

There is no generic dialog primitive to reuse anyway: `components/ui/` has no Modal or Dialog, and `components/auth/SignInDialog.tsx` is built as a trigger button. Onboarding has no trigger — it opens on session state — so the modal path would have meant extracting a primitive first.

## What existing data proves

Checks run against `main` @ `7bd7b09` before committing to the design:

| Claim | Evidence |
| --- | --- |
| Sessions are database-backed, so the session callback already holds the full `User` row | `lib/auth.ts` uses `PrismaAdapter` and `session({ session, user })`; `user` is the Prisma record. Surfacing a new column on the session costs no extra query. |
| Middleware must not enforce this | `middleware.ts` `config.matcher` covers only `/admin*`, `/api/admin*`, `/learn*`, and runs `runtime = "nodejs"` with the Prisma session adapter. Enforcing onboarding there means widening the matcher site-wide and paying a DB session read on every request. |
| The featured track is a constant, and this is its first real consumer | `lib/curriculum-featured.ts` exports `FEATURED_TRACK_SLUG` with the comment *"There is no per-user active track concept yet; when one arrives this constant is what it replaces."* |
| The unpublished-track path is real, not theoretical | Same file: *"Note this track ships DRAFT."* `getTrackCurriculumForUser` returns `null` for an unpublished track for non-staff. |
| The catalog cannot be filtered by URL | `app/practice/page.tsx` takes no `searchParams`; filters are client state inside `CatalogClient`, typed by `CatalogFilters` in `lib/practice/catalog-model.ts`. |
| No LLM or email dependency exists to piggyback on | No `@anthropic-ai/*`, `ai`, `@ai-sdk/*`, `openai`, `resend` or `nodemailer` in either `package.json`. |
| The module ladder maps cleanly to three levels | `prisma/seed-analyst-track.ts` authors five modules in order: `foundations`, `joins`, `aggregation`, `window-functions`, `interview-patterns`. |

## 1. Data model

One additive migration. Three nullable columns on `User` and one enum.

```prisma
enum SqlLevel {
  NEW
  INTERMEDIATE
  ADVANCED
}

model User {
  // ...
  sqlLevel              SqlLevel?
  onboardingStartedAt   DateTime?
  onboardingCompletedAt DateTime?
}
```

Three columns, not four, because the states compose without a fourth:

| `startedAt` | `sqlLevel` | `completedAt` | Meaning |
| --- | --- | --- | --- |
| null | null | null | Never reached the flow |
| set | null | null | Reached screen 1, left without answering |
| set | set | null | Answered, left before choosing a destination — flow resumes with the answer pre-selected |
| set | null | set | Skipped deliberately |
| set | set | set | Completed |

What this deliberately does **not** distinguish is "started the lesson" from "browse instead" on screen 2. Both complete the flow. The outcome that matters is a first submission or first lesson progress, and V11 already measures both; a column recording which button was pressed would be a second source for a question already answered elsewhere.

**Backfill runs in the same migration:**

```sql
UPDATE "User" SET "onboardingCompletedAt" = "createdAt" WHERE "onboardingCompletedAt" IS NULL;
```

Without it, every existing user meets a first-run flow on their next visit to `/`. The copy would be wrong for someone with fifty submissions, and it would read as a regression rather than a feature. `prisma migrate deploy` runs on every Vercel build, so this lands with the deploy that ships the route.

`types/next-auth.d.ts` gains `onboardingCompletedAt` on `session.user`, populated in the `session` callback alongside `role` and `id`. Per CLAUDE.md, the augmentation is the mechanism — no casting at call sites. `sqlLevel` is **not** put on the session: only `/welcome` needs it, and that route can read it in its own query.

## 2. Route, shell, and the redirect contract

`app/welcome/page.tsx` is a server component:

- no session → redirect to `signInPath("/welcome")`
- `onboardingCompletedAt` set → redirect to `/`
- otherwise → render the flow, seeded with `sqlLevel` if the user already answered

`recordOnboardingStart` fires from the client on first mount of screen 1, not during server render. A GET that renders a page must stay side-effect-free — Next may render a server component more than once, and a prefetch would otherwise record a start the user never saw. The action is a no-op when `onboardingStartedAt` is already set, so a refresh preserves the original timestamp.

`app/page.tsx` redirects to `/welcome` when the session is present and `onboardingCompletedAt` is null. That check is free — the session is already read at the top of the component — and it must run **before** the existing `getUserStats` / `getDailyStatusForCurrentUser` / `getHomeData` reads, so an onboarding user never pays for a dashboard they will not see.

Only `app/page.tsx` redirects *into* the flow and only `/welcome` redirects *out* of it, and the two conditions are exact complements. A loop is therefore structurally impossible rather than defended against.

A user who signs in from a callback URL — say, from a problem page — lands on that page and is never interrupted. They had intent; onboarding is an invitation, not a gate. They meet it the first time they visit `/`.

`isFocusRoute` in `components/layout/console/focus-route.ts` gains a static match for `/welcome`, so the console shell is replaced rather than wrapped. `/welcome` is one segment and `isAppRoute` requires two, so the mutual-exclusivity invariant pinned in `scripts/test-console-nav.ts` continues to hold. As a focus route, the page supplies its own `<header>` and `<main id="main-content">` **as siblings** — ARIA forbids `banner` inside `main`, the same constraint the lesson reader lives under.

## 3. Level → entry point

A pure, Prisma-free `lib/onboarding/entry-point.ts`:

```text
entryModuleIndex(level, moduleCount):
  NEW          → 0
  INTERMEDIATE → min(2, moduleCount - 1)
  ADVANCED     → min(3, moduleCount - 1)
```

Against the authored track that is `foundations`, `aggregation`, `window-functions`.

**An index with clamping, not a slug map.** A literal `{ INTERMEDIATE: "aggregation" }` would silently resolve to nothing the first time an admin renames a module, and module order is explicitly mutable through `reorderModules`. Clamping also means a one-module or two-module track degrades to "start at the beginning" instead of returning null.

The module resolves to its first lesson through the existing curriculum read (`getTrackCurriculumForUser` via the session-resolving `getTrackCurriculum` action) — the same flattening the reader's `lesson-nav.ts` performs. No new read is introduced.

Placement is **advisory**, exactly as `isModuleUnlocked` is advisory. It selects a starting point and gates nothing. A learner who wants module 01 clicks module 01.

The track is `FEATURED_TRACK_SLUG`. When a second published track exists, `sqlLevel` becomes an input to the per-user active-track concept that constant's own comment anticipates; the level answer is a step toward it rather than a workaround around it.

## 4. Honesty constraints

The featured track ships DRAFT, and `getTrackCurriculumForUser` returns `null` for it to non-staff. The empty path is reachable in production, so it is designed rather than discovered:

- **No published track, or a track with zero modules** → screen 2 renders a "browse the catalog" destination instead of a lesson card. It never renders a module card with "0 lessons".
- **The fallback CTA links to `/practice` with no filter.** The catalog reads no search params; a `?difficulty=EASY` link would be a dead parameter that looks like a feature. Adding URL-param support to `CatalogClient` is a legitimate separate change with its own test surface — it is not smuggled in here.
- **Skip on screen 1** completes the flow immediately and lands on `/`. Screen 2 is never shown, because with no level there is nothing to recommend.
- **Staff previewing a DRAFT track** get the real recommendation, matching the reader's existing ADMIN/MODERATOR preview gate.

## 5. Analytics

Without a read, this ships as a conversion feature whose conversion is unknown.

One section on `/admin/analytics`, built on the existing pure `buildFunnel` from `lib/analytics/funnel.ts`:

```text
signed up → reached onboarding → finished onboarding → made a submission
```

**Every step must be a genuine subset of the one before it.** `buildFunnel` divides each count by the previous one and does not clamp, and `FunnelBar` renders the result directly — so a step that is not a subset produces "250% of previous step" on an operator's screen. This is not hypothetical here: a learner can skip straight from screen 1, which completes onboarding without ever answering, and onboarding is an invitation rather than a gate, so a learner can submit without ever reaching the flow. An earlier draft of this spec chained `signed up → started → answered → completed → first submission`, which fails the subset rule at two of its four transitions. The chain below is the corrected one.

| Step | Condition |
| --- | --- |
| signed up | `createdAt >= ONBOARDING_LAUNCHED_AT` |
| reached onboarding | `onboardingStartedAt` OR `sqlLevel` OR `onboardingCompletedAt` is not null |
| finished onboarding | `onboardingCompletedAt` is not null |
| made a submission | finished onboarding AND has at least one `Submission` |

Two details carry weight. **"Reached onboarding" is OR-ed across all three columns**, not just `onboardingStartedAt`: that write is fire-and-forget from a mount effect, so a fast skip could otherwise complete before it lands and make the step smaller than the one it contains. And **the submission step is scoped to those who finished**, because a cohort-wide submission count is not a subset of the completers above it. It is deliberately not time-ordered against `completedAt` — a learner who signs in from a problem-page callback, submits, and onboards later still counts — which is why the label says "made a submission" rather than "submitted after finishing".

**`answered` (`sqlLevel` is not null) is deliberately NOT a funnel step.** Answering is optional by design, so it is a subset of nothing. It is reported as a standalone figure alongside a **skip rate** tile: users with `completedAt` set and `sqlLevel` null, over all users with `completedAt` set. Rising is bad, which is why it renders through `StatTile` with an explicit polarity.

`getOnboardingCounts` lands in `lib/analytics/analytics-read.ts` — the one module in `lib/analytics/` that holds Prisma reads and is deliberately not a `"use server"` file.

**The cohort is bounded by an explicit `ONBOARDING_LAUNCHED_AT` constant.** Backfilled users have `onboardingCompletedAt` set and `startedAt` null; counting them would poison the denominator from the first day and make the funnel read as a catastrophic drop-off forever. Identifying them by `completedAt == createdAt` would work and is rejected as too clever — an explicit launch constant states the intent.

Rendering uses `components/admin/analytics/StatTile.tsx`, not `MetricCard`: skip rate is a metric where rising is bad, and `MetricCard`'s `DELTA_COLOR` hardcodes up-is-green.

Nothing here goes into `MetricSnapshot`. Every count derives from an immutable timestamp and is computed live, per the rule that a snapshot holds only what cannot be reconstructed.

## 6. Module structure

| File | Purpose | Pure? |
| --- | --- | --- |
| `lib/onboarding/entry-point.ts` | `entryModuleIndex`, level→destination resolution | yes |
| `lib/onboarding/onboarding-write.ts` | `userId`-parameterised writer for the three columns | no (Prisma), **no `"use server"`** |
| `actions/onboarding.ts` | session-resolving `recordOnboardingStart` / `recordLevel` / `completeOnboarding` | `"use server"` |
| `app/welcome/page.tsx` | server component: gating, curriculum read, own header + main | no |
| `components/welcome/WelcomeFlow.tsx` | client: which screen, selection state, action calls | no |
| `components/welcome/LevelStep.tsx` | screen 1, presentational | no |
| `components/welcome/StartHereStep.tsx` | screen 2, presentational, including the no-track fallback | no |

The writer/action split is not stylistic. CLAUDE.md's rule: every export of a `"use server"` module becomes a client-callable RPC endpoint, so a writer taking `userId` as a caller-supplied argument would let any client write onboarding state for any other user. `lib/curriculum-write.ts` is the existing precedent and this follows it exactly.

## 7. Access control

Three server actions, all session-resolving, all writing only to the calling user's row. There is no admin surface, no read of another user's state, and no new API route. The analytics read inherits the portal's existing ADMIN-only gate (MODERATOR excluded).

`sanitizeAuthCallbackPath` in `lib/auth-redirect.ts` already rejects protocol-relative and control-character callbacks, so `signInPath("/welcome")` needs no new validation.

## 8. Phasing

Three PRs, each independently revertible.

1. **Schema and logic, ships dark.** Migration + backfill, session augmentation, `lib/onboarding/entry-point.ts`, `onboarding-write.ts`, `actions/onboarding.ts`, and the pure unit suite. No route exists yet, so nothing changes for any user.
2. **The route.** `/welcome`, the three components, the `isFocusRoute` widening, the redirect in `app/page.tsx`, widened `test:console-nav`, and the e2e spec. This is the PR that changes behaviour.
3. **The analytics section.** `getOnboardingFunnelCounts` and its tile. Deliberately last: the funnel is meaningless until phase 2 has been live long enough to produce a cohort.

## 9. Testing

| Suite | Asserts |
| --- | --- |
| `npm run test:onboarding-entry` (new, pure) | Level→index mapping; clamping at one and two modules; empty curriculum → null; every `SqlLevel` value handled with no fallthrough |
| `npm run test:console-nav` (widened) | `/welcome` is a focus route; `isAppRoute`/`isFocusRoute` remain mutually exclusive over every real route |
| `tests/e2e/welcome.spec.ts` (new) | New user redirected from `/`; exactly one `banner`, one `main`, one `h1`; skip completes and never redirects again; answering lands on the expected lesson; a completed user hitting `/welcome` is bounced to `/`; the no-track fallback renders a catalog CTA and never "0 lessons" |
| `npm run test:analytics-onboarding-funnel` (new, pure) | Onboarding steps produce null rates over empty cohorts rather than zeros; and no step's `rateFromPrevious` exceeds 1, asserted over a skip-heavy cohort where more users completed than answered |

Every new guard is proven non-vacuous by breaking the thing it guards and watching it fail before the commit lands — the standard this repository has applied since SP1.

The e2e spec seeds its own user and track rather than depending on seed data, following `tests/e2e/lesson-reader.spec.ts`.

## Open questions

- **Copy for the three levels is provisional.** "New to SQL" / "I can write JOINs and GROUP BY" / "Prepping for senior interviews" reads well and maps to the module ladder, but it is a product-voice decision worth a pass against `docs/design-system/README.md` during implementation.
- **`ONBOARDING_LAUNCHED_AT` needs a real value** — set it to the phase 2 production deploy date, not the phase 1 merge date, since phase 1 ships dark.
- **Whether skipping should be re-offerable.** Today a skip is permanent: `completedAt` is set and the flow never returns. A dismissible dashboard entry point for skippers is a plausible follow-up, deliberately not in v1.
