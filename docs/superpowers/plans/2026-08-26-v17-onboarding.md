# V17 First-Run Onboarding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn a new account into a learner on a specific lesson, via a two-screen `/welcome` route that asks one question and recommends one destination.

**Architecture:** Three additive `User` columns carry the state. A pure, Prisma-free module maps the self-declared level to an entry module inside the featured track's curriculum. `/welcome` is a focus route (no console shell); `app/page.tsx` redirects into it and nothing else does. Writes go through a `userId`-parameterised writer that is deliberately not a server action, wrapped by session-resolving actions — the same split `lib/curriculum-write.ts` and `actions/curriculum.ts` already use.

**Tech Stack:** Next.js 16 App Router, TypeScript strict, Prisma 7, NextAuth v5 (database sessions), Tailwind v4 semantic tokens, `node:test` via `node --import tsx --test` for unit suites, Playwright for e2e.

**Spec:** `docs/superpowers/specs/2026-08-26-v17-onboarding-design.md`

## Global Constraints

- **Feature PRs MUST pass `--base main`** to `gh pr create`. The GitHub default branch is `production`; a forgotten flag deploys unfinished work to live.
- **No emoji icons.** SVG only, via `lucide-react`.
- **Semantic color tokens only** — `bg-primary`, `text-muted-foreground`, `border-border`, `bg-surface`. Never `slate-*`, `blue-*`, or hex.
- **Every `:root` token needs a `.light` counterpart.** No new tokens are introduced by this plan; if one becomes necessary, `npm run check:token-parity` must pass.
- **Never export a `userId`-parameterised writer from a `"use server"` file.** Every export of a `"use server"` module is a client-callable RPC endpoint.
- **Positions are never written outside their reorder transactions.** This plan reads `Module.position` and writes none.
- **Module placement is advisory.** `entryModuleIndex` selects a starting point and must never gate a route, action, or checkpoint.
- **Every new `test:*` npm script must be wired into `.github/workflows/test.yml`** or `npm run check:ci-coverage` fails.
- **Local Postgres user is `anchitgupta`**, not `postgres`. Prisma commands in this plan prefix `DATABASE_URL` explicitly — `.env.local` may point at a remote Neon branch.
- **Build with `--webpack`.** Never `next build` bare.
- **`.github/workflows/*` changes cannot be merged with the local `gh` token** (missing `workflow` scope). Phases 1 and 3 touch the workflow file; merge those PRs in the web UI.

## File Structure

| File | Responsibility | Pure? |
| --- | --- | --- |
| `lib/onboarding/entry-point.ts` | Level→module index, entry-point resolution, structural input types | yes |
| `lib/onboarding/onboarding-write.ts` | The three `User` writes, `userId`-parameterised | no — **no `"use server"`** |
| `actions/onboarding.ts` | Session resolution + input validation, delegates to the writer | `"use server"` |
| `app/welcome/page.tsx` | Gating, curriculum read, own `<header>` + `<main>` | no |
| `components/welcome/WelcomeFlow.tsx` | Screen state, selection, action calls | client |
| `components/welcome/LevelStep.tsx` | Screen 1, presentational | client |
| `components/welcome/StartHereStep.tsx` | Screen 2 including the no-track fallback | client |
| `lib/analytics/onboarding-funnel.ts` | Cohort constant, funnel assembly, skip rate | yes |
| `components/admin/analytics/OnboardingSection.tsx` | Portal section | no |
| `scripts/test-onboarding-entry.ts` | Unit suite for the pure entry-point module | test |
| `scripts/test-analytics-onboarding-funnel.ts` | Unit suite for the pure funnel module | test |
| `tests/e2e/welcome.spec.ts` | Route behaviour, landmarks, redirect contract | test |

**Two deliberate deviations from the spec:**

1. **The session carries a boolean, not the timestamp.** The spec says `types/next-auth.d.ts` gains `onboardingCompletedAt` (a `DateTime`); this plan adds `onboardingCompleted: boolean`. The session object is JSON-serialized to client components, so a field typed `Date` would arrive as a `string` and the type would be a lie. The timestamp stays in the database, where the analytics read uses it; the session carries only what the redirect needs.
2. **The funnel gets its own suite rather than extending `test:analytics-funnel`.** The spec proposed extending the existing suite. Every other pure module in `lib/analytics/` has a dedicated suite named after it, and `check:ci-coverage` tracks scripts one-to-one, so a new module gets `test:analytics-onboarding-funnel`.

---

## Phase 1 — Schema and logic (ships dark)

Branch: `feat/v17-onboarding-schema`. Nothing changes for any user — no route exists yet.

### Task 1: Pure entry-point module

**Files:**

- Create: `lib/onboarding/entry-point.ts`
- Test: `scripts/test-onboarding-entry.ts`
- Modify: `package.json` (scripts), `.github/workflows/test.yml`

**Interfaces:**

- Consumes: nothing.
- Produces: `type SqlLevel = "NEW" | "INTERMEDIATE" | "ADVANCED"`; `type LessonLike = { slug: string; title: string; readingMinutes: number | null }`; `type ModuleLike = { slug: string; name: string; position: number; lessons: LessonLike[] }`; `type EntryPoint = { moduleSlug: string; moduleName: string; modulePosition: number; lessonSlug: string; lessonTitle: string; lessonCount: number; readingMinutes: number | null }`; `entryModuleIndex(level: SqlLevel, moduleCount: number): number | null`; `resolveEntryPoint(level: SqlLevel, modules: ModuleLike[]): EntryPoint | null`.

- [ ] **Step 1: Write the failing test**

Create `scripts/test-onboarding-entry.ts`:

```ts
// Unit tests for the pure onboarding entry-point maths. No database.
//
// Run: node --import tsx --test scripts/test-onboarding-entry.ts

import { describe, it } from "node:test"
import assert from "node:assert/strict"
import {
    entryModuleIndex,
    resolveEntryPoint,
    type ModuleLike,
    type SqlLevel,
} from "../lib/onboarding/entry-point"

function mod(slug: string, position: number, lessonCount: number): ModuleLike {
    return {
        slug,
        name: `Module ${slug}`,
        position,
        lessons: Array.from({ length: lessonCount }, (_, i) => ({
            slug: `${slug}-lesson-${i}`,
            title: `${slug} lesson ${i}`,
            readingMinutes: 6,
        })),
    }
}

// The authored track: foundations, joins, aggregation, window-functions,
// interview-patterns.
const FIVE: ModuleLike[] = [
    mod("foundations", 0, 3),
    mod("joins", 1, 4),
    mod("aggregation", 2, 4),
    mod("window-functions", 3, 3),
    mod("interview-patterns", 4, 3),
]

describe("entryModuleIndex", () => {
    it("sends a new learner to the first module", () => {
        assert.equal(entryModuleIndex("NEW", 5), 0)
    })

    it("sends an intermediate learner past the basics", () => {
        assert.equal(entryModuleIndex("INTERMEDIATE", 5), 2)
    })

    it("sends an advanced learner to window functions, not the last module", () => {
        // Landing on the final module would finish the track in one sitting
        // and leave nowhere to go next.
        assert.equal(entryModuleIndex("ADVANCED", 5), 3)
    })

    it("clamps to the last module on a short track", () => {
        assert.equal(entryModuleIndex("ADVANCED", 2), 1)
        assert.equal(entryModuleIndex("INTERMEDIATE", 2), 1)
    })

    it("clamps to the only module on a one-module track", () => {
        assert.equal(entryModuleIndex("ADVANCED", 1), 0)
    })

    it("returns null when there are no modules", () => {
        assert.equal(entryModuleIndex("NEW", 0), null)
    })

    it("handles every level with no fallthrough", () => {
        const levels: SqlLevel[] = ["NEW", "INTERMEDIATE", "ADVANCED"]
        for (const level of levels) {
            const index = entryModuleIndex(level, 5)
            assert.equal(typeof index, "number", `${level} produced no index`)
        }
    })
})

describe("resolveEntryPoint", () => {
    it("returns the first lesson of the target module", () => {
        const entry = resolveEntryPoint("INTERMEDIATE", FIVE)
        assert.equal(entry?.moduleSlug, "aggregation")
        assert.equal(entry?.lessonSlug, "aggregation-lesson-0")
        assert.equal(entry?.lessonCount, 4)
        assert.equal(entry?.modulePosition, 2)
    })

    it("skips forward past an empty target module", () => {
        const modules = [
            mod("foundations", 0, 3),
            mod("joins", 1, 2),
            { ...mod("aggregation", 2, 0) },
            mod("window-functions", 3, 3),
        ]
        const entry = resolveEntryPoint("INTERMEDIATE", modules)
        assert.equal(entry?.moduleSlug, "window-functions")
    })

    it("falls back to an earlier module when every later one is empty", () => {
        const modules = [
            mod("foundations", 0, 3),
            mod("joins", 1, 2),
            { ...mod("aggregation", 2, 0) },
            { ...mod("window-functions", 3, 0) },
        ]
        const entry = resolveEntryPoint("ADVANCED", modules)
        assert.equal(entry?.moduleSlug, "joins")
    })

    it("returns null when no module has a lesson", () => {
        const modules = [mod("foundations", 0, 0), mod("joins", 1, 0)]
        assert.equal(resolveEntryPoint("NEW", modules), null)
    })

    it("returns null for an empty curriculum", () => {
        assert.equal(resolveEntryPoint("NEW", []), null)
    })
})
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
node --import tsx --test scripts/test-onboarding-entry.ts
```

Expected: FAIL — `Cannot find module '../lib/onboarding/entry-point'`.

- [ ] **Step 3: Write the implementation**

Create `lib/onboarding/entry-point.ts`:

```ts
/**
 * Where a learner starts, given the level they declared during onboarding.
 *
 * Pure and Prisma-free so the maths unit-tests without a database. The input
 * types are structural on purpose — `CurriculumModule` from
 * `lib/curriculum-read.ts` satisfies `ModuleLike` without this module
 * importing it, which keeps Prisma out of the dependency graph entirely.
 *
 * Placement is ADVISORY, exactly like `isModuleUnlocked` in
 * `lib/curriculum-progress.ts`. It picks a starting point and gates nothing;
 * a learner who wants module 01 clicks module 01.
 */

export type SqlLevel = "NEW" | "INTERMEDIATE" | "ADVANCED"

export type LessonLike = {
    slug: string
    title: string
    readingMinutes: number | null
}

export type ModuleLike = {
    slug: string
    name: string
    position: number
    lessons: LessonLike[]
}

export type EntryPoint = {
    moduleSlug: string
    moduleName: string
    modulePosition: number
    lessonSlug: string
    lessonTitle: string
    lessonCount: number
    readingMinutes: number | null
}

/**
 * Target index per level, clamped to the track's length.
 *
 * An index, not a slug map: module slugs and names are admin-editable and
 * module order is mutable through `reorderModules`, so a literal
 * `{ INTERMEDIATE: "aggregation" }` would silently resolve to nothing the
 * first time someone renames or reorders. ADVANCED targets index 3 rather
 * than the last module deliberately — landing on the final module leaves
 * nowhere to go next.
 */
const TARGET_INDEX: Record<SqlLevel, number> = {
    NEW: 0,
    INTERMEDIATE: 2,
    ADVANCED: 3,
}

export function entryModuleIndex(
    level: SqlLevel,
    moduleCount: number,
): number | null {
    if (moduleCount <= 0) return null
    return Math.min(TARGET_INDEX[level], moduleCount - 1)
}

/**
 * The first module at or after `start` that actually has a lesson, else the
 * nearest one before it. An admin can create a module and not fill it yet;
 * recommending an empty module would render "0 lessons", which the project's
 * fallback rule forbids.
 */
function firstModuleWithLessons(
    modules: ModuleLike[],
    start: number,
): ModuleLike | null {
    for (let i = start; i < modules.length; i += 1) {
        if (modules[i].lessons.length > 0) return modules[i]
    }
    for (let i = start - 1; i >= 0; i -= 1) {
        if (modules[i].lessons.length > 0) return modules[i]
    }
    return null
}

export function resolveEntryPoint(
    level: SqlLevel,
    modules: ModuleLike[],
): EntryPoint | null {
    const start = entryModuleIndex(level, modules.length)
    if (start === null) return null

    const target = firstModuleWithLessons(modules, start)
    if (!target) return null

    const lesson = target.lessons[0]
    return {
        moduleSlug: target.slug,
        moduleName: target.name,
        modulePosition: target.position,
        lessonSlug: lesson.slug,
        lessonTitle: lesson.title,
        lessonCount: target.lessons.length,
        readingMinutes: lesson.readingMinutes,
    }
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
node --import tsx --test scripts/test-onboarding-entry.ts
```

Expected: PASS, 12 tests.

- [ ] **Step 5: Prove the suite is non-vacuous**

Temporarily change `NEW: 0` to `NEW: 1` in `TARGET_INDEX`, re-run, and confirm "sends a new learner to the first module" FAILS. Revert the change and confirm PASS again. A test that cannot fail is not coverage — this is the standard applied since SP1.

- [ ] **Step 6: Wire the suite into npm scripts and CI**

In `package.json`, add alongside the other `test:` entries:

```json
"test:onboarding-entry": "node --import tsx --test scripts/test-onboarding-entry.ts",
```

In `.github/workflows/test.yml`, add a step next to the other unit suites (near `Test analytics window maths`):

```yaml
      - name: Test onboarding entry point
        run: npm run test:onboarding-entry
```

- [ ] **Step 7: Verify the CI coverage guard passes**

```bash
npm run check:ci-coverage
```

Expected: PASS. This guard is why step 6 is not optional.

- [ ] **Step 8: Commit**

```bash
git add lib/onboarding/entry-point.ts scripts/test-onboarding-entry.ts package.json .github/workflows/test.yml
git commit -m "feat(onboarding): pure level-to-entry-point resolution"
```

---

### Task 2: Schema, migration, and backfill

**Files:**

- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<timestamp>_add_onboarding_columns/migration.sql` (generated, then edited)

**Interfaces:**

- Consumes: `SqlLevel` values from Task 1 — the Prisma enum members must match those three strings exactly.
- Produces: `User.sqlLevel: SqlLevel?`, `User.onboardingStartedAt: DateTime?`, `User.onboardingCompletedAt: DateTime?`; Prisma enum `SqlLevel`.

- [ ] **Step 1: Add the enum and columns**

In `prisma/schema.prisma`, add the enum next to the other enums (near `UserRole`):

```prisma
/// Self-declared during first-run onboarding. Null means the learner
/// skipped the question or was backfilled as already-onboarded.
enum SqlLevel {
  NEW
  INTERMEDIATE
  ADVANCED
}
```

Then add three fields to `model User`, immediately after `role`:

```prisma
  sqlLevel                    SqlLevel?
  onboardingStartedAt         DateTime?
  onboardingCompletedAt       DateTime?
```

- [ ] **Step 2: Generate the migration**

```bash
DATABASE_URL='postgresql://anchitgupta@localhost:5432/datalearn' npx prisma migrate dev --name add_onboarding_columns
```

Expected: a new directory under `prisma/migrations/` containing `migration.sql` with `CREATE TYPE "SqlLevel"` and three `ALTER TABLE "User" ADD COLUMN`.

- [ ] **Step 3: Append the backfill to the generated migration**

Open the generated `migration.sql` and append:

```sql
-- Existing users are already onboarded. Without this, every account created
-- before V17 meets a first-run flow on its next visit to "/", where the copy
-- is wrong and it reads as a regression. Idempotent: the WHERE clause makes a
-- re-run a no-op.
UPDATE "User"
SET "onboardingCompletedAt" = "createdAt"
WHERE "onboardingCompletedAt" IS NULL;
```

- [ ] **Step 4: Re-apply the edited migration and verify the backfill ran**

```bash
DATABASE_URL='postgresql://anchitgupta@localhost:5432/datalearn' npx prisma migrate reset --force --skip-seed
DATABASE_URL='postgresql://anchitgupta@localhost:5432/datalearn' npx prisma migrate deploy
```

Then confirm no row is left un-backfilled:

```bash
psql 'postgresql://anchitgupta@localhost:5432/datalearn' -c \
  'SELECT count(*) AS unbackfilled FROM "User" WHERE "onboardingCompletedAt" IS NULL;'
```

Expected: `unbackfilled | 0`. (On a freshly reset database with no users the count is also 0 — seed first with `npm run seed` if you want a non-trivial check.)

- [ ] **Step 5: Restart the dev server**

The running process holds the old generated client. Stop and restart `npm run dev`.

- [ ] **Step 6: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat(onboarding): add sqlLevel and onboarding timestamps to User"
```

---

### Task 3: Session augmentation

**Files:**

- Modify: `types/next-auth.d.ts`
- Modify: `lib/auth.ts` (the `session` callback)

**Interfaces:**

- Consumes: `User.onboardingCompletedAt` from Task 2.
- Produces: `session.user.onboardingCompleted: boolean` — the flag `app/page.tsx` and `app/welcome/page.tsx` both branch on in Phase 2.

- [ ] **Step 1: Extend the type augmentation**

In `types/next-auth.d.ts`, add the field to both interfaces:

```ts
import { DefaultSession, DefaultUser } from "next-auth"

declare module "next-auth" {
    interface Session {
        user: {
            id: string
            role: "USER" | "CONTRIBUTOR" | "MODERATOR" | "ADMIN"
            /**
             * Derived from `User.onboardingCompletedAt` in the session
             * callback. A boolean, not the timestamp: the session is
             * JSON-serialized to client components, so a `Date` field would
             * arrive as a string and the type would be a lie. The timestamp
             * stays in the database, where the analytics read uses it.
             */
            onboardingCompleted: boolean
        } & DefaultSession["user"]
    }

    interface User extends DefaultUser {
        role: "USER" | "CONTRIBUTOR" | "MODERATOR" | "ADMIN"
        onboardingCompletedAt: Date | null
    }
}
```

- [ ] **Step 2: Populate it in the session callback**

In `lib/auth.ts`, extend the existing `session` callback. Database sessions mean `user` is the full Prisma row, so this costs no extra query:

```ts
        async session({ session, user }) {
            if (session.user) {
                session.user.role = (user as any).role
                session.user.id = user.id
                session.user.onboardingCompleted =
                    (user as any).onboardingCompletedAt !== null
            }
            return session
        },
```

- [ ] **Step 3: Verify types compile**

```bash
npx tsc --noEmit
```

Expected: PASS with no errors.

- [ ] **Step 4: Commit**

```bash
git add types/next-auth.d.ts lib/auth.ts
git commit -m "feat(onboarding): surface onboardingCompleted on the session"
```

---

### Task 4: Writer and server actions

**Files:**

- Create: `lib/onboarding/onboarding-write.ts`
- Create: `actions/onboarding.ts`

**Interfaces:**

- Consumes: `SqlLevel` (Task 1), the three `User` columns (Task 2).
- Produces: `recordOnboardingStart(): Promise<void>`; `recordSqlLevel(level: string): Promise<{ ok: boolean }>`; `completeOnboarding(level: string | null): Promise<{ ok: boolean }>` — all called from `WelcomeFlow` in Phase 2.

- [ ] **Step 1: Write the writer**

Create `lib/onboarding/onboarding-write.ts`:

```ts
import { prisma } from "@/lib/prisma"
import type { SqlLevel } from "@/lib/onboarding/entry-point"

/**
 * The three onboarding writes, parameterised by userId.
 *
 * NOT a server action, deliberately: every export of a "use server" module
 * becomes a client-callable RPC endpoint, so a writer taking an explicit
 * userId would let any client write onboarding state as any other user.
 * `actions/onboarding.ts` resolves the session and delegates here. Same split
 * as `lib/curriculum-write.ts`.
 */

/**
 * First write wins. A refresh must not reset the timestamp — the funnel's
 * "started" step asks when the learner first arrived, not most recently.
 * `updateMany` with the null guard makes that a single atomic statement
 * rather than a read-then-write race.
 */
export async function markOnboardingStartedForUser(userId: string): Promise<void> {
    await prisma.user.updateMany({
        where: { id: userId, onboardingStartedAt: null },
        data: { onboardingStartedAt: new Date() },
    })
}

/** Last write wins: a learner may go back and change their answer. */
export async function recordSqlLevelForUser(
    userId: string,
    level: SqlLevel,
): Promise<void> {
    await prisma.user.update({
        where: { id: userId },
        data: { sqlLevel: level },
    })
}

/**
 * Completing is terminal and first-write-wins. `level` is null for a skip,
 * and a skip must not overwrite a level the learner already chose on a
 * previous visit.
 */
export async function completeOnboardingForUser(
    userId: string,
    level: SqlLevel | null,
): Promise<void> {
    await prisma.user.updateMany({
        where: { id: userId, onboardingCompletedAt: null },
        data: {
            onboardingCompletedAt: new Date(),
            ...(level ? { sqlLevel: level } : {}),
        },
    })
}
```

- [ ] **Step 2: Write the actions**

Create `actions/onboarding.ts`:

```ts
"use server"

import { auth } from "@/lib/auth"
import type { SqlLevel } from "@/lib/onboarding/entry-point"
import {
    completeOnboardingForUser,
    markOnboardingStartedForUser,
    recordSqlLevelForUser,
} from "@/lib/onboarding/onboarding-write"

const LEVELS: readonly string[] = ["NEW", "INTERMEDIATE", "ADVANCED"]

/**
 * `level` arrives from a client RPC and is untrusted. An unrecognised string
 * would reach a Prisma enum column and throw a 500 rather than failing
 * cleanly, so it is validated here before any write.
 */
function asSqlLevel(value: unknown): SqlLevel | null {
    return typeof value === "string" && LEVELS.includes(value)
        ? (value as SqlLevel)
        : null
}

/**
 * `auth()` throws synchronously (not a rejected promise) when called outside
 * a request scope — e.g. from a test harness — so this is a try/catch, not a
 * `.catch()` chain. Matches the fail-closed pattern in actions/curriculum.ts.
 */
async function currentUserId(): Promise<string | null> {
    try {
        const session = await auth()
        return session?.user?.id ?? null
    } catch {
        return null
    }
}

/** Records that the learner reached screen 1. Anonymous callers no-op. */
export async function recordOnboardingStart(): Promise<void> {
    const userId = await currentUserId()
    if (!userId) return
    await markOnboardingStartedForUser(userId)
}

export async function recordSqlLevel(level: string): Promise<{ ok: boolean }> {
    const userId = await currentUserId()
    if (!userId) return { ok: false }

    const parsed = asSqlLevel(level)
    if (!parsed) return { ok: false }

    await recordSqlLevelForUser(userId, parsed)
    return { ok: true }
}

/** `level` is null for a skip. */
export async function completeOnboarding(
    level: string | null,
): Promise<{ ok: boolean }> {
    const userId = await currentUserId()
    if (!userId) return { ok: false }

    const parsed = level === null ? null : asSqlLevel(level)
    if (level !== null && !parsed) return { ok: false }

    await completeOnboardingForUser(userId, parsed)
    return { ok: true }
}
```

- [ ] **Step 3: Verify the writer is not a server action**

```bash
head -1 lib/onboarding/onboarding-write.ts
```

Expected: the first line is `import { prisma }...`, **not** `"use server"`. If it is `"use server"`, the security split is broken — fix before committing.

- [ ] **Step 4: Verify types compile**

```bash
npx tsc --noEmit
```

Expected: PASS.

- [ ] **Step 5: Commit and open the Phase 1 PR**

```bash
git add lib/onboarding/onboarding-write.ts actions/onboarding.ts
git commit -m "feat(onboarding): session-resolving actions over a parameterised writer"
git push -u origin feat/v17-onboarding-schema
gh pr create --base main --title "feat(onboarding): V17 schema and logic (ships dark)" --body "$(cat <<'EOF'
## Summary
Phase 1 of V17 first-run onboarding. No user-visible change — no route exists yet.

- Three additive `User` columns (`sqlLevel`, `onboardingStartedAt`, `onboardingCompletedAt`) plus a `SqlLevel` enum, with an in-migration backfill marking every existing user as already onboarded.
- `lib/onboarding/entry-point.ts` — pure level→module resolution, clamped by index rather than mapped by slug so an admin rename or reorder cannot break it.
- `actions/onboarding.ts` over `lib/onboarding/onboarding-write.ts`, following the `curriculum-write` split: the `userId`-parameterised writer is deliberately not a server action.
- `session.user.onboardingCompleted` as a boolean, not the timestamp — the session is JSON-serialized to clients.

## Verified
- `npm run test:onboarding-entry` — 12 tests pass; proven non-vacuous by breaking `TARGET_INDEX.NEW` and watching the first test fail.
- `npm run check:ci-coverage` passes with the new suite wired in.
- `npx tsc --noEmit` clean.
- Backfill verified against local Postgres: zero rows left with a null `onboardingCompletedAt`.

## Not yet verified
- Nothing renders this yet; behaviour lands in Phase 2.

> Touches `.github/workflows/test.yml` — merge in the web UI, the local `gh` token lacks `workflow` scope.
EOF
)"
```

---

## Phase 2 — The route

Branch: `feat/v17-onboarding-route`, cut from `main` after Phase 1 merges. This is the PR that changes behaviour.

### Task 5: Make `/welcome` a focus route

**Files:**

- Modify: `components/layout/console/focus-route.ts`
- Modify: `scripts/test-console-nav.ts`

**Interfaces:**

- Consumes: nothing.
- Produces: `isFocusRoute("/welcome") === true`, so `ConsoleChrome` renders only `#app-scroll` and the page supplies its own landmarks.

- [ ] **Step 1: Write the failing tests**

In `scripts/test-console-nav.ts`, add to the existing `describe("isFocusRoute", ...)` block:

```ts
    it("treats /welcome as a focus route", () => {
        // Onboarding replaces the shell: no sidebar, no rail, no footer.
        assert.equal(isFocusRoute("/welcome"), true)
    })

    it("tolerates a trailing slash on /welcome", () => {
        assert.equal(isFocusRoute("/welcome/"), true)
    })

    it("does not match a deeper path under /welcome", () => {
        // There is no /welcome/<step> route; steps are client state.
        assert.equal(isFocusRoute("/welcome/step-2"), false)
    })
```

And add `"/welcome"` to the `ROUTES` array inside `describe("shell modes are mutually exclusive", ...)`:

```ts
    const ROUTES = [
        "/",
        "/welcome",
        "/practice",
        // ...unchanged
    ]
```

- [ ] **Step 2: Run to verify it fails**

```bash
npm run test:console-nav
```

Expected: FAIL — "treats /welcome as a focus route" gets `false`.

- [ ] **Step 3: Widen the predicate**

In `components/layout/console/focus-route.ts`, update `isFocusRoute`:

```ts
/**
 * Whether a path is a "focus mode" route — one that replaces the console
 * shell rather than sitting inside it.
 *
 * Two routes today: the lesson reader (/learn/tracks/<track>/<lesson>) and
 * first-run onboarding (/welcome). The track page one level up
 * (/learn/tracks/<track>) keeps the shell, so segment count is the
 * discriminator for the reader, not a prefix match. /welcome is a single
 * static segment — there is no /welcome/<step>, because the steps are client
 * state inside one page.
 */
export function isFocusRoute(pathname: string): boolean {
    const segments = pathname.split("/").filter(Boolean)

    if (segments.length === 1 && segments[0] === "welcome") return true

    return (
        segments.length === 4 &&
        segments[0] === "learn" &&
        segments[1] === "tracks"
    )
}
```

- [ ] **Step 4: Run to verify it passes**

```bash
npm run test:console-nav
```

Expected: PASS, including the unchanged mutual-exclusivity test — `/welcome` is one segment and `isAppRoute` requires two, so no path resolves to two shell modes.

- [ ] **Step 5: Commit**

```bash
git add components/layout/console/focus-route.ts scripts/test-console-nav.ts
git commit -m "feat(onboarding): /welcome is a focus route"
```

---

### Task 6: The two screens

**Files:**

- Create: `components/welcome/LevelStep.tsx`
- Create: `components/welcome/StartHereStep.tsx`
- Create: `components/welcome/WelcomeFlow.tsx`

**Interfaces:**

- Consumes: `resolveEntryPoint`, `EntryPoint`, `ModuleLike`, `SqlLevel` (Task 1); `recordOnboardingStart`, `recordSqlLevel`, `completeOnboarding` (Task 4).
- Produces: `<WelcomeFlow firstName={string | null} initialLevel={SqlLevel | null} trackSlug={string | null} trackName={string | null} modules={ModuleLike[]} />`, consumed by `app/welcome/page.tsx` in Task 7.

- [ ] **Step 1: Write screen 1**

Create `components/welcome/LevelStep.tsx`:

```tsx
"use client"

import { Button } from "@/components/ui/Button"
import { cn } from "@/lib/utils"
import type { SqlLevel } from "@/lib/onboarding/entry-point"

const OPTIONS: { value: SqlLevel; label: string; detail: string }[] = [
    {
        value: "NEW",
        label: "New to SQL",
        detail: "Start from SELECT and filtering",
    },
    {
        value: "INTERMEDIATE",
        label: "I can write JOINs and GROUP BY",
        detail: "Skip the basics, start at aggregation",
    },
    {
        value: "ADVANCED",
        label: "Prepping for senior interviews",
        detail: "Window functions, CTEs, optimization",
    },
]

export function LevelStep({
    firstName,
    selected,
    onSelect,
    onContinue,
    onSkip,
    busy,
}: {
    firstName: string | null
    selected: SqlLevel | null
    onSelect: (level: SqlLevel) => void
    onContinue: () => void
    onSkip: () => void
    busy: boolean
}) {
    return (
        <div className="mx-auto w-full max-w-lg">
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                {firstName ? `Welcome, ${firstName}.` : "Welcome to Data Learn."}
            </h1>
            <p className="mt-2 text-muted-foreground">
                One question, then we&rsquo;ll point you at a starting lesson.
            </p>

            <fieldset className="mt-8">
                <legend className="text-sm font-medium">
                    How comfortable are you with SQL?
                </legend>
                <div className="mt-3 space-y-2">
                    {OPTIONS.map((option) => {
                        const isSelected = selected === option.value
                        return (
                            <label
                                key={option.value}
                                className={cn(
                                    "flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition-colors",
                                    isSelected
                                        ? "border-primary bg-primary/5"
                                        : "border-border bg-surface hover:border-primary/40",
                                )}
                            >
                                <input
                                    type="radio"
                                    name="sql-level"
                                    value={option.value}
                                    checked={isSelected}
                                    onChange={() => onSelect(option.value)}
                                    className="mt-1 accent-primary"
                                />
                                <span>
                                    <span className="block text-sm font-medium">
                                        {option.label}
                                    </span>
                                    <span className="block text-sm text-muted-foreground">
                                        {option.detail}
                                    </span>
                                </span>
                            </label>
                        )
                    })}
                </div>
            </fieldset>

            <div className="mt-8 flex items-center justify-between gap-4">
                <Button variant="ghost" onClick={onSkip} disabled={busy}>
                    Skip
                </Button>
                <Button onClick={onContinue} disabled={!selected || busy}>
                    Continue
                </Button>
            </div>
        </div>
    )
}
```

- [ ] **Step 2: Write screen 2, including the fallback**

Create `components/welcome/StartHereStep.tsx`:

```tsx
"use client"

import { BookOpen, ListChecks } from "lucide-react"
import { Button } from "@/components/ui/Button"
import type { EntryPoint } from "@/lib/onboarding/entry-point"

/**
 * The destination screen.
 *
 * `entry` is null whenever there is no published track, no modules, or no
 * module with a lesson — all reachable in production, because the featured
 * track ships DRAFT and `getTrackCurriculum` returns null for it to
 * non-staff. In that case this renders an honest catalog CTA rather than a
 * module card reading "0 lessons".
 *
 * The fallback links to plain /practice with no query string: the catalog
 * reads no search params (filters are client state in CatalogClient), so a
 * ?difficulty= link would be a dead parameter that looks like a feature.
 */
export function StartHereStep({
    entry,
    trackSlug,
    trackName,
    moduleCount,
    onLaunch,
    onBrowse,
    onBack,
    busy,
}: {
    entry: EntryPoint | null
    trackSlug: string | null
    trackName: string | null
    moduleCount: number
    onLaunch: (href: string) => void
    onBrowse: () => void
    onBack: () => void
    busy: boolean
}) {
    const lessonHref =
        entry && trackSlug ? `/learn/tracks/${trackSlug}/${entry.lessonSlug}` : null

    return (
        <div className="mx-auto w-full max-w-lg">
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                You&rsquo;re set.
            </h1>

            {entry && lessonHref ? (
                <>
                    <p className="mt-2 text-muted-foreground">Start here.</p>
                    <div className="mt-6 rounded-lg border border-border bg-surface p-5">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <BookOpen className="h-4 w-4" aria-hidden />
                            <span className="tabular-nums">
                                Module {String(entry.modulePosition + 1).padStart(2, "0")}
                            </span>
                            <span aria-hidden>·</span>
                            <span>{entry.moduleName}</span>
                        </div>
                        <p className="mt-3 text-base font-medium">{entry.lessonTitle}</p>
                        <p className="mt-1 text-sm text-muted-foreground tabular-nums">
                            {entry.lessonCount} lesson{entry.lessonCount === 1 ? "" : "s"} in this module
                            {entry.readingMinutes !== null
                                ? ` · ~${entry.readingMinutes} min to read`
                                : ""}
                        </p>
                    </div>
                    {trackName ? (
                        <p className="mt-3 text-sm text-muted-foreground tabular-nums">
                            {trackName} · {moduleCount} modules
                        </p>
                    ) : null}
                    <div className="mt-8 flex items-center justify-between gap-4">
                        <Button variant="ghost" onClick={onBack} disabled={busy}>
                            Back
                        </Button>
                        <Button onClick={() => onLaunch(lessonHref)} disabled={busy}>
                            Start lesson
                        </Button>
                    </div>
                    <button
                        type="button"
                        onClick={onBrowse}
                        disabled={busy}
                        className="mt-4 text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
                    >
                        Or browse all problems instead
                    </button>
                </>
            ) : (
                <>
                    <p className="mt-2 text-muted-foreground">
                        There&rsquo;s no published lesson path yet, so start with the
                        problem catalog — everything runs in your browser.
                    </p>
                    <div className="mt-6 rounded-lg border border-border bg-surface p-5">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <ListChecks className="h-4 w-4" aria-hidden />
                            <span>Practice catalog</span>
                        </div>
                        <p className="mt-3 text-sm text-muted-foreground">
                            Filter by difficulty and topic once you&rsquo;re in.
                        </p>
                    </div>
                    <div className="mt-8 flex items-center justify-between gap-4">
                        <Button variant="ghost" onClick={onBack} disabled={busy}>
                            Back
                        </Button>
                        <Button onClick={onBrowse} disabled={busy}>
                            Browse problems
                        </Button>
                    </div>
                </>
            )}
        </div>
    )
}
```

- [ ] **Step 3: Write the flow container**

Create `components/welcome/WelcomeFlow.tsx`:

```tsx
"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import {
    completeOnboarding,
    recordOnboardingStart,
    recordSqlLevel,
} from "@/actions/onboarding"
import {
    resolveEntryPoint,
    type ModuleLike,
    type SqlLevel,
} from "@/lib/onboarding/entry-point"
import { LevelStep } from "@/components/welcome/LevelStep"
import { StartHereStep } from "@/components/welcome/StartHereStep"

export function WelcomeFlow({
    firstName,
    initialLevel,
    trackSlug,
    trackName,
    modules,
}: {
    firstName: string | null
    initialLevel: SqlLevel | null
    trackSlug: string | null
    trackName: string | null
    modules: ModuleLike[]
}) {
    const router = useRouter()
    // Resume: a learner who answered and left comes back to screen 2 with
    // their answer intact rather than re-answering.
    const [level, setLevel] = useState<SqlLevel | null>(initialLevel)
    const [step, setStep] = useState<1 | 2>(initialLevel ? 2 : 1)
    const [busy, setBusy] = useState(false)

    useEffect(() => {
        // Write-on-view, fired from the client rather than during server
        // render: a GET that renders a page must stay side-effect-free, and a
        // prefetch would otherwise record a start the learner never saw. The
        // action is first-write-wins, so a refresh keeps the original stamp.
        void recordOnboardingStart()
    }, [])

    const entry = level ? resolveEntryPoint(level, modules) : null

    async function handleContinue() {
        if (!level) return
        setBusy(true)
        await recordSqlLevel(level)
        setBusy(false)
        setStep(2)
    }

    async function finish(destination: string) {
        setBusy(true)
        await completeOnboarding(level)
        // Not router.push: the session's onboardingCompleted flag is stale in
        // this client's cache, and "/" redirects on the stale value. A hard
        // navigation re-reads the session server-side.
        window.location.assign(destination)
    }

    async function handleSkip() {
        setBusy(true)
        await completeOnboarding(null)
        window.location.assign("/")
    }

    if (step === 1) {
        return (
            <LevelStep
                firstName={firstName}
                selected={level}
                onSelect={setLevel}
                onContinue={handleContinue}
                onSkip={handleSkip}
                busy={busy}
            />
        )
    }

    return (
        <StartHereStep
            entry={entry}
            trackSlug={trackSlug}
            trackName={trackName}
            moduleCount={modules.length}
            onLaunch={(href) => void finish(href)}
            onBrowse={() => void finish("/practice")}
            onBack={() => setStep(1)}
            busy={busy}
        />
    )
}
```

Note `router` is imported but only used if you prefer a soft navigation somewhere; if it stays unused, delete the import and the `useRouter()` call rather than leaving a lint error.

- [ ] **Step 4: Verify types compile**

```bash
npx tsc --noEmit
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add components/welcome
git commit -m "feat(onboarding): level and start-here screens"
```

---

### Task 7: The route and the redirect contract

**Files:**

- Create: `app/welcome/page.tsx`
- Modify: `app/page.tsx`

**Interfaces:**

- Consumes: `WelcomeFlow` (Task 6), `session.user.onboardingCompleted` (Task 3), `getTrackCurriculum` + `FEATURED_TRACK_SLUG` (existing).
- Produces: the `/welcome` route and the one-way redirect from `/`.

- [ ] **Step 1: Write the page**

Create `app/welcome/page.tsx`:

```tsx
import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { signInPath } from "@/lib/auth-redirect"
import { getTrackCurriculum } from "@/actions/curriculum"
import { FEATURED_TRACK_SLUG } from "@/lib/curriculum-featured"
import { Logo } from "@/components/ui/Logo"
import { WelcomeFlow } from "@/components/welcome/WelcomeFlow"
import type { ModuleLike, SqlLevel } from "@/lib/onboarding/entry-point"

export const metadata: Metadata = {
    title: "Welcome",
    robots: { index: false, follow: false },
}

function firstNameOf(name: string | null): string | null {
    if (!name) return null
    const first = name.trim().split(/\s+/)[0]
    return first.length > 0 ? first : null
}

/**
 * First-run onboarding. A focus route: `ConsoleChrome` renders only
 * #app-scroll for it, so this page supplies its own <header> and <main> AS
 * SIBLINGS — ARIA forbids the `banner` landmark inside `main`, the same
 * constraint the lesson reader lives under.
 *
 * Only app/page.tsx redirects INTO this route, and this route only redirects
 * OUT when onboarding is already complete. The two conditions are exact
 * complements, so a redirect loop is structurally impossible rather than
 * defended against.
 */
export default async function WelcomePage() {
    const session = await auth()
    if (!session?.user?.id) redirect(signInPath("/welcome"))
    if (session.user.onboardingCompleted) redirect("/")

    const [user, curriculum] = await Promise.all([
        prisma.user.findUnique({
            where: { id: session.user.id },
            select: { sqlLevel: true, name: true },
        }),
        getTrackCurriculum(FEATURED_TRACK_SLUG),
    ])

    // Structural mapping, not a cast: entry-point.ts stays Prisma-free by
    // accepting the shape it needs rather than importing CurriculumModule.
    const modules: ModuleLike[] = (curriculum?.modules ?? []).map((module) => ({
        slug: module.slug,
        name: module.name,
        position: module.position,
        lessons: module.lessons.map((lesson) => ({
            slug: lesson.slug,
            title: lesson.title,
            readingMinutes: lesson.readingMinutes,
        })),
    }))

    return (
        <>
            <header className="border-b border-border">
                <div className="mx-auto flex h-14 w-full max-w-5xl items-center px-4">
                    <Logo />
                </div>
            </header>
            <main id="main-content" className="px-4 py-12 sm:py-16">
                <WelcomeFlow
                    firstName={firstNameOf(user?.name ?? session.user.name ?? null)}
                    initialLevel={(user?.sqlLevel as SqlLevel | null) ?? null}
                    trackSlug={curriculum?.slug ?? null}
                    trackName={curriculum?.name ?? null}
                    modules={modules}
                />
            </main>
        </>
    )
}
```

- [ ] **Step 2: Add the redirect to the home page**

In `app/page.tsx`, add the import:

```ts
import { redirect } from "next/navigation"
```

Then insert this immediately after the existing `const [{ data: problems }, { data: topics }, session] = await Promise.all([...])` and **before** the `if (session?.user?.id) {` block:

```ts
    // First-run onboarding. Placed before the dashboard reads below so an
    // onboarding user never pays for getUserStats / getDailyStatus /
    // getHomeData on a page they will not see. A learner who signed in from
    // a callbackUrl lands on that page instead and is never interrupted —
    // onboarding is an invitation, not a gate.
    if (session?.user?.id && !session.user.onboardingCompleted) {
        redirect("/welcome")
    }
```

- [ ] **Step 3: Verify the flow by hand**

Start the dev server against local Postgres:

```bash
DATABASE_URL='postgresql://anchitgupta@localhost:5432/datalearn' npm run dev
```

Then reset one user to un-onboarded and walk the flow:

```bash
psql 'postgresql://anchitgupta@localhost:5432/datalearn' -c \
  'UPDATE "User" SET "onboardingCompletedAt" = NULL, "onboardingStartedAt" = NULL, "sqlLevel" = NULL;'
```

Confirm, signed in: `/` redirects to `/welcome`; the console sidebar is absent; choosing a level and continuing shows the module card; "Start lesson" lands on the reader; revisiting `/` no longer redirects; visiting `/welcome` directly bounces to `/`.

- [ ] **Step 4: Verify the build**

```bash
npm run build
```

Expected: PASS. (`--webpack` is already pinned in the script — do not run `next build` bare.)

- [ ] **Step 5: Commit**

```bash
git add app/welcome/page.tsx app/page.tsx
git commit -m "feat(onboarding): /welcome route and the home redirect"
```

---

### Task 8: End-to-end coverage

**Files:**

- Create: `tests/e2e/welcome.spec.ts`

**Interfaces:**

- Consumes: everything from Tasks 5–7; `seedUser`, `deleteUser`, `sessionCookie`, `prisma` from `tests/e2e/fixtures/db`.
- Produces: nothing consumed downstream.

- [ ] **Step 1: Write the spec**

Create `tests/e2e/welcome.spec.ts`:

```ts
import { expect, test } from "@playwright/test"
import {
    deleteUser,
    prisma,
    seedUser,
    sessionCookie,
    type SeededUser,
} from "./fixtures/db"

/**
 * First-run onboarding — /welcome.
 *
 * Seeds its own users rather than depending on seed data, matching every
 * other spec in this directory. The no-track case is the default here: CI
 * does not run seed-analyst-track.ts, so there is no published curriculum
 * and the fallback path is what renders. That is deliberate — the fallback
 * is the branch most likely to regress silently, because it is invisible on
 * a developer machine with a seeded track.
 */
const NAMESPACE = "e2e-welcome"
const RUN_ID = `${Date.now()}-${Math.random().toString(16).slice(2)}`
const PREFIX = `${NAMESPACE}-${RUN_ID}`
const BASE_URL =
    process.env.E2E_BASE_URL ??
    `http://localhost:${process.env.E2E_PORT ?? "3100"}`

const newUserEmail = `${PREFIX}-new@example.test`
const doneUserEmail = `${PREFIX}-done@example.test`
const emails = [newUserEmail, doneUserEmail]

let newUser: SeededUser
let doneUser: SeededUser

test.beforeAll(async () => {
    newUser = await seedUser({ email: newUserEmail, name: "Ada Lovelace" })
    doneUser = await seedUser({ email: doneUserEmail, name: "Grace Hopper" })

    // seedUser creates a fresh row, so both start un-onboarded. Mark one
    // complete to assert the bounce.
    await prisma.user.update({
        where: { id: newUser.id },
        data: { onboardingCompletedAt: null, onboardingStartedAt: null, sqlLevel: null },
    })
    await prisma.user.update({
        where: { id: doneUser.id },
        data: { onboardingCompletedAt: new Date() },
    })
})

test.afterAll(async () => {
    for (const email of emails) await deleteUser(email)
})

test.describe("first-run onboarding", () => {
    test("a new user is redirected from / to /welcome", async ({ context, page }) => {
        await context.addCookies([sessionCookie(newUser.sessionToken, BASE_URL)])
        await page.goto(`${BASE_URL}/`)
        await expect(page).toHaveURL(/\/welcome$/)
        await expect(
            page.getByRole("heading", { level: 1, name: /Welcome, Ada/ })
        ).toBeVisible()
    })

    test("exactly one banner, one main and one h1", async ({ context, page }) => {
        await context.addCookies([sessionCookie(newUser.sessionToken, BASE_URL)])
        await page.goto(`${BASE_URL}/welcome`)
        // ARIA forbids banner inside main; a focus route that got this wrong
        // would still look correct on screen.
        await expect(page.getByRole("banner")).toHaveCount(1)
        await expect(page.getByRole("main")).toHaveCount(1)
        await expect(page.locator("h1")).toHaveCount(1)
    })

    test("the console sidebar is absent", async ({ context, page }) => {
        await context.addCookies([sessionCookie(newUser.sessionToken, BASE_URL)])
        await page.goto(`${BASE_URL}/welcome`)
        // The console nav is labelled "Primary" (ConsoleSidebar.tsx / ConsoleRail.tsx).
        await expect(page.getByRole("navigation", { name: "Primary" })).toHaveCount(0)
    })

    test("a completed user visiting /welcome is bounced home", async ({ context, page }) => {
        await context.addCookies([sessionCookie(doneUser.sessionToken, BASE_URL)])
        await page.goto(`${BASE_URL}/welcome`)
        await expect(page).toHaveURL(new RegExp(`${BASE_URL}/?$`))
    })

    test("answering records the level and shows a destination", async ({ context, page }) => {
        await context.addCookies([sessionCookie(newUser.sessionToken, BASE_URL)])
        await page.goto(`${BASE_URL}/welcome`)

        await page.getByRole("radio", { name: /I can write JOINs/ }).check()
        await page.getByRole("button", { name: "Continue" }).click()

        await expect(page.getByRole("heading", { level: 1 })).toContainText("You're set")

        const stored = await prisma.user.findUnique({
            where: { id: newUser.id },
            select: { sqlLevel: true, onboardingStartedAt: true },
        })
        expect(stored?.sqlLevel).toBe("INTERMEDIATE")
        // Write-on-view fired from the client effect.
        expect(stored?.onboardingStartedAt).not.toBeNull()
    })

    test("with no published track it offers the catalog, never '0 lessons'", async ({ context, page }) => {
        await context.addCookies([sessionCookie(newUser.sessionToken, BASE_URL)])
        await page.goto(`${BASE_URL}/welcome`)
        await page.getByRole("radio", { name: /New to SQL/ }).check()
        await page.getByRole("button", { name: "Continue" }).click()

        await expect(page.getByText("0 lessons")).toHaveCount(0)
        await expect(page.getByRole("button", { name: /Browse problems/ })).toBeVisible()
    })

    test("skipping completes and never redirects again", async ({ context, page }) => {
        const skipper = await seedUser({ email: `${PREFIX}-skip@example.test` })
        emails.push(`${PREFIX}-skip@example.test`)
        await prisma.user.update({
            where: { id: skipper.id },
            data: { onboardingCompletedAt: null, sqlLevel: null },
        })

        await context.addCookies([sessionCookie(skipper.sessionToken, BASE_URL)])
        await page.goto(`${BASE_URL}/welcome`)
        await page.getByRole("button", { name: "Skip" }).click()

        await expect(page).toHaveURL(new RegExp(`${BASE_URL}/?$`))

        const stored = await prisma.user.findUnique({
            where: { id: skipper.id },
            select: { sqlLevel: true, onboardingCompletedAt: true },
        })
        // Skipped: completed, but no level. That pair is what the skip-rate
        // tile counts.
        expect(stored?.sqlLevel).toBeNull()
        expect(stored?.onboardingCompletedAt).not.toBeNull()

        await page.goto(`${BASE_URL}/`)
        await expect(page).not.toHaveURL(/\/welcome/)
    })
})
```

- [ ] **Step 2: Run the spec**

```bash
npm run test:e2e -- welcome
```

Expected: PASS, 7 tests.

- [ ] **Step 3: Prove it is non-vacuous**

Comment out the redirect block in `app/page.tsx`, re-run, and confirm "a new user is redirected from / to /welcome" FAILS. Restore it and confirm PASS.

- [ ] **Step 4: Run the full guard set**

```bash
npm run test:console-nav
npm run test:onboarding-entry
npm run check:token-parity
npx tsc --noEmit
```

Expected: all PASS.

- [ ] **Step 5: Commit and open the Phase 2 PR**

```bash
git add tests/e2e/welcome.spec.ts
git commit -m "test(onboarding): e2e for the welcome route"
git push -u origin feat/v17-onboarding-route
gh pr create --base main --title "feat(onboarding): V17 welcome route" --body "$(cat <<'EOF'
## Summary
Phase 2 of V17. The behaviour change: a new user landing on `/` is redirected once to `/welcome`, answers one question, and leaves on a specific lesson.

- `/welcome` is a focus route — no console shell, own `<header>` + `<main>` as siblings.
- Two screens; the answer resolves to an entry module inside the featured track, clamped so a short track degrades instead of breaking.
- With no published track the destination screen offers the catalog rather than a module card reading "0 lessons". CI has no seeded curriculum, so that fallback is the branch the e2e actually exercises.
- Only `app/page.tsx` redirects in; only `/welcome` redirects out, on the complementary condition. No loop is possible.

## Verified
- `npm run test:e2e -- welcome` — 7 tests pass; proven non-vacuous by commenting out the redirect and watching the first test fail.
- `npm run test:console-nav` passes with `/welcome` added to the mutual-exclusivity route list.
- `npm run build`, `npx tsc --noEmit`, `npm run check:token-parity` all clean.
- Walked by hand against local Postgres: redirect, resume, skip, and the bounce for a completed user.

## Not yet verified
- The funnel read lands in Phase 3; conversion is not yet measurable.
EOF
)"
```

---

## Phase 3 — Analytics

Branch: `feat/v17-onboarding-analytics`, cut from `main` after Phase 2 merges. Do not start this until Phase 2 has been live long enough to produce a cohort — an empty funnel proves nothing about the read.

### Task 9: The pure funnel module and its read

**Files:**

- Create: `lib/analytics/onboarding-funnel.ts`
- Create: `scripts/test-analytics-onboarding-funnel.ts`
- Modify: `lib/analytics/analytics-read.ts`
- Modify: `package.json`, `.github/workflows/test.yml`

**Interfaces:**

- Consumes: `buildFunnel`, `FunnelStep` from `lib/analytics/funnel.ts`; the three `User` columns.
- Produces: `ONBOARDING_LAUNCHED_AT: Date`; `type OnboardingCounts = { signedUp: number; started: number; answered: number; completed: number; submitted: number; skipped: number }`; `buildOnboardingFunnel(counts: OnboardingCounts): FunnelStep[]`; `skipRate(counts: OnboardingCounts): number | null`; `getOnboardingCounts(): Promise<OnboardingCounts>`.

- [ ] **Step 1: Write the failing test**

Create `scripts/test-analytics-onboarding-funnel.ts`:

```ts
// Unit tests for the pure onboarding funnel assembly. No database.
//
// Run: node --import tsx --test scripts/test-analytics-onboarding-funnel.ts

import { describe, it } from "node:test"
import assert from "node:assert/strict"
import {
    buildOnboardingFunnel,
    skipRate,
    type OnboardingCounts,
} from "../lib/analytics/onboarding-funnel"

function counts(over: Partial<OnboardingCounts> = {}): OnboardingCounts {
    return {
        signedUp: 0,
        started: 0,
        answered: 0,
        completed: 0,
        submitted: 0,
        skipped: 0,
        ...over,
    }
}

describe("buildOnboardingFunnel", () => {
    it("reports five steps in order", () => {
        const steps = buildOnboardingFunnel(
            counts({ signedUp: 100, started: 80, answered: 60, completed: 55, submitted: 30 }),
        )
        assert.deepEqual(
            steps.map((s) => s.key),
            ["signedUp", "started", "answered", "completed", "submitted"],
        )
    })

    it("computes rates against the previous step and the start", () => {
        const steps = buildOnboardingFunnel(
            counts({ signedUp: 100, started: 80, answered: 60, completed: 55, submitted: 30 }),
        )
        assert.equal(steps[1].rateFromPrevious, 0.8)
        assert.equal(steps[4].rateFromStart, 0.3)
    })

    it("reports null rates over an empty cohort, never zero", () => {
        // An empty cohort is unknown, not a 0% conversion. Rendering 0%
        // would claim a catastrophic result that the data does not support.
        const steps = buildOnboardingFunnel(counts())
        assert.equal(steps[0].rateFromPrevious, null)
        for (const step of steps.slice(1)) {
            assert.equal(step.rateFromPrevious, null)
            assert.equal(step.rateFromStart, null)
        }
    })
})

describe("skipRate", () => {
    it("is skipped over completed", () => {
        assert.equal(skipRate(counts({ completed: 50, skipped: 10 })), 0.2)
    })

    it("is null when nobody has completed", () => {
        assert.equal(skipRate(counts({ completed: 0, skipped: 0 })), null)
    })

    it("is 1 when everyone skipped", () => {
        assert.equal(skipRate(counts({ completed: 8, skipped: 8 })), 1)
    })
})
```

- [ ] **Step 2: Run to verify it fails**

```bash
node --import tsx --test scripts/test-analytics-onboarding-funnel.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Write the pure module**

Create `lib/analytics/onboarding-funnel.ts`:

```ts
import { buildFunnel, type FunnelStep } from "@/lib/analytics/funnel"

/**
 * The onboarding cohort boundary.
 *
 * Users created before this instant were backfilled as already-onboarded by
 * the V17 migration: they have `onboardingCompletedAt` set and
 * `onboardingStartedAt` null. Counting them would poison the denominator
 * permanently and make the funnel read as a catastrophic drop-off forever.
 *
 * Identifying them by `completedAt === createdAt` would also work and is
 * rejected as too clever — an explicit constant states the intent. Set to
 * the Phase 2 production deploy date, NOT the Phase 1 merge date: Phase 1
 * ships dark, so nobody could have onboarded before Phase 2 was live.
 */
export const ONBOARDING_LAUNCHED_AT = new Date("2026-09-01T00:00:00.000Z")

export type OnboardingCounts = {
    signedUp: number
    started: number
    answered: number
    completed: number
    submitted: number
    /** Completed with no level — the definition of a deliberate skip. */
    skipped: number
}

export function buildOnboardingFunnel(counts: OnboardingCounts): FunnelStep[] {
    return buildFunnel([
        { key: "signedUp", label: "Signed up", count: counts.signedUp },
        { key: "started", label: "Reached onboarding", count: counts.started },
        { key: "answered", label: "Answered the level question", count: counts.answered },
        { key: "completed", label: "Finished onboarding", count: counts.completed },
        { key: "submitted", label: "Made a first submission", count: counts.submitted },
    ])
}

/**
 * Null, not zero, when nobody has completed — an unknown rate and a genuine
 * 0% must not render identically.
 */
export function skipRate(counts: OnboardingCounts): number | null {
    return counts.completed === 0 ? null : counts.skipped / counts.completed
}
```

- [ ] **Step 4: Run to verify it passes**

```bash
node --import tsx --test scripts/test-analytics-onboarding-funnel.ts
```

Expected: PASS, 6 tests.

- [ ] **Step 5: Prove it is non-vacuous**

Change `skipRate` to return `0` instead of `null` for the zero case, re-run, and confirm "is null when nobody has completed" FAILS. Revert.

- [ ] **Step 6: Add the Prisma read**

Append to `lib/analytics/analytics-read.ts` (which deliberately has no `"use server"` directive):

```ts
export async function getOnboardingCounts(): Promise<OnboardingCounts> {
    const cohort = { createdAt: { gte: ONBOARDING_LAUNCHED_AT } }

    const [signedUp, started, answered, completed, skipped, cohortUsers] =
        await Promise.all([
            prisma.user.count({ where: cohort }),
            prisma.user.count({ where: { ...cohort, onboardingStartedAt: { not: null } } }),
            prisma.user.count({ where: { ...cohort, sqlLevel: { not: null } } }),
            prisma.user.count({ where: { ...cohort, onboardingCompletedAt: { not: null } } }),
            prisma.user.count({
                where: { ...cohort, onboardingCompletedAt: { not: null }, sqlLevel: null },
            }),
            prisma.user.findMany({ where: cohort, select: { id: true } }),
        ])

    if (cohortUsers.length === 0) {
        return { signedUp: 0, started: 0, answered: 0, completed: 0, submitted: 0, skipped: 0 }
    }

    const submittingUsers = await prisma.submission.findMany({
        where: { userId: { in: cohortUsers.map((user) => user.id) } },
        distinct: ["userId"],
        select: { userId: true },
    })

    return {
        signedUp,
        started,
        answered,
        completed,
        submitted: submittingUsers.length,
        skipped,
    }
}
```

Add the imports at the top of the file:

```ts
import {
    ONBOARDING_LAUNCHED_AT,
    type OnboardingCounts,
} from "@/lib/analytics/onboarding-funnel"
```

- [ ] **Step 7: Wire the suite into npm scripts and CI**

In `package.json`:

```json
"test:analytics-onboarding-funnel": "node --import tsx --test scripts/test-analytics-onboarding-funnel.ts",
```

In `.github/workflows/test.yml`, next to the other analytics suites:

```yaml
      - name: Test analytics onboarding funnel
        run: npm run test:analytics-onboarding-funnel
```

- [ ] **Step 8: Verify the coverage guard and types**

```bash
npm run check:ci-coverage
npx tsc --noEmit
```

Expected: both PASS.

- [ ] **Step 9: Commit**

```bash
git add lib/analytics/onboarding-funnel.ts scripts/test-analytics-onboarding-funnel.ts lib/analytics/analytics-read.ts package.json .github/workflows/test.yml
git commit -m "feat(analytics): onboarding funnel read and cohort boundary"
```

---

### Task 10: The portal section

**Files:**

- Create: `components/admin/analytics/OnboardingSection.tsx`
- Modify: `app/admin/analytics/page.tsx`

**Interfaces:**

- Consumes: `getOnboardingCounts`, `buildOnboardingFunnel`, `skipRate` (Task 9); existing `FunnelBar` and `StatTile`.
- Produces: nothing consumed downstream.

- [ ] **Step 1: Write the section**

Create `components/admin/analytics/OnboardingSection.tsx`:

```tsx
import { FunnelBar } from "@/components/admin/analytics/FunnelBar"
import { StatTile } from "@/components/admin/analytics/StatTile"
import { Eyebrow } from "@/components/ui/Eyebrow"
import { getOnboardingCounts } from "@/lib/analytics/analytics-read"
import {
    buildOnboardingFunnel,
    skipRate,
} from "@/lib/analytics/onboarding-funnel"

/**
 * Self-fetching, like PlatformSection and ContentSection — the analytics page
 * has no shared read to join. Each section owns its own query so one slow
 * section cannot delay the others.
 */
export async function OnboardingSection() {
    const counts = await getOnboardingCounts()
    const steps = buildOnboardingFunnel(counts)
    const skipped = skipRate(counts)

    return (
        <section className="mt-12">
            <Eyebrow variant="bracket" className="mb-1">
                ONBOARDING
            </Eyebrow>
            <h2 className="text-lg font-semibold tracking-tight">First-run flow</h2>
            <p className="mt-1 text-sm text-muted-foreground">
                Accounts created since onboarding shipped. Users from before that
                are excluded — they were backfilled as already onboarded and would
                otherwise sink every rate permanently.
            </p>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <StatTile
                    label="Skip rate"
                    value={
                        skipped === null
                            ? "Nobody has finished onboarding yet"
                            : `${Math.round(skipped * 100)}%`
                    }
                    // Rising is bad: MetricCard hardcodes up=green, which is
                    // exactly why this renders through StatTile.
                    polarity="up-bad"
                    footnote="Finished without answering the level question"
                />
                <StatTile
                    label="Answered the level question"
                    value={counts.answered.toLocaleString()}
                    footnote={`of ${counts.signedUp.toLocaleString()} accounts in the cohort`}
                />
            </div>

            <div className="mt-6">
                <FunnelBar steps={steps} />
            </div>
        </section>
    )
}
```

- [ ] **Step 2: Render it on the analytics page**

In `app/admin/analytics/page.tsx`, add the import and the read, then render the section after `ContentSection`:

```ts
import { OnboardingSection } from "@/components/admin/analytics/OnboardingSection"
import { getOnboardingCounts } from "@/lib/analytics/analytics-read"
```

Add `getOnboardingCounts()` to the page's existing parallel read, and render:

```tsx
            <OnboardingSection counts={onboardingCounts} />
```

- [ ] **Step 3: Verify by hand**

```bash
DATABASE_URL='postgresql://anchitgupta@localhost:5432/datalearn' npm run dev
```

As an ADMIN, open `/admin/analytics`. With an empty cohort, confirm the funnel says there is nothing to report and the skip tile says "Nobody has finished onboarding yet" — not "0%".

- [ ] **Step 4: Run the analytics guards**

```bash
npm run test:analytics-funnel
npm run test:analytics-onboarding-funnel
npm run test:analytics-stat-tile
npm run test:e2e -- admin-analytics
npx tsc --noEmit
npm run build
```

Expected: all PASS.

- [ ] **Step 5: Commit and open the Phase 3 PR**

```bash
git add components/admin/analytics/OnboardingSection.tsx app/admin/analytics/page.tsx
git commit -m "feat(analytics): onboarding section on the operator portal"
git push -u origin feat/v17-onboarding-analytics
gh pr create --base main --title "feat(analytics): V17 onboarding funnel" --body "$(cat <<'EOF'
## Summary
Phase 3 of V17. Makes the conversion the feature exists to improve actually measurable.

- Funnel: signed up → reached onboarding → answered → finished → first submission, on the existing pure `buildFunnel`.
- Cohorted by an explicit `ONBOARDING_LAUNCHED_AT` constant; backfilled pre-V17 users are excluded so the denominator is not poisoned.
- Skip rate renders through `StatTile` with an explicit polarity, not `MetricCard` — a climbing skip rate must not render green.
- Empty cohort reports null rates and an honest string, never 0%.

## Verified
- `npm run test:analytics-onboarding-funnel` — 6 tests pass; proven non-vacuous by making `skipRate` return 0 for the empty case and watching the null test fail.
- `npm run test:analytics-funnel`, `test:analytics-stat-tile`, `test:e2e -- admin-analytics` all pass.
- `npm run check:ci-coverage`, `npx tsc --noEmit`, `npm run build` clean.
- Checked by hand on an empty cohort: honest zero-states, no fabricated percentages.

## Not yet verified
- Real conversion numbers — the cohort needs live traffic to be meaningful.

> Touches `.github/workflows/test.yml` — merge in the web UI, the local `gh` token lacks `workflow` scope.
EOF
)"
```

---

## Post-merge follow-ups

Not tasks in this plan, but they belong to V17 and should not be lost:

- **Set `ONBOARDING_LAUNCHED_AT` to the real Phase 2 production deploy date** before Phase 3 merges. The placeholder in Task 9 is `2026-09-01`.
- **Update `docs/ROADMAP.md`:** mark V17 shipped, and fix the two contradictions found while writing the spec — V15 is listed as unshipped though the daily mechanic is fully built, and the Phase 1/2/4 tables still list query validation and Vercel deployment as Todo.
- **Update `docs/TECHNICAL_DESIGN.md`** with the onboarding subsystem and the `/welcome` focus route.
- **CLAUDE.md drift found in passing:** `components/practice/PracticeList.tsx` no longer exists (it is `components/practice/catalog/CatalogClient.tsx`). Worth correcting when CLAUDE.md is next touched.
