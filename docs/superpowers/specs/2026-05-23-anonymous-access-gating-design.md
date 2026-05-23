# Anonymous access gating — free-trial workspace wall

> **Status:** design approved by user; revised after four Codex adversarial review passes (2026-05-23). Awaits implementation plan via writing-plans skill.
> **Date:** 2026-05-23

## Goal

Limit how much value an anonymous (non-signed-in) visitor can extract from `/practice/**` before they're required to sign in, without harming the SEO surface or the "try it free" first impression. The mechanism is a LeetCode-style free trial: three problems' worth of in-browser query execution, then a workspace-side wall on the fourth distinct problem.

**Posture (be precise about this).** The gate is a **conversion nudge backed by a soft server check**, not authoritative enforcement. A determined visitor can clear their browser storage/cookies or open a new browser for a fresh trial; two tabs racing on slug 3→4 can both pass the gate; tampered cookies fall back to localStorage or a fresh cookie state. We accept this because (a) the asset being protected is engagement value, not secrets — DuckDB-WASM runs entirely in-browser, so true enforcement would require server-mediated query execution we don't have, and (b) telemetry over the first two weeks will tell us whether bypass is statistically material. If it is, v1.1 adds a server-side `AnonSession` table with atomic append; v1 stays cookie-only.

The change is a `gateAndExecute(intent)` helper inside `SqlPlayground.tsx` that wraps **both** `handleRun` and `handleSubmit` before they call the in-browser engine, new runtime server actions (`validateRunQuery` and `clearAnonRunCookie`) keyed off a signed cookie, a small chip on the Run button, a sign-in modal, a client-only `AnonStorageReset` component for post-OAuth storage cleanup (receives `isSignedIn` as a server-derived prop from the layout's existing `auth()` call — no extra session lookup per page load, anon mounts no-op), and three Vercel Analytics events. The server-only HMAC code stays out of client bundles. No schema changes. No backend rate-limiter dependency. No new auth providers.

## Non-goals

- Server-side anonymous user records / persistent guest accounts. (Per-browser cookie + localStorage only.)
- Redis-backed rate limiting on Run. Deferred until telemetry shows bypass volume that justifies the dependency.
- IP-based fingerprinting or device tracking.
- Gating the catalog (`/practice`), Learn articles, discussion reads, or `/api/problems/[slug]/discussion`. All stay public.
- A/B testing different quotas or copy. v1 ships one configuration.
- Email-only sign-up. We stay on the existing GitHub + Google OAuth providers via NextAuth.
- Refunding the three trial slots when a user signs in. Sign-in is its own unlock event; trial credits are not restored or carried over.
- (Removed prior non-goal that excluded `Check Answer` from the new gate. v1 actually gates **both** Run and Submit via the shared `gateAndExecute` helper — see the trigger-semantics section. The existing server-side `validateSubmission` auth gate remains in place for already-started slugs.)
- "Continue as guest" account persistence across browsers, devices, or sessions.

## Decisions

| Question | Decision |
|---|---|
| Goal of the gate | Drive sign-ups while preserving SEO discovery. |
| Gate flavor | LeetCode freemium: N free problems, then workspace wall on the N+1th. |
| Free quota | **3 problems** (one constant in code; tunable). |
| What counts as "using" a problem | **First successful user-initiated engine action on that slug: `Run` or `Submit / Check Answer`.** Page visits, schema reads, and re-runs/re-submits on already-started slugs do not count. |
| Storage of the counter | **localStorage** (`dl:anon:startedSlugs`) **+ signed cookie** (`dl_anon_started`, HMAC-signed JSON, server-readable). |
| Counter reset semantics | `AnonStorageReset` mounts in the root layout and receives `isSignedIn` as a server-derived boolean prop (derived from the layout's existing `auth()` call — no new session lookup). When `isSignedIn === true` on any mount, it clears localStorage and fire-and-forgets `clearAnonRunCookie` to drop the server cookie. Anon mounts short-circuit on the boolean — no HTTP work. OAuth-remount-safe (clears on every mount-while-signed-in, not on a transition). Server action still does its own `auth()` check as defense in depth against direct calls. Existing server-component `Navbar` is not touched. Never refunded. |
| Wall UX on the 4th problem | **Centered modal overlay** with two OAuth buttons + "Maybe later". |
| Quota indicator | **Subtle chip** next to the Run button: `"3 free runs"`, `"2 free runs left"`, `"1 free run left"` (amber). Hidden on already-started slugs and for authed users. |
| Server enforcement | New `validateRunQuery` server action checks the signed cookie. Soft/advisory, not authoritative — accepts cookie clear, incognito, and two-tab race as acceptable bypass paths in v1. |
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
| Click **Submit / Check Answer** on a *new* problem | Same gate as Run: allowed if `startedSlugs.length < 3`, else modal (and the engine is NOT executed). The existing server-side `validateSubmission` gate still blocks the DB row write for anons even if the gate let them through. | Always allowed |
| Click **Submit / Check Answer** on an already-started problem | Engine runs locally; `validateSubmission` server gate still rejects the DB row write for anons (existing behavior, unchanged). | Always allowed |
| `/learn/**` | Public (unchanged) | Same |
| `/api/problems/[slug]/discussion` GET | Public read (unchanged) | Same |
| Discussion POST / vote / reply | Already 401 (existing) | Always allowed |
| `/me/**`, `/admin/**`, `/profile` | Already redirected (existing) | Allowed by role |
| `/api/health` | Public (unchanged) | Same |

**Invariant (single rule):** Every user-action path that calls `runQuery(editorSql)` from a UI handler — `handleRun` (Cmd/Ctrl+Enter), `handleSubmit` (Cmd/Ctrl+Shift+Enter), and any future handler that performs an engine call from a user click — must pass through the shared `gateAndExecute` helper before invoking the engine. Two rows in the matrix above (Run-on-new-slug and Submit-on-new-slug) are the gated cases; everything else is status quo.

## State, storage, and trigger semantics

### Client state

- `localStorage["dl:anon:startedSlugs"]` — JSON array of slugs the anon has run at least once. Example: `["joins", "aggregations", "ctes-and-subqueries"]`.
- Schema is forward-compatible: future versions can extend the entry shape to `{slug, firstRunAt, runCount}` without breaking the v1 length-based gate.

### Server state

- Cookie `dl_anon_started` set on the first successful Run or Submit gate pass for a new slug.
  - Format: `<base64(json)>.<hmac-sha256(secret, base64(json))>` where the JSON payload is `{startedSlugs: string[]}`. HMAC secret from `process.env.ANON_GATE_SECRET` (new env var; required in production, generated locally on first dev run via a small bootstrap script).
  - Attributes: `HttpOnly; SameSite=Lax; Secure (prod only); Path=/; Max-Age=31536000` (1 year).
  - Cleared by the `clearAnonRunCookie` server action, called from `AnonStorageReset` whenever the root layout renders a signed-in session.
- The cookie is functional (not tracking) — no consent banner needed under GDPR; documented in `/privacy`.

### Trigger semantics

A slug is "started" the first time the anon takes a **user-initiated action that executes an engine query** on it: either clicking Run (or `Cmd/Ctrl+Enter`) OR clicking Submit / Check Answer (or `Cmd/Ctrl+Shift+Enter`). The slug is appended to both `localStorage` and the cookie on the first such action's gate success.

**The gate wraps both `handleRun` and `handleSubmit` in `SqlPlayground.tsx`** — i.e., every code path in the workspace that leads to a `runQuery(editorSql)` call. The gate is *not* hooked into the shared `runQuery` in `useProblemDB` (that would also catch background introspection); it's specifically at the user-action handlers immediately before they invoke the engine.

Why both Run and Submit need the gate, not just Run: the existing `validateSubmission` action at `actions/submissions.ts:36-42` blocks the *Submission DB row creation* for anons, but `SqlPlayground.handleSubmit` runs the engine query *before* calling `onSubmit`. Without the gate on Submit too, an anon past quota could press Submit on a 4th problem, see the result table render, and bypass the entire workspace wall through a normal UI path.

The following code paths must NOT increment the counter (verified by tests in Done criteria):

- Page-load schema introspection / table metadata fetch on `useProblemDB` init.
- Sample data preview rendering inside the `INPUT` panel.
- Any background query the workspace runs to populate the table list, dialect picker, or schema sidebar.
- Programmatic re-runs from React Strict Mode double-effects in dev.

Subsequent Run or Submit clicks on the same slug do not increment.

```ts
// pseudocode in SqlPlayground.tsx (NOT in useProblemDB or runQuery)

async function gateAndExecute(intent: "run" | "submit") {
    const localStartedSlugs = readStartedSlugsFromLocalStorage()
    if (!isSignedIn && !localStartedSlugs.includes(slug) && localStartedSlugs.length >= MAX_FREE_PROBLEMS) {
        onTrialExhausted({ slug, reason: "trial-exhausted", intent })
        return null
    }

    const gate = await validateRunQuery({ slug })
    if (!gate.ok) {
        onTrialExhausted({ slug, reason: gate.reason, intent })
        return null  // signal to caller: do not invoke engine
    }
    if (gate.consumedNewSlot && !localStartedSlugs.includes(slug)) {
        appendStartedSlug(slug)  // updates localStorage; cookie was updated by validateRunQuery
    }
    return runQuery(editorSql)  // existing in-browser DuckDB / PGlite execution
}

async function handleRun() {
    const rows = await gateAndExecute("run")
    if (rows) setResultRows(rows)
}

async function handleSubmit() {
    const rows = await gateAndExecute("submit")
    if (rows) await onSubmit(rows)  // existing server validation pipeline
}
```

Both keyboard shortcuts (`Cmd/Ctrl+Enter` for Run, `Cmd/Ctrl+Shift+Enter` for Submit) bind to the same `handleRun` / `handleSubmit` handlers; no extra wiring needed.

`ProblemClient` passes both `isSignedIn` and the `onTrialExhausted` callback to `SqlPlayground` via new props. The callback opens the modal regardless of `intent` (`run` vs `submit`); the modal copy is identical.

### Server-side check (soft, advisory — not authoritative)

New server actions in `actions/runtime.ts` (new file):

- `validateRunQuery({ slug })`
  - Parses + verifies the `dl_anon_started` cookie. If unsigned / tampered / missing, treats `startedSlugs = []`.
  - If `session?.user?.id` → returns `{ ok: true, consumedNewSlot: false, startedSlugs }` immediately (authed users bypass).
  - Else if `startedSlugs.includes(slug)` → returns `{ ok: true, consumedNewSlot: false, startedSlugs }`.
  - Else if `startedSlugs.length < 3` → appends `slug`, writes the signed cookie with `cookies().set(...)`, and returns `{ ok: true, consumedNewSlot: true, startedSlugs: nextStartedSlugs }`.
  - Else → returns `{ ok: false, reason: "trial-exhausted" }` and does not mutate the cookie.
- `clearAnonRunCookie()`
  - If `session?.user?.id` is present, deletes `dl_anon_started` with `cookies().delete(...)` / `Max-Age=0`.
  - If anonymous, no-ops. This keeps the action safe if the client calls it from a stale tab.

The client performs a localStorage preflight before `validateRunQuery` so either storage can block the common 4th-new-problem case. The server action remains the soft same-browser check when localStorage is unavailable or stale, while localStorage still blocks if the cookie was cleared but the browser storage remains.

Implementation boundary: client components import only a client-safe constants/storage module, for example `lib/anon-gate-client.ts` or `lib/anon-gate-constants.ts`. They must not import `lib/anon-gate.ts` if that file imports `node:crypto` for HMAC signing.

**What this gate does and does not guarantee.** The localStorage preflight plus server action is a soft enforcement layer that catches the common case of "user clicks Run or Submit on the 4th problem in a single browser session" and produces a sign-in conversion event. It is **not** authoritative:

- **Race between tabs.** If a visitor with `startedSlugs = ["a", "b"]` opens slugs `c` and `d` in two tabs simultaneously and clicks Run/Submit in both within the same ~100ms window, both requests can verify against the same incoming cookie value (length 2, OK), both pass the gate, and the response `Set-Cookie` for the second-arriving response overwrites the first. The cookie ends up with one of `{a,b,c}` or `{a,b,d}` — one slug is silently dropped from the counter. The visitor effectively gets 4 trials instead of 3. Accepted.
- **Storage clear / incognito.** The visitor can clear both `localStorage` and `dl_anon_started` (or open an incognito window) at any time for a fresh 3-trial run. Accepted; matches LeetCode behavior; no claim of stronger enforcement.
- **Bundle patching.** Bypassing the client preflight requires inspecting the bundle and avoiding the normal UI path, but the server cookie check still blocks the common same-browser path. High effort, low payoff. Accepted.

Telemetry consequences (covered in the Telemetry section): `anon_wall_shown` undercounts real "anonymous user wanted to run a 4th problem" events by the race factor (estimated tiny — most visitors don't sequence two tabs that fast). If conversion-rate observability matters more than enforcement, the v1.1 path is the durable `AnonSession` table.

DuckDB / PGlite execution itself stays client-side; the server gate is on the action the client calls *before* invoking the in-browser engine.

### Counter reset on sign-in

The two storages clear from one root-mounted component that handles each storage through the right boundary and does not depend on which page the user lands on after OAuth.

**Important architectural constraint.** The existing `components/layout/Navbar.tsx` is an **async server component** that imports `auth()`, `getNavLinks`, and `prisma`. It cannot host a `useSession()` hook directly without converting to a client component (which would break its data-fetching boundary). The reset design therefore uses a tiny client-only sibling component that receives `isSignedIn` as a server-derived boolean prop — **not** a `useSession` hook, and **not** an every-mount server action round-trip. The boolean is derived from the existing `auth()` call that the root layout already does for `<Navbar />`, so the reset adds zero new session lookups per page load.

1. **`isSignedIn` prop is the source of truth.** `app/layout.tsx` already invokes `auth()` to render `<Navbar />` (and for the existing nonce/CSP integration on `/learn/**`). That same result feeds `<AnonStorageReset isSignedIn={Boolean(session?.user?.id)} />`. No extra session lookup, no extra DB hit. Short-circuiting on `!isSignedIn` makes the anonymous-user path a single boolean check per page load — no HTTP work at all.

2. **Cookie + localStorage clear are both triggered when `isSignedIn === true`.** `AnonStorageReset.tsx`:
   ```tsx
   "use client"
   import { useEffect } from "react"
   import { clearAnonRunCookie } from "@/actions/runtime"
   import { clearAnonStartedSlugs } from "@/lib/anon-gate-client"

   export function AnonStorageReset({ isSignedIn }: { isSignedIn: boolean }) {
       useEffect(() => {
           if (!isSignedIn) return
           clearAnonStartedSlugs()
           // Fire-and-forget cookie clear. The server action does its own session
           // check as defense in depth; we don't need to await the response.
           void clearAnonRunCookie()
       }, [isSignedIn])
       return null
   }
   ```

   **Clear on every mount while `isSignedIn === true`, not on a `false → true` transition.** OAuth flows navigate away to the provider and return through `/api/auth/callback/<provider>`, then re-mount the root layout fresh. A component that only fires on a transition (using `useRef`) sees `prevRef.current = null` and `isSignedIn = true` on first render and never clears. Clearing whenever `isSignedIn === true` is mounted is the correct, OAuth-callback-safe rule. `clearAnonStartedSlugs()` is a no-op when the key is already absent.

3. **`clearAnonRunCookie` keeps its own server-side `auth()` check as defense in depth.** A malicious or stale client could call the action directly without an `isSignedIn` prop guard. The action verifies the session before deleting the cookie. If anonymous, it no-ops. This costs at most one server-action round-trip per layout mount **for signed-in users only**; anons skip it entirely because of the `if (!isSignedIn) return` short-circuit. The previous design (server-action call on every mount regardless of session) paid an `auth()` + round-trip cost for every anonymous page load — that was the wrong trade-off.

   Mounted under `app/layout.tsx` (which is a server component) alongside the existing `<Navbar />`:
   ```tsx
   const session = await auth()  // already happening for Navbar / CSP nonce
   const isSignedIn = Boolean(session?.user?.id)
   // ...
   <Navbar />
   <AnonStorageReset isSignedIn={isSignedIn} />
   ```
   Layout already calls `auth()`; we just thread the result through as a prop. No `SessionProvider` boundary is introduced, and Navbar's server-component status is preserved.

This reset path is robust against:

- **OAuth callback remount.** OAuth flows navigate to the provider and return via `/api/auth/callback/<provider>`, which triggers a fresh root layout mount. The layout sees a signed-in session and threads `isSignedIn={true}` into `AnonStorageReset`, which immediately clears localStorage and fire-and-forgets the cookie clear. (The prior `prevRef === false → true` formulation never fired on this path because remount starts with `prevRef = null`; fixed.)
- OAuth callbacks bouncing the user to any URL (the root layout renders there, computes `isSignedIn` from its existing `auth()` call, and `AnonStorageReset` runs).
- The `/auth/signin` page server-redirecting authed users elsewhere (`AnonStorageReset` is in the root layout and renders everywhere).
- Sign-in → sign-out → fresh-anonymous cycle: localStorage is empty after sign-in (cleared on mount), so a subsequent sign-out leaves the visitor with a fresh `[]` counter for the new anonymous session. **An e2e test in Done criteria exercises a full root-layout remount with `isSignedIn=true` — not an in-place prop flip — to assert this cycle.**

After sign-in the user has unlimited Run access. No retroactive credit for the three anon runs (they were never persisted to `Submission` anyway).

## UI surfaces

### 1. Counter chip

Lives in `components/sql/SqlPlayground.tsx`, rendered next to the Run button.

Visibility predicate (all must be true for the chip to render):
- `!isSignedIn` (the viewer is anonymous), AND
- `!startedSlugs.includes(currentSlug)` (the current problem hasn't been started yet — re-runs on already-tried problems don't need a chip).

Chip text by `startedSlugs.length`:

| `startedSlugs.length` | Chip text | Visual |
|---|---|---|
| 0 | `"3 free runs"` | default border |
| 1 | `"2 free runs left"` | default border |
| 2 | `"1 free run left"` | amber border (`border-amber-400/40`) |
| ≥ 3 | chip hidden, **Run button shows a lock icon next to its label** | the lock state is the visible cue |

The lock icon on Run obeys the same predicate as the chip plus `count >= 3` — i.e., it shows IFF `!isSignedIn && !startedSlugs.includes(currentSlug) && startedSlugs.length >= 3`. On an already-started slug, Run never shows a lock even when `count >= 3`, because the policy matrix permits re-runs unconditionally.

Keep the toolbar stable by reserving a small chip slot or otherwise using fixed button-group spacing; do not let the Run/Submit buttons jump horizontally when the chip appears or disappears.

### 2. Sign-in modal

New component: `components/auth/SignInModal.tsx`. Reuses the existing portal/focus-trap pattern from `components/auth/SignInDialog.tsx` plus `ProviderSignInActions`; do not introduce a new dialog library or Radix dependency just for this modal.

- Triggered by either `SqlPlayground.handleRun` or `SqlPlayground.handleSubmit` (via the shared `gateAndExecute` helper) receiving `{ ok: false, reason: "trial-exhausted" }` from the `validateRunQuery` server action, which then invokes the `onTrialExhausted` callback that `ProblemClient` wires to the modal's open state. Modal copy is identical regardless of which intent (Run vs Submit) triggered it.
- Content: friendly header, two OAuth buttons (GitHub / Google) wired through the existing `ProviderSignInActions` / `signIn(provider, { redirectTo: <currentUrl> })` path, a small "Maybe later" button that closes the modal.
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
| `anon_trial_consumed` | After a successful Run or Submit that appends a new slug to `startedSlugs` | `{ slug, attemptedFrom: "run" \| "submit", totalStarted: 1\|2\|3 }` |
| `anon_wall_shown` | When `SignInModal` renders for the `trial-exhausted` reason | `{ slug, attemptedFrom: "run" \| "submit" }` |
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

## Out of scope (do not add in v1)

- **Server-side `AnonSession` table.** Provides atomic append + race-free counter, eliminates the two-tab undercount, and makes the gate authoritative. Deferred to **v1.1**, gated on telemetry showing meaningful bypass (e.g., conversion < 15%, or wall-shown counts implausibly low relative to engaged anons). Decision rule: if `anon_trial_consumed` events plateau or drop in week 2 (suggesting incognito bypass), prioritize v1.1; if conversion is healthy, leave v1 in place.
- IP-based or device-fingerprint rate limiting.
- A/B test framework integration.
- Per-problem-difficulty quota tiers (e.g., 5 free easy, 1 free hard).
- Persistent guest accounts (cookies promotable to real accounts on sign-up).
- Mobile-app-specific UX (the site is responsive web only in this scope).

## Risks and mitigations

| Risk | Mitigation |
|---|---|
| Two-tab race lets a visitor get 4 trials instead of 3 | Accepted in v1. Documented in the Server-side check section. Telemetry's `anon_wall_shown` undercount is expected to be tiny; v1.1 ships an atomic `AnonSession` table if real-world data says otherwise. |
| Storage clear / incognito gives fresh trials | Accepted. Same behavior as LeetCode and Substack metered paywalls. v1 does not attempt to defeat this. |
| Determined anons reverse-engineer the JS bundle and bypass the client gate | Server cookie check on `validateRunQuery` raises the bar (need to inspect bundle + forge `Set-Cookie` ack). Low payoff for high effort. Accepted. |
| SEO traffic drops because crawlers see the chip / modal in HTML | Crawlers see the full problem content on page load. The chip is neutral text (`"3 free runs"`) and the modal does not open until a user action. Verified by `curl -A Googlebot ...` after implementation. |
| Cookie consent / GDPR | The cookie is functional (auth-trial state), not tracking. No banner change. Updated `/privacy` text covers it. |
| The 3-problem quota is wrong (too tight or too loose) | Single constant in `lib/anon-gate.ts`; tuned via telemetry over the first two weeks. |
| Anons confused by the chip → support tickets | Modal copy explains the system. Chip wording is plain English. Telemetry on bounce-after-chip-shown signals confusion. |
| Existing logged-in users hit a regression | Gate paths are wrapped in `if (!isSignedIn)` client-side and `session?.user?.id` server-side; logged-in callers bypass the anon wall. Regression risk near zero. |
| Background / non-Run engine calls (schema introspection, sample preview) accidentally consume quota | The gate hooks into `SqlPlayground.handleRun` and `handleSubmit` only — not the shared `runQuery` in `useProblemDB`. **An e2e test asserts that opening 4+ problems sequentially without clicking Run or Submit does not increment the counter** (see Done criteria). |
| **Submit-shortcut bypass** — anon presses Submit on the 4th problem and sees the engine result table render before the server rejects the DB write | Closed: the gate wraps both `handleRun` and `handleSubmit` in a shared `gateAndExecute(intent)` helper. The engine is never invoked for trial-exhausted anons on a new slug, regardless of whether the action was Run or Submit. Dedicated e2e test (Submit bypass test) asserts no result table renders in this path. |
| `localStorage` or cookie stale after sign-in if NextAuth callback redirects somewhere unexpected | `AnonStorageReset` mounts from the root layout on the callback destination, invokes `clearAnonRunCookie` server-side, and clears localStorage when the action returns `signedIn: true`. No `SessionProvider` required, no Navbar refactor. E2e test covers exhaust -> sign-in -> sign-out -> fresh counter. |
| **Navbar architectural drift** — implementer accidentally converts the server-component Navbar to a client component to host a `useSession` hook | The reset uses a dedicated client component (`AnonStorageReset`) fed by a prop derived from the layout's existing `auth()` call. Done criteria includes an explicit "Navbar still a server component" check. |

## Done criteria (gate)

**Code + tests:**

- [ ] New file `lib/anon-gate.ts` exports `MAX_FREE_PROBLEMS`, `signCounter()`, `verifyCounter()`, `parseCookieValue()`. Unit tests in `scripts/test-anon-gate.ts` cover signing, verification, and tamper detection. If `lib/anon-gate.ts` imports `node:crypto`, client components import a separate client-safe constants/storage module instead of importing this file directly.
- [ ] New server actions in `actions/runtime.ts`: `validateRunQuery` returns the documented ok/blocked outcomes and mutates `dl_anon_started` only on allowed new slugs; `clearAnonRunCookie` deletes the cookie only when a signed-in session exists and returns `{ signedIn: boolean }`.
- [ ] New client component `components/auth/AnonStorageReset.tsx` mounts in `app/layout.tsx` alongside `<Navbar />`, calls `clearAnonRunCookie()` once on mount, and clears `localStorage["dl:anon:startedSlugs"]` only when the action returns `signedIn: true`. **`Navbar.tsx` remains an async server component; no `useSession` hook is added to it; `app/layout.tsx` does not add a separate `auth()` call just for the reset.**
- [ ] `components/auth/SignInModal.tsx` renders the two OAuth buttons + "Maybe later"; opens on `trial-exhausted` from either the client localStorage preflight or the server action. It reuses the existing `SignInDialog`/`ProviderSignInActions` pattern and does not add Radix or a new dialog package.
- [ ] `components/sql/SqlPlayground.tsx` accepts `isSignedIn`, renders the chip next to Run when `!isSignedIn && !startedSlugs.includes(currentSlug)`, and preserves a stable toolbar layout when the chip is absent. Amber border at `count == 2`. Run button shows a lock icon when `!isSignedIn && !startedSlugs.includes(currentSlug) && count >= 3` (lock never appears on already-started slugs).
- [ ] **Both `SqlPlayground.handleRun` (`Cmd/Ctrl+Enter`) AND `SqlPlayground.handleSubmit` (`Cmd/Ctrl+Shift+Enter`) wrap the underlying `runQuery` call in the gate.** A shared `gateAndExecute(intent)` helper inside `SqlPlayground` is the single point of control. The helper first checks localStorage, then calls `validateRunQuery`, and never invokes the engine when either storage says the trial is exhausted for a new slug. The shared `runQuery` in `useProblemDB` is *not* gated (so schema introspection still works). `ProblemClient` passes `isSignedIn` and an `onTrialExhausted` callback prop that the gate invokes; the callback opens the modal.
- [ ] `ANON_GATE_SECRET` env var added to `.env.example` with a generation hint; required in Vercel production and preview.
- [ ] Three telemetry events fire and are visible in Vercel Analytics within 1 hour of preview deploy.

**E2e regression tests (Playwright in `tests/e2e/anon-gate.spec.ts`):**

- [ ] Open 4 distinct `/practice/<slug>` pages in sequence as anonymous **without clicking Run or Submit on any of them** → counter remains 0; chip shows "3 free runs" on each. (Asserts background `runQuery` calls don't consume quota.)
- [ ] Open problem A, click Run → counter = 1. Refresh the page → chip is hidden (slug already started), Run still works without counter change.
- [ ] Click Run on three distinct new problems → counter = 3. Open a 4th distinct slug, click Run → modal appears, **the result table does not re-render** (engine not invoked), counter stays 3.
- [ ] **Submit bypass test:** exhaust trial via Run on 3 slugs → open a 4th distinct slug → press **Submit** (or `Cmd/Ctrl+Shift+Enter`) → modal opens, **no query result is rendered**, no engine execution. (This specifically verifies the Submit-shortcut bypass closed.)
- [ ] **Reset cycle test (full layout remount, not an in-place prop flip):** exhaust trial → establish a real signed-in NextAuth session using the repo's e2e session-cookie fixture or a mocked provider callback → reload/navigate through the post-auth destination so the root layout mounts fresh with an already-signed-in session → cookie cleared by `clearAnonRunCookie` and localStorage cleared by `AnonStorageReset` → sign out / clear the session cookie → navigate to a 5th distinct slug → chip shows "3 free runs" and Run works. **The test must exercise a fresh mounted root layout with the session already present**, since the bug Codex caught was specifically that an in-place `false -> true` transition fires in dev but a real callback/remount starts already signed in.
- [ ] `Check Answer` (Submit) path for anonymous users on an **already-started** slug still returns the existing "Sign in to submit..." error from `validateSubmission` server-side (engine executes locally, DB write rejected). The new gate doesn't change that surface for already-started slugs; it only blocks engine execution on NEW slugs past quota.
- [ ] **Navbar regression:** verify `components/layout/Navbar.tsx` still imports `auth()` and `prisma` and is rendered as a server component. (Asserts the reset implementation didn't accidentally convert the Navbar to a client component.)

**Smoke checks (manual on Vercel preview):**

- [ ] Anon hits problems 1-3 in real Chrome (Run works, chip counts down), problem 4 (modal opens), signs in via GitHub (cookie cleared, Run works on problem 4 immediately).
- [ ] `curl -A Googlebot https://<preview>/practice/joins` shows the full problem description and schema content in the HTML response. Gate-related text is neutral (`"3 free runs"` if the client shell renders it); the modal is not open in the initial response.

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
