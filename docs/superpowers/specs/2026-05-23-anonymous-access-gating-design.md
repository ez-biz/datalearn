# Anonymous access gating — free-trial workspace wall

> **Status:** design approved by user. Awaits implementation plan via writing-plans skill.
> **Date:** 2026-05-23

## Goal

Limit how much value an anonymous (non-signed-in) visitor can extract from `/practice/**` before they're required to sign in, without harming the SEO surface or the "try it free" first impression. The mechanism is a LeetCode-style free trial: three problems' worth of in-browser query execution, then a workspace-side wall on the fourth distinct problem.

The change is one new client gate (`gateRunQuery`) in `ProblemClient` + one new server-action gate (`validateRunQuery`) keyed off a signed cookie, plus a small chip on the Run button, a sign-in modal, and three Vercel Analytics events. No schema changes. No backend rate-limiter dependency. No new auth providers.

## Non-goals

- Server-side anonymous user records / persistent guest accounts. (Per-browser cookie + localStorage only.)
- Redis-backed rate limiting on Run. Deferred until telemetry shows bypass volume that justifies the dependency.
- IP-based fingerprinting or device tracking.
- Gating the catalog (`/practice`), Learn articles, discussion reads, or `/api/problems/[slug]/discussion`. All stay public.
- A/B testing different quotas or copy. v1 ships one configuration.
- Email-only sign-up. We stay on the existing GitHub + Google OAuth providers via NextAuth.
- Refunding the three trial slots when a user signs in. Sign-in is its own unlock event; trial credits are not restored or carried over.
- Gating `Check Answer`. That path is already blocked for anons at `actions/submissions.ts:36-42`; no change needed.
- "Continue as guest" account persistence across browsers, devices, or sessions.

## Decisions

| Question | Decision |
|---|---|
| Goal of the gate | Drive sign-ups while preserving SEO discovery. |
| Gate flavor | LeetCode freemium: N free problems, then workspace wall on the N+1th. |
| Free quota | **3 problems** (one constant in code; tunable). |
| What counts as "using" a problem | **First successful `Run` click on that slug.** Page visits, schema reads, and re-runs on already-started slugs do not count. |
| Storage of the counter | **localStorage** (`dl:anon:startedSlugs`) **+ signed cookie** (`dl_anon_started`, HMAC-signed JSON, server-readable). |
| Counter reset semantics | Reset on successful sign-in (cleared by NextAuth `signIn` callback). Never refunded. |
| Wall UX on the 4th problem | **Modal overlay** (centered Dialog, two OAuth buttons + "Maybe later"). |
| Quota indicator | **Subtle chip** next to the Run button: `"2 free runs left"`, `"1 free run left"` (amber). Hidden on already-started slugs and for authed users. |
| Server enforcement | New `validateRunQuery` server action checks the signed cookie. Client also enforces; server is authoritative. |
| Logged-in user behavior | No change. |
| Discussion read for anons | Public read remains. No change. |
| Learn articles | Public. No change. |
| Tracks / Daily problem | Same `/practice/[slug]` gate inherits. No special-casing. |

## Policy matrix

| Surface | Anonymous policy | Authed policy |
|---|---|---|
| `/` (home) | Public (unchanged) | Personalized |
| `/practice` (catalog) | Public — browse all | Same + solve indicators |
| `/practice/[slug]` page load | Public — full content visible (description, schema, editor) | Full + history |
| Click **Run** on a *new* problem (slug not in `startedSlugs`) | Allowed if `startedSlugs.length < 3`, else modal | Always allowed |
| Click **Run** on an already-started problem | Always allowed (no double-counting) | Always allowed |
| Click **Check Answer** | Already blocked at `validateSubmission` (existing) | Always allowed |
| `/learn/**` | Public (unchanged) | Same |
| `/api/problems/[slug]/discussion` GET | Public read (unchanged) | Same |
| Discussion POST / vote / reply | Already 401 (existing) | Always allowed |
| `/me/**`, `/admin/**`, `/profile` | Already redirected (existing) | Allowed by role |
| `/api/health` | Public (unchanged) | Same |

The new gate is the single row "Click **Run** on a *new* problem". Everything else is status quo.

## State, storage, and trigger semantics

### Client state

- `localStorage["dl:anon:startedSlugs"]` — JSON array of slugs the anon has run at least once. Example: `["joins", "aggregations", "ctes-and-subqueries"]`.
- Schema is forward-compatible: future versions can extend the entry shape to `{slug, firstRunAt, runCount}` without breaking the v1 length-based gate.

### Server state

- Cookie `dl_anon_started` set on the first successful Run.
  - Format: `<base64(json)>.<hmac-sha256(secret, base64(json))>` where the JSON payload is `{startedSlugs: string[]}`. HMAC secret from `process.env.ANON_GATE_SECRET` (new env var; required in production, generated locally on first dev run via a small bootstrap script).
  - Attributes: `HttpOnly; SameSite=Lax; Secure (prod only); Path=/; Max-Age=31536000` (1 year).
  - Cleared by setting `Max-Age=0` in the NextAuth `signIn` callback so signed-in users never carry an anon counter.
- The cookie is functional (not tracking) — no consent banner needed under GDPR; documented in `/privacy`.

### Trigger semantics

A slug is "started" the first time the anon clicks Run on that problem AND the Run executes successfully through `validateRunQuery`. The slug is appended to both `localStorage` and the cookie on that success.

```ts
// pseudocode in ProblemClient
async function onRunClick(sql: string) {
    const gate = await validateRunQuery({ slug })
    if (!gate.ok) {
        openSignInModal({ slug, reason: gate.reason })
        return
    }
    if (!startedSlugs.includes(slug)) {
        appendStartedSlug(slug) // updates both storages, also via Set-Cookie returned by gate
    }
    runQuery(sql) // existing DuckDB / PGlite execution
}
```

Subsequent Runs on the same slug do not increment.

### Server-side check (defense in depth)

New server action `validateRunQuery({ slug })` in `actions/runtime.ts` (new file):

- Parses + verifies the `dl_anon_started` cookie. If unsigned / tampered / missing, treats `startedSlugs = []`.
- If `session?.user?.id` → returns `{ ok: true }` immediately (authed users bypass).
- Else if `startedSlugs.length < 3 || startedSlugs.includes(slug)` → returns `{ ok: true, setCookie: <updated value> }`.
- Else → returns `{ ok: false, reason: "trial-exhausted" }`.

DuckDB / PGlite execution itself stays client-side; the server gate is on the action the client calls *before* invoking the in-browser engine. Bypassing the server gate requires patching the JS bundle. Accepted.

### Counter reset on sign-in

In `lib/auth.ts`'s `signIn` callback (or the equivalent NextAuth event), clear both storages:

- Server-side: respond to the OAuth callback with `Set-Cookie: dl_anon_started=; Max-Age=0; Path=/`.
- Client-side: the post-sign-in landing page (the existing `signInPath()` target) clears `localStorage["dl:anon:startedSlugs"]` on mount.

After sign-in the user has unlimited Run access. No retroactive credit for the three anon runs (they were never persisted to `Submission` anyway).

## UI surfaces

### 1. Counter chip

Lives in `components/sql/SqlPlayground.tsx`, rendered next to the Run button.

Visibility predicate (all must be true for the chip to render):
- `!session?.user?.id` (the viewer is anonymous), AND
- `!startedSlugs.includes(currentSlug)` (the current problem hasn't been started yet — re-runs on already-tried problems don't need a chip).

Chip text by `startedSlugs.length`:

| `startedSlugs.length` | Chip text | Visual |
|---|---|---|
| 0 | `"3 free runs"` | default border |
| 1 | `"2 free runs left"` | default border |
| 2 | `"1 free run left"` | amber border (`border-amber-400/40`) |
| ≥ 3 | chip hidden, **Run button shows a lock icon next to its label** | the lock state is the visible cue |

The lock icon on Run obeys the same predicate as the chip plus `count >= 3` — i.e., it shows IFF `!session && !startedSlugs.includes(currentSlug) && startedSlugs.length >= 3`. On an already-started slug, Run never shows a lock even when `count >= 3`, because the policy matrix permits re-runs unconditionally.

No layout shift between authed and anon users — the chip slot is conditionally rendered with `display: none` rather than removed from the flow.

### 2. Sign-in modal

New component: `components/auth/SignInModal.tsx`. Reuses the existing `Dialog` primitive.

- Triggered by `gateRunQuery()` returning `trial-exhausted` (client) or `validateRunQuery` server action returning `{ ok: false }` (network).
- Content: friendly header, two OAuth buttons (GitHub / Google) wired to `signIn(provider, { callbackUrl: <currentUrl> })`, a small "Maybe later" link that closes the modal.
- Copy: *"Nice — you've tried 3 problems. Sign in to keep solving, save your progress, and unlock the full catalog."*
- After successful sign-in, the OAuth callback redirects back to the current problem URL with the cookie cleared. The Run button then works.

### 3. Catalog page (`/practice`)

Zero anonymous-specific UI. No banner. No header CTA. Browsing the catalog is unmetered and uncounted. Keeps the page clean for SEO crawlers and casual readers.

### 4. Discussion, Learn, daily, tracks pages

Zero UI changes.

## Telemetry

Three Vercel Analytics events instrument the funnel. No new vendor.

| Event | Trigger | Properties |
|---|---|---|
| `anon_run_consumed` | After a successful Run that appends a new slug to `startedSlugs` | `{ slug, totalStarted: 1\|2\|3 }` |
| `anon_wall_shown` | When `SignInModal` renders for the `trial-exhausted` reason | `{ slug, attemptedFrom: "run" }` |
| `anon_signin_from_wall` | When the user clicks an OAuth button inside the modal | `{ slug, provider: "github" \| "google" }` |

Conversion = `anon_signin_from_wall / anon_wall_shown`. Target after one week: > 25%. Below 15% → revisit copy or quota in v1.1.

## Edge cases (decided, not deferred)

1. **Sign-out after authed use.** The anon counter starts fresh after sign-out. No backfill from authed history.
2. **Already-solved problems for an anon who later signs in.** `Submission` history starts at sign-in. The three anon runs are not retroactively credited.
3. **`localStorage` disabled.** Chip doesn't render; the server cookie alone enforces the gate. If both are blocked, the client falls open (anon gets unmetered access). Acceptable — we're not protecting secrets.
4. **Programmatic / cURL hits to server actions.** Same-origin policy on Next server actions + the signed cookie are the gate. Anyone calling the action without a cookie is treated as fresh-trial; they still hit `validateSubmission`'s auth gate on Check Answer.
5. **Admins / contributors.** Already authed via session; gate never applies.
6. **Daily problem page.** Same slug-based counter applies. If the daily is a slug the anon already ran, free. Otherwise it counts as a 4th-problem trigger like any other.
7. **Tracks (`/learn/tracks/[slug]`).** Track listing is public. Clicking into a problem from a track goes to `/practice/[slug]` and the same gate applies. No special-case logic.
8. **Cookie tampering.** HMAC verification on `validateRunQuery` rejects a tampered cookie and treats `startedSlugs = []`. Worst case for an attacker: they reset to a fresh trial, which they could also do by clearing storage. No worse than the baseline.
9. **Quota tuning.** `MAX_FREE_PROBLEMS = 3` is a single constant in `lib/anon-gate.ts` (new file). Tuning is a one-line PR.

## Out of scope (do not add)

- Server-side anonymous-user `AnonSession` table (v2 if cookie bypass becomes a measured problem).
- IP-based or device-fingerprint rate limiting.
- A/B test framework integration.
- Per-problem-difficulty quota tiers (e.g., 5 free easy, 1 free hard).
- Persistent guest accounts (cookies promotable to real accounts on sign-up).
- Mobile-app-specific UX (the site is responsive web only in this scope).

## Risks and mitigations

| Risk | Mitigation |
|---|---|
| Determined anons reverse-engineer the JS bundle and bypass the client gate | Server cookie check on `validateRunQuery`; bypass also requires patching the bundle and re-signing the cookie (requires `ANON_GATE_SECRET`). Low payoff for high effort; accepted. |
| SEO traffic drops because crawlers see the chip / modal in HTML | Crawlers see the full HTML on page load — the chip is hidden for `count == 0` (visible text: `"3 free runs"`, which is a neutral marketing string). The modal is mounted hidden; only opens on a user click. Verified by `curl -A Googlebot ...` after implementation. |
| Cookie consent / GDPR | The cookie is functional (auth-trial state), not tracking. No banner change. Updated `/privacy` text covers it. |
| The 3-problem quota is wrong (too tight or too loose) | Single constant; tuned via telemetry over the first two weeks. |
| Anons confused by the chip → support tickets | Modal copy explains the system. Chip wording is plain English. Telemetry on bounce-after-chip-shown signals confusion. |
| Race between client appendStartedSlug and server cookie set | Server returns `Set-Cookie` in the `validateRunQuery` action response; client mirrors to localStorage in the same code path. Single source of truth on the round-trip. |
| Existing logged-in users hit a regression | Gate paths are wrapped in `if (!session?.user?.id)`; logged-in callers short-circuit at line 1 of the gate. Regression risk near zero. |

## Done criteria (gate)

- [ ] New file `lib/anon-gate.ts` exports `MAX_FREE_PROBLEMS`, `signCounter()`, `verifyCounter()`, `parseCookieValue()`. Unit tests in `scripts/test-anon-gate.ts` cover signing, verification, and tamper detection.
- [ ] New server action `validateRunQuery` in `actions/runtime.ts` returns the four documented outcomes.
- [ ] `lib/auth.ts` clears the `dl_anon_started` cookie on the `signIn` event.
- [ ] `components/auth/SignInModal.tsx` renders the two OAuth buttons + "Maybe later"; opens on `trial-exhausted` from either the client gate or a 4xx from the server action.
- [ ] `components/sql/SqlPlayground.tsx` renders the chip next to Run when `!session && !startedSlugs.includes(currentSlug)`. Amber border at `count == 2`. Hidden at `count >= 3` with a lock-icon swap on the Run button.
- [ ] `components/practice/ProblemClient.tsx` calls `validateRunQuery` before `runQuery`; on rejection opens the modal. On success and on a new slug, persists to both storages.
- [ ] `ANON_GATE_SECRET` env var added to `.env.example` with a generation hint; required in Vercel production and preview.
- [ ] Three telemetry events fire and are visible in Vercel Analytics within 1 hour of preview deploy.
- [ ] Browser-smoke on Vercel preview: anon hits problem 1-3 (Run works, chip counts down), problem 4 (modal opens), signs in via GitHub (cookie cleared, Run works on problem 4 immediately).
- [ ] `curl -A Googlebot` smoke on `/practice/joins` shows the full schema + description + editor markup in the HTML response (no gate text other than the neutral `"3 free runs"` chip text).

## Open questions

None at spec-approval time. Implementation may surface follow-ups; they go into the implementation plan, not this spec.

## References

- Auth setup: `lib/auth.ts`, `lib/auth-redirect.ts`, `types/next-auth.d.ts`.
- Existing `validateSubmission` gate (the pattern to match): `actions/submissions.ts:36-42`.
- Existing discussion API auth gate pattern: `lib/discussions/api-auth.ts:50-67`.
- Workspace client component (where the new gate hooks in): `components/practice/ProblemClient.tsx`.
- SQL editor toolbar (where the chip lives): `components/sql/SqlPlayground.tsx`.
- Sign-in path helper: `lib/auth-redirect.ts` (`signInPath()`).
- NextAuth providers configured: GitHub, Google (see `lib/auth.ts`).
- Privacy doc to update for the cookie: `app/privacy/page.tsx`.
- Prior handoff with context on the workspace + auth flows: `docs/superpowers/handoff/2026-05-21-learn-v2-launch-handoff.md`.
