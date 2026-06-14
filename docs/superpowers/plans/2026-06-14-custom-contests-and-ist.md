# Custom Contests + IST Time Standard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let signed-in users create unlisted, link-shared "custom" contests judged practice-style (in-browser run → validate against public output → leaderboard), and standardize all contest times on IST (Asia/Kolkata).

**Architecture:** Pure helpers for IST formatting/parsing and custom-contest validation (unit-tested). New server actions (`createCustomContest`, `getCustomContestBySlug`, `submitCustomContestEntry`) reuse the existing `compareResults` comparator and `recordFirstSolveAndLeaderboard`. New routes under `/contests/custom/**` reuse `ContestPlayClient` (new `judge: "PRACTICE"` mode) and `ContestStandings`. No schema migration.

**Tech Stack:** Next.js 16 App Router, Prisma 7, React 19, `node --import tsx --test`, Playwright.

**Spec:** [`docs/superpowers/specs/2026-06-14-custom-contests-and-ist-design.md`](../specs/2026-06-14-custom-contests-and-ist-design.md)

**Branch:** `feat/custom-contests` (stacked on `feat/contest-play` / #161).

---

## File Structure

- `lib/time-ist.ts` — **Create.** Pure: `formatIST`, `istLocalInputToUtc`.
- `lib/contests/custom.ts` — **Create.** Pure: `validateCustomContestInput`, `canCreateCustomContest`, `CUSTOM_LIMITS`.
- `actions/custom-contests.ts` — **Create.** `createCustomContest`, `getCustomContestBySlug`, `submitCustomContestEntry`.
- `lib/contest-submit.ts` — **Modify.** Export `recordFirstSolveAndLeaderboard` for reuse.
- `components/contests/play/ContestPlayClient.tsx` — **Modify.** Add `judge: "OFFICIAL" | "PRACTICE"` + practice submit path.
- `components/contests/custom/CreateCustomContestForm.tsx` — **Create.** Client create form.
- `app/contests/custom/new/page.tsx` — **Create.** Create page (signed-in gate + cap notice).
- `app/contests/custom/[slug]/page.tsx` — **Create.** Detail (share link, problems, standings).
- `app/contests/custom/[slug]/[problemSlug]/page.tsx` — **Create.** Play route (PRACTICE mode).
- `app/contests/page.tsx` — **Modify.** Add a "Create your own contest" entry; swap `LocalTime` → `formatIST`.
- `app/contests/[slug]/page.tsx` — **Modify.** Swap `LocalTime` → `formatIST`.
- `components/contests/admin/ContestForm.tsx` — **Modify.** Interpret datetime-local as IST; label "(IST)".
- `components/ui/LocalTime.tsx` — **Delete** (replaced by server-side `formatIST`).
- `scripts/test-time-ist.ts`, `scripts/test-custom-contests.ts` — **Create.** Unit tests.
- `tests/e2e/custom-contest.spec.ts` — **Create.** E2E.
- `package.json` — **Modify.** Add `test:time-ist`, `test:custom-contests`.

---

### Task 1: IST time helpers

**Files:** Create `lib/time-ist.ts`, `scripts/test-time-ist.ts`; Modify `package.json`.

- [ ] **Step 1: Write the failing test** — `scripts/test-time-ist.ts`:

```ts
// Run: node --import tsx --test scripts/test-time-ist.ts
import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { formatIST, istLocalInputToUtc } from "../lib/time-ist"

describe("istLocalInputToUtc", () => {
    it("interprets a datetime-local string as IST (+5:30) wall-clock", () => {
        // 2026-06-18 18:00 IST == 2026-06-18 12:30 UTC
        assert.equal(
            istLocalInputToUtc("2026-06-18T18:00").toISOString(),
            "2026-06-18T12:30:00.000Z"
        )
    })
})

describe("formatIST", () => {
    it("formats a UTC instant in IST with an IST suffix", () => {
        // 12:30 UTC -> 18:00 IST
        const out = formatIST("2026-06-18T12:30:00.000Z")
        assert.match(out, /Jun 18, 2026/)
        assert.match(out, /6:00\s?PM/i)
        assert.match(out, /IST$/)
    })
})
```

- [ ] **Step 2: Run → fail** — `node --import tsx --test scripts/test-time-ist.ts` (module missing).

- [ ] **Step 3: Implement** — `lib/time-ist.ts`:

```ts
// Contest times standardize on IST (Asia/Kolkata, fixed +05:30). Pure + isomorphic.
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000

/** Interpret a `YYYY-MM-DDTHH:mm` datetime-local string as IST wall-clock → UTC Date. */
export function istLocalInputToUtc(localInput: string): Date {
    const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(localInput)
    if (!match) return new Date(NaN)
    const [, y, mo, d, h, mi] = match.map(Number) as unknown as number[]
    return new Date(Date.UTC(y, mo - 1, d, h, mi) - IST_OFFSET_MS)
}

/** Format a UTC instant in IST, e.g. "Jun 18, 2026, 6:00 PM IST". */
export function formatIST(value: Date | string): string {
    const date = typeof value === "string" ? new Date(value) : value
    const formatted = date.toLocaleString("en-US", {
        timeZone: "Asia/Kolkata",
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
    })
    return `${formatted} IST`
}
```

- [ ] **Step 4: Add npm script** — after `"test:contest-play"` add:
```json
"test:time-ist": "node --import tsx --test scripts/test-time-ist.ts",
```

- [ ] **Step 5: Run → pass** — `npm run test:time-ist`.

- [ ] **Step 6: Commit** — `git add lib/time-ist.ts scripts/test-time-ist.ts package.json && git commit -m "feat(contests): IST time helpers (format + datetime-local parse)"`

---

### Task 2: Adopt IST in display + admin input; remove LocalTime

**Files:** Modify `app/contests/page.tsx`, `app/contests/[slug]/page.tsx`, `components/contests/admin/ContestForm.tsx`; Delete `components/ui/LocalTime.tsx`.

- [ ] **Step 1: Swap display to `formatIST`.** In both contest pages, replace each `<LocalTime value={contest.startsAt.toISOString()} />` (and `endsAt`) with `{formatIST(contest.startsAt)}` (and `endsAt`), remove the `import { LocalTime }` line, and add `import { formatIST } from "@/lib/time-ist"`.

- [ ] **Step 2: IST input in the admin form.** In `components/contests/admin/ContestForm.tsx`, replace the submit-time conversion `startsAt: new Date(startsAt).toISOString()` / `endsAt: new Date(endsAt).toISOString()` with `startsAt: istLocalInputToUtc(startsAt).toISOString()` / `endsAt: istLocalInputToUtc(endsAt).toISOString()`; add `import { istLocalInputToUtc } from "@/lib/time-ist"`. Append "(IST)" to the "Starts at" / "Ends at" field labels.

- [ ] **Step 3: Delete LocalTime** — `git rm components/ui/LocalTime.tsx`. Confirm no other importers: `grep -rn "components/ui/LocalTime" app components` returns nothing.

- [ ] **Step 4: Verify** — `npx tsc --noEmit` (clean) and `npm run build` (compiles).

- [ ] **Step 5: Commit** — `git add -A && git commit -m "feat(contests): standardize contest times on IST (display + admin input)"`

---

### Task 3: Custom-contest pure helpers

**Files:** Create `lib/contests/custom.ts`, `scripts/test-custom-contests.ts`; Modify `package.json`.

- [ ] **Step 1: Write the failing test** — `scripts/test-custom-contests.ts`:

```ts
// Run: node --import tsx --test scripts/test-custom-contests.ts
import { describe, it } from "node:test"
import assert from "node:assert/strict"
import {
    canCreateCustomContest,
    validateCustomContestInput,
} from "../lib/contests/custom"

describe("canCreateCustomContest", () => {
    it("allows only when the user has no active custom contest", () => {
        assert.equal(canCreateCustomContest(0), true)
        assert.equal(canCreateCustomContest(1), false)
        assert.equal(canCreateCustomContest(3), false)
    })
})

describe("validateCustomContestInput", () => {
    const base = {
        title: "Friday Night SQL",
        problemIds: ["a"],
        startsAt: new Date("2026-06-18T12:30:00.000Z"),
        endsAt: new Date("2026-06-18T13:30:00.000Z"),
        maxParticipants: 20,
    }
    it("accepts a well-formed input", () => {
        assert.equal(validateCustomContestInput(base).ok, true)
    })
    it("rejects empty problems, bad duration, and out-of-range participants", () => {
        assert.equal(validateCustomContestInput({ ...base, problemIds: [] }).ok, false)
        assert.equal(
            validateCustomContestInput({
                ...base,
                endsAt: new Date("2026-06-18T12:35:00.000Z"), // 5 min < 10 min min
            }).ok,
            false
        )
        assert.equal(
            validateCustomContestInput({ ...base, maxParticipants: 1000 }).ok,
            false
        )
        assert.equal(validateCustomContestInput({ ...base, title: "ab" }).ok, false)
    })
})
```

- [ ] **Step 2: Run → fail.**

- [ ] **Step 3: Implement** — `lib/contests/custom.ts`:

```ts
// Pure validation for user-created (USER_CUSTOM) contests. No Prisma/React.
export const CUSTOM_LIMITS = {
    maxActivePerUser: 1,
    minProblems: 1,
    maxProblems: 20,
    minTitle: 3,
    maxTitle: 80,
    minDurationMs: 10 * 60 * 1000,
    maxDurationMs: 7 * 24 * 60 * 60 * 1000,
    minParticipants: 1,
    maxParticipants: 50,
} as const

/** A user may create a custom contest only if they have none currently active. */
export function canCreateCustomContest(activeCount: number): boolean {
    return activeCount < CUSTOM_LIMITS.maxActivePerUser
}

export type CustomContestInput = {
    title: string
    problemIds: string[]
    startsAt: Date
    endsAt: Date
    maxParticipants: number
}

export function validateCustomContestInput(
    input: CustomContestInput
): { ok: true } | { ok: false; reason: string } {
    const title = input.title?.trim() ?? ""
    if (title.length < CUSTOM_LIMITS.minTitle || title.length > CUSTOM_LIMITS.maxTitle) {
        return { ok: false, reason: "Title must be 3–80 characters." }
    }
    if (
        input.problemIds.length < CUSTOM_LIMITS.minProblems ||
        input.problemIds.length > CUSTOM_LIMITS.maxProblems
    ) {
        return { ok: false, reason: "Pick between 1 and 20 problems." }
    }
    const duration = input.endsAt.getTime() - input.startsAt.getTime()
    if (
        Number.isNaN(duration) ||
        duration < CUSTOM_LIMITS.minDurationMs ||
        duration > CUSTOM_LIMITS.maxDurationMs
    ) {
        return { ok: false, reason: "Duration must be between 10 minutes and 7 days." }
    }
    if (
        input.maxParticipants < CUSTOM_LIMITS.minParticipants ||
        input.maxParticipants > CUSTOM_LIMITS.maxParticipants
    ) {
        return { ok: false, reason: "Max participants must be between 1 and 50." }
    }
    return { ok: true }
}
```

- [ ] **Step 4: Add npm script** — `"test:custom-contests": "node --import tsx --test scripts/test-custom-contests.ts",`

- [ ] **Step 5: Run → pass** — `npm run test:custom-contests`.

- [ ] **Step 6: Commit** — `git add lib/contests/custom.ts scripts/test-custom-contests.ts package.json && git commit -m "feat(contests): custom-contest validation helpers"`

---

### Task 4: Export `recordFirstSolveAndLeaderboard`

**Files:** Modify `lib/contest-submit.ts`.

- [ ] **Step 1: Export the helper.** Change `async function recordFirstSolveAndLeaderboard(args: {` to `export async function recordFirstSolveAndLeaderboard(args: {` (around line 242). No behavior change.

- [ ] **Step 2: Verify** — `npx tsc --noEmit` clean; `npm run test:contest-submit` still passes (run with the contest worker built; if the harness needs the local DB, set `DATABASE_URL` to the local Postgres).

- [ ] **Step 3: Commit** — `git add lib/contest-submit.ts && git commit -m "refactor(contests): export recordFirstSolveAndLeaderboard for reuse"`

---

### Task 5: Custom-contest server actions

**Files:** Create `actions/custom-contests.ts`.

Write `actions/custom-contests.ts` (`"use server"`). It must implement three functions. Read `actions/contests.ts` (for `deriveContestStatus` usage + select shapes), `actions/submissions.ts` (for the `compareResults` + `expectedOutputs[dialect]` parse pattern), and `lib/contest-submit.ts` (for `recordFirstSolveAndLeaderboard` args) and mirror those patterns exactly.

- [ ] **Step 1: `createCustomContest`.**
```ts
export async function createCustomContest(input: {
    title: string
    problemIds: string[]
    startsAtIso: string
    endsAtIso: string
    maxParticipants: number
}): Promise<{ ok: true; slug: string } | { ok: false; error: string }>
```
Behavior: `auth()` → require `session.user.id`. Count the user's active custom contests:
`prisma.contest.findMany({ where: { kind: "USER_CUSTOM", createdById: userId }, select: { startsAt, endsAt, status } })`, derive each with `deriveContestStatus`, count those `!== "CLOSED"`; if `!canCreateCustomContest(activeCount)` return `{ ok: false, error: "You already have an active custom contest." }`. Build `startsAt = new Date(input.startsAtIso)`, `endsAt = new Date(input.endsAtIso)`. Verify all `problemIds` are PUBLISHED (`prisma.sQLProblem.count({ where: { id: { in }, status: "PUBLISHED" } }) === problemIds.length`); else `{ ok: false, error: "All problems must be published." }`. `validateCustomContestInput({...})`; on failure return its reason. Generate slug: `const slug = "c-" + crypto.randomBytes(9).toString("base64url")` (import `crypto` from `node:crypto`). Create:
```ts
await prisma.contest.create({ data: {
  slug, title: input.title.trim(), description: "User-created contest.",
  kind: "USER_CUSTOM", status: "SCHEDULED", visibility: "PUBLIC",
  startsAt, endsAt, durationMinutes: Math.round((endsAt.getTime()-startsAt.getTime())/60000),
  rated: false, maxParticipants: input.maxParticipants, createdById: userId,
  problems: { create: input.problemIds.map((problemId, i) => ({ problemId, position: i, points: 1 })) },
} })
```
Return `{ ok: true, slug }`.

- [ ] **Step 2: `getCustomContestBySlug`.**
```ts
export async function getCustomContestBySlug(slug: string)
```
`prisma.contest.findUnique` selecting the same fields `getContestBySlug` selects (id, slug, title, description, startsAt, endsAt, status, maxParticipants, problems{position,points,problem{id,number,slug,title,difficulty}}, _count.registrations). Return `null` unless `row.kind === "USER_CUSTOM"`. Derive `status`; return `{ ...row, status, problemCount, problems: status === "SCHEDULED" ? [] : row.problems }` (mirror `getContestBySlug`).

- [ ] **Step 3: `submitCustomContestEntry`.**
```ts
export async function submitCustomContestEntry(input: {
    slug: string
    problemId: string
    dialect: "DUCKDB" | "POSTGRES"
    userResult: unknown[]
}): Promise<{ ok: true; verdict: "ACCEPTED" | "WRONG_ANSWER"; attemptNumber: number }
        | { ok: false; error: string }>
```
Behavior: `auth()` → require userId. Load the contest by slug with `{ id, kind, startsAt, endsAt, status, problems: { where: { problemId }, select: { problemId } } }`. Reject if `kind !== "USER_CUSTOM"` (`{ ok:false, error:"Not found." }`), if `deriveContestStatus(...) !== "LIVE"` (`"Contest isn't live."`), or if the problem isn't attached (`"Problem not in contest."`). Load the problem: `prisma.sQLProblem.findUnique({ where: { id: problemId }, select: { expectedOutputs: true, expectedOutput: true, ordered: true } })`. Resolve `expected` exactly as `validateSubmission` does (per-dialect `expectedOutputs[dialect]` JSON-parse, fall back to legacy `expectedOutput`). `const result = compareResults(input.userResult, expected, { ordered: problem.ordered })`. In a `prisma.$transaction(async (tx) => {...})`:
  - `const submission = await tx.submission.create({ data: { userId, problemId, status: result.ok ? "ACCEPTED" : "WRONG_ANSWER", code: "" } })` (the rows came from the client; SQL text isn't persisted for custom).
  - `const priorContestSubs = await tx.contestSubmission.count({ where: { contestId, userId, problemId } })`; `const attemptNumber = priorContestSubs + 1`.
  - `const acceptedAt = result.ok ? new Date() : null`.
  - `await tx.contestSubmission.create({ data: { contestId, userId, problemId, submissionId: submission.id, verdict: result.ok ? "ACCEPTED" : "WRONG_ANSWER", attemptNumber, acceptedAt } })` (match the field names on `ContestSubmission` in schema.prisma; read the model first).
  - If `result.ok`: check it's the first accepted solve — `const existingSolve = await tx.contestProblemSolve.findUnique({ where: { contestId_userId_problemId: { contestId, userId, problemId } } })`; if none, `await recordFirstSolveAndLeaderboard({ tx, contestId, userId, problemId, submissionId: submission.id, acceptedAt: acceptedAt!, attemptNumber, contestStartsAt: contest.startsAt })`.
  - Return `{ verdict, attemptNumber }`.
Wrap and return `{ ok: true, ... }`. On any thrown error return `{ ok: false, error: "Submission failed." }` (and `console.error`).

> Read `ContestSubmission` and `ContestProblemSolve` models in `prisma/schema.prisma` first and match exact required fields (some may require `ipHash`/`userAgent`/`code`; supply `""`/`"custom"` placeholders if non-nullable).

- [ ] **Step 4: Verify** — `npx tsc --noEmit` clean.

- [ ] **Step 5: Commit** — `git add actions/custom-contests.ts && git commit -m "feat(contests): custom-contest create/read/submit actions (practice-judged)"`

---

### Task 6: `ContestPlayClient` PRACTICE mode

**Files:** Modify `components/contests/play/ContestPlayClient.tsx`.

- [ ] **Step 1:** Add a prop `judge: "OFFICIAL" | "PRACTICE"` (default `"OFFICIAL"`) and (for PRACTICE) `contestSlug` already exists. In `submit`, branch:
  - `OFFICIAL` (existing): POST raw SQL to `/api/contests/${contestSlug}/submit`.
  - `PRACTICE`: first run the query in-browser (`const out = await runQuery(sql)`), then call the imported server action `submitCustomContestEntry({ slug: contestSlug, problemId: problem.id, dialect: problem.dialect, userResult: out.rows })`; map its `{ ok, verdict, attemptNumber }` to the verdict panel (`verdictLabel(verdict, points)`), or show `error`.
  Keep the idempotency-key logic only for OFFICIAL.

- [ ] **Step 2: Verify** — `npx tsc --noEmit` clean; existing `contest-play.spec.ts` (OFFICIAL) still passes locally.

- [ ] **Step 3: Commit** — `git add components/contests/play/ContestPlayClient.tsx && git commit -m "feat(contests): ContestPlayClient PRACTICE judge mode for custom contests"`

---

### Task 7: Create form + page + /contests entry

**Files:** Create `components/contests/custom/CreateCustomContestForm.tsx`, `app/contests/custom/new/page.tsx`; Modify `app/contests/page.tsx`.

- [ ] **Step 1:** `app/contests/custom/new/page.tsx` (server): `auth()`; if not signed in, render a sign-in gate; else count the user's active custom contests (same logic as the action) and pass `atCap: boolean` to the form. Render `<CreateCustomContestForm publishedProblems={...} atCap={...} />` where `publishedProblems` is `getProblems()` mapped to `{ id, number, title }`.

- [ ] **Step 2:** `CreateCustomContestForm.tsx` (client): fields — title, problem multi-select (search by title/number, add/remove chips), `startsAt`/`endsAt` (`datetime-local`, labelled "(IST)"), maxParticipants (default 20). On submit, convert times with `istLocalInputToUtc(value).toISOString()` and call `createCustomContest({...})`; on `{ ok, slug }` `router.push("/contests/custom/" + slug)`; on `{ ok:false }` show `error`. Disable submit when `atCap` (show "You already have an active custom contest").

- [ ] **Step 3:** In `app/contests/page.tsx`, add a `LinkButton` "Create your own contest" → `/contests/custom/new` in the page header.

- [ ] **Step 4: Verify** — `npx tsc --noEmit`; `npm run build`.

- [ ] **Step 5: Commit** — `git add -A && git commit -m "feat(contests): custom contest creation form + entry point"`

---

### Task 8: Custom detail + play routes

**Files:** Create `app/contests/custom/[slug]/page.tsx`, `app/contests/custom/[slug]/[problemSlug]/page.tsx`.

- [ ] **Step 1:** Detail page (`/contests/custom/[slug]`): `getCustomContestBySlug(slug)`; `notFound()` if null. Render title, `ContestStatusPill`, IST times (`formatIST`), a **copy-the-link** control (the current URL), a "Friendly · unrated" badge, the problems list (hidden until live; each links to `/contests/custom/[slug]/[problemSlug]`), and `<ContestStandings rows={await getContestLeaderboard(contest.id)} viewerUserId={...} status={...} />` when LIVE/CLOSED.

- [ ] **Step 2:** Play page (`/contests/custom/[slug]/[problemSlug]`): mirror `app/contests/[slug]/[problemSlug]/page.tsx` but use `getCustomContestBySlug`, and render `<ContestPlayClient judge="PRACTICE" ... />`. Gating via `gatingFromStatus` (registration is always considered satisfied for custom — pass `registered = Boolean(viewerUserId)` so any signed-in user is in PLAY mode during LIVE).

- [ ] **Step 3: Verify** — `npx tsc --noEmit`; `npm run build` (routes appear).

- [ ] **Step 4: Commit** — `git add -A && git commit -m "feat(contests): custom contest detail + play routes"`

---

### Task 9: E2E

**Files:** Create `tests/e2e/custom-contest.spec.ts`.

- [ ] **Step 1:** Seed a signed-in user; create a LIVE `USER_CUSTOM` contest directly via Prisma (kind `USER_CUSTOM`, past start / future end, `rated:false`, `createdById`, one attached PUBLISHED problem with public `expectedOutputs.DUCKDB`). Open `/contests/custom/<slug>/<problemSlug>`, type the correct SQL in Monaco (pattern from `contest-play.spec.ts`: `editor.waitFor`, click, `keyboard.type`, then `expect(submitButton).toBeEnabled()` before click), submit, assert `Accepted` is visible, then load `/contests/custom/<slug>` and assert the user shows as "You" in standings. Use the cleanup pattern from `contest-play.spec.ts`.

- [ ] **Step 2:** Run locally (built app on 3100, local DB): `DATABASE_URL=... AUTH_TRUST_HOST=true E2E_PORT=3100 npx playwright test custom-contest.spec.ts --reporter=list`. Expected: PASS.

- [ ] **Step 3: Commit** — `git add tests/e2e/custom-contest.spec.ts && git commit -m "test(e2e): custom contest create-and-play flow"`

---

## Self-Review

**Spec coverage:** IST display+input+helpers → Tasks 1–2 ✅. Custom validation/cap → Task 3 ✅. Create/read/submit actions (practice-judged, reuse comparator + leaderboard) → Tasks 4–5 ✅. Play PRACTICE mode → Task 6 ✅. Create UI + entry → Task 7 ✅. Detail + play routes + standings reuse → Task 8 ✅. Unit + e2e → Tasks 1/3/9 ✅. No migration ✅.

**Placeholder scan:** Task 5 intentionally instructs reading the `ContestSubmission`/`ContestProblemSolve` models for exact fields — that's a verification instruction, not a placeholder; all logic is specified.

**Type consistency:** `validateCustomContestInput`/`canCreateCustomContest`/`CUSTOM_LIMITS` (Task 3) used in Task 5; `formatIST`/`istLocalInputToUtc` (Task 1) used in Tasks 2/7; `recordFirstSolveAndLeaderboard` exported (Task 4) used in Task 5; `judge: "PRACTICE"` (Task 6) used in Task 8; `submitCustomContestEntry` signature (Task 5) consumed by Task 6.
