# Contests — Phase 1 Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the data model, admin tooling, and public read surfaces for Data Learn contests, so that an admin can create a scheduled contest, attach problems (locking them out of the public practice list while the contest is live), and learners can browse and register.

**Architecture:** Adds five new Prisma models (`Contest`, `ContestProblem`, `ContestRegistration`, `ContestProblemLock`, plus two enum types) and two optional fields on `SQLProblem` for hidden test data. Locking lives in its own table, so existing public surfaces (practice, tracks, lists, profile) stay on `status = PUBLISHED` and only opt into lock filtering via a shared helper. Admin CRUD is exposed via REST routes under `/api/admin/contests/*` following the existing `withAdmin` + `lib/admin-validation.ts` pattern. Public reads are server components that derive `SCHEDULED | LIVE | CLOSED` from the contest window so we never trust the DB `status` column to be live-accurate. **No judge, no submissions, no rating, no in-contest workspace** — those are phases 2–7.

**Tech Stack:** Next.js 16 App Router, Prisma 7, NextAuth v5, TypeScript strict, zod, Node's built-in test runner (`node --import tsx --test`), Playwright for E2E.

**Source spec:** [`docs/superpowers/specs/2026-05-24-contests-design.md`](../specs/2026-05-24-contests-design.md). Sections referenced: §3.1 (enums), §3.2 (data model — Phase 1 subset), §3.3 (ContestProblemLock + audit list), §3.4 (hidden fields), §13 (admin surface), §14 phase 1.

---

## File Plan

**New files**

| Path | Responsibility |
| --- | --- |
| `lib/contest-locks.ts` | `excludeLockedProblems(query)` query helper + lock CRUD helpers (single-source of truth for the lock table). Prisma-free? **No** — uses Prisma; kept out of `lib/admin-validation.ts` for that reason. |
| `lib/contest-status.ts` | Pure `deriveContestStatus(startsAt, endsAt, dbStatus, now)` function. No IO. Unit-tested. |
| `actions/contests.ts` | Public server actions: `listContests`, `getContestBySlug`, `registerForContest`. |
| `app/api/admin/contests/route.ts` | Admin `GET` list + `POST` create. |
| `app/api/admin/contests/[id]/route.ts` | Admin `GET` one + `PATCH` edit. |
| `app/api/admin/contests/[id]/problems/route.ts` | `POST` attach problem (creates lock). |
| `app/api/admin/contests/[id]/problems/[problemId]/route.ts` | `DELETE` detach (drops lock). |
| `app/api/admin/contests/[id]/registrations/route.ts` | `GET` registrations list. |
| `app/api/contests/sweep-locks/route.ts` | Cron endpoint that deletes orphaned locks past `unlocksAt`. |
| `app/contests/page.tsx` | Public contest index — upcoming, live, past. |
| `app/contests/[slug]/page.tsx` | Public contest detail — description, register CTA, problems-list-while-LIVE-or-CLOSED. |
| `app/admin/contests/page.tsx` | Admin contest list page. |
| `app/admin/contests/new/page.tsx` | Admin create form. |
| `app/admin/contests/[id]/page.tsx` | Admin edit form + problems picker. |
| `components/contests/RegisterButton.tsx` | Client component for register/unregister. |
| `components/contests/ContestStatusPill.tsx` | Server component — small status badge. |
| `scripts/test-contest-locks.ts` | Integration tests for the locks helper + audit. |
| `scripts/test-contest-status.ts` | Unit tests for `deriveContestStatus`. |
| `scripts/test-contests-actions.ts` | Integration tests for public server actions + registration. |
| `scripts/test-contest-admin-validation.ts` | Unit tests for new zod schemas in `lib/admin-validation.ts`. |
| `tests/e2e/contests-foundation.spec.ts` | Playwright happy-path: admin creates contest, attaches problem, learner sees it, registers. |

**Modified files**

| Path | Change |
| --- | --- |
| `prisma/schema.prisma` | Add enums + 4 new models + 2 fields on `SQLProblem`. Single migration. |
| `lib/admin-validation.ts` | Add `ContestCreateInput`, `ContestUpdateInput`, `ContestProblemAttachInput` zod schemas. Prisma-free per CLAUDE.md. |
| `actions/problems.ts` | Wrap practice list + search queries with `excludeLockedProblems`. |
| `actions/tracks.ts` | Same. |
| `actions/lists.ts` | Render locked problems as "Locked: in contest until <time>" instead of hiding. |
| `actions/profile.ts` | Gate "practice this" CTA on solved-list items. |
| `actions/submissions.ts` | Gate "rerun" CTA. |
| `app/profile/page.tsx` | (No change in Phase 1 — `PlaceholderCard("Contests")` stays; replaced in Phase 4.) |
| `components/layout/Navbar.tsx` | Add `/contests` link. |
| `app/admin/page.tsx` | Add "Contests" admin card. |
| `package.json` | Add `test:contests`, `test:contest-locks`, `test:contest-status`, `test:contest-admin-validation` npm scripts. |
| `docs/ROADMAP.md` | Mark Phase 1 of V2 Contest shipped. |
| `vercel.json` | Add cron entry for `/api/contests/sweep-locks` (optional — call out if Hobby plan blocks it). |

---

## Test Strategy

Three layers, mirroring the existing project convention:

1. **Unit** — pure-function modules (`lib/contest-status.ts`, zod schemas in `lib/admin-validation.ts`). Run with `node --import tsx --test scripts/test-*.ts`. No DB.
2. **Integration** — `scripts/test-contest-locks.ts` and `scripts/test-contests-actions.ts` run against the local dev DB using a `contest-test-` prefix for cleanup (same pattern as `scripts/test-tracks.ts`). Loaded via `import "dotenv/config"`.
3. **E2E** — `tests/e2e/contests-foundation.spec.ts` runs Playwright against `npm run dev`. Single happy-path.

Before-run reminder: integration tests assume local Postgres trust auth on `anchitgupta@localhost:5432/datalearn` per CLAUDE.md.

---

## Task 1: Add schema models, enums, and hidden-field columns

**Files:**
- Modify: `prisma/schema.prisma` (after the existing `Submission` block around line 304)

- [ ] **Step 1: Edit `prisma/schema.prisma` — append the new enums + models, and add two optional fields on `SQLProblem`.**

Find the `model SQLProblem { ... }` block and add these two fields next to the existing JSON fields:

```prisma
  hiddenSchemas         Json?
  hiddenExpectedOutputs Json?
```

Then append the following at the end of the file:

```prisma
enum ContestKind {
  WEEKLY
  BIWEEKLY
  SPECIAL
  USER_CUSTOM
}

enum ContestStatus {
  SCHEDULED
  LIVE
  CLOSED
  FINALIZED
  CANCELLED
}

model Contest {
  id              String         @id @default(cuid())
  slug            String         @unique
  title           String
  description     String         @db.Text
  kind            ContestKind
  status          ContestStatus  @default(SCHEDULED)
  startsAt        DateTime
  endsAt          DateTime
  durationMinutes Int
  rated           Boolean        @default(true)
  createdById     String
  createdBy       User           @relation(fields: [createdById], references: [id])
  visibility      String         @default("PUBLIC")
  inviteTokenHash String?
  maxParticipants Int?
  problems        ContestProblem[]
  registrations   ContestRegistration[]
  locks           ContestProblemLock[]
  createdAt       DateTime       @default(now())
  updatedAt       DateTime       @updatedAt

  @@index([status, startsAt])
  @@index([kind, startsAt])
}

model ContestProblem {
  contestId String
  problemId String
  position  Int
  points    Int
  contest   Contest    @relation(fields: [contestId], references: [id], onDelete: Cascade)
  problem   SQLProblem @relation(fields: [problemId], references: [id])

  @@id([contestId, problemId])
  @@unique([contestId, position])
}

model ContestRegistration {
  contestId    String
  userId       String
  registeredAt DateTime @default(now())
  ratedAtStart Boolean  @default(true)
  contest      Contest  @relation(fields: [contestId], references: [id], onDelete: Cascade)
  user         User     @relation(fields: [userId], references: [id])

  @@id([contestId, userId])
}

model ContestProblemLock {
  problemId String     @id
  contestId String
  lockedAt  DateTime   @default(now())
  unlocksAt DateTime
  problem   SQLProblem @relation(fields: [problemId], references: [id], onDelete: Cascade)
  contest   Contest    @relation(fields: [contestId], references: [id], onDelete: Cascade)

  @@index([unlocksAt])
}
```

Add the inverse relations on `User` and `SQLProblem`:

- On `User`: `contestsCreated Contest[]`, `contestRegistrations ContestRegistration[]`.
- On `SQLProblem`: `contestProblems ContestProblem[]`, `contestLock ContestProblemLock?`.

- [ ] **Step 2: Generate the migration.**

```bash
npx prisma migrate dev --name add_contests_phase_1
```

Expected: a new directory under `prisma/migrations/` containing the SQL for the new tables and columns. The dev server (if running) must be restarted afterward per CLAUDE.md.

- [ ] **Step 3: Confirm the migration applied cleanly.**

```bash
npx prisma migrate status
```

Expected output: `Database schema is up to date!`

- [ ] **Step 4: Commit.**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat(contests): add Phase 1 schema (Contest, lock, registration, hidden fields)"
```

---

## Task 2: Pure-function `lib/contest-status.ts` with unit tests

**Files:**
- Create: `lib/contest-status.ts`
- Create: `scripts/test-contest-status.ts`
- Modify: `package.json` (add `test:contest-status`)

- [ ] **Step 1: Write the failing test.**

`scripts/test-contest-status.ts`:

```typescript
// Pure-function tests for deriveContestStatus.
// Run: node --import tsx --test scripts/test-contest-status.ts

import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { deriveContestStatus } from "../lib/contest-status"

const startsAt = new Date("2026-06-01T10:00:00Z")
const endsAt   = new Date("2026-06-01T11:30:00Z")

describe("deriveContestStatus", () => {
  it("returns SCHEDULED before startsAt", () => {
    const now = new Date("2026-06-01T09:59:59Z")
    assert.equal(deriveContestStatus(startsAt, endsAt, "SCHEDULED", now), "SCHEDULED")
  })

  it("returns LIVE inside the window", () => {
    const now = new Date("2026-06-01T10:30:00Z")
    assert.equal(deriveContestStatus(startsAt, endsAt, "SCHEDULED", now), "LIVE")
  })

  it("returns CLOSED after endsAt when DB status is SCHEDULED or LIVE", () => {
    const now = new Date("2026-06-01T11:30:01Z")
    assert.equal(deriveContestStatus(startsAt, endsAt, "LIVE", now), "CLOSED")
    assert.equal(deriveContestStatus(startsAt, endsAt, "SCHEDULED", now), "CLOSED")
  })

  it("preserves terminal DB statuses", () => {
    const now = new Date("2026-06-01T10:30:00Z")
    assert.equal(deriveContestStatus(startsAt, endsAt, "FINALIZED", now), "FINALIZED")
    assert.equal(deriveContestStatus(startsAt, endsAt, "CANCELLED", now), "CANCELLED")
  })

  it("CLOSED stays CLOSED until finalize flips it", () => {
    const now = new Date("2026-06-02T00:00:00Z")
    assert.equal(deriveContestStatus(startsAt, endsAt, "CLOSED", now), "CLOSED")
  })
})
```

- [ ] **Step 2: Run the test to verify it fails.**

```bash
node --import tsx --test scripts/test-contest-status.ts
```

Expected: failure with "Cannot find module '../lib/contest-status'".

- [ ] **Step 3: Implement the helper.**

`lib/contest-status.ts`:

```typescript
import type { ContestStatus } from "@prisma/client"

/**
 * Derive the live status of a contest from its window + the DB status.
 *
 * Terminal DB statuses (FINALIZED, CANCELLED) always win — once finalized,
 * a contest stays finalized regardless of clock state.
 *
 * SCHEDULED + before startsAt → SCHEDULED.
 * SCHEDULED/LIVE + inside window → LIVE.
 * SCHEDULED/LIVE + past endsAt → CLOSED (awaiting finalize job).
 * CLOSED → CLOSED (idempotent).
 *
 * Pure function. No IO. `now` is injected for testability.
 */
export function deriveContestStatus(
  startsAt: Date,
  endsAt: Date,
  dbStatus: ContestStatus,
  now: Date = new Date(),
): ContestStatus {
  if (dbStatus === "FINALIZED" || dbStatus === "CANCELLED") return dbStatus
  if (dbStatus === "CLOSED") return "CLOSED"
  if (now < startsAt) return "SCHEDULED"
  if (now >= endsAt) return "CLOSED"
  return "LIVE"
}
```

- [ ] **Step 4: Add the npm script in `package.json`.**

In the `scripts` block, add:

```json
"test:contest-status": "node --import tsx --test scripts/test-contest-status.ts",
```

- [ ] **Step 5: Run the test to verify it passes.**

```bash
npm run test:contest-status
```

Expected: all 5 `it` cases pass.

- [ ] **Step 6: Commit.**

```bash
git add lib/contest-status.ts scripts/test-contest-status.ts package.json
git commit -m "feat(contests): deriveContestStatus pure helper + tests"
```

---

## Task 3: zod input schemas in `lib/admin-validation.ts`

**Files:**
- Modify: `lib/admin-validation.ts`
- Create: `scripts/test-contest-admin-validation.ts`
- Modify: `package.json`

- [ ] **Step 1: Write the failing tests.**

`scripts/test-contest-admin-validation.ts`:

```typescript
// Unit tests for contest zod schemas. No Prisma, no DB.
// Run: node --import tsx --test scripts/test-contest-admin-validation.ts

import { describe, it } from "node:test"
import assert from "node:assert/strict"
import {
  ContestCreateInput,
  ContestUpdateInput,
  ContestProblemAttachInput,
} from "../lib/admin-validation"

describe("ContestCreateInput", () => {
  const valid = {
    slug: "weekly-1",
    title: "Weekly Contest 1",
    description: "First contest",
    kind: "WEEKLY",
    startsAt: "2026-06-01T10:00:00.000Z",
    endsAt: "2026-06-01T11:30:00.000Z",
    rated: true,
  }

  it("accepts a well-formed input", () => {
    const parsed = ContestCreateInput.safeParse(valid)
    assert.equal(parsed.success, true)
  })

  it("rejects endsAt before startsAt", () => {
    const parsed = ContestCreateInput.safeParse({
      ...valid,
      endsAt: "2026-06-01T09:00:00.000Z",
    })
    assert.equal(parsed.success, false)
  })

  it("rejects a contest shorter than 5 minutes", () => {
    const parsed = ContestCreateInput.safeParse({
      ...valid,
      endsAt: "2026-06-01T10:04:00.000Z",
    })
    assert.equal(parsed.success, false)
  })

  it("rejects non-kebab slug", () => {
    const parsed = ContestCreateInput.safeParse({ ...valid, slug: "Weekly_1" })
    assert.equal(parsed.success, false)
  })

  it("rejects USER_CUSTOM in admin input", () => {
    const parsed = ContestCreateInput.safeParse({ ...valid, kind: "USER_CUSTOM" })
    assert.equal(parsed.success, false)
  })
})

describe("ContestUpdateInput", () => {
  it("allows partial update", () => {
    const parsed = ContestUpdateInput.safeParse({ title: "Renamed" })
    assert.equal(parsed.success, true)
  })

  it("rejects status field", () => {
    const parsed = ContestUpdateInput.safeParse({ status: "LIVE" })
    assert.equal(parsed.success, false)
  })
})

describe("ContestProblemAttachInput", () => {
  it("accepts a valid attach", () => {
    const parsed = ContestProblemAttachInput.safeParse({
      problemId: "ckxxxxxxxxxxxxxxxxxxxxxxx",
      position: 1,
      points: 3,
    })
    assert.equal(parsed.success, true)
  })

  it("rejects points <= 0", () => {
    const parsed = ContestProblemAttachInput.safeParse({
      problemId: "ckxxxxxxxxxxxxxxxxxxxxxxx",
      position: 1,
      points: 0,
    })
    assert.equal(parsed.success, false)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails.**

```bash
node --import tsx --test scripts/test-contest-admin-validation.ts
```

Expected: failure with "ContestCreateInput is not exported".

- [ ] **Step 3: Add the schemas to `lib/admin-validation.ts`.**

Append at the bottom of `lib/admin-validation.ts` (no Prisma imports — keep this file Prisma-free per CLAUDE.md):

```typescript
import { z } from "zod"

const ContestKindAdminEnum = z.enum(["WEEKLY", "BIWEEKLY", "SPECIAL"])
// USER_CUSTOM is intentionally absent — those are created via a separate
// (future) user-facing endpoint, never through the admin surface.

const SlugSchema = z
  .string()
  .min(1)
  .max(80)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "slug must be kebab-case")

const IsoDateSchema = z
  .string()
  .datetime({ offset: false })
  .transform((s) => new Date(s))

const MIN_CONTEST_MINUTES = 5
const MAX_CONTEST_MINUTES = 24 * 60 * 7 // one week ceiling — sanity bound

export const ContestCreateInput = z
  .object({
    slug: SlugSchema,
    title: z.string().min(1).max(200),
    description: z.string().min(1).max(20_000),
    kind: ContestKindAdminEnum,
    startsAt: IsoDateSchema,
    endsAt: IsoDateSchema,
    rated: z.boolean().default(true),
    maxParticipants: z.number().int().positive().nullable().optional(),
  })
  .refine((v) => v.endsAt > v.startsAt, {
    message: "endsAt must be after startsAt",
    path: ["endsAt"],
  })
  .refine(
    (v) => {
      const mins = Math.round((v.endsAt.getTime() - v.startsAt.getTime()) / 60_000)
      return mins >= MIN_CONTEST_MINUTES && mins <= MAX_CONTEST_MINUTES
    },
    { message: `contest must be between ${MIN_CONTEST_MINUTES} minutes and 1 week`, path: ["endsAt"] },
  )

export const ContestUpdateInput = z
  .object({
    title: z.string().min(1).max(200).optional(),
    description: z.string().min(1).max(20_000).optional(),
    startsAt: IsoDateSchema.optional(),
    endsAt: IsoDateSchema.optional(),
    rated: z.boolean().optional(),
    maxParticipants: z.number().int().positive().nullable().optional(),
  })
  .strict() // rejects unknown fields like `status`, `slug`, `kind`
  .refine(
    (v) => !v.startsAt || !v.endsAt || v.endsAt > v.startsAt,
    { message: "endsAt must be after startsAt", path: ["endsAt"] },
  )

export const ContestProblemAttachInput = z.object({
  problemId: z.string().min(20).max(40),
  position: z.number().int().min(1).max(20),
  points: z.number().int().min(1).max(20),
})
```

- [ ] **Step 4: Wire the npm script.**

In `package.json` `scripts`:

```json
"test:contest-admin-validation": "node --import tsx --test scripts/test-contest-admin-validation.ts",
```

- [ ] **Step 5: Run the tests.**

```bash
npm run test:contest-admin-validation
```

Expected: all 8 cases pass.

- [ ] **Step 6: Commit.**

```bash
git add lib/admin-validation.ts scripts/test-contest-admin-validation.ts package.json
git commit -m "feat(contests): admin zod schemas for contest CRUD + attach"
```

---

## Task 4: `lib/contest-locks.ts` helper module with integration tests

**Files:**
- Create: `lib/contest-locks.ts`
- Create: `scripts/test-contest-locks.ts`
- Modify: `package.json`

- [ ] **Step 1: Write the failing integration test.**

`scripts/test-contest-locks.ts`:

```typescript
// Integration tests for the lock helper. Runs against the local dev DB.
// Run: DATABASE_URL='postgresql://anchitgupta@localhost:5432/datalearn' \
//      node --import tsx --test scripts/test-contest-locks.ts

import "dotenv/config"
import { after, before, describe, it } from "node:test"
import assert from "node:assert/strict"
import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import pg from "pg"
import {
  lockProblemsForContest,
  unlockProblemsForContest,
  excludeLockedProblems,
  isProblemLocked,
} from "../lib/contest-locks"

const PREFIX = "contest-locks-test-"
let pool: pg.Pool
let prisma: PrismaClient
let userId: string
let schemaId: string
let problemId: string
let contestId: string

before(async () => {
  pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })
  prisma = new PrismaClient({ adapter: new PrismaPg(pool) })
  const user = await prisma.user.create({
    data: { email: `${PREFIX}admin@example.com`, role: "ADMIN" },
  })
  userId = user.id
  const schema = await prisma.sqlSchema.create({
    data: { name: `${PREFIX}schema`, sql: "CREATE TABLE t (x INT);" },
  })
  schemaId = schema.id
  const problem = await prisma.sQLProblem.create({
    data: {
      slug: `${PREFIX}p1`,
      title: `${PREFIX}P1`,
      description: "x",
      difficulty: "EASY",
      schemaId,
      status: "PUBLISHED",
      dialects: ["DUCKDB"],
      expectedOutputs: { DUCKDB: [] },
      solutions: { DUCKDB: "SELECT 1;" },
    },
  })
  problemId = problem.id
  const contest = await prisma.contest.create({
    data: {
      slug: `${PREFIX}c1`,
      title: `${PREFIX}C1`,
      description: "x",
      kind: "WEEKLY",
      status: "SCHEDULED",
      startsAt: new Date(Date.now() + 60_000),
      endsAt: new Date(Date.now() + 120_000),
      durationMinutes: 1,
      createdById: userId,
    },
  })
  contestId = contest.id
})

after(async () => {
  await prisma.contestProblemLock.deleteMany({ where: { contestId } })
  await prisma.contestProblem.deleteMany({ where: { contestId } })
  await prisma.contest.deleteMany({ where: { id: contestId } })
  await prisma.sQLProblem.deleteMany({ where: { id: problemId } })
  await prisma.sqlSchema.deleteMany({ where: { id: schemaId } })
  await prisma.user.deleteMany({ where: { id: userId } })
  await prisma.$disconnect()
  await pool.end()
})

describe("lockProblemsForContest", () => {
  it("creates a lock row scoped to (problem, contest)", async () => {
    await lockProblemsForContest(prisma, contestId, [problemId])
    assert.equal(await isProblemLocked(prisma, problemId), true)
  })

  it("is idempotent — second call with same problem is a no-op", async () => {
    await lockProblemsForContest(prisma, contestId, [problemId])
    const count = await prisma.contestProblemLock.count({ where: { problemId } })
    assert.equal(count, 1)
  })

  it("rejects locking a problem already locked by a different contest", async () => {
    const other = await prisma.contest.create({
      data: {
        slug: `${PREFIX}c2`,
        title: `${PREFIX}C2`,
        description: "x",
        kind: "WEEKLY",
        status: "SCHEDULED",
        startsAt: new Date(Date.now() + 60_000),
        endsAt: new Date(Date.now() + 120_000),
        durationMinutes: 1,
        createdById: userId,
      },
    })
    await assert.rejects(
      () => lockProblemsForContest(prisma, other.id, [problemId]),
      /already locked/,
    )
    await prisma.contest.delete({ where: { id: other.id } })
  })
})

describe("excludeLockedProblems", () => {
  it("filters locked problems out of a findMany query", async () => {
    const rows = await prisma.sQLProblem.findMany({
      where: excludeLockedProblems({ status: "PUBLISHED" }),
      select: { id: true },
    })
    assert.equal(rows.some((r) => r.id === problemId), false)
  })
})

describe("unlockProblemsForContest", () => {
  it("removes the lock and the problem becomes visible again", async () => {
    await unlockProblemsForContest(prisma, contestId)
    assert.equal(await isProblemLocked(prisma, problemId), false)
    const rows = await prisma.sQLProblem.findMany({
      where: excludeLockedProblems({ status: "PUBLISHED" }),
      select: { id: true },
    })
    assert.equal(rows.some((r) => r.id === problemId), true)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails.**

```bash
DATABASE_URL='postgresql://anchitgupta@localhost:5432/datalearn' \
  node --import tsx --test scripts/test-contest-locks.ts
```

Expected: failure with "Cannot find module '../lib/contest-locks'".

- [ ] **Step 3: Implement the helper.**

`lib/contest-locks.ts`:

```typescript
import type { Prisma, PrismaClient } from "@prisma/client"

type Db = PrismaClient | Prisma.TransactionClient

/**
 * Add a NOT IN (locked) constraint to a SQLProblem `where` clause.
 * Single source of truth for "is this problem currently reserved by a contest?".
 *
 * Usage:
 *   prisma.sQLProblem.findMany({ where: excludeLockedProblems({ status: "PUBLISHED" }) })
 */
export function excludeLockedProblems(
  where: Prisma.SQLProblemWhereInput = {},
): Prisma.SQLProblemWhereInput {
  return {
    ...where,
    contestLock: null,
  }
}

export async function isProblemLocked(db: Db, problemId: string): Promise<boolean> {
  const row = await db.contestProblemLock.findUnique({
    where: { problemId },
    select: { problemId: true },
  })
  return row !== null
}

/**
 * Atomically lock problems for a contest. Reads the contest's endsAt to set
 * unlocksAt. Errors with "already locked" if any problem is locked by a
 * different contest.
 */
export async function lockProblemsForContest(
  db: Db,
  contestId: string,
  problemIds: string[],
): Promise<void> {
  if (problemIds.length === 0) return
  const contest = await db.contest.findUniqueOrThrow({
    where: { id: contestId },
    select: { endsAt: true },
  })

  for (const problemId of problemIds) {
    const existing = await db.contestProblemLock.findUnique({
      where: { problemId },
      select: { contestId: true },
    })
    if (existing && existing.contestId !== contestId) {
      throw new Error(`Problem ${problemId} is already locked by contest ${existing.contestId}`)
    }
    if (existing) continue // same contest, idempotent
    await db.contestProblemLock.create({
      data: { problemId, contestId, unlocksAt: contest.endsAt },
    })
  }
}

/** Drop all locks held by a contest. Called on FINALIZE / CANCEL / detach. */
export async function unlockProblemsForContest(db: Db, contestId: string): Promise<void> {
  await db.contestProblemLock.deleteMany({ where: { contestId } })
}

/** Drop one specific lock — used when an admin detaches a single problem. */
export async function unlockProblem(db: Db, contestId: string, problemId: string): Promise<void> {
  await db.contestProblemLock.deleteMany({ where: { contestId, problemId } })
}

/** Sweep stale locks past their unlocksAt — defensive cleanup. */
export async function sweepExpiredLocks(db: Db, now: Date = new Date()): Promise<number> {
  const result = await db.contestProblemLock.deleteMany({
    where: { unlocksAt: { lt: now } },
  })
  return result.count
}
```

- [ ] **Step 4: Add the npm script.**

```json
"test:contest-locks": "node --import tsx --test scripts/test-contest-locks.ts",
```

- [ ] **Step 5: Run the test to verify it passes.**

```bash
npm run test:contest-locks
```

Expected: all 5 cases pass.

- [ ] **Step 6: Commit.**

```bash
git add lib/contest-locks.ts scripts/test-contest-locks.ts package.json
git commit -m "feat(contests): contest-locks helper with idempotent locking + sweep"
```

---

## Task 5: Wire `excludeLockedProblems` into `actions/problems.ts`

**Files:**
- Modify: `actions/problems.ts`

- [ ] **Step 1: Open `actions/problems.ts` and locate every `prisma.sQLProblem.findMany` and `prisma.sQLProblem.findUnique` call that returns problems to the public practice list, search, or related-problems surfaces.**

Read the file end to end first; this is the audit.

- [ ] **Step 2: For each call returning publicly-listed problems, wrap the `where` clause with `excludeLockedProblems(...)`.**

Example transformation:

```typescript
// before
const rows = await prisma.sQLProblem.findMany({
  where: { status: "PUBLISHED" },
  orderBy: { number: "asc" },
})

// after
import { excludeLockedProblems } from "@/lib/contest-locks"

const rows = await prisma.sQLProblem.findMany({
  where: excludeLockedProblems({ status: "PUBLISHED" }),
  orderBy: { number: "asc" },
})
```

Do **not** wrap the per-slug `findUnique` for `/practice/[slug]` page — if a learner has the URL of a locked problem, the page should render a "Locked: in contest until <time>" state, not a 404 (otherwise we leak the lock signal through HTTP status codes). The page itself adds that check in Task 6.

- [ ] **Step 3: Verify by running the existing problems-related tests.**

```bash
npm run test:contests 2>/dev/null || true   # not yet defined
npm run test:tracks
```

Expected: tracks tests still pass (they don't touch locks but exercise problem listing).

- [ ] **Step 4: Commit.**

```bash
git add actions/problems.ts
git commit -m "feat(contests): exclude locked problems from public practice list + search"
```

---

## Task 6: Surface lock state on `/practice/[slug]` and related surfaces

**Files:**
- Modify: `actions/problems.ts` (add `isProblemLocked` exposure in the slug fetcher)
- Modify: `app/practice/[slug]/page.tsx` (render lock notice)
- Modify: `components/practice/ProblemClient.tsx` (disable submit button when locked)

- [ ] **Step 1: Update the slug fetcher to include lock state.**

In `actions/problems.ts`, find the function that returns the problem for `/practice/[slug]/page.tsx` (e.g., `getProblemBySlug`). Extend its `include`:

```typescript
include: {
  // ...existing
  contestLock: { select: { contestId: true, unlocksAt: true } },
},
```

- [ ] **Step 2: Render the lock notice in the page.**

In `app/practice/[slug]/page.tsx`, after fetching the problem, branch on `problem.contestLock`:

```tsx
if (problem.contestLock) {
  return (
    <Container className="py-10">
      <EmptyState
        title="This problem is part of a live contest"
        description={`It will be available for free practice after ${problem.contestLock.unlocksAt.toLocaleString()}.`}
      />
    </Container>
  )
}
```

`EmptyState` is already an existing primitive in `components/ui/`.

- [ ] **Step 3: Manual smoke test.**

```bash
npm run dev
```

Then in a second terminal:

```bash
psql postgresql://anchitgupta@localhost:5432/datalearn -c "
INSERT INTO \"ContestProblemLock\" (\"problemId\", \"contestId\", \"unlocksAt\")
SELECT id, (SELECT id FROM \"Contest\" LIMIT 1), now() + interval '1 hour'
FROM \"SQLProblem\" WHERE status='PUBLISHED' LIMIT 1
ON CONFLICT DO NOTHING;
"
```

(You may need to first create a contest via Task 8's endpoint, or insert a dummy contest by hand for this smoke test. If the dummy approach is too fiddly, defer the smoke step to after Task 8 is done.)

Then visit `/practice/<that-slug>` and confirm the lock notice renders. Clean up:

```bash
psql postgresql://anchitgupta@localhost:5432/datalearn -c "DELETE FROM \"ContestProblemLock\";"
```

- [ ] **Step 4: Commit.**

```bash
git add actions/problems.ts app/practice/[slug]/page.tsx
git commit -m "feat(contests): render lock notice on locked problem pages"
```

---

## Task 7: Audit remaining surfaces (tracks, lists, profile, submissions)

**Files:**
- Modify: `actions/tracks.ts`
- Modify: `actions/lists.ts`
- Modify: `actions/profile.ts`
- Modify: `actions/submissions.ts`

- [ ] **Step 1: `actions/tracks.ts` — wrap the public track-problem listing with `excludeLockedProblems`.**

Find the function returning problems inside a track (`getTrackBySlug` or similar). Wrap its `where` clause for the nested problem fetch. Use the same pattern as Task 5.

- [ ] **Step 2: `actions/lists.ts` — keep locked problems in the user's list but mark them.**

User-curated lists should NOT silently shrink when an item gets locked — that confuses the user and looks like data loss. Instead, the list fetcher returns each item with a `locked: { unlocksAt }` field when locked, and the UI renders a disabled row with "Locked: in contest until <time>". Implementation:

```typescript
const items = await prisma.problemListItem.findMany({
  where: { listId },
  include: {
    problem: {
      select: {
        // existing fields...
        contestLock: { select: { unlocksAt: true } },
      },
    },
  },
})
```

Pass `contestLock` through to the list rendering component (`components/lists/ListDetail.tsx`) and disable the "Practice" CTA when set.

- [ ] **Step 3: `actions/profile.ts` — gate the "Practice this" CTA on locked solved-list items.**

In the function returning the user's recent submissions / solved list, include `contestLock` on the nested problem and pass it through. Do NOT remove the row (history of past submissions is historical truth and stays).

- [ ] **Step 4: `actions/submissions.ts` — same gating on the "Rerun" CTA.**

Include `contestLock` in the projection; the UI hides Rerun when set.

- [ ] **Step 5: Manual verification — `git grep` to confirm no other public surfaces query `SQLProblem` without lock awareness.**

```bash
git grep -n "sQLProblem.findMany\|sQLProblem.findUnique" actions/ app/
```

Walk through each hit. Acceptable: admin paths (`app/admin/**`, `app/api/admin/**`) — those intentionally show locked problems. Anything else needs `excludeLockedProblems` or a `contestLock` projection + UI gating.

- [ ] **Step 6: Commit.**

```bash
git add actions/tracks.ts actions/lists.ts actions/profile.ts actions/submissions.ts components/lists/ListDetail.tsx
git commit -m "feat(contests): audit public surfaces for contest-locked problems"
```

---

## Task 8: Admin REST — `POST /api/admin/contests` (create)

**Files:**
- Create: `app/api/admin/contests/route.ts`

- [ ] **Step 1: Write the route.**

```typescript
import { NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { withAdmin } from "@/lib/api-auth"
import { ContestCreateInput } from "@/lib/admin-validation"

export const GET = withAdmin(async () => {
  const contests = await prisma.contest.findMany({
    orderBy: { startsAt: "desc" },
    select: {
      id: true,
      slug: true,
      title: true,
      kind: true,
      status: true,
      startsAt: true,
      endsAt: true,
      rated: true,
      _count: { select: { problems: true, registrations: true } },
    },
  })
  return NextResponse.json({ data: contests })
})

export const POST = withAdmin(async (req, ctx) => {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 })
  }

  const parsed = ContestCreateInput.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: z.treeifyError(parsed.error) },
      { status: 400 },
    )
  }
  const input = parsed.data

  const durationMinutes = Math.round(
    (input.endsAt.getTime() - input.startsAt.getTime()) / 60_000,
  )

  try {
    const created = await prisma.contest.create({
      data: {
        slug: input.slug,
        title: input.title,
        description: input.description,
        kind: input.kind,
        // status defaults to SCHEDULED — never accepts client-provided status
        startsAt: input.startsAt,
        endsAt: input.endsAt,
        durationMinutes,
        rated: input.rated,
        maxParticipants: input.maxParticipants ?? null,
        createdById: ctx.session.user.id,
      },
      select: { id: true, slug: true },
    })
    return NextResponse.json({ data: created }, { status: 201 })
  } catch (e: unknown) {
    const err = e as { code?: string }
    if (err.code === "P2002") {
      return NextResponse.json({ error: "Slug already exists" }, { status: 409 })
    }
    throw e
  }
})
```

(`withAdmin` in `lib/api-auth.ts` already exposes `ctx.session.user.id` based on the existing problems endpoint pattern. Confirm by reading `lib/api-auth.ts` before writing this code; adjust the signature if `ctx` shape differs.)

- [ ] **Step 2: Smoke test with curl.**

```bash
npm run dev &
sleep 5
curl -X POST http://localhost:3000/api/admin/contests \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $ADMIN_API_KEY" \
  -d '{
    "slug": "test-weekly-1",
    "title": "Test Weekly 1",
    "description": "Smoke test",
    "kind": "WEEKLY",
    "startsAt": "2026-06-01T10:00:00.000Z",
    "endsAt": "2026-06-01T11:30:00.000Z"
  }'
```

Expected: `201` with `{ "data": { "id": "...", "slug": "test-weekly-1" } }`. Clean up after:

```bash
psql postgresql://anchitgupta@localhost:5432/datalearn -c \
  "DELETE FROM \"Contest\" WHERE slug='test-weekly-1';"
```

- [ ] **Step 3: Commit.**

```bash
git add app/api/admin/contests/route.ts
git commit -m "feat(contests): admin REST GET/POST /api/admin/contests"
```

---

## Task 9: Admin REST — `GET` + `PATCH` `/api/admin/contests/[id]`

**Files:**
- Create: `app/api/admin/contests/[id]/route.ts`

- [ ] **Step 1: Write the route.**

```typescript
import { NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { withAdmin } from "@/lib/api-auth"
import { ContestUpdateInput } from "@/lib/admin-validation"

export const GET = withAdmin(async (_req, ctx) => {
  const id = ctx.params?.id as string | undefined
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 })
  const contest = await prisma.contest.findUnique({
    where: { id },
    include: {
      problems: {
        orderBy: { position: "asc" },
        include: { problem: { select: { id: true, slug: true, title: true, number: true, difficulty: true } } },
      },
      _count: { select: { registrations: true } },
    },
  })
  if (!contest) return NextResponse.json({ error: "Not found" }, { status: 404 })
  return NextResponse.json({ data: contest })
})

export const PATCH = withAdmin(async (req, ctx) => {
  const id = ctx.params?.id as string | undefined
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 })

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 })
  }

  const parsed = ContestUpdateInput.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: z.treeifyError(parsed.error) },
      { status: 400 },
    )
  }
  const input = parsed.data

  const current = await prisma.contest.findUnique({
    where: { id },
    select: { status: true, startsAt: true, endsAt: true },
  })
  if (!current) return NextResponse.json({ error: "Not found" }, { status: 404 })
  if (current.status === "LIVE" || current.status === "FINALIZED" || current.status === "CLOSED") {
    return NextResponse.json(
      { error: `Cannot edit contest in status ${current.status}` },
      { status: 409 },
    )
  }

  const nextStartsAt = input.startsAt ?? current.startsAt
  const nextEndsAt = input.endsAt ?? current.endsAt
  const durationMinutes = Math.round((nextEndsAt.getTime() - nextStartsAt.getTime()) / 60_000)

  const updated = await prisma.contest.update({
    where: { id },
    data: {
      ...input,
      durationMinutes,
    },
    select: { id: true, slug: true, updatedAt: true },
  })

  // If endsAt changed, propagate it to any existing locks so the sweep is honest.
  if (input.endsAt) {
    await prisma.contestProblemLock.updateMany({
      where: { contestId: id },
      data: { unlocksAt: input.endsAt },
    })
  }

  return NextResponse.json({ data: updated })
})
```

- [ ] **Step 2: Manual smoke test (with the contest from Task 8).**

```bash
curl http://localhost:3000/api/admin/contests/$ID -H "Authorization: Bearer $ADMIN_API_KEY"
curl -X PATCH http://localhost:3000/api/admin/contests/$ID \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $ADMIN_API_KEY" \
  -d '{"title":"Renamed"}'
```

Expected: GET returns the contest; PATCH returns 200; second GET reflects the new title.

- [ ] **Step 3: Commit.**

```bash
git add app/api/admin/contests/[id]/route.ts
git commit -m "feat(contests): admin REST GET/PATCH /api/admin/contests/[id]"
```

---

## Task 10: Admin REST — attach/detach problems with lock side effects

**Files:**
- Create: `app/api/admin/contests/[id]/problems/route.ts`
- Create: `app/api/admin/contests/[id]/problems/[problemId]/route.ts`

- [ ] **Step 1: Write the attach route.**

`app/api/admin/contests/[id]/problems/route.ts`:

```typescript
import { NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { withAdmin } from "@/lib/api-auth"
import { ContestProblemAttachInput } from "@/lib/admin-validation"
import { lockProblemsForContest } from "@/lib/contest-locks"

export const POST = withAdmin(async (req, ctx) => {
  const contestId = ctx.params?.id as string | undefined
  if (!contestId) return NextResponse.json({ error: "Missing id" }, { status: 400 })

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 })
  }

  const parsed = ContestProblemAttachInput.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: z.treeifyError(parsed.error) },
      { status: 400 },
    )
  }
  const input = parsed.data

  const contest = await prisma.contest.findUnique({
    where: { id: contestId },
    select: { status: true, rated: true, kind: true },
  })
  if (!contest) return NextResponse.json({ error: "Contest not found" }, { status: 404 })
  if (contest.status !== "SCHEDULED") {
    return NextResponse.json(
      { error: `Cannot modify problems on ${contest.status} contest` },
      { status: 409 },
    )
  }

  const problem = await prisma.sQLProblem.findUnique({
    where: { id: input.problemId },
    select: { id: true, status: true, dialects: true, hiddenSchemas: true, hiddenExpectedOutputs: true },
  })
  if (!problem) return NextResponse.json({ error: "Problem not found" }, { status: 404 })
  if (problem.status !== "PUBLISHED") {
    return NextResponse.json({ error: "Problem is not PUBLISHED" }, { status: 409 })
  }
  if (contest.rated) {
    // Rated contests require hidden data for every supported dialect.
    const hiddenS = problem.hiddenSchemas as Record<string, unknown> | null
    const hiddenE = problem.hiddenExpectedOutputs as Record<string, unknown> | null
    const missing = problem.dialects.filter(
      (d) => !hiddenS?.[d as string] || !hiddenE?.[d as string],
    )
    if (missing.length > 0) {
      return NextResponse.json(
        { error: `Problem is missing hidden test data for dialects: ${missing.join(", ")}` },
        { status: 422 },
      )
    }
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.contestProblem.create({
        data: {
          contestId,
          problemId: input.problemId,
          position: input.position,
          points: input.points,
        },
      })
      // Official kinds (not USER_CUSTOM) lock the problem.
      if (contest.kind !== "USER_CUSTOM") {
        await lockProblemsForContest(tx, contestId, [input.problemId])
      }
    })
  } catch (e: unknown) {
    const err = e as { code?: string; message?: string }
    if (err.code === "P2002") {
      return NextResponse.json(
        { error: "Problem already attached or position taken" },
        { status: 409 },
      )
    }
    if (err.message?.includes("already locked")) {
      return NextResponse.json(
        { error: err.message },
        { status: 409 },
      )
    }
    throw e
  }

  return NextResponse.json({ data: { contestId, problemId: input.problemId } }, { status: 201 })
})
```

- [ ] **Step 2: Write the detach route.**

`app/api/admin/contests/[id]/problems/[problemId]/route.ts`:

```typescript
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { withAdmin } from "@/lib/api-auth"
import { unlockProblem } from "@/lib/contest-locks"

export const DELETE = withAdmin(async (_req, ctx) => {
  const contestId = ctx.params?.id as string | undefined
  const problemId = ctx.params?.problemId as string | undefined
  if (!contestId || !problemId) {
    return NextResponse.json({ error: "Missing id/problemId" }, { status: 400 })
  }

  const contest = await prisma.contest.findUnique({
    where: { id: contestId },
    select: { status: true },
  })
  if (!contest) return NextResponse.json({ error: "Contest not found" }, { status: 404 })
  if (contest.status !== "SCHEDULED") {
    return NextResponse.json(
      { error: `Cannot modify problems on ${contest.status} contest` },
      { status: 409 },
    )
  }

  await prisma.$transaction(async (tx) => {
    await tx.contestProblem.deleteMany({ where: { contestId, problemId } })
    await unlockProblem(tx, contestId, problemId)
  })

  return NextResponse.json({ data: { contestId, problemId } })
})
```

- [ ] **Step 3: Smoke test the attach → list-locked → detach flow with curl, then `psql`-check that no orphan locks remain.**

- [ ] **Step 4: Commit.**

```bash
git add app/api/admin/contests/[id]/problems/
git commit -m "feat(contests): attach/detach problem endpoints with lock side effects"
```

---

## Task 11: Admin REST — `GET /api/admin/contests/[id]/registrations`

**Files:**
- Create: `app/api/admin/contests/[id]/registrations/route.ts`

- [ ] **Step 1: Write the route.**

```typescript
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { withAdmin } from "@/lib/api-auth"

export const GET = withAdmin(async (_req, ctx) => {
  const contestId = ctx.params?.id as string | undefined
  if (!contestId) return NextResponse.json({ error: "Missing id" }, { status: 400 })
  const rows = await prisma.contestRegistration.findMany({
    where: { contestId },
    orderBy: { registeredAt: "asc" },
    include: { user: { select: { id: true, email: true, name: true } } },
  })
  return NextResponse.json({ data: rows, count: rows.length })
})
```

- [ ] **Step 2: Smoke test (will return empty until users register).**

```bash
curl http://localhost:3000/api/admin/contests/$ID/registrations \
  -H "Authorization: Bearer $ADMIN_API_KEY"
```

Expected: `{ "data": [], "count": 0 }`.

- [ ] **Step 3: Commit.**

```bash
git add app/api/admin/contests/[id]/registrations/route.ts
git commit -m "feat(contests): admin registrations list endpoint"
```

---

## Task 12: Public server actions in `actions/contests.ts` + tests

**Files:**
- Create: `actions/contests.ts`
- Create: `scripts/test-contests-actions.ts`
- Modify: `package.json`

- [ ] **Step 1: Write the failing integration test.**

`scripts/test-contests-actions.ts`:

```typescript
// Integration tests for public contest server actions.
// Run: DATABASE_URL='postgresql://anchitgupta@localhost:5432/datalearn' \
//      node --import tsx --test scripts/test-contests-actions.ts

import "dotenv/config"
import { after, before, describe, it } from "node:test"
import assert from "node:assert/strict"
import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import pg from "pg"
import {
  listContests,
  getContestBySlug,
  registerForContest,
} from "../actions/contests"

const PREFIX = "contest-actions-test-"
let pool: pg.Pool
let prisma: PrismaClient
let adminId: string
let learnerId: string
let scheduledId: string
let pastId: string

before(async () => {
  pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })
  prisma = new PrismaClient({ adapter: new PrismaPg(pool) })
  const admin = await prisma.user.create({ data: { email: `${PREFIX}a@x.com`, role: "ADMIN" } })
  adminId = admin.id
  const learner = await prisma.user.create({ data: { email: `${PREFIX}l@x.com`, role: "USER", emailVerified: new Date() } })
  learnerId = learner.id
  const future = new Date(Date.now() + 24 * 3600_000)
  const futureEnd = new Date(Date.now() + 25 * 3600_000)
  const scheduled = await prisma.contest.create({
    data: {
      slug: `${PREFIX}sched`,
      title: "Scheduled",
      description: "x",
      kind: "WEEKLY",
      status: "SCHEDULED",
      startsAt: future,
      endsAt: futureEnd,
      durationMinutes: 60,
      createdById: adminId,
    },
  })
  scheduledId = scheduled.id
  const past = await prisma.contest.create({
    data: {
      slug: `${PREFIX}past`,
      title: "Past",
      description: "x",
      kind: "WEEKLY",
      status: "FINALIZED",
      startsAt: new Date(Date.now() - 48 * 3600_000),
      endsAt: new Date(Date.now() - 47 * 3600_000),
      durationMinutes: 60,
      createdById: adminId,
    },
  })
  pastId = past.id
})

after(async () => {
  await prisma.contestRegistration.deleteMany({ where: { contestId: { in: [scheduledId, pastId] } } })
  await prisma.contest.deleteMany({ where: { id: { in: [scheduledId, pastId] } } })
  await prisma.user.deleteMany({ where: { id: { in: [adminId, learnerId] } } })
  await prisma.$disconnect()
  await pool.end()
})

describe("listContests", () => {
  it("returns scheduled and past contests in separate buckets", async () => {
    const out = await listContests()
    assert.equal(out.upcoming.some((c) => c.id === scheduledId), true)
    assert.equal(out.past.some((c) => c.id === pastId), true)
  })
})

describe("getContestBySlug", () => {
  it("returns a SCHEDULED contest without its problem list", async () => {
    const c = await getContestBySlug(`${PREFIX}sched`)
    assert.ok(c)
    assert.equal(c.problems.length, 0) // empty because none attached; once attached, would still be HIDDEN
  })

  it("returns null for unknown slug", async () => {
    const c = await getContestBySlug(`${PREFIX}nope`)
    assert.equal(c, null)
  })
})

describe("registerForContest", () => {
  it("creates a registration row", async () => {
    const out = await registerForContest({ contestId: scheduledId, userId: learnerId })
    assert.equal(out.status, "registered")
    const row = await prisma.contestRegistration.findUnique({
      where: { contestId_userId: { contestId: scheduledId, userId: learnerId } },
    })
    assert.ok(row)
  })

  it("is idempotent", async () => {
    const out = await registerForContest({ contestId: scheduledId, userId: learnerId })
    assert.equal(out.status, "already_registered")
  })

  it("rejects registration for a FINALIZED contest", async () => {
    await assert.rejects(
      () => registerForContest({ contestId: pastId, userId: learnerId }),
      /closed/i,
    )
  })
})
```

- [ ] **Step 2: Run the test to verify it fails.**

```bash
DATABASE_URL='postgresql://anchitgupta@localhost:5432/datalearn' \
  node --import tsx --test scripts/test-contests-actions.ts
```

Expected: "Cannot find module '../actions/contests'".

- [ ] **Step 3: Implement `actions/contests.ts`.**

```typescript
"use server"

import { prisma } from "@/lib/prisma"
import { deriveContestStatus } from "@/lib/contest-status"

type ContestListRow = {
  id: string
  slug: string
  title: string
  kind: string
  startsAt: Date
  endsAt: Date
  status: string
  registeredCount: number
}

export async function listContests(): Promise<{
  live: ContestListRow[]
  upcoming: ContestListRow[]
  past: ContestListRow[]
}> {
  const rows = await prisma.contest.findMany({
    where: { visibility: "PUBLIC" },
    orderBy: { startsAt: "desc" },
    select: {
      id: true,
      slug: true,
      title: true,
      kind: true,
      status: true,
      startsAt: true,
      endsAt: true,
      _count: { select: { registrations: true } },
    },
  })

  const now = new Date()
  const live: ContestListRow[] = []
  const upcoming: ContestListRow[] = []
  const past: ContestListRow[] = []
  for (const r of rows) {
    const status = deriveContestStatus(r.startsAt, r.endsAt, r.status, now)
    const out: ContestListRow = {
      id: r.id,
      slug: r.slug,
      title: r.title,
      kind: r.kind,
      startsAt: r.startsAt,
      endsAt: r.endsAt,
      status,
      registeredCount: r._count.registrations,
    }
    if (status === "LIVE") live.push(out)
    else if (status === "SCHEDULED") upcoming.push(out)
    else past.push(out)
  }
  upcoming.sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime())
  return { live, upcoming, past }
}

export async function getContestBySlug(slug: string) {
  const c = await prisma.contest.findUnique({
    where: { slug },
    include: {
      problems: {
        orderBy: { position: "asc" },
        select: {
          position: true,
          points: true,
          problem: { select: { id: true, slug: true, title: true, number: true, difficulty: true } },
        },
      },
      _count: { select: { registrations: true } },
    },
  })
  if (!c) return null
  const status = deriveContestStatus(c.startsAt, c.endsAt, c.status)
  // Hide problem list until contest is LIVE or finalized; only the count leaks.
  const problemsVisible = status === "LIVE" || status === "CLOSED" || status === "FINALIZED"
  return {
    ...c,
    status,
    problems: problemsVisible ? c.problems : [],
    problemCount: c.problems.length,
  }
}

type RegisterArgs = { contestId: string; userId: string }
type RegisterOk = { status: "registered" | "already_registered" }

export async function registerForContest(args: RegisterArgs): Promise<RegisterOk> {
  const contest = await prisma.contest.findUnique({
    where: { id: args.contestId },
    select: { status: true, startsAt: true, endsAt: true, maxParticipants: true, _count: { select: { registrations: true } } },
  })
  if (!contest) throw new Error("Contest not found")
  const live = deriveContestStatus(contest.startsAt, contest.endsAt, contest.status)
  if (live === "CLOSED" || live === "FINALIZED" || live === "CANCELLED") {
    throw new Error("Contest is closed")
  }
  if (contest.maxParticipants && contest._count.registrations >= contest.maxParticipants) {
    throw new Error("Contest is full")
  }
  try {
    await prisma.contestRegistration.create({
      data: { contestId: args.contestId, userId: args.userId, ratedAtStart: true },
    })
    return { status: "registered" }
  } catch (e: unknown) {
    if ((e as { code?: string }).code === "P2002") return { status: "already_registered" }
    throw e
  }
}
```

- [ ] **Step 4: Add the npm script.**

```json
"test:contests": "node --import tsx --test scripts/test-contests-actions.ts",
```

- [ ] **Step 5: Run the test to verify it passes.**

```bash
npm run test:contests
```

Expected: all 6 cases pass.

- [ ] **Step 6: Commit.**

```bash
git add actions/contests.ts scripts/test-contests-actions.ts package.json
git commit -m "feat(contests): public server actions list/get/register"
```

---

## Task 13: `ContestStatusPill` server component

**Files:**
- Create: `components/contests/ContestStatusPill.tsx`

- [ ] **Step 1: Write the component.**

```tsx
import type { ContestStatus } from "@prisma/client"
import { Badge } from "@/components/ui/Badge"

type Props = { status: ContestStatus }

const LABEL: Record<ContestStatus, string> = {
  SCHEDULED: "Upcoming",
  LIVE: "Live",
  CLOSED: "Closed",
  FINALIZED: "Final",
  CANCELLED: "Cancelled",
}

const VARIANT: Record<ContestStatus, "default" | "live" | "muted"> = {
  SCHEDULED: "default",
  LIVE: "live",
  CLOSED: "muted",
  FINALIZED: "muted",
  CANCELLED: "muted",
}

export function ContestStatusPill({ status }: Props) {
  return <Badge variant={VARIANT[status]}>{LABEL[status]}</Badge>
}
```

If the existing `Badge` primitive does not support a `"live"` variant, add one in `components/ui/Badge.tsx` (red dot + pulse) — verify by reading that file before editing. The variant token must use `--easy`/`--destructive` tokens, **not** a hardcoded color (CLAUDE.md rule).

- [ ] **Step 2: Commit.**

```bash
git add components/contests/ContestStatusPill.tsx components/ui/Badge.tsx
git commit -m "feat(contests): ContestStatusPill with live/upcoming/closed variants"
```

---

## Task 14: Public `/contests` index page

**Files:**
- Create: `app/contests/page.tsx`

- [ ] **Step 1: Write the page.**

```tsx
import Link from "next/link"
import { Container } from "@/components/ui/Container"
import { Card } from "@/components/ui/Card"
import { ContestStatusPill } from "@/components/contests/ContestStatusPill"
import { listContests } from "@/actions/contests"

export const dynamic = "force-dynamic"

export default async function ContestsIndexPage() {
  const { live, upcoming, past } = await listContests()

  return (
    <Container className="py-10">
      <h1 className="text-3xl font-semibold tracking-tight mb-8">Contests</h1>

      {live.length > 0 && (
        <Section title="Live now">
          {live.map((c) => <ContestCard key={c.id} contest={c} />)}
        </Section>
      )}

      <Section title="Upcoming">
        {upcoming.length === 0 ? (
          <p className="text-sm text-muted-foreground">No upcoming contests scheduled.</p>
        ) : (
          upcoming.map((c) => <ContestCard key={c.id} contest={c} />)
        )}
      </Section>

      <Section title="Past">
        {past.length === 0 ? (
          <p className="text-sm text-muted-foreground">No past contests yet.</p>
        ) : (
          past.slice(0, 20).map((c) => <ContestCard key={c.id} contest={c} />)
        )}
      </Section>
    </Container>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-10">
      <h2 className="text-lg font-medium mb-3">{title}</h2>
      <div className="grid gap-3">{children}</div>
    </section>
  )
}

function ContestCard({ contest }: { contest: Awaited<ReturnType<typeof listContests>>["upcoming"][number] }) {
  return (
    <Link href={`/contests/${contest.slug}`}>
      <Card className="p-4 hover:bg-accent transition">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-medium">{contest.title}</h3>
              <ContestStatusPill status={contest.status as never} />
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              {contest.startsAt.toLocaleString()} · {contest.kind.toLowerCase()}
            </p>
          </div>
          <div className="text-sm tabular-nums text-muted-foreground">
            {contest.registeredCount} registered
          </div>
        </div>
      </Card>
    </Link>
  )
}
```

- [ ] **Step 2: Add a `/contests` link to the navbar.**

In `components/layout/Navbar.tsx`, add a `Link` to `/contests` next to the existing `/practice` and `/learn` links. Match the surrounding pattern.

- [ ] **Step 3: Manual check.**

```bash
npm run dev
```

Visit `http://localhost:3000/contests`. Confirm sections render, empty states for buckets with no rows, no console errors.

- [ ] **Step 4: Commit.**

```bash
git add app/contests/page.tsx components/layout/Navbar.tsx
git commit -m "feat(contests): /contests public index page + navbar link"
```

---

## Task 15: Public `/contests/[slug]` detail page

**Files:**
- Create: `app/contests/[slug]/page.tsx`

- [ ] **Step 1: Write the page.**

```tsx
import { notFound } from "next/navigation"
import { auth } from "@/lib/auth"
import { Container } from "@/components/ui/Container"
import { Card } from "@/components/ui/Card"
import { ContestStatusPill } from "@/components/contests/ContestStatusPill"
import { RegisterButton } from "@/components/contests/RegisterButton"
import { getContestBySlug } from "@/actions/contests"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

export default async function ContestDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const contest = await getContestBySlug(slug)
  if (!contest) notFound()

  const session = await auth()
  const isRegistered = session?.user?.id
    ? await prisma.contestRegistration.findUnique({
        where: { contestId_userId: { contestId: contest.id, userId: session.user.id } },
        select: { contestId: true },
      })
    : null

  return (
    <Container className="py-10">
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <h1 className="text-3xl font-semibold tracking-tight">{contest.title}</h1>
            <ContestStatusPill status={contest.status as never} />
          </div>
          <p className="text-sm text-muted-foreground">
            {contest.startsAt.toLocaleString()} → {contest.endsAt.toLocaleString()}
          </p>
        </div>
        <RegisterButton
          contestId={contest.id}
          alreadyRegistered={Boolean(isRegistered)}
          disabled={contest.status !== "SCHEDULED" && contest.status !== "LIVE"}
          isSignedIn={Boolean(session?.user)}
        />
      </div>

      <Card className="p-6 mb-6">
        <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap">
          {contest.description}
        </div>
      </Card>

      <Card className="p-6">
        <h2 className="text-lg font-medium mb-3">
          Problems ({contest.problemCount})
        </h2>
        {contest.problems.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {contest.status === "SCHEDULED"
              ? "Problems are hidden until the contest goes live."
              : "No problems attached."}
          </p>
        ) : (
          <ul className="space-y-2">
            {contest.problems.map((p) => (
              <li key={p.problem.id} className="flex items-center justify-between text-sm">
                <span>
                  Q{p.position}. {p.problem.number}. {p.problem.title}
                </span>
                <span className="text-muted-foreground tabular-nums">{p.points} pts</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </Container>
  )
}
```

- [ ] **Step 2: Commit.**

```bash
git add app/contests/[slug]/page.tsx
git commit -m "feat(contests): /contests/[slug] detail page"
```

---

## Task 16: `RegisterButton` client component

**Files:**
- Create: `components/contests/RegisterButton.tsx`

- [ ] **Step 1: Write the component.**

```tsx
"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/Button"
import { registerForContest } from "@/actions/contests"

type Props = {
  contestId: string
  alreadyRegistered: boolean
  disabled: boolean
  isSignedIn: boolean
}

export function RegisterButton({ contestId, alreadyRegistered, disabled, isSignedIn }: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [registered, setRegistered] = useState(alreadyRegistered)
  const [error, setError] = useState<string | null>(null)

  if (!isSignedIn) {
    return <a href="/api/auth/signin"><Button variant="default">Sign in to register</Button></a>
  }

  if (registered) {
    return <Button disabled variant="secondary">Registered</Button>
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        disabled={disabled || pending}
        onClick={() => {
          setError(null)
          startTransition(async () => {
            try {
              await registerForContest({ contestId, userId: "self" /* server reads from session */ })
              setRegistered(true)
              router.refresh()
            } catch (e: unknown) {
              setError((e as Error).message ?? "Failed to register")
            }
          })
        }}
      >
        {pending ? "Registering…" : "Register"}
      </Button>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}
```

- [ ] **Step 2: Update `actions/contests.ts` `registerForContest` to derive `userId` from the session, not from the client.**

The current signature `registerForContest({ contestId, userId })` is fine for tests but unsafe for client callers — a malicious client can pass any `userId`. Change the public-from-client signature to take only `contestId` and read the session inside. Keep an internal helper for tests:

```typescript
// internal — exported for tests only
export async function _registerForContestUnchecked(args: { contestId: string; userId: string }) {
  // existing body
}

export async function registerForContest({ contestId }: { contestId: string }): Promise<{ status: "registered" | "already_registered" }> {
  const { auth } = await import("@/lib/auth")
  const session = await auth()
  if (!session?.user?.id) throw new Error("Not signed in")
  return _registerForContestUnchecked({ contestId, userId: session.user.id })
}
```

Update `scripts/test-contests-actions.ts` to call `_registerForContestUnchecked` for its register cases, and add one extra `it` that confirms `registerForContest({ contestId })` throws when there is no session (best-effort — `auth()` returns null in script context).

- [ ] **Step 3: Re-run the action tests.**

```bash
npm run test:contests
```

Expected: all cases pass.

- [ ] **Step 4: Commit.**

```bash
git add components/contests/RegisterButton.tsx actions/contests.ts scripts/test-contests-actions.ts
git commit -m "feat(contests): RegisterButton client component + session-scoped server action"
```

---

## Task 17: Cron sweep endpoint `/api/contests/sweep-locks`

**Files:**
- Create: `app/api/contests/sweep-locks/route.ts`

- [ ] **Step 1: Write the route.**

```typescript
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { sweepExpiredLocks } from "@/lib/contest-locks"

export async function GET(req: Request) {
  // Vercel Cron sends an Authorization header set to `Bearer <CRON_SECRET>`.
  const auth = req.headers.get("authorization") ?? ""
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const deleted = await sweepExpiredLocks(prisma)
  return NextResponse.json({ data: { deleted } })
}
```

- [ ] **Step 2: Add the cron entry to `vercel.json` (if Pro plan).**

If `vercel.json` exists, add:

```json
{
  "crons": [
    { "path": "/api/contests/sweep-locks", "schedule": "*/5 * * * *" }
  ]
}
```

If the project is still on Hobby plan, **skip** this step and note in the PR description that the sweep must be triggered manually or by an external scheduler until the plan upgrades. The `lockProblemsForContest` + `unlockProblemsForContest` paths already keep things consistent in the happy case; sweep is purely defensive.

- [ ] **Step 3: Manual smoke test.**

```bash
curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/contests/sweep-locks
```

Expected: `{ "data": { "deleted": 0 } }`.

- [ ] **Step 4: Commit.**

```bash
git add app/api/contests/sweep-locks/route.ts vercel.json
git commit -m "feat(contests): sweep-locks cron endpoint as defensive cleanup"
```

---

## Task 18: Admin UI — contest list

**Files:**
- Create: `app/admin/contests/page.tsx`
- Modify: `app/admin/page.tsx` (add a tile linking to `/admin/contests`)

- [ ] **Step 1: Write the list page.**

```tsx
import Link from "next/link"
import { prisma } from "@/lib/prisma"
import { Container } from "@/components/ui/Container"
import { Card } from "@/components/ui/Card"
import { Button } from "@/components/ui/Button"
import { ContestStatusPill } from "@/components/contests/ContestStatusPill"
import { deriveContestStatus } from "@/lib/contest-status"
import { requireAdmin } from "@/lib/api-auth"  // or whatever helper the existing admin pages use

export const dynamic = "force-dynamic"

export default async function AdminContestsPage() {
  await requireAdmin()
  const rows = await prisma.contest.findMany({
    orderBy: { startsAt: "desc" },
    select: {
      id: true, slug: true, title: true, kind: true, status: true,
      startsAt: true, endsAt: true,
      _count: { select: { problems: true, registrations: true } },
    },
  })
  const now = new Date()
  return (
    <Container className="py-10">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-semibold">Contests</h1>
        <Link href="/admin/contests/new"><Button>New contest</Button></Link>
      </div>
      <div className="grid gap-3">
        {rows.map((c) => {
          const status = deriveContestStatus(c.startsAt, c.endsAt, c.status, now)
          return (
            <Link key={c.id} href={`/admin/contests/${c.id}`}>
              <Card className="p-4 hover:bg-accent">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{c.title}</span>
                      <ContestStatusPill status={status} />
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {c.kind} · {c.startsAt.toLocaleString()}
                    </p>
                  </div>
                  <div className="text-sm tabular-nums text-muted-foreground">
                    {c._count.problems} probs · {c._count.registrations} reg
                  </div>
                </div>
              </Card>
            </Link>
          )
        })}
        {rows.length === 0 && <p className="text-sm text-muted-foreground">No contests yet.</p>}
      </div>
    </Container>
  )
}
```

(Verify the exact name of the existing "require admin in a server component" helper — read `app/admin/problems/page.tsx` to copy that pattern instead of inventing `requireAdmin`.)

- [ ] **Step 2: Add the tile to `app/admin/page.tsx`.**

Follow the existing tile pattern. Title: "Contests". Description: "Create and manage contests."

- [ ] **Step 3: Commit.**

```bash
git add app/admin/contests/page.tsx app/admin/page.tsx
git commit -m "feat(contests): admin contests list page"
```

---

## Task 19: Admin UI — new contest form

**Files:**
- Create: `app/admin/contests/new/page.tsx`
- Create: `components/contests/admin/ContestForm.tsx`

- [ ] **Step 1: Write the form component.**

`components/contests/admin/ContestForm.tsx`:

```tsx
"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Input } from "@/components/ui/Input"
import { Button } from "@/components/ui/Button"

type Mode = { kind: "create" } | { kind: "edit"; id: string; initial: InitialValues }

type InitialValues = {
  slug: string
  title: string
  description: string
  kind: "WEEKLY" | "BIWEEKLY" | "SPECIAL"
  startsAt: string  // ISO local
  endsAt: string
  rated: boolean
}

const EMPTY: InitialValues = {
  slug: "",
  title: "",
  description: "",
  kind: "WEEKLY",
  startsAt: "",
  endsAt: "",
  rated: true,
}

export function ContestForm({ mode }: { mode: Mode }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [values, setValues] = useState<InitialValues>(
    mode.kind === "edit" ? mode.initial : EMPTY,
  )

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        setError(null)
        start(async () => {
          const url = mode.kind === "create" ? "/api/admin/contests" : `/api/admin/contests/${mode.id}`
          const method = mode.kind === "create" ? "POST" : "PATCH"
          const payload = mode.kind === "create"
            ? values
            : (() => {
                const { slug: _slug, kind: _kind, ...rest } = values
                return rest
              })()
          const res = await fetch(url, {
            method,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              ...payload,
              startsAt: new Date(values.startsAt).toISOString(),
              endsAt: new Date(values.endsAt).toISOString(),
            }),
          })
          if (!res.ok) {
            const body = await res.json().catch(() => ({}))
            setError(body.error ?? `Request failed (${res.status})`)
            return
          }
          const body = await res.json()
          router.push(`/admin/contests/${body.data.id}`)
          router.refresh()
        })
      }}
      className="space-y-4 max-w-2xl"
    >
      {mode.kind === "create" && (
        <Field label="Slug">
          <Input value={values.slug} onChange={(e) => setValues({ ...values, slug: e.target.value })} required />
        </Field>
      )}
      <Field label="Title">
        <Input value={values.title} onChange={(e) => setValues({ ...values, title: e.target.value })} required />
      </Field>
      <Field label="Description (markdown)">
        <textarea
          className="w-full min-h-[160px] rounded-md border border-border bg-background p-2 text-sm"
          value={values.description}
          onChange={(e) => setValues({ ...values, description: e.target.value })}
          required
        />
      </Field>
      {mode.kind === "create" && (
        <Field label="Kind">
          <select
            className="w-full rounded-md border border-border bg-background p-2 text-sm"
            value={values.kind}
            onChange={(e) => setValues({ ...values, kind: e.target.value as InitialValues["kind"] })}
          >
            <option value="WEEKLY">Weekly</option>
            <option value="BIWEEKLY">Biweekly</option>
            <option value="SPECIAL">Special</option>
          </select>
        </Field>
      )}
      <div className="grid grid-cols-2 gap-4">
        <Field label="Starts at (local)">
          <Input type="datetime-local" value={values.startsAt} onChange={(e) => setValues({ ...values, startsAt: e.target.value })} required />
        </Field>
        <Field label="Ends at (local)">
          <Input type="datetime-local" value={values.endsAt} onChange={(e) => setValues({ ...values, endsAt: e.target.value })} required />
        </Field>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={values.rated}
          onChange={(e) => setValues({ ...values, rated: e.target.checked })}
        />
        Rated
      </label>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : (mode.kind === "create" ? "Create" : "Save")}
      </Button>
    </form>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-medium uppercase tracking-wide text-muted-foreground mb-1">{label}</span>
      {children}
    </label>
  )
}
```

- [ ] **Step 2: Write the new page wrapper.**

`app/admin/contests/new/page.tsx`:

```tsx
import { Container } from "@/components/ui/Container"
import { ContestForm } from "@/components/contests/admin/ContestForm"

export default function NewContestPage() {
  return (
    <Container className="py-10">
      <h1 className="text-2xl font-semibold mb-6">New contest</h1>
      <ContestForm mode={{ kind: "create" }} />
    </Container>
  )
}
```

- [ ] **Step 3: Commit.**

```bash
git add app/admin/contests/new/page.tsx components/contests/admin/ContestForm.tsx
git commit -m "feat(contests): admin new-contest form"
```

---

## Task 20: Admin UI — edit page with problems picker

**Files:**
- Create: `app/admin/contests/[id]/page.tsx`
- Create: `components/contests/admin/ContestProblemsPicker.tsx`

- [ ] **Step 1: Write the edit page.**

`app/admin/contests/[id]/page.tsx`:

```tsx
import { notFound } from "next/navigation"
import { Container } from "@/components/ui/Container"
import { prisma } from "@/lib/prisma"
import { ContestForm } from "@/components/contests/admin/ContestForm"
import { ContestProblemsPicker } from "@/components/contests/admin/ContestProblemsPicker"

export default async function EditContestPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const contest = await prisma.contest.findUnique({
    where: { id },
    include: {
      problems: {
        orderBy: { position: "asc" },
        include: { problem: { select: { id: true, number: true, slug: true, title: true, difficulty: true } } },
      },
    },
  })
  if (!contest) notFound()

  const toLocal = (d: Date) => {
    // Convert to "yyyy-MM-ddTHH:mm" for <input type="datetime-local">
    const off = d.getTimezoneOffset()
    return new Date(d.getTime() - off * 60_000).toISOString().slice(0, 16)
  }

  return (
    <Container className="py-10">
      <h1 className="text-2xl font-semibold mb-6">{contest.title}</h1>
      <section className="mb-10">
        <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground mb-3">Settings</h2>
        <ContestForm
          mode={{
            kind: "edit",
            id: contest.id,
            initial: {
              slug: contest.slug,
              title: contest.title,
              description: contest.description,
              kind: contest.kind as "WEEKLY" | "BIWEEKLY" | "SPECIAL",
              startsAt: toLocal(contest.startsAt),
              endsAt: toLocal(contest.endsAt),
              rated: contest.rated,
            },
          }}
        />
      </section>
      <section>
        <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground mb-3">Problems</h2>
        <ContestProblemsPicker
          contestId={contest.id}
          attached={contest.problems.map((p) => ({
            problemId: p.problem.id,
            position: p.position,
            points: p.points,
            number: p.problem.number,
            title: p.problem.title,
            difficulty: p.problem.difficulty,
          }))}
        />
      </section>
    </Container>
  )
}
```

- [ ] **Step 2: Write the picker.**

`components/contests/admin/ContestProblemsPicker.tsx`:

```tsx
"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Input } from "@/components/ui/Input"
import { Button } from "@/components/ui/Button"

type Attached = {
  problemId: string
  position: number
  points: number
  number: number
  title: string
  difficulty: string
}

export function ContestProblemsPicker({ contestId, attached }: { contestId: string; attached: Attached[] }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [search, setSearch] = useState("")
  const [results, setResults] = useState<Array<{ id: string; number: number; title: string; difficulty: string }>>([])
  const [position, setPosition] = useState(attached.length + 1)
  const [points, setPoints] = useState(3)
  const [error, setError] = useState<string | null>(null)

  return (
    <div className="space-y-4">
      <ul className="space-y-1">
        {attached.map((a) => (
          <li key={a.problemId} className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm">
            <span>Q{a.position} — {a.number}. {a.title} ({a.difficulty.toLowerCase()})</span>
            <span className="flex items-center gap-3">
              <span className="text-muted-foreground tabular-nums">{a.points} pts</span>
              <button
                type="button"
                className="text-destructive text-xs"
                disabled={pending}
                onClick={() => {
                  setError(null)
                  start(async () => {
                    const res = await fetch(`/api/admin/contests/${contestId}/problems/${a.problemId}`, { method: "DELETE" })
                    if (!res.ok) {
                      setError((await res.json()).error ?? "Failed to detach")
                      return
                    }
                    router.refresh()
                  })
                }}
              >
                Remove
              </button>
            </span>
          </li>
        ))}
      </ul>

      <div className="grid grid-cols-[1fr_auto_auto_auto] gap-2 items-end">
        <label className="block">
          <span className="block text-xs uppercase tracking-wide text-muted-foreground mb-1">Search problem</span>
          <Input
            value={search}
            onChange={async (e) => {
              setSearch(e.target.value)
              if (e.target.value.length < 2) { setResults([]); return }
              const r = await fetch(`/api/admin/problems?q=${encodeURIComponent(e.target.value)}`)
              if (r.ok) setResults((await r.json()).data.slice(0, 8))
            }}
            placeholder="title or number"
          />
        </label>
        <label className="block">
          <span className="block text-xs uppercase tracking-wide text-muted-foreground mb-1">Position</span>
          <Input type="number" value={position} onChange={(e) => setPosition(Number(e.target.value))} className="w-20" />
        </label>
        <label className="block">
          <span className="block text-xs uppercase tracking-wide text-muted-foreground mb-1">Points</span>
          <Input type="number" value={points} onChange={(e) => setPoints(Number(e.target.value))} className="w-20" />
        </label>
        <div />
      </div>
      {results.length > 0 && (
        <ul className="border border-border rounded-md divide-y divide-border">
          {results.map((r) => (
            <li key={r.id} className="flex items-center justify-between px-3 py-2 text-sm">
              <span>{r.number}. {r.title} <span className="text-muted-foreground">({r.difficulty.toLowerCase()})</span></span>
              <Button
                size="sm"
                disabled={pending}
                onClick={() => {
                  setError(null)
                  start(async () => {
                    const res = await fetch(`/api/admin/contests/${contestId}/problems`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ problemId: r.id, position, points }),
                    })
                    if (!res.ok) {
                      setError((await res.json()).error ?? "Failed to attach")
                      return
                    }
                    setSearch(""); setResults([])
                    setPosition(position + 1)
                    router.refresh()
                  })
                }}
              >Attach</Button>
            </li>
          ))}
        </ul>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  )
}
```

(The picker uses `/api/admin/problems?q=...` for search — confirm the existing list endpoint supports `?q`. If not, add it as a small modification to `app/api/admin/problems/route.ts`. Read that file first.)

- [ ] **Step 3: Commit.**

```bash
git add app/admin/contests/[id]/page.tsx components/contests/admin/ContestProblemsPicker.tsx
git commit -m "feat(contests): admin contest edit page + problems picker"
```

---

## Task 21: E2E happy path with Playwright

**Files:**
- Create: `tests/e2e/contests-foundation.spec.ts`

- [ ] **Step 1: Write the spec.**

```typescript
import { test, expect } from "@playwright/test"

// Assumes an admin and a learner test user are seeded (see tests/e2e/auth.ts
// or whatever the existing convention is — read tests/e2e/discussions.spec.ts
// for the existing sign-in pattern before customizing).

test.describe("contests foundation", () => {
  test("admin creates a contest, attaches a problem, learner sees and registers", async ({ page }) => {
    // 1. Admin sign in
    await page.goto("/api/auth/signin")
    // ... follow the existing admin sign-in helper ...

    // 2. Create
    await page.goto("/admin/contests/new")
    await page.getByLabel(/slug/i).fill(`e2e-${Date.now()}`)
    await page.getByLabel(/title/i).fill("E2E Test Contest")
    await page.getByLabel(/description/i).fill("e2e")
    // Pick startsAt/endsAt 1h apart in the future
    const start = new Date(Date.now() + 24 * 3600_000)
    const end = new Date(start.getTime() + 90 * 60_000)
    const fmt = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16)
    await page.getByLabel(/starts at/i).fill(fmt(start))
    await page.getByLabel(/ends at/i).fill(fmt(end))
    await page.getByRole("button", { name: /create/i }).click()
    await expect(page).toHaveURL(/\/admin\/contests\/[^/]+$/)

    // 3. Attach a problem (assumes at least one PUBLISHED problem exists)
    await page.getByPlaceholder(/title or number/i).fill("a")
    const firstResult = page.getByRole("button", { name: /attach/i }).first()
    await expect(firstResult).toBeVisible({ timeout: 5_000 })
    await firstResult.click()

    // 4. Switch to learner — see /contests, see this contest
    // ... sign out then sign in as learner using the existing helper ...
    await page.goto("/contests")
    await expect(page.getByText(/E2E Test Contest/)).toBeVisible()

    // 5. Open detail + register
    await page.getByText(/E2E Test Contest/).click()
    await page.getByRole("button", { name: /register/i }).click()
    await expect(page.getByText(/registered/i)).toBeVisible()

    // 6. Verify the attached problem disappears from /practice list while contest is SCHEDULED
    // (it's locked, even before LIVE)
    await page.goto("/practice")
    // The attached problem's title (we don't know it; the assertion uses absence
    // is brittle — instead, hit the attached problem's direct URL and assert
    // the "Locked: in contest" notice renders).
    // ... follow the lock-notice assertion ...
  })
})
```

Replace the `... follow the existing helper ...` markers with the actual sign-in pattern by reading `tests/e2e/discussions.spec.ts` first.

- [ ] **Step 2: Run the spec.**

```bash
npm run test:e2e -- contests-foundation.spec.ts
```

Expected: pass.

- [ ] **Step 3: Commit.**

```bash
git add tests/e2e/contests-foundation.spec.ts
git commit -m "test(contests): e2e foundation happy path"
```

---

## Task 22: Roadmap update + PR

**Files:**
- Modify: `docs/ROADMAP.md`

- [ ] **Step 1: Edit `docs/ROADMAP.md`.**

Under the existing `### V2 — Contest` heading (around line 313 per the original survey), add a `**Status:**` line near the top:

```markdown
**Status:** Phase 1 (Foundation) shipped — schema, admin CRUD, problem
locking, public listing, registration. Phases 2–7 tracked in
`docs/superpowers/specs/2026-05-24-contests-design.md` and follow-on plans.
```

- [ ] **Step 2: Commit.**

```bash
git add docs/ROADMAP.md
git commit -m "docs(roadmap): contests Phase 1 (Foundation) shipped"
```

- [ ] **Step 3: Open the PR.**

```bash
git push -u origin <branch>
gh pr create --base main --title "feat(contests): Phase 1 — foundation" --body "$(cat <<'EOF'
## Summary
- Schema for Contest, ContestProblem, ContestRegistration, ContestProblemLock + hidden test fields on SQLProblem
- Admin REST CRUD under /api/admin/contests/* (create, edit, attach/detach problems, list registrations)
- Public /contests index + /contests/[slug] detail + registration
- excludeLockedProblems helper + audited gates in practice/tracks/lists/profile/submissions
- Cron-style sweep endpoint for orphaned locks
- Unit + integration + E2E coverage

Implements Phase 1 of `docs/superpowers/specs/2026-05-24-contests-design.md`.

## Verified
- [ ] `npm run test:contest-status`
- [ ] `npm run test:contest-admin-validation`
- [ ] `npm run test:contest-locks`
- [ ] `npm run test:contests`
- [ ] `npm run test:e2e -- contests-foundation.spec.ts`
- [ ] Manual: create contest via UI, attach problem, confirm /practice excludes it, /practice/<slug> shows lock notice
- [ ] Manual: register as learner, see "Registered" state, refresh persists

## Not yet verified
- Cron entry (requires Vercel Pro plan)

## Screenshots
TODO before opening for review
EOF
)"
```

---

## Self-Review

**Spec coverage walk:**

- §3.1 enums (ContestKind, ContestStatus, ContestVerdict) — ContestKind + ContestStatus in Task 1 ✅. ContestVerdict is deferred to Phase 2 (no consumer in Phase 1). Noted in spec §3.1 that ContestSubmission is Phase 2. ✅
- §3.2 data model (Phase 1 subset) — Contest, ContestProblem, ContestRegistration in Task 1 ✅. ContestSubmission/Solve/Leaderboard/UserRating/RatingHistory deferred to later phases ✅.
- §3.3 ContestProblemLock + audit — Tasks 1, 4, 5, 6, 7 ✅.
- §3.4 hidden fields — Task 1 ✅, enforcement at attach time Task 10 ✅.
- §13 admin surface — Tasks 8, 9, 10, 11, 18, 19, 20 ✅. MCP server tools deferred to Phase 2 alongside the judge (they need the same hidden-data write path).
- §14 Phase 1 — full coverage ✅.
- §10 server-authoritative time — partial: the `deriveContestStatus` helper uses server clock in `actions/contests.ts` and the admin UI. Submit-side time gating is Phase 2 (no submit endpoint in Phase 1). ✅ for scope.

**Placeholder scan:** None of the steps say "TBD" or "handle appropriately". The Playwright step (Task 21) has placeholder `... follow the existing helper ...` comments but they're explicitly directed at reading a specific existing file first — that is concrete enough to act on.

**Type consistency:** `excludeLockedProblems` signature consistent across Tasks 4/5/7. `registerForContest` signature changed in Task 16 — the change is called out and the test file is updated in the same task. `ContestStatus` and `ContestKind` strings consistent across all UI and API code. `ContestProblemLock` field names (`problemId`, `contestId`, `unlocksAt`) consistent across schema, helper, and sweep route.

**Coverage gaps found and added:** Task 6 (lock notice on `/practice/[slug]`) was not initially in the file plan but the audit revealed the slug page needs explicit handling to avoid leaking lock state through 404s. Added.

---

Plan complete and saved to `docs/superpowers/plans/2026-05-24-contests-phase-1-foundation.md`. 22 tasks covering schema → admin CRUD → public surfaces → registration → E2E.

Two execution options:

1. **Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.
2. **Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints.

Which approach?
