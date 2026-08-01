# Curriculum Spine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the ordered curriculum spine — track → module → lesson → checkpoint problems, with per-user read state and progress rollups — plus the admin API, MCP tools, and one authored track that the redesign's screens will render.

**Architecture:** Four additive Prisma models (`Module`, `ModuleLesson`, `LessonCheckpoint`, `LessonProgress`) leave `Article`, `Topic`, `SQLProblem` and `Track` untouched. Rollup maths lives in a Prisma-free pure module so it is unit-testable without a database; Prisma queries live in `actions/curriculum.ts` and mutation helpers in `lib/admin-curriculum.ts`, mirroring the existing `lib/tracks.ts` / `lib/admin-tracks.ts` split. REST routes are thin translators from `CurriculumMutationResult` to HTTP, and MCP tools are thin wrappers over REST.

**Tech Stack:** Next.js 16 App Router, TypeScript strict, Prisma 7 (`@prisma/adapter-pg`), Zod 4, `node:test` via `node --import tsx --test`, MCP TypeScript SDK bundled with tsup.

**Spec:** [`docs/superpowers/specs/2026-08-01-curriculum-spine-design.md`](../specs/2026-08-01-curriculum-spine-design.md)

## Global Constraints

- **Never run `next build` without `--webpack`.** Turbopack panics on this codebase in Next 16.1.1. `package.json` already pins it.
- **`lib/admin-validation.ts` must stay Prisma-free and server-runtime-free — pure Zod only.** The MCP server bundles it via tsup. `npm run check:mcp-bundle-isolation` must pass.
- **Positions are mutable only inside a reorder transaction.** Applies to `Module.position`, `ModuleLesson.position`, `LessonCheckpoint.position`. Never write a position from a create/update path outside the documented insert-shift transaction.
- **Module unlocking is advisory and must never be enforced.** No route guard, no server-action rejection, no redirect. Skipping ahead is always permitted.
- **Attaching curriculum never mutates `Track.status`.** Publishing a track stays a deliberate human action.
- **Locked-contest problems must be excluded from learner-facing problem queries** via `excludeLockedProblems` from `lib/contest-locks.ts`, as `lib/tracks.ts` already does.
- **Lock copy is "Locked until 02"** — not "Not started".
- **Branch is `feat/curriculum-spine`.** PRs must pass `--base main` to `gh pr create`. No direct push to `main`, no `--no-verify`.
- **Know which database you are talking to.** `.env` → local Postgres `postgresql://anchitgupta@localhost:5432/datalearn` (user `anchitgupta`, not `postgres`) — this is the one every test uses. `.env.production.local` → **real production**, `ep-autumn-math`. `.env.local` → `ep-cool-flower`, a **stale Neon branch that is NOT production** and must never be cited as such. Establishing this cost Task 1; do not re-derive it.
- **`ls prisma/migrations | wc -l` overcounts by one** — `migration_lock.toml` is not a migration.
- **Restart the dev server after any `prisma/schema.prisma` change** — the running process holds the old generated client.

---

## Task 1: Clear the production migration backlog

> **RESOLVED 2026-08-01 — this task is complete and its premise was false.** There
> is no backlog. Production (`ep-autumn-math`, via `.env.production.local`) is at
> 27 of 27 migrations with the `Track` table populated and `/api/health` green.
> The original figure was measured against `.env.local`, which points at
> `ep-cool-flower` — a stale Neon *branch*, not production — and overcounted by
> one because `migration_lock.toml` was treated as a migration. Evidence:
> [`2026-08-01-curriculum-spine-task1-findings.md`](./2026-08-01-curriculum-spine-task1-findings.md).
> Steps below are retained as the record of what was investigated.

This task adds no schema — it was there to make the rest of the plan shippable.

**Files:**

- Modify (only if the diagnosis calls for it): `package.json:vercel-build`
- Create: `docs/superpowers/plans/2026-08-01-curriculum-spine-task1-findings.md`

**Interfaces:**

- Consumes: nothing
- Produces: a production database at 28 of 28 migrations. Every later task assumes migrations deploy cleanly.

- [ ] **Step 1: Record the current production migration state**

```bash
cat > ./.dl-migstate.mjs <<'EOF'
import dotenv from "dotenv"
dotenv.config({ path: ".env.local" })
const { Pool } = await import("pg")
const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const { rows } = await pool.query(
  `select migration_name, finished_at, rolled_back_at, applied_steps_count
   from "_prisma_migrations" order by started_at asc`
)
console.table(rows)
console.log("total:", rows.length,
  "finished:", rows.filter(r => r.finished_at).length,
  "rolled_back:", rows.filter(r => r.rolled_back_at).length)
await pool.end()
EOF
node ./.dl-migstate.mjs; rm -f ./.dl-migstate.mjs
```

Expected: 19 rows. Note whether any row has a null `finished_at` or a non-null `rolled_back_at` — a failed migration blocks every one after it.

- [ ] **Step 2: List the migrations production is missing**

```bash
ls prisma/migrations | sort
```

Compare against Step 1's `migration_name` column. Write the missing names down — they go in the findings doc.

- [ ] **Step 3: Check whether `production` is simply behind `main`**

```bash
git fetch origin
git log --oneline origin/production..origin/main -- prisma/migrations | cat
```

If this lists commits, the cause is release lag, not a broken pipeline: the migrations were never merged to `production`. That is the expected answer given `main` is the integration branch.

- [ ] **Step 4: Check the most recent production deployment log**

```bash
gh run list --branch production --limit 5
```

Look for `prisma migrate deploy` output. Confirm it ran and what it reported. If Vercel deploy logs aren't reachable via `gh`, check the Vercel dashboard for the last `production` deployment and search its build log for `migrate deploy`.

- [ ] **Step 5: Write the findings document**

Create `docs/superpowers/plans/2026-08-01-curriculum-spine-task1-findings.md` containing: the 19 applied names, the 9 missing names, which of the three causes from the spec was actually true, and the exact remediation performed or required. If remediation needs a `main → production` release PR, say so explicitly — that is a human-gated action, not something this task performs unilaterally.

- [ ] **Step 6: Remediate**

If the cause is release lag (the expected case): this is resolved by the normal release flow, and the plan proceeds — SP1's migrations will ship in the same release. Record that and move on.

If the cause is a failed/blocked migration row: resolve with `prisma migrate resolve --applied <name>` or `--rolled-back <name>` against `DIRECT_URL`, then re-run `prisma migrate deploy`. Never edit `_prisma_migrations` by hand.

If the cause is `vercel-build` short-circuiting: fix the script so `migrate deploy` failures are fatal rather than swallowed.

- [ ] **Step 7: Verify production health**

```bash
curl -s https://www.learndatanow.com/api/health | head -20
```

Expected: a healthy response. Re-run Step 1 and confirm the applied count now matches `ls prisma/migrations | wc -l`, **or** that the findings doc explains precisely why it cannot yet (e.g. "requires release PR #N").

- [ ] **Step 8: Commit**

```bash
git add docs/superpowers/plans/2026-08-01-curriculum-spine-task1-findings.md
git commit -m "docs(plans): production migration backlog findings for the curriculum spine"
```

---

## Task 2: Schema and migration

**Files:**

- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<timestamp>_curriculum_spine/migration.sql` (generated)

**Interfaces:**

- Consumes: nothing
- Produces: Prisma client accessors `prisma.module`, `prisma.moduleLesson`, `prisma.lessonCheckpoint`, `prisma.lessonProgress`, and the exported types `Module`, `ModuleLesson`, `LessonCheckpoint`, `LessonProgress` from `@prisma/client`.

- [ ] **Step 1: Add the four models to `prisma/schema.prisma`**

Append after the `TrackItem` model (around line 289):

```prisma
/// A named, ordered stage of a Track. Modules group lessons; lessons
/// carry checkpoint problems. `slug` is unique per track and does NOT
/// contain the display number — the "04-" prefix in breadcrumbs is
/// derived from `position` at render time so reordering never breaks
/// a URL.
model Module {
  id          String         @id @default(cuid())
  trackId     String
  track       Track          @relation(fields: [trackId], references: [id], onDelete: Cascade)
  slug        String
  name        String
  description String         @db.Text
  /// 0-indexed. Mutable ONLY inside reorderModules' transaction.
  position    Int
  lessons     ModuleLesson[]
  createdAt   DateTime       @default(now())
  updatedAt   DateTime       @updatedAt

  @@unique([trackId, slug])
  @@unique([trackId, position])
  @@index([trackId])
}

/// An Article placed in a Module, in order. An Article MAY appear in more
/// than one Module — reuse across tracks is intentional, and read progress
/// is keyed on the article so it counts everywhere the lesson appears.
model ModuleLesson {
  moduleId  String
  module    Module  @relation(fields: [moduleId], references: [id], onDelete: Cascade)
  articleId String
  article   Article @relation(fields: [articleId], references: [id], onDelete: Cascade)
  /// 0-indexed. Mutable ONLY inside reorderModuleLessons' transaction.
  position  Int

  @@id([moduleId, articleId])
  @@unique([moduleId, position])
  @@index([articleId])
}

/// A problem that checks a lesson. `@@unique([problemId])` enforces the
/// product rule from the design handoff: a problem belongs to exactly one
/// lesson. Relaxing to many-to-many later means dropping this constraint,
/// not migrating SQLProblem.
model LessonCheckpoint {
  articleId String
  article   Article    @relation(fields: [articleId], references: [id], onDelete: Cascade)
  problemId String
  problem   SQLProblem @relation(fields: [problemId], references: [id], onDelete: Cascade)
  /// 0-indexed. Mutable ONLY inside reorderCheckpoints' transaction.
  position  Int

  @@id([articleId, problemId])
  @@unique([problemId])
  @@unique([articleId, position])
}

/// Per-user lesson read state. `percent` is monotonic — writes take
/// max(existing, incoming) and never decrease. `completedAt` is set once,
/// when percent first reaches 100, and is never unset.
model LessonProgress {
  userId      String
  user        User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  articleId   String
  article     Article   @relation(fields: [articleId], references: [id], onDelete: Cascade)
  percent     Int       @default(0)
  completedAt DateTime?
  updatedAt   DateTime  @updatedAt

  @@id([userId, articleId])
  @@index([userId, completedAt])
}
```

- [ ] **Step 2: Add the back-relations to the existing models**

`Track` (around line 271) — add to the field list:

```prisma
  modules          Module[]
```

`Article` (around line 126) — add:

```prisma
  moduleLessons   ModuleLesson[]
  checkpoints     LessonCheckpoint[]
  lessonProgress  LessonProgress[]
```

`SQLProblem` (around line 225, next to `trackItems`) — add:

```prisma
  lessonCheckpoint                LessonCheckpoint?
```

`User` (around line 10) — add:

```prisma
  lessonProgress LessonProgress[]
```

- [ ] **Step 3: Generate the migration**

```bash
npx prisma migrate dev --name curriculum_spine
```

Expected: a new directory under `prisma/migrations/`, and `prisma generate` runs.

If Prisma rejects `Module` as a model name, rename the model to `CurriculumModule` and add `@@map("Module")`, then update every `prisma.module` reference in this plan to `prisma.curriculumModule`. Record the substitution in the commit message so later tasks aren't surprised.

- [ ] **Step 4: Verify the client typechecks and the accessors exist**

```bash
npx tsc --noEmit
```

Expected: PASS.

```bash
cat > ./.dl-verify.mjs <<'EOF'
import dotenv from "dotenv"
dotenv.config({ path: ".env" })
const { PrismaClient } = await import("@prisma/client")
const { PrismaPg } = await import("@prisma/adapter-pg")
const { Pool } = await import("pg")
const p = new PrismaClient({ adapter: new PrismaPg(new Pool({ connectionString: process.env.DATABASE_URL })) })
console.log("module:", await p.module.count())
console.log("moduleLesson:", await p.moduleLesson.count())
console.log("lessonCheckpoint:", await p.lessonCheckpoint.count())
console.log("lessonProgress:", await p.lessonProgress.count())
await p.$disconnect()
EOF
node ./.dl-verify.mjs; rm -f ./.dl-verify.mjs
```

Expected: four lines, each `0`. (The script must live in the repo root — `node_modules` won't resolve from a temp directory.)

- [ ] **Step 5: Restart the dev server**

The running `next dev` process holds the pre-migration client. Kill and restart it.

- [ ] **Step 6: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat(db): add Module, ModuleLesson, LessonCheckpoint, LessonProgress"
```

---

## Task 3: Pure progress rollup module

No database. Pure functions over already-fetched rows, so they are unit-testable in isolation.

**Files:**

- Create: `lib/curriculum-progress.ts`
- Test: `scripts/test-curriculum-progress.ts`
- Modify: `package.json` (add the `test:curriculum-progress` script)

**Interfaces:**

- Consumes: nothing
- Produces:
  - `type LessonState = { articleId: string; completed: boolean }`
  - `type ProblemState = { problemId: string; solved: boolean }`
  - `type ModuleRollup = { moduleId: string; lessonsDone: number; lessonsTotal: number; problemsDone: number; problemsTotal: number; percent: number }`
  - `type TrackRollup = { lessonsDone: number; lessonsTotal: number; problemsDone: number; problemsTotal: number; percent: number }`
  - `rollUpModule(input: { moduleId: string; lessons: LessonState[]; problems: ProblemState[] }): ModuleRollup`
  - `rollUpTrack(modules: ModuleRollup[]): TrackRollup`
  - `isModuleUnlocked(modules: ModuleRollup[], index: number): boolean`
  - `clampProgressPercent(existing: number, incoming: number): number`

- [ ] **Step 1: Write the failing test**

Create `scripts/test-curriculum-progress.ts`:

```ts
// Unit tests for the pure curriculum rollup maths. No database.
//
// Run: node --import tsx --test scripts/test-curriculum-progress.ts

import { describe, it } from "node:test"
import assert from "node:assert/strict"
import {
    clampProgressPercent,
    isModuleUnlocked,
    rollUpModule,
    rollUpTrack,
    type ModuleRollup,
} from "../lib/curriculum-progress"

function mod(
    moduleId: string,
    lessons: Array<boolean>,
    problems: Array<boolean>,
): ModuleRollup {
    return rollUpModule({
        moduleId,
        lessons: lessons.map((completed, i) => ({
            articleId: `${moduleId}-a${i}`,
            completed,
        })),
        problems: problems.map((solved, i) => ({
            problemId: `${moduleId}-p${i}`,
            solved,
        })),
    })
}

describe("rollUpModule", () => {
    it("counts lessons and problems separately", () => {
        const r = mod("m1", [true, false, false], [true, true, false, false])
        assert.equal(r.lessonsDone, 1)
        assert.equal(r.lessonsTotal, 3)
        assert.equal(r.problemsDone, 2)
        assert.equal(r.problemsTotal, 4)
    })

    it("puts problems in the percent denominator", () => {
        // 1 of 3 lessons + 2 of 4 problems = 3 of 7
        const r = mod("m1", [true, false, false], [true, true, false, false])
        assert.equal(r.percent, 43)
    })

    it("is 0 for an empty module rather than NaN", () => {
        const r = mod("empty", [], [])
        assert.equal(r.percent, 0)
        assert.equal(Number.isNaN(r.percent), false)
    })

    it("is 100 when everything is done", () => {
        assert.equal(mod("m1", [true, true], [true]).percent, 100)
    })

    it("is 100 for a lessons-only module with every lesson read", () => {
        assert.equal(mod("m1", [true, true, true], []).percent, 100)
    })
})

describe("rollUpTrack", () => {
    it("sums across modules and recomputes the percent from the totals", () => {
        const t = rollUpTrack([
            mod("m1", [true, true], [true, true]),
            mod("m2", [false, false], [false, false]),
        ])
        assert.equal(t.lessonsDone, 2)
        assert.equal(t.lessonsTotal, 4)
        assert.equal(t.problemsDone, 2)
        assert.equal(t.problemsTotal, 4)
        assert.equal(t.percent, 50)
    })

    it("is 0 for a track with no content", () => {
        assert.equal(rollUpTrack([]).percent, 0)
    })

    it("does not average module percentages", () => {
        // A 1-item 100% module and a 99-item 0% module is 1%, not 50%.
        const t = rollUpTrack([
            mod("small", [true], []),
            mod("big", new Array(99).fill(false), []),
        ])
        assert.equal(t.percent, 1)
    })
})

describe("isModuleUnlocked", () => {
    const modules = [
        mod("m1", [true], []),           // 100%
        mod("m2", [true, false], []),    // 50%
        mod("m3", [false], []),          // 0%
    ]

    it("always unlocks the first module", () => {
        assert.equal(isModuleUnlocked(modules, 0), true)
    })

    it("unlocks a module when the previous one is complete", () => {
        assert.equal(isModuleUnlocked(modules, 1), true)
    })

    it("locks a module when the previous one is incomplete", () => {
        assert.equal(isModuleUnlocked(modules, 2), false)
    })

    it("treats an out-of-range index as locked", () => {
        assert.equal(isModuleUnlocked(modules, 9), false)
    })
})

describe("clampProgressPercent", () => {
    it("never decreases", () => {
        assert.equal(clampProgressPercent(80, 20), 80)
    })

    it("advances when the incoming value is higher", () => {
        assert.equal(clampProgressPercent(20, 80), 80)
    })

    it("clamps above 100", () => {
        assert.equal(clampProgressPercent(0, 140), 100)
    })

    it("clamps below 0", () => {
        assert.equal(clampProgressPercent(0, -5), 0)
    })

    it("rounds fractional input", () => {
        assert.equal(clampProgressPercent(0, 62.4), 62)
    })
})
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
node --import tsx --test scripts/test-curriculum-progress.ts
```

Expected: FAIL — `Cannot find module '../lib/curriculum-progress'`.

- [ ] **Step 3: Write the implementation**

Create `lib/curriculum-progress.ts`:

```ts
// Pure curriculum rollup maths. NO Prisma, NO React, NO server runtime —
// this module takes already-fetched rows and returns numbers, so it can be
// unit-tested without a database. Prisma queries live in
// actions/curriculum.ts and hand their results here.

export type LessonState = { articleId: string; completed: boolean }
export type ProblemState = { problemId: string; solved: boolean }

export type ModuleRollup = {
    moduleId: string
    lessonsDone: number
    lessonsTotal: number
    problemsDone: number
    problemsTotal: number
    percent: number
}

export type TrackRollup = {
    lessonsDone: number
    lessonsTotal: number
    problemsDone: number
    problemsTotal: number
    percent: number
}

/**
 * Percent of a (done, total) pair. Problems share the denominator with
 * lessons — the learn hub shows "13/37 lessons" beside "38%" on the same
 * track, and 13/37 is 35%, so problems must be counted in.
 *
 * An empty unit is 0%, never NaN.
 */
function percentOf(done: number, total: number): number {
    if (total <= 0) return 0
    return Math.round((done / total) * 100)
}

export function rollUpModule(input: {
    moduleId: string
    lessons: LessonState[]
    problems: ProblemState[]
}): ModuleRollup {
    const lessonsDone = input.lessons.filter((l) => l.completed).length
    const problemsDone = input.problems.filter((p) => p.solved).length
    const done = lessonsDone + problemsDone
    const total = input.lessons.length + input.problems.length

    return {
        moduleId: input.moduleId,
        lessonsDone,
        lessonsTotal: input.lessons.length,
        problemsDone,
        problemsTotal: input.problems.length,
        percent: percentOf(done, total),
    }
}

/**
 * Roll modules into a track. Recomputes from the summed totals rather than
 * averaging module percentages — a 1-item complete module next to a
 * 99-item empty one is 1%, not 50%.
 */
export function rollUpTrack(modules: ModuleRollup[]): TrackRollup {
    const lessonsDone = modules.reduce((n, m) => n + m.lessonsDone, 0)
    const lessonsTotal = modules.reduce((n, m) => n + m.lessonsTotal, 0)
    const problemsDone = modules.reduce((n, m) => n + m.problemsDone, 0)
    const problemsTotal = modules.reduce((n, m) => n + m.problemsTotal, 0)

    return {
        lessonsDone,
        lessonsTotal,
        problemsDone,
        problemsTotal,
        percent: percentOf(
            lessonsDone + problemsDone,
            lessonsTotal + problemsTotal,
        ),
    }
}

/**
 * ADVISORY ONLY. This drives the "Locked until 02" affordance in the UI and
 * nothing else. It must never gate a route, reject a server action, or
 * redirect — the design is explicit that skipping ahead is always allowed.
 *
 * `modules` must be in track order.
 */
export function isModuleUnlocked(
    modules: ModuleRollup[],
    index: number,
): boolean {
    if (index < 0 || index >= modules.length) return false
    if (index === 0) return true
    return modules[index - 1].percent === 100
}

/**
 * Monotonic progress write. Reading backwards up a lesson must not undo
 * progress, so the stored value only ever advances.
 */
export function clampProgressPercent(
    existing: number,
    incoming: number,
): number {
    const bounded = Math.min(100, Math.max(0, Math.round(incoming)))
    return Math.max(existing, bounded)
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
node --import tsx --test scripts/test-curriculum-progress.ts
```

Expected: PASS, 18 tests.

- [ ] **Step 5: Register the test script**

In `package.json`, add next to `"test:tracks"`:

```json
"test:curriculum-progress": "node --import tsx --test scripts/test-curriculum-progress.ts",
```

- [ ] **Step 6: Commit**

```bash
git add lib/curriculum-progress.ts scripts/test-curriculum-progress.ts package.json
git commit -m "feat(curriculum): pure progress rollup maths with unit tests"
```

---

## Task 4: Zod input schemas

**Files:**

- Modify: `lib/admin-validation.ts` (append after `TrackItemAddInput`, around line 628)
- Test: `scripts/test-curriculum-admin-validation.ts`
- Modify: `package.json`

**Interfaces:**

- Consumes: `SlugSchema` from `lib/admin-validation.ts`
- Produces, all from `lib/admin-validation.ts`:
  - `ModuleCreateInput` — `{ name, slug?, description, position? }`
  - `ModuleUpdateInput` — `{ name?, slug?, description? }`, strict (rejects `position`)
  - `ModuleReorderInput` — `{ moduleSlugs: string[] }`
  - `ModuleLessonAddInput` — `{ articleSlug, position? }`
  - `ModuleLessonReorderInput` — `{ articleSlugs: string[] }`
  - `CheckpointAddInput` — `{ problemSlug, position? }`
  - `CheckpointReorderInput` — `{ problemSlugs: string[] }`

- [ ] **Step 1: Write the failing test**

Create `scripts/test-curriculum-admin-validation.ts`:

```ts
// Unit tests for the curriculum Zod schemas. No database, no Prisma.
//
// Run: node --import tsx --test scripts/test-curriculum-admin-validation.ts

import { describe, it } from "node:test"
import assert from "node:assert/strict"
import {
    CheckpointAddInput,
    CheckpointReorderInput,
    ModuleCreateInput,
    ModuleLessonAddInput,
    ModuleLessonReorderInput,
    ModuleReorderInput,
    ModuleUpdateInput,
} from "../lib/admin-validation"

describe("ModuleCreateInput", () => {
    it("accepts a minimal module", () => {
        const r = ModuleCreateInput.safeParse({
            name: "Window functions",
            description: "Frames, partitions, and the ranking family.",
        })
        assert.equal(r.success, true)
    })

    it("accepts an explicit slug and position", () => {
        const r = ModuleCreateInput.safeParse({
            name: "Window functions",
            slug: "window-functions",
            description: "d",
            position: 3,
        })
        assert.equal(r.success, true)
        assert.equal(r.data?.position, 3)
    })

    it("rejects a slug with uppercase or spaces", () => {
        assert.equal(
            ModuleCreateInput.safeParse({
                name: "n",
                slug: "Window Functions",
                description: "d",
            }).success,
            false,
        )
    })

    it("rejects an empty description", () => {
        assert.equal(
            ModuleCreateInput.safeParse({ name: "n", description: "" }).success,
            false,
        )
    })

    it("rejects a negative position", () => {
        assert.equal(
            ModuleCreateInput.safeParse({
                name: "n",
                description: "d",
                position: -1,
            }).success,
            false,
        )
    })
})

describe("ModuleUpdateInput", () => {
    it("accepts a partial update", () => {
        const r = ModuleUpdateInput.safeParse({ name: "Renamed" })
        assert.equal(r.success, true)
    })

    it("REJECTS position — positions move only through reorder", () => {
        const r = ModuleUpdateInput.safeParse({ name: "n", position: 2 })
        assert.equal(r.success, false)
    })

    it("rejects any other unknown key", () => {
        assert.equal(
            ModuleUpdateInput.safeParse({ trackId: "abc" }).success,
            false,
        )
    })
})

describe("ModuleReorderInput", () => {
    it("accepts a list of slugs", () => {
        const r = ModuleReorderInput.safeParse({
            moduleSlugs: ["foundations", "joins"],
        })
        assert.equal(r.success, true)
    })

    it("rejects an empty list", () => {
        assert.equal(
            ModuleReorderInput.safeParse({ moduleSlugs: [] }).success,
            false,
        )
    })

    it("rejects a non-slug entry", () => {
        assert.equal(
            ModuleReorderInput.safeParse({ moduleSlugs: ["Not A Slug"] })
                .success,
            false,
        )
    })
})

describe("attach inputs", () => {
    it("ModuleLessonAddInput accepts an articleSlug", () => {
        assert.equal(
            ModuleLessonAddInput.safeParse({ articleSlug: "null-is-not-a-value" })
                .success,
            true,
        )
    })

    it("ModuleLessonAddInput rejects a missing articleSlug", () => {
        assert.equal(ModuleLessonAddInput.safeParse({}).success, false)
    })

    it("CheckpointAddInput accepts a problemSlug and position", () => {
        const r = CheckpointAddInput.safeParse({
            problemSlug: "second-highest-salary-per-department",
            position: 0,
        })
        assert.equal(r.success, true)
    })

    it("CheckpointAddInput rejects a missing problemSlug", () => {
        assert.equal(CheckpointAddInput.safeParse({}).success, false)
    })
})

describe("reorder inputs", () => {
    it("ModuleLessonReorderInput accepts article slugs", () => {
        assert.equal(
            ModuleLessonReorderInput.safeParse({ articleSlugs: ["a", "b"] })
                .success,
            true,
        )
    })

    it("CheckpointReorderInput accepts problem slugs", () => {
        assert.equal(
            CheckpointReorderInput.safeParse({ problemSlugs: ["a", "b"] })
                .success,
            true,
        )
    })

    it("CheckpointReorderInput rejects an empty list", () => {
        assert.equal(
            CheckpointReorderInput.safeParse({ problemSlugs: [] }).success,
            false,
        )
    })
})
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
node --import tsx --test scripts/test-curriculum-admin-validation.ts
```

Expected: FAIL — the named exports don't exist.

- [ ] **Step 3: Add the schemas**

Append to `lib/admin-validation.ts` immediately after `TrackItemAddInput`:

```ts
// ---------------------------------------------------------------------------
// Curriculum spine — modules, lessons, checkpoints.
//
// Positions are NEVER accepted on update paths. A module's position moves
// only through its track's reorder endpoint, inside a transaction; the same
// rule applies to lesson and checkpoint positions.
// ---------------------------------------------------------------------------

export const ModuleCreateInput = z.object({
    name: z.string().min(1).max(120),
    slug: SlugSchema.optional(),
    description: z.string().min(1).max(20_000),
    position: z.coerce.number().int().min(0).optional(),
})

/**
 * Strict on purpose: a caller that sends `position` gets a 400 rather than
 * having it silently stripped, so the "reorder only" rule is discoverable.
 */
export const ModuleUpdateInput = z
    .object({
        name: z.string().min(1).max(120).optional(),
        slug: SlugSchema.optional(),
        description: z.string().min(1).max(20_000).optional(),
    })
    .strict()

export const ModuleReorderInput = z.object({
    moduleSlugs: z.array(SlugSchema).min(1).max(200),
})

export const ModuleLessonAddInput = z.object({
    articleSlug: SlugSchema,
    position: z.coerce.number().int().min(0).optional(),
})

export const ModuleLessonReorderInput = z.object({
    articleSlugs: z.array(SlugSchema).min(1).max(200),
})

export const CheckpointAddInput = z.object({
    problemSlug: SlugSchema,
    position: z.coerce.number().int().min(0).optional(),
})

export const CheckpointReorderInput = z.object({
    problemSlugs: z.array(SlugSchema).min(1).max(200),
})
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
node --import tsx --test scripts/test-curriculum-admin-validation.ts
```

Expected: PASS, 17 tests.

- [ ] **Step 5: Verify the MCP bundle isolation still holds**

```bash
npm run check:mcp-bundle-isolation
```

Expected: PASS. This is the guard that `lib/admin-validation.ts` stayed Prisma-free.

- [ ] **Step 6: Register the test script**

In `package.json`:

```json
"test:curriculum-admin-validation": "node --import tsx --test scripts/test-curriculum-admin-validation.ts",
```

- [ ] **Step 7: Commit**

```bash
git add lib/admin-validation.ts scripts/test-curriculum-admin-validation.ts package.json
git commit -m "feat(curriculum): zod input schemas for modules, lessons, checkpoints"
```

---

## Task 5: Module mutation helpers

Mirrors `lib/admin-tracks.ts` exactly — including the two-pass negative-then-positive reorder that dodges the `@@unique([trackId, position])` constraint.

**Files:**

- Create: `lib/admin-curriculum.ts`
- Test: `scripts/test-curriculum-admin.ts`
- Modify: `package.json`

**Interfaces:**

- Consumes: `prisma` from `lib/prisma.ts`; `slugify` from `lib/admin-validation.ts`
- Produces, from `lib/admin-curriculum.ts`:
  - `type CurriculumMutationResult<T = void> = (T extends void ? { ok: true } : { ok: true; data: T }) | { ok: false; status: number; error: string }`
  - `createModule(trackSlug: string, input: { name: string; slug?: string; description: string; position?: number }): Promise<CurriculumMutationResult<{ id: string; slug: string }>>`
  - `updateModule(trackSlug: string, moduleSlug: string, updates: { name?: string; slug?: string; description?: string }): Promise<CurriculumMutationResult<{ id: string; slug: string }>>`
  - `deleteModule(trackSlug: string, moduleSlug: string): Promise<CurriculumMutationResult>`
  - `reorderModules(trackSlug: string, moduleSlugs: string[]): Promise<CurriculumMutationResult>`

- [ ] **Step 1: Write the failing test**

Create `scripts/test-curriculum-admin.ts`:

```ts
// Integration tests for curriculum module mutations.
// Runs against the local dev DB; seeds with a unique prefix and cleans up.
//
// Run: DATABASE_URL='postgresql://anchitgupta@localhost:5432/datalearn' \
//      node --import tsx --test scripts/test-curriculum-admin.ts

import "dotenv/config"
import { after, before, beforeEach, describe, it } from "node:test"
import assert from "node:assert/strict"
import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import pg from "pg"
import {
    createModule,
    deleteModule,
    reorderModules,
    updateModule,
} from "../lib/admin-curriculum"

const PREFIX = "curriculumtest-"
const TRACK_SLUG = `${PREFIX}track`

let pool: pg.Pool
let prisma: PrismaClient
let trackId: string

async function cleanup() {
    await prisma.module.deleteMany({ where: { track: { slug: TRACK_SLUG } } })
    await prisma.track.deleteMany({ where: { slug: { startsWith: PREFIX } } })
}

before(async () => {
    if (!process.env.DATABASE_URL) {
        throw new Error("DATABASE_URL is required for curriculum tests")
    }
    pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })
    prisma = new PrismaClient({ adapter: new PrismaPg(pool) })
    await cleanup()
})

beforeEach(async () => {
    await prisma.module.deleteMany({ where: { track: { slug: TRACK_SLUG } } })
    await prisma.track.deleteMany({ where: { slug: TRACK_SLUG } })
    const track = await prisma.track.create({
        data: {
            slug: TRACK_SLUG,
            name: `${PREFIX}Track`,
            summary: "s",
            description: "d",
        },
    })
    trackId = track.id
})

after(async () => {
    await cleanup()
    await prisma.$disconnect()
    await pool.end()
})

async function slugsInOrder(): Promise<string[]> {
    const rows = await prisma.module.findMany({
        where: { trackId },
        orderBy: { position: "asc" },
        select: { slug: true },
    })
    return rows.map((r) => r.slug)
}

describe("createModule", () => {
    it("appends when no position is given", async () => {
        await createModule(TRACK_SLUG, { name: "Foundations", description: "d" })
        await createModule(TRACK_SLUG, { name: "Joins", description: "d" })
        assert.deepEqual(await slugsInOrder(), ["foundations", "joins"])
    })

    it("derives the slug from the name", async () => {
        const r = await createModule(TRACK_SLUG, {
            name: "Window Functions",
            description: "d",
        })
        assert.equal(r.ok, true)
        assert.equal(r.ok && r.data.slug, "window-functions")
    })

    it("inserts at an explicit position and shifts the rest down", async () => {
        await createModule(TRACK_SLUG, { name: "A", description: "d" })
        await createModule(TRACK_SLUG, { name: "C", description: "d" })
        await createModule(TRACK_SLUG, {
            name: "B",
            description: "d",
            position: 1,
        })
        assert.deepEqual(await slugsInOrder(), ["a", "b", "c"])
    })

    it("404s for an unknown track", async () => {
        const r = await createModule("no-such-track", {
            name: "A",
            description: "d",
        })
        assert.equal(r.ok, false)
        assert.equal(!r.ok && r.status, 404)
    })

    it("409s on a duplicate slug within the track", async () => {
        await createModule(TRACK_SLUG, { name: "Joins", description: "d" })
        const r = await createModule(TRACK_SLUG, { name: "Joins", description: "d" })
        assert.equal(r.ok, false)
        assert.equal(!r.ok && r.status, 409)
    })
})

describe("updateModule", () => {
    it("renames without touching position", async () => {
        await createModule(TRACK_SLUG, { name: "A", description: "d" })
        await createModule(TRACK_SLUG, { name: "B", description: "d" })
        const r = await updateModule(TRACK_SLUG, "a", { name: "Alpha" })
        assert.equal(r.ok, true)
        assert.deepEqual(await slugsInOrder(), ["a", "b"])
        const row = await prisma.module.findFirst({ where: { trackId, slug: "a" } })
        assert.equal(row?.name, "Alpha")
    })

    it("changes the slug when asked", async () => {
        await createModule(TRACK_SLUG, { name: "A", description: "d" })
        const r = await updateModule(TRACK_SLUG, "a", { slug: "alpha" })
        assert.equal(r.ok, true)
        assert.deepEqual(await slugsInOrder(), ["alpha"])
    })

    it("404s for an unknown module", async () => {
        const r = await updateModule(TRACK_SLUG, "nope", { name: "x" })
        assert.equal(r.ok, false)
        assert.equal(!r.ok && r.status, 404)
    })
})

describe("deleteModule", () => {
    it("removes the module and closes the position gap", async () => {
        await createModule(TRACK_SLUG, { name: "A", description: "d" })
        await createModule(TRACK_SLUG, { name: "B", description: "d" })
        await createModule(TRACK_SLUG, { name: "C", description: "d" })
        const r = await deleteModule(TRACK_SLUG, "b")
        assert.equal(r.ok, true)
        assert.deepEqual(await slugsInOrder(), ["a", "c"])
        const rows = await prisma.module.findMany({
            where: { trackId },
            orderBy: { position: "asc" },
            select: { position: true },
        })
        assert.deepEqual(rows.map((r) => r.position), [0, 1])
    })

    it("404s for an unknown module", async () => {
        const r = await deleteModule(TRACK_SLUG, "nope")
        assert.equal(r.ok, false)
        assert.equal(!r.ok && r.status, 404)
    })
})

describe("reorderModules", () => {
    it("applies the requested order", async () => {
        await createModule(TRACK_SLUG, { name: "A", description: "d" })
        await createModule(TRACK_SLUG, { name: "B", description: "d" })
        await createModule(TRACK_SLUG, { name: "C", description: "d" })
        const r = await reorderModules(TRACK_SLUG, ["c", "a", "b"])
        assert.equal(r.ok, true)
        assert.deepEqual(await slugsInOrder(), ["c", "a", "b"])
    })

    it("400s when the payload omits a module", async () => {
        await createModule(TRACK_SLUG, { name: "A", description: "d" })
        await createModule(TRACK_SLUG, { name: "B", description: "d" })
        const r = await reorderModules(TRACK_SLUG, ["a"])
        assert.equal(r.ok, false)
        assert.equal(!r.ok && r.status, 400)
    })

    it("400s on a duplicate entry", async () => {
        await createModule(TRACK_SLUG, { name: "A", description: "d" })
        await createModule(TRACK_SLUG, { name: "B", description: "d" })
        const r = await reorderModules(TRACK_SLUG, ["a", "a"])
        assert.equal(r.ok, false)
        assert.equal(!r.ok && r.status, 400)
    })

    it("does not change Track.status", async () => {
        await createModule(TRACK_SLUG, { name: "A", description: "d" })
        await reorderModules(TRACK_SLUG, ["a"])
        const track = await prisma.track.findUnique({ where: { slug: TRACK_SLUG } })
        assert.equal(track?.status, "DRAFT")
    })
})
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
node --import tsx --test scripts/test-curriculum-admin.ts
```

Expected: FAIL — `Cannot find module '../lib/admin-curriculum'`.

- [ ] **Step 3: Write the implementation**

Create `lib/admin-curriculum.ts`:

```ts
import { prisma } from "@/lib/prisma"
import { slugify } from "@/lib/admin-validation"

export type CurriculumMutationResult<T = void> =
    | (T extends void ? { ok: true } : { ok: true; data: T })
    | { ok: false; status: number; error: string }

function isPrismaCode(error: unknown, code: string): boolean {
    return (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === code
    )
}

function setsEqual(left: Set<string>, right: Set<string>): boolean {
    if (left.size !== right.size) return false
    for (const value of left) {
        if (!right.has(value)) return false
    }
    return true
}

async function findTrackId(trackSlug: string): Promise<string | null> {
    const track = await prisma.track.findUnique({
        where: { slug: trackSlug },
        select: { id: true },
    })
    return track?.id ?? null
}

/**
 * Renumber `keys` to positions 0..n-1 via `update`.
 *
 * Two passes: park everything at a negative position first, then assign the
 * real ones. A single forward pass would transiently collide with the unique
 * (parent, position) constraint. Callers must run this inside a transaction.
 *
 * The `update` callback exists because the three position-bearing models have
 * different composite-key shapes — Module keys on `id`, ModuleLesson on
 * `moduleId_articleId`, LessonCheckpoint on `articleId_problemId`.
 */
async function renumber(
    keys: string[],
    update: (key: string, position: number) => Promise<unknown>,
): Promise<void> {
    for (let i = 0; i < keys.length; i++) await update(keys[i], -i - 1)
    for (let i = 0; i < keys.length; i++) await update(keys[i], i)
}

export async function createModule(
    trackSlug: string,
    input: {
        name: string
        slug?: string
        description: string
        position?: number
    },
): Promise<CurriculumMutationResult<{ id: string; slug: string }>> {
    const trackId = await findTrackId(trackSlug)
    if (!trackId) return { ok: false, status: 404, error: "Track not found." }

    const slug = input.slug ?? slugify(input.name)

    try {
        const created = await prisma.$transaction(async (tx) => {
            const current = await tx.module.findMany({
                where: { trackId },
                orderBy: { position: "asc" },
                select: { id: true, position: true },
            })
            const position = Math.min(
                input.position ?? current.length,
                current.length,
            )

            // Shift from the tail inwards so the unique (trackId, position)
            // constraint is never violated mid-loop.
            const toShift = current
                .filter((m) => m.position >= position)
                .sort((a, b) => b.position - a.position)
            for (const m of toShift) {
                await tx.module.update({
                    where: { id: m.id },
                    data: { position: m.position + 1 },
                })
            }

            return tx.module.create({
                data: {
                    trackId,
                    slug,
                    name: input.name,
                    description: input.description,
                    position,
                },
                select: { id: true, slug: true },
            })
        })
        return { ok: true, data: created }
    } catch (error) {
        if (isPrismaCode(error, "P2002")) {
            return {
                ok: false,
                status: 409,
                error: "A module with that slug already exists in this track.",
            }
        }
        console.error("Create module failed:", error)
        return { ok: false, status: 500, error: "Failed to create module." }
    }
}

export async function updateModule(
    trackSlug: string,
    moduleSlug: string,
    updates: { name?: string; slug?: string; description?: string },
): Promise<CurriculumMutationResult<{ id: string; slug: string }>> {
    const trackId = await findTrackId(trackSlug)
    if (!trackId) return { ok: false, status: 404, error: "Track not found." }

    const existing = await prisma.module.findUnique({
        where: { trackId_slug: { trackId, slug: moduleSlug } },
        select: { id: true },
    })
    if (!existing) return { ok: false, status: 404, error: "Module not found." }

    try {
        const updated = await prisma.module.update({
            where: { id: existing.id },
            data: updates,
            select: { id: true, slug: true },
        })
        return { ok: true, data: updated }
    } catch (error) {
        if (isPrismaCode(error, "P2002")) {
            return {
                ok: false,
                status: 409,
                error: "A module with that slug already exists in this track.",
            }
        }
        console.error("Update module failed:", error)
        return { ok: false, status: 500, error: "Failed to update module." }
    }
}

export async function deleteModule(
    trackSlug: string,
    moduleSlug: string,
): Promise<CurriculumMutationResult> {
    const trackId = await findTrackId(trackSlug)
    if (!trackId) return { ok: false, status: 404, error: "Track not found." }

    const modules = await prisma.module.findMany({
        where: { trackId },
        orderBy: { position: "asc" },
        select: { id: true, slug: true },
    })
    const target = modules.find((m) => m.slug === moduleSlug)
    if (!target) return { ok: false, status: 404, error: "Module not found." }

    const remaining = modules.filter((m) => m.id !== target.id).map((m) => m.id)

    await prisma.$transaction(async (tx) => {
        await tx.module.delete({ where: { id: target.id } })
        await renumber(remaining, (id, position) =>
            tx.module.update({ where: { id }, data: { position } }),
        )
    })

    return { ok: true }
}

export async function reorderModules(
    trackSlug: string,
    moduleSlugs: string[],
): Promise<CurriculumMutationResult> {
    const trackId = await findTrackId(trackSlug)
    if (!trackId) return { ok: false, status: 404, error: "Track not found." }

    const modules = await prisma.module.findMany({
        where: { trackId },
        select: { id: true, slug: true },
    })
    const currentSlugs = new Set(modules.map((m) => m.slug))
    const requested = new Set(moduleSlugs)
    if (
        moduleSlugs.length !== requested.size ||
        !setsEqual(currentSlugs, requested)
    ) {
        return {
            ok: false,
            status: 400,
            error: "Reorder payload must include every current module exactly once.",
        }
    }

    const idBySlug = new Map(modules.map((m) => [m.slug, m.id]))
    const orderedIds = moduleSlugs.map((s) => idBySlug.get(s)!)

    await prisma.$transaction(async (tx) =>
        renumber(orderedIds, (id, position) =>
            tx.module.update({ where: { id }, data: { position } }),
        ),
    )

    return { ok: true }
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
node --import tsx --test scripts/test-curriculum-admin.ts
```

Expected: PASS, 15 tests.

- [ ] **Step 5: Register the test script**

In `package.json`:

```json
"test:curriculum-admin": "node --import tsx --test scripts/test-curriculum-admin.ts",
```

- [ ] **Step 6: Commit**

```bash
git add lib/admin-curriculum.ts scripts/test-curriculum-admin.ts package.json
git commit -m "feat(curriculum): module create/update/delete/reorder helpers"
```

---

## Task 6: Lesson and checkpoint mutation helpers

**Files:**

- Modify: `lib/admin-curriculum.ts` (append)
- Modify: `scripts/test-curriculum-admin.ts` (append describe blocks)

**Interfaces:**

- Consumes: `CurriculumMutationResult`, `findTrackId`, `setsEqual`, `isPrismaCode` from Task 5
- Produces, from `lib/admin-curriculum.ts`:
  - `addLessonToModule(trackSlug: string, moduleSlug: string, input: { articleSlug: string; position?: number }): Promise<CurriculumMutationResult<{ articleId: string; position: number }>>`
  - `removeLessonFromModule(trackSlug: string, moduleSlug: string, articleSlug: string): Promise<CurriculumMutationResult>`
  - `reorderModuleLessons(trackSlug: string, moduleSlug: string, articleSlugs: string[]): Promise<CurriculumMutationResult>`
  - `addCheckpoint(articleSlug: string, input: { problemSlug: string; position?: number }): Promise<CurriculumMutationResult<{ problemId: string; position: number }>>`
  - `removeCheckpoint(articleSlug: string, problemSlug: string): Promise<CurriculumMutationResult>`
  - `reorderCheckpoints(articleSlug: string, problemSlugs: string[]): Promise<CurriculumMutationResult>`

- [ ] **Step 1: Write the failing tests**

Append to `scripts/test-curriculum-admin.ts` (and extend the imports at the top to include the six new functions):

```ts
describe("addLessonToModule", () => {
    it("appends lessons in order", async () => {
        await createModule(TRACK_SLUG, { name: "M", description: "d" })
        const a1 = await makeArticle("lesson-one")
        const a2 = await makeArticle("lesson-two")
        await addLessonToModule(TRACK_SLUG, "m", { articleSlug: "lesson-one" })
        await addLessonToModule(TRACK_SLUG, "m", { articleSlug: "lesson-two" })
        assert.deepEqual(await lessonIdsInOrder("m"), [a1, a2])
    })

    it("inserts at an explicit position", async () => {
        await createModule(TRACK_SLUG, { name: "M", description: "d" })
        const a1 = await makeArticle("l-a")
        const a3 = await makeArticle("l-c")
        const a2 = await makeArticle("l-b")
        await addLessonToModule(TRACK_SLUG, "m", { articleSlug: "l-a" })
        await addLessonToModule(TRACK_SLUG, "m", { articleSlug: "l-c" })
        await addLessonToModule(TRACK_SLUG, "m", {
            articleSlug: "l-b",
            position: 1,
        })
        assert.deepEqual(await lessonIdsInOrder("m"), [a1, a2, a3])
    })

    it("404s for an unknown article", async () => {
        await createModule(TRACK_SLUG, { name: "M", description: "d" })
        const r = await addLessonToModule(TRACK_SLUG, "m", {
            articleSlug: "no-such-article",
        })
        assert.equal(r.ok, false)
        assert.equal(!r.ok && r.status, 404)
    })

    it("409s when the lesson is already in the module", async () => {
        await createModule(TRACK_SLUG, { name: "M", description: "d" })
        await makeArticle("dupe")
        await addLessonToModule(TRACK_SLUG, "m", { articleSlug: "dupe" })
        const r = await addLessonToModule(TRACK_SLUG, "m", { articleSlug: "dupe" })
        assert.equal(r.ok, false)
        assert.equal(!r.ok && r.status, 409)
    })

    it("allows the same article in two different modules", async () => {
        await createModule(TRACK_SLUG, { name: "M1", description: "d" })
        await createModule(TRACK_SLUG, { name: "M2", description: "d" })
        await makeArticle("shared")
        const r1 = await addLessonToModule(TRACK_SLUG, "m1", {
            articleSlug: "shared",
        })
        const r2 = await addLessonToModule(TRACK_SLUG, "m2", {
            articleSlug: "shared",
        })
        assert.equal(r1.ok, true)
        assert.equal(r2.ok, true)
    })
})

describe("removeLessonFromModule", () => {
    it("removes and closes the position gap", async () => {
        await createModule(TRACK_SLUG, { name: "M", description: "d" })
        const a1 = await makeArticle("r-a")
        await makeArticle("r-b")
        const a3 = await makeArticle("r-c")
        await addLessonToModule(TRACK_SLUG, "m", { articleSlug: "r-a" })
        await addLessonToModule(TRACK_SLUG, "m", { articleSlug: "r-b" })
        await addLessonToModule(TRACK_SLUG, "m", { articleSlug: "r-c" })
        const r = await removeLessonFromModule(TRACK_SLUG, "m", "r-b")
        assert.equal(r.ok, true)
        assert.deepEqual(await lessonIdsInOrder("m"), [a1, a3])
    })
})

describe("reorderModuleLessons", () => {
    it("applies the requested order", async () => {
        await createModule(TRACK_SLUG, { name: "M", description: "d" })
        const a1 = await makeArticle("o-a")
        const a2 = await makeArticle("o-b")
        await addLessonToModule(TRACK_SLUG, "m", { articleSlug: "o-a" })
        await addLessonToModule(TRACK_SLUG, "m", { articleSlug: "o-b" })
        const r = await reorderModuleLessons(TRACK_SLUG, "m", ["o-b", "o-a"])
        assert.equal(r.ok, true)
        assert.deepEqual(await lessonIdsInOrder("m"), [a2, a1])
    })

    it("400s when the payload omits a lesson", async () => {
        await createModule(TRACK_SLUG, { name: "M", description: "d" })
        await makeArticle("p-a")
        await makeArticle("p-b")
        await addLessonToModule(TRACK_SLUG, "m", { articleSlug: "p-a" })
        await addLessonToModule(TRACK_SLUG, "m", { articleSlug: "p-b" })
        const r = await reorderModuleLessons(TRACK_SLUG, "m", ["p-a"])
        assert.equal(r.ok, false)
        assert.equal(!r.ok && r.status, 400)
    })
})

describe("addCheckpoint", () => {
    it("appends checkpoints in order", async () => {
        await makeArticle("cp-lesson")
        const p1 = await makeProblem("cp-one")
        const p2 = await makeProblem("cp-two")
        await addCheckpoint("cp-lesson", { problemSlug: "cp-one" })
        await addCheckpoint("cp-lesson", { problemSlug: "cp-two" })
        assert.deepEqual(await checkpointIdsInOrder("cp-lesson"), [p1, p2])
    })

    it("409s when the problem already checks another lesson", async () => {
        await makeArticle("cp-l1")
        await makeArticle("cp-l2")
        await makeProblem("cp-shared")
        await addCheckpoint("cp-l1", { problemSlug: "cp-shared" })
        const r = await addCheckpoint("cp-l2", { problemSlug: "cp-shared" })
        assert.equal(r.ok, false)
        assert.equal(!r.ok && r.status, 409)
    })

    it("404s for an unknown problem", async () => {
        await makeArticle("cp-l3")
        const r = await addCheckpoint("cp-l3", { problemSlug: "no-such-problem" })
        assert.equal(r.ok, false)
        assert.equal(!r.ok && r.status, 404)
    })
})

describe("removeCheckpoint / reorderCheckpoints", () => {
    it("removes and closes the gap", async () => {
        await makeArticle("rm-lesson")
        const p1 = await makeProblem("rm-one")
        await makeProblem("rm-two")
        const p3 = await makeProblem("rm-three")
        await addCheckpoint("rm-lesson", { problemSlug: "rm-one" })
        await addCheckpoint("rm-lesson", { problemSlug: "rm-two" })
        await addCheckpoint("rm-lesson", { problemSlug: "rm-three" })
        const r = await removeCheckpoint("rm-lesson", "rm-two")
        assert.equal(r.ok, true)
        assert.deepEqual(await checkpointIdsInOrder("rm-lesson"), [p1, p3])
    })

    it("reorders", async () => {
        await makeArticle("ro-lesson")
        const p1 = await makeProblem("ro-one")
        const p2 = await makeProblem("ro-two")
        await addCheckpoint("ro-lesson", { problemSlug: "ro-one" })
        await addCheckpoint("ro-lesson", { problemSlug: "ro-two" })
        const r = await reorderCheckpoints("ro-lesson", ["ro-two", "ro-one"])
        assert.equal(r.ok, true)
        assert.deepEqual(await checkpointIdsInOrder("ro-lesson"), [p2, p1])
    })
})
```

Add these fixtures and helpers near the top of the same file (after `slugsInOrder`):

```ts
let schemaId: string
let authorId: string
let topicId: string

async function makeArticle(slug: string): Promise<string> {
    const a = await prisma.article.create({
        data: {
            title: slug,
            slug: `${PREFIX}${slug}`,
            content: "body",
            status: "PUBLISHED",
            topicId,
            authorId,
        },
        select: { id: true },
    })
    return a.id
}

async function makeProblem(slug: string): Promise<string> {
    const max = await prisma.sQLProblem.aggregate({ _max: { number: true } })
    const p = await prisma.sQLProblem.create({
        data: {
            number: (max._max.number ?? 0) + 1,
            title: slug,
            slug: `${PREFIX}${slug}`,
            difficulty: "EASY",
            status: "PUBLISHED",
            description: "d",
            schemaDescription: "s",
            schemaId,
            expectedOutput: "[]",
            dialects: ["DUCKDB"],
        },
        select: { id: true },
    })
    return p.id
}

async function lessonIdsInOrder(moduleSlug: string): Promise<string[]> {
    const rows = await prisma.moduleLesson.findMany({
        where: { module: { trackId, slug: moduleSlug } },
        orderBy: { position: "asc" },
        select: { articleId: true },
    })
    return rows.map((r) => r.articleId)
}

async function checkpointIdsInOrder(articleSlug: string): Promise<string[]> {
    const rows = await prisma.lessonCheckpoint.findMany({
        where: { article: { slug: `${PREFIX}${articleSlug}` } },
        orderBy: { position: "asc" },
        select: { problemId: true },
    })
    return rows.map((r) => r.problemId)
}
```

Extend `cleanup()` to remove the new fixtures, and create the shared schema/author/topic in `before()`:

```ts
async function cleanup() {
    await prisma.lessonCheckpoint.deleteMany({
        where: { article: { slug: { startsWith: PREFIX } } },
    })
    await prisma.moduleLesson.deleteMany({
        where: { article: { slug: { startsWith: PREFIX } } },
    })
    await prisma.module.deleteMany({ where: { track: { slug: TRACK_SLUG } } })
    await prisma.track.deleteMany({ where: { slug: { startsWith: PREFIX } } })
    await prisma.article.deleteMany({ where: { slug: { startsWith: PREFIX } } })
    await prisma.sQLProblem.deleteMany({ where: { slug: { startsWith: PREFIX } } })
    await prisma.topic.deleteMany({ where: { slug: { startsWith: PREFIX } } })
    await prisma.sqlSchema.deleteMany({ where: { name: { startsWith: PREFIX } } })
    await prisma.user.deleteMany({ where: { email: { startsWith: PREFIX } } })
}
```

```ts
// inside before(), after the first cleanup():
const schema = await prisma.sqlSchema.create({
    data: { name: `${PREFIX}schema`, sql: "CREATE TABLE t (id INTEGER);" },
})
schemaId = schema.id
const author = await prisma.user.create({
    data: { email: `${PREFIX}author@example.com`, name: "Author" },
})
authorId = author.id
const topic = await prisma.topic.create({
    data: { name: `${PREFIX}Topic`, slug: `${PREFIX}topic` },
})
topicId = topic.id
```

And extend `beforeEach()` to also clear articles, problems and their joins between cases:

```ts
await prisma.lessonCheckpoint.deleteMany({
    where: { article: { slug: { startsWith: PREFIX } } },
})
await prisma.moduleLesson.deleteMany({
    where: { article: { slug: { startsWith: PREFIX } } },
})
await prisma.article.deleteMany({ where: { slug: { startsWith: PREFIX } } })
await prisma.sQLProblem.deleteMany({ where: { slug: { startsWith: PREFIX } } })
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
node --import tsx --test scripts/test-curriculum-admin.ts
```

Expected: FAIL — the six new functions aren't exported.

- [ ] **Step 3: Write the implementation**

Append to `lib/admin-curriculum.ts`:

```ts
async function findModuleId(
    trackSlug: string,
    moduleSlug: string,
): Promise<{ ok: true; id: string } | { ok: false; status: number; error: string }> {
    const trackId = await findTrackId(trackSlug)
    if (!trackId) return { ok: false, status: 404, error: "Track not found." }
    const mod = await prisma.module.findUnique({
        where: { trackId_slug: { trackId, slug: moduleSlug } },
        select: { id: true },
    })
    if (!mod) return { ok: false, status: 404, error: "Module not found." }
    return { ok: true, id: mod.id }
}

async function findArticleId(articleSlug: string): Promise<string | null> {
    const article = await prisma.article.findUnique({
        where: { slug: articleSlug },
        select: { id: true },
    })
    return article?.id ?? null
}

export async function addLessonToModule(
    trackSlug: string,
    moduleSlug: string,
    input: { articleSlug: string; position?: number },
): Promise<CurriculumMutationResult<{ articleId: string; position: number }>> {
    const found = await findModuleId(trackSlug, moduleSlug)
    if (!found.ok) return found
    const moduleId = found.id

    const articleId = await findArticleId(input.articleSlug)
    if (!articleId) return { ok: false, status: 404, error: "Article not found." }

    const existing = await prisma.moduleLesson.findUnique({
        where: { moduleId_articleId: { moduleId, articleId } },
        select: { articleId: true },
    })
    if (existing) {
        return {
            ok: false,
            status: 409,
            error: "That lesson is already in this module.",
        }
    }

    const created = await prisma.$transaction(async (tx) => {
        const current = await tx.moduleLesson.findMany({
            where: { moduleId },
            orderBy: { position: "asc" },
            select: { articleId: true, position: true },
        })
        const position = Math.min(
            input.position ?? current.length,
            current.length,
        )
        const toShift = current
            .filter((l) => l.position >= position)
            .sort((a, b) => b.position - a.position)
        for (const l of toShift) {
            await tx.moduleLesson.update({
                where: {
                    moduleId_articleId: { moduleId, articleId: l.articleId },
                },
                data: { position: l.position + 1 },
            })
        }
        return tx.moduleLesson.create({
            data: { moduleId, articleId, position },
            select: { articleId: true, position: true },
        })
    })

    return { ok: true, data: created }
}

export async function removeLessonFromModule(
    trackSlug: string,
    moduleSlug: string,
    articleSlug: string,
): Promise<CurriculumMutationResult> {
    const found = await findModuleId(trackSlug, moduleSlug)
    if (!found.ok) return found
    const moduleId = found.id

    const articleId = await findArticleId(articleSlug)
    if (!articleId) return { ok: false, status: 404, error: "Article not found." }

    const lessons = await prisma.moduleLesson.findMany({
        where: { moduleId },
        orderBy: { position: "asc" },
        select: { articleId: true },
    })
    if (!lessons.some((l) => l.articleId === articleId)) {
        return { ok: false, status: 404, error: "Lesson not in this module." }
    }
    const remaining = lessons
        .map((l) => l.articleId)
        .filter((id) => id !== articleId)

    await prisma.$transaction(async (tx) => {
        await tx.moduleLesson.delete({
            where: { moduleId_articleId: { moduleId, articleId } },
        })
        await renumber(remaining, (id, position) =>
            tx.moduleLesson.update({
                where: { moduleId_articleId: { moduleId, articleId: id } },
                data: { position },
            }),
        )
    })

    return { ok: true }
}

export async function reorderModuleLessons(
    trackSlug: string,
    moduleSlug: string,
    articleSlugs: string[],
): Promise<CurriculumMutationResult> {
    const found = await findModuleId(trackSlug, moduleSlug)
    if (!found.ok) return found
    const moduleId = found.id

    const lessons = await prisma.moduleLesson.findMany({
        where: { moduleId },
        select: { articleId: true, article: { select: { slug: true } } },
    })
    const currentSlugs = new Set(lessons.map((l) => l.article.slug))
    const requested = new Set(articleSlugs)
    if (
        articleSlugs.length !== requested.size ||
        !setsEqual(currentSlugs, requested)
    ) {
        return {
            ok: false,
            status: 400,
            error: "Reorder payload must include every current lesson exactly once.",
        }
    }

    const idBySlug = new Map(lessons.map((l) => [l.article.slug, l.articleId]))
    const ordered = articleSlugs.map((s) => idBySlug.get(s)!)

    await prisma.$transaction(async (tx) =>
        renumber(ordered, (id, position) =>
            tx.moduleLesson.update({
                where: { moduleId_articleId: { moduleId, articleId: id } },
                data: { position },
            }),
        ),
    )

    return { ok: true }
}

export async function addCheckpoint(
    articleSlug: string,
    input: { problemSlug: string; position?: number },
): Promise<CurriculumMutationResult<{ problemId: string; position: number }>> {
    const articleId = await findArticleId(articleSlug)
    if (!articleId) return { ok: false, status: 404, error: "Lesson not found." }

    const problem = await prisma.sQLProblem.findUnique({
        where: { slug: input.problemSlug },
        select: { id: true },
    })
    if (!problem) return { ok: false, status: 404, error: "Problem not found." }

    // A problem checks exactly one lesson — @@unique([problemId]).
    const claimed = await prisma.lessonCheckpoint.findUnique({
        where: { problemId: problem.id },
        select: { articleId: true },
    })
    if (claimed) {
        return {
            ok: false,
            status: 409,
            error:
                claimed.articleId === articleId
                    ? "That problem is already a checkpoint on this lesson."
                    : "That problem is already a checkpoint on another lesson.",
        }
    }

    const created = await prisma.$transaction(async (tx) => {
        const current = await tx.lessonCheckpoint.findMany({
            where: { articleId },
            orderBy: { position: "asc" },
            select: { problemId: true, position: true },
        })
        const position = Math.min(
            input.position ?? current.length,
            current.length,
        )
        const toShift = current
            .filter((c) => c.position >= position)
            .sort((a, b) => b.position - a.position)
        for (const c of toShift) {
            await tx.lessonCheckpoint.update({
                where: {
                    articleId_problemId: { articleId, problemId: c.problemId },
                },
                data: { position: c.position + 1 },
            })
        }
        return tx.lessonCheckpoint.create({
            data: { articleId, problemId: problem.id, position },
            select: { problemId: true, position: true },
        })
    })

    return { ok: true, data: created }
}

export async function removeCheckpoint(
    articleSlug: string,
    problemSlug: string,
): Promise<CurriculumMutationResult> {
    const articleId = await findArticleId(articleSlug)
    if (!articleId) return { ok: false, status: 404, error: "Lesson not found." }

    const checkpoints = await prisma.lessonCheckpoint.findMany({
        where: { articleId },
        orderBy: { position: "asc" },
        select: { problemId: true, problem: { select: { slug: true } } },
    })
    const target = checkpoints.find((c) => c.problem.slug === problemSlug)
    if (!target) {
        return { ok: false, status: 404, error: "Checkpoint not found." }
    }
    const remaining = checkpoints
        .filter((c) => c.problemId !== target.problemId)
        .map((c) => c.problemId)

    await prisma.$transaction(async (tx) => {
        await tx.lessonCheckpoint.delete({
            where: {
                articleId_problemId: { articleId, problemId: target.problemId },
            },
        })
        await renumber(remaining, (id, position) =>
            tx.lessonCheckpoint.update({
                where: { articleId_problemId: { articleId, problemId: id } },
                data: { position },
            }),
        )
    })

    return { ok: true }
}

export async function reorderCheckpoints(
    articleSlug: string,
    problemSlugs: string[],
): Promise<CurriculumMutationResult> {
    const articleId = await findArticleId(articleSlug)
    if (!articleId) return { ok: false, status: 404, error: "Lesson not found." }

    const checkpoints = await prisma.lessonCheckpoint.findMany({
        where: { articleId },
        select: { problemId: true, problem: { select: { slug: true } } },
    })
    const currentSlugs = new Set(checkpoints.map((c) => c.problem.slug))
    const requested = new Set(problemSlugs)
    if (
        problemSlugs.length !== requested.size ||
        !setsEqual(currentSlugs, requested)
    ) {
        return {
            ok: false,
            status: 400,
            error: "Reorder payload must include every current checkpoint exactly once.",
        }
    }

    const idBySlug = new Map(
        checkpoints.map((c) => [c.problem.slug, c.problemId]),
    )
    const ordered = problemSlugs.map((s) => idBySlug.get(s)!)

    await prisma.$transaction(async (tx) =>
        renumber(ordered, (id, position) =>
            tx.lessonCheckpoint.update({
                where: { articleId_problemId: { articleId, problemId: id } },
                data: { position },
            }),
        ),
    )

    return { ok: true }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
node --import tsx --test scripts/test-curriculum-admin.ts
```

Expected: PASS, 27 tests.

- [ ] **Step 5: Commit**

```bash
git add lib/admin-curriculum.ts scripts/test-curriculum-admin.ts
git commit -m "feat(curriculum): lesson and checkpoint attach/detach/reorder helpers"
```

---

## Task 7: Admin REST routes — modules

Thin translators from `CurriculumMutationResult` to HTTP, copying `app/api/admin/tracks/[slug]/reorder/route.ts` exactly.

**Files:**

- Create: `app/api/admin/tracks/[slug]/modules/route.ts`
- Create: `app/api/admin/tracks/[slug]/modules/reorder/route.ts`
- Create: `app/api/admin/tracks/[slug]/modules/[moduleSlug]/route.ts`

**Interfaces:**

- Consumes: `createModule`, `updateModule`, `deleteModule`, `reorderModules` (Task 5); `ModuleCreateInput`, `ModuleUpdateInput`, `ModuleReorderInput` (Task 4); `withAdmin` from `lib/api-auth.ts`
- Produces: the four module endpoints. Success bodies are `{ data: ... }` for reads/creates and `{ ok: true }` for reorder/delete — the MCP client's `request()` unwraps `data`, `requestRaw()` returns the body verbatim.

- [ ] **Step 1: Create the collection route**

Create `app/api/admin/tracks/[slug]/modules/route.ts`:

```ts
import { NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { withAdmin } from "@/lib/api-auth"
import { createModule } from "@/lib/admin-curriculum"
import { ModuleCreateInput } from "@/lib/admin-validation"

type Ctx = { params: Promise<{ slug: string }> }

export const GET = withAdmin(async (_req, _principal, ctx: Ctx) => {
    const { slug } = await ctx.params
    const track = await prisma.track.findUnique({
        where: { slug },
        select: { id: true },
    })
    if (!track) {
        return NextResponse.json({ error: "Track not found." }, { status: 404 })
    }
    const modules = await prisma.module.findMany({
        where: { trackId: track.id },
        orderBy: { position: "asc" },
        select: {
            id: true,
            slug: true,
            name: true,
            description: true,
            position: true,
            _count: { select: { lessons: true } },
        },
    })
    return NextResponse.json({ data: modules })
})

export const POST = withAdmin(async (req, _principal, ctx: Ctx) => {
    const { slug } = await ctx.params
    let body: unknown
    try {
        body = await req.json()
    } catch {
        return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 })
    }

    const parsed = ModuleCreateInput.safeParse(body)
    if (!parsed.success) {
        return NextResponse.json(
            { error: "Validation failed", details: z.treeifyError(parsed.error) },
            { status: 400 },
        )
    }

    const result = await createModule(slug, parsed.data)
    if (!result.ok) {
        return NextResponse.json({ error: result.error }, { status: result.status })
    }
    return NextResponse.json({ data: result.data }, { status: 201 })
})
```

- [ ] **Step 2: Create the reorder route**

Create `app/api/admin/tracks/[slug]/modules/reorder/route.ts`:

```ts
import { NextResponse } from "next/server"
import { z } from "zod"
import { withAdmin } from "@/lib/api-auth"
import { reorderModules } from "@/lib/admin-curriculum"
import { ModuleReorderInput } from "@/lib/admin-validation"

type Ctx = { params: Promise<{ slug: string }> }

export const POST = withAdmin(async (req, _principal, ctx: Ctx) => {
    const { slug } = await ctx.params
    let body: unknown
    try {
        body = await req.json()
    } catch {
        return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 })
    }

    const parsed = ModuleReorderInput.safeParse(body)
    if (!parsed.success) {
        return NextResponse.json(
            { error: "Validation failed", details: z.treeifyError(parsed.error) },
            { status: 400 },
        )
    }

    const result = await reorderModules(slug, parsed.data.moduleSlugs)
    if (!result.ok) {
        return NextResponse.json({ error: result.error }, { status: result.status })
    }
    return NextResponse.json({ ok: true })
})
```

- [ ] **Step 3: Create the item route**

Create `app/api/admin/tracks/[slug]/modules/[moduleSlug]/route.ts`:

```ts
import { NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { withAdmin } from "@/lib/api-auth"
import { deleteModule, updateModule } from "@/lib/admin-curriculum"
import { ModuleUpdateInput } from "@/lib/admin-validation"

type Ctx = { params: Promise<{ slug: string; moduleSlug: string }> }

export const GET = withAdmin(async (_req, _principal, ctx: Ctx) => {
    const { slug, moduleSlug } = await ctx.params
    const mod = await prisma.module.findFirst({
        where: { slug: moduleSlug, track: { slug } },
        select: {
            id: true,
            slug: true,
            name: true,
            description: true,
            position: true,
            lessons: {
                orderBy: { position: "asc" },
                select: {
                    position: true,
                    article: {
                        select: {
                            id: true,
                            slug: true,
                            title: true,
                            status: true,
                            readingMinutes: true,
                        },
                    },
                },
            },
        },
    })
    if (!mod) {
        return NextResponse.json({ error: "Module not found." }, { status: 404 })
    }
    return NextResponse.json({ data: mod })
})

export const PATCH = withAdmin(async (req, _principal, ctx: Ctx) => {
    const { slug, moduleSlug } = await ctx.params
    let body: unknown
    try {
        body = await req.json()
    } catch {
        return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 })
    }

    // ModuleUpdateInput is strict, so a `position` key 400s here rather than
    // being silently ignored. Positions move only through /reorder.
    const parsed = ModuleUpdateInput.safeParse(body)
    if (!parsed.success) {
        return NextResponse.json(
            { error: "Validation failed", details: z.treeifyError(parsed.error) },
            { status: 400 },
        )
    }

    const result = await updateModule(slug, moduleSlug, parsed.data)
    if (!result.ok) {
        return NextResponse.json({ error: result.error }, { status: result.status })
    }
    return NextResponse.json({ data: result.data })
})

export const DELETE = withAdmin(async (_req, _principal, ctx: Ctx) => {
    const { slug, moduleSlug } = await ctx.params
    const result = await deleteModule(slug, moduleSlug)
    if (!result.ok) {
        return NextResponse.json({ error: result.error }, { status: result.status })
    }
    return NextResponse.json({ ok: true, deleted: true })
})
```

- [ ] **Step 4: Verify against a running dev server**

Start `npm run dev` in one terminal. In another, using a local admin user id (the `x-test-user-id` header path is dev-only and exists precisely for this):

Write the helper, run it, then capture its output — in that order. Collapsing the
heredoc into the command substitution does not work.

```bash
cat > ./.dl-admin.mjs <<'EOF'
import dotenv from "dotenv"; dotenv.config({ path: ".env" })
const { PrismaClient } = await import("@prisma/client")
const { PrismaPg } = await import("@prisma/adapter-pg")
const { Pool } = await import("pg")
const p = new PrismaClient({ adapter: new PrismaPg(new Pool({ connectionString: process.env.DATABASE_URL })) })
const u = await p.user.findFirst({ where: { role: "ADMIN" }, select: { id: true } })
console.log(u?.id ?? "")
await p.$disconnect()
EOF
ADMIN_ID=$(node ./.dl-admin.mjs | tail -1)
rm -f ./.dl-admin.mjs
echo "admin: $ADMIN_ID"   # must be non-empty; if blank, promote a local user to ADMIN first
```

Then create a track to hang modules off (skip if one already exists):

```bash
curl -s -X POST http://localhost:3000/api/admin/tracks \
  -H "content-type: application/json" -H "origin: http://localhost:3000" \
  -H "x-test-user-id: $ADMIN_ID" \
  -d '{"name":"Analyst interview prep","summary":"s","description":"d"}' | head -5

curl -s -X POST http://localhost:3000/api/admin/tracks/analyst-interview-prep/modules \
  -H "content-type: application/json" -H "origin: http://localhost:3000" \
  -H "x-test-user-id: $ADMIN_ID" \
  -d '{"name":"Foundations","description":"Evaluation order, NULLs, sorting."}'
```

Expected: `201` with `{"data":{"id":"...","slug":"foundations"}}`.

Then confirm the strict PATCH:

```bash
curl -s -o /dev/null -w "%{http_code}\n" -X PATCH \
  http://localhost:3000/api/admin/tracks/analyst-interview-prep/modules/foundations \
  -H "content-type: application/json" -H "origin: http://localhost:3000" \
  -H "x-test-user-id: $ADMIN_ID" -d '{"position":2}'
```

Expected: `400`.

- [ ] **Step 5: Typecheck**

```bash
npx tsc --noEmit
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add "app/api/admin/tracks/[slug]/modules"
git commit -m "feat(api): admin module routes under /api/admin/tracks/[slug]/modules"
```

---

## Task 8: Admin REST routes — lessons and checkpoints

**Files:**

- Create: `app/api/admin/tracks/[slug]/modules/[moduleSlug]/lessons/route.ts`
- Create: `app/api/admin/tracks/[slug]/modules/[moduleSlug]/lessons/reorder/route.ts`
- Create: `app/api/admin/tracks/[slug]/modules/[moduleSlug]/lessons/[articleSlug]/route.ts`
- Create: `app/api/admin/lessons/[articleSlug]/checkpoints/route.ts`
- Create: `app/api/admin/lessons/[articleSlug]/checkpoints/reorder/route.ts`
- Create: `app/api/admin/lessons/[articleSlug]/checkpoints/[problemSlug]/route.ts`

**Interfaces:**

- Consumes: the six helpers from Task 6; `ModuleLessonAddInput`, `ModuleLessonReorderInput`, `CheckpointAddInput`, `CheckpointReorderInput` (Task 4)
- Produces: the six endpoints. Checkpoints hang off the **article**, not the module path, because `LessonCheckpoint` is keyed on `articleId` and a lesson may sit in several modules.

- [ ] **Step 1: Create the lesson attach + reorder + detach routes**

`app/api/admin/tracks/[slug]/modules/[moduleSlug]/lessons/route.ts`:

```ts
import { NextResponse } from "next/server"
import { z } from "zod"
import { withAdmin } from "@/lib/api-auth"
import { addLessonToModule } from "@/lib/admin-curriculum"
import { ModuleLessonAddInput } from "@/lib/admin-validation"

type Ctx = { params: Promise<{ slug: string; moduleSlug: string }> }

export const POST = withAdmin(async (req, _principal, ctx: Ctx) => {
    const { slug, moduleSlug } = await ctx.params
    let body: unknown
    try {
        body = await req.json()
    } catch {
        return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 })
    }

    const parsed = ModuleLessonAddInput.safeParse(body)
    if (!parsed.success) {
        return NextResponse.json(
            { error: "Validation failed", details: z.treeifyError(parsed.error) },
            { status: 400 },
        )
    }

    const result = await addLessonToModule(slug, moduleSlug, parsed.data)
    if (!result.ok) {
        return NextResponse.json({ error: result.error }, { status: result.status })
    }
    return NextResponse.json({ data: result.data }, { status: 201 })
})
```

`.../lessons/reorder/route.ts`:

```ts
import { NextResponse } from "next/server"
import { z } from "zod"
import { withAdmin } from "@/lib/api-auth"
import { reorderModuleLessons } from "@/lib/admin-curriculum"
import { ModuleLessonReorderInput } from "@/lib/admin-validation"

type Ctx = { params: Promise<{ slug: string; moduleSlug: string }> }

export const POST = withAdmin(async (req, _principal, ctx: Ctx) => {
    const { slug, moduleSlug } = await ctx.params
    let body: unknown
    try {
        body = await req.json()
    } catch {
        return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 })
    }

    const parsed = ModuleLessonReorderInput.safeParse(body)
    if (!parsed.success) {
        return NextResponse.json(
            { error: "Validation failed", details: z.treeifyError(parsed.error) },
            { status: 400 },
        )
    }

    const result = await reorderModuleLessons(
        slug,
        moduleSlug,
        parsed.data.articleSlugs,
    )
    if (!result.ok) {
        return NextResponse.json({ error: result.error }, { status: result.status })
    }
    return NextResponse.json({ ok: true })
})
```

`.../lessons/[articleSlug]/route.ts`:

```ts
import { NextResponse } from "next/server"
import { withAdmin } from "@/lib/api-auth"
import { removeLessonFromModule } from "@/lib/admin-curriculum"

type Ctx = {
    params: Promise<{ slug: string; moduleSlug: string; articleSlug: string }>
}

export const DELETE = withAdmin(async (_req, _principal, ctx: Ctx) => {
    const { slug, moduleSlug, articleSlug } = await ctx.params
    const result = await removeLessonFromModule(slug, moduleSlug, articleSlug)
    if (!result.ok) {
        return NextResponse.json({ error: result.error }, { status: result.status })
    }
    return NextResponse.json({ ok: true, removed: true })
})
```

- [ ] **Step 2: Create the checkpoint routes**

`app/api/admin/lessons/[articleSlug]/checkpoints/route.ts`:

```ts
import { NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { withAdmin } from "@/lib/api-auth"
import { addCheckpoint } from "@/lib/admin-curriculum"
import { CheckpointAddInput } from "@/lib/admin-validation"

type Ctx = { params: Promise<{ articleSlug: string }> }

export const GET = withAdmin(async (_req, _principal, ctx: Ctx) => {
    const { articleSlug } = await ctx.params
    const article = await prisma.article.findUnique({
        where: { slug: articleSlug },
        select: { id: true },
    })
    if (!article) {
        return NextResponse.json({ error: "Lesson not found." }, { status: 404 })
    }
    const checkpoints = await prisma.lessonCheckpoint.findMany({
        where: { articleId: article.id },
        orderBy: { position: "asc" },
        select: {
            position: true,
            problem: {
                select: {
                    id: true,
                    number: true,
                    slug: true,
                    title: true,
                    difficulty: true,
                    status: true,
                },
            },
        },
    })
    return NextResponse.json({ data: checkpoints })
})

export const POST = withAdmin(async (req, _principal, ctx: Ctx) => {
    const { articleSlug } = await ctx.params
    let body: unknown
    try {
        body = await req.json()
    } catch {
        return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 })
    }

    const parsed = CheckpointAddInput.safeParse(body)
    if (!parsed.success) {
        return NextResponse.json(
            { error: "Validation failed", details: z.treeifyError(parsed.error) },
            { status: 400 },
        )
    }

    const result = await addCheckpoint(articleSlug, parsed.data)
    if (!result.ok) {
        return NextResponse.json({ error: result.error }, { status: result.status })
    }
    return NextResponse.json({ data: result.data }, { status: 201 })
})
```

`.../checkpoints/reorder/route.ts`:

```ts
import { NextResponse } from "next/server"
import { z } from "zod"
import { withAdmin } from "@/lib/api-auth"
import { reorderCheckpoints } from "@/lib/admin-curriculum"
import { CheckpointReorderInput } from "@/lib/admin-validation"

type Ctx = { params: Promise<{ articleSlug: string }> }

export const POST = withAdmin(async (req, _principal, ctx: Ctx) => {
    const { articleSlug } = await ctx.params
    let body: unknown
    try {
        body = await req.json()
    } catch {
        return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 })
    }

    const parsed = CheckpointReorderInput.safeParse(body)
    if (!parsed.success) {
        return NextResponse.json(
            { error: "Validation failed", details: z.treeifyError(parsed.error) },
            { status: 400 },
        )
    }

    const result = await reorderCheckpoints(articleSlug, parsed.data.problemSlugs)
    if (!result.ok) {
        return NextResponse.json({ error: result.error }, { status: result.status })
    }
    return NextResponse.json({ ok: true })
})
```

`.../checkpoints/[problemSlug]/route.ts`:

```ts
import { NextResponse } from "next/server"
import { withAdmin } from "@/lib/api-auth"
import { removeCheckpoint } from "@/lib/admin-curriculum"

type Ctx = { params: Promise<{ articleSlug: string; problemSlug: string }> }

export const DELETE = withAdmin(async (_req, _principal, ctx: Ctx) => {
    const { articleSlug, problemSlug } = await ctx.params
    const result = await removeCheckpoint(articleSlug, problemSlug)
    if (!result.ok) {
        return NextResponse.json({ error: result.error }, { status: result.status })
    }
    return NextResponse.json({ ok: true, removed: true })
})
```

- [ ] **Step 3: Verify against the dev server**

With `npm run dev` running and `$ADMIN_ID` set as in Task 7 Step 4, pull two real article slugs and one problem slug out of the local DB rather than guessing:

```bash
cat > ./.dl-slugs.mjs <<'EOF'
import dotenv from "dotenv"; dotenv.config({ path: ".env" })
const { PrismaClient } = await import("@prisma/client")
const { PrismaPg } = await import("@prisma/adapter-pg")
const { Pool } = await import("pg")
const p = new PrismaClient({ adapter: new PrismaPg(new Pool({ connectionString: process.env.DATABASE_URL })) })
const arts = await p.article.findMany({ where: { status: "PUBLISHED" }, take: 2, select: { slug: true } })
const prob = await p.sQLProblem.findFirst({ where: { status: "PUBLISHED" }, select: { slug: true } })
console.log([arts[0]?.slug, arts[1]?.slug, prob?.slug].join(" "))
await p.$disconnect()
EOF
read ART1 ART2 PROB <<< "$(node ./.dl-slugs.mjs | tail -1)"
rm -f ./.dl-slugs.mjs
echo "art1=$ART1 art2=$ART2 prob=$PROB"   # all three must be non-empty
```

```bash
curl -s -X POST "http://localhost:3000/api/admin/lessons/$ART1/checkpoints" \
  -H "content-type: application/json" -H "origin: http://localhost:3000" \
  -H "x-test-user-id: $ADMIN_ID" -d "{\"problemSlug\":\"$PROB\"}"
```

Expected: `201` with `{"data":{"problemId":"...","position":0}}`.

Now the same problem against the *second* article:

```bash
curl -s -X POST "http://localhost:3000/api/admin/lessons/$ART2/checkpoints" \
  -H "content-type: application/json" -H "origin: http://localhost:3000" \
  -H "x-test-user-id: $ADMIN_ID" -d "{\"problemSlug\":\"$PROB\"}"
```

Expected: `409` with "already a checkpoint on another lesson." Then clean up:

```bash
curl -s -X DELETE "http://localhost:3000/api/admin/lessons/$ART1/checkpoints/$PROB" \
  -H "origin: http://localhost:3000" -H "x-test-user-id: $ADMIN_ID"
```

- [ ] **Step 4: Typecheck**

```bash
npx tsc --noEmit
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add "app/api/admin/tracks/[slug]/modules" "app/api/admin/lessons"
git commit -m "feat(api): admin lesson and checkpoint routes"
```

---

## Task 9: Read layer and the lesson-progress write action

**Files:**

- Create: `actions/curriculum.ts`
- Test: `scripts/test-curriculum-actions.ts`
- Modify: `package.json`

**Interfaces:**

- Consumes: `rollUpModule`, `rollUpTrack`, `isModuleUnlocked`, `clampProgressPercent` (Task 3); `excludeLockedProblems` from `lib/contest-locks.ts`
- Produces, from `actions/curriculum.ts`:
  - `type CurriculumLesson = { articleId: string; slug: string; title: string; readingMinutes: number | null; completed: boolean; checkpoints: CurriculumCheckpoint[] }`
  - `type CurriculumCheckpoint = { problemId: string; number: number; slug: string; title: string; difficulty: "EASY" | "MEDIUM" | "HARD"; solved: boolean }`
  - `type CurriculumModule = { id: string; slug: string; name: string; description: string; position: number; unlocked: boolean; lessons: CurriculumLesson[]; rollup: ModuleRollup }`
  - `type TrackCurriculum = { trackId: string; slug: string; name: string; modules: CurriculumModule[]; rollup: TrackRollup }`
  - `getTrackCurriculum(trackSlug: string, userId: string | null): Promise<TrackCurriculum | null>`
  - `recordLessonProgress(articleSlug: string, percent: number): Promise<{ ok: boolean; percent: number; completed: boolean }>`

- [ ] **Step 1: Write the failing test**

Create `scripts/test-curriculum-actions.ts`. It reuses the fixture style from Task 5/6 — a `PREFIX`, a track, two modules, lessons, checkpoints, a user, and submissions:

```ts
// Integration tests for the curriculum read layer and progress writes.
//
// Run: DATABASE_URL='postgresql://anchitgupta@localhost:5432/datalearn' \
//      node --import tsx --test scripts/test-curriculum-actions.ts

import "dotenv/config"
import { after, before, describe, it } from "node:test"
import assert from "node:assert/strict"
import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import pg from "pg"
import { getTrackCurriculum } from "../actions/curriculum"

const PREFIX = "curricread-"
const TRACK_SLUG = `${PREFIX}track`

let pool: pg.Pool
let prisma: PrismaClient
let userId: string
let lessonAId: string
let problemAId: string

async function cleanup() {
    await prisma.submission.deleteMany({ where: { user: { email: { startsWith: PREFIX } } } })
    await prisma.lessonProgress.deleteMany({ where: { user: { email: { startsWith: PREFIX } } } })
    await prisma.lessonCheckpoint.deleteMany({ where: { article: { slug: { startsWith: PREFIX } } } })
    await prisma.moduleLesson.deleteMany({ where: { article: { slug: { startsWith: PREFIX } } } })
    await prisma.module.deleteMany({ where: { track: { slug: { startsWith: PREFIX } } } })
    await prisma.track.deleteMany({ where: { slug: { startsWith: PREFIX } } })
    await prisma.article.deleteMany({ where: { slug: { startsWith: PREFIX } } })
    await prisma.sQLProblem.deleteMany({ where: { slug: { startsWith: PREFIX } } })
    await prisma.topic.deleteMany({ where: { slug: { startsWith: PREFIX } } })
    await prisma.sqlSchema.deleteMany({ where: { name: { startsWith: PREFIX } } })
    await prisma.user.deleteMany({ where: { email: { startsWith: PREFIX } } })
}

before(async () => {
    if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required")
    pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })
    prisma = new PrismaClient({ adapter: new PrismaPg(pool) })
    await cleanup()

    const schema = await prisma.sqlSchema.create({
        data: { name: `${PREFIX}schema`, sql: "CREATE TABLE t (id INTEGER);" },
    })
    const author = await prisma.user.create({
        data: { email: `${PREFIX}author@example.com`, name: "A" },
    })
    const learner = await prisma.user.create({
        data: { email: `${PREFIX}learner@example.com`, name: "L" },
    })
    userId = learner.id
    const topic = await prisma.topic.create({
        data: { name: `${PREFIX}Topic`, slug: `${PREFIX}topic` },
    })
    const track = await prisma.track.create({
        data: { slug: TRACK_SLUG, name: "T", summary: "s", description: "d" },
    })

    const m1 = await prisma.module.create({
        data: { trackId: track.id, slug: "m1", name: "M1", description: "d", position: 0 },
    })
    const m2 = await prisma.module.create({
        data: { trackId: track.id, slug: "m2", name: "M2", description: "d", position: 1 },
    })

    const article = async (slug: string) =>
        prisma.article.create({
            data: {
                title: slug,
                slug: `${PREFIX}${slug}`,
                content: "c",
                status: "PUBLISHED",
                topicId: topic.id,
                authorId: author.id,
            },
            select: { id: true },
        })

    const max = await prisma.sQLProblem.aggregate({ _max: { number: true } })
    let n = (max._max.number ?? 0) + 1
    const problem = async (slug: string) =>
        prisma.sQLProblem.create({
            data: {
                number: n++,
                title: slug,
                slug: `${PREFIX}${slug}`,
                difficulty: "EASY",
                status: "PUBLISHED",
                description: "d",
                schemaDescription: "s",
                schemaId: schema.id,
                expectedOutput: "[]",
                dialects: ["DUCKDB"],
            },
            select: { id: true },
        })

    // M1: one lesson (read) with one checkpoint (solved) → 100%
    const la = await article("lesson-a")
    lessonAId = la.id
    const pa = await problem("problem-a")
    problemAId = pa.id
    await prisma.moduleLesson.create({
        data: { moduleId: m1.id, articleId: la.id, position: 0 },
    })
    await prisma.lessonCheckpoint.create({
        data: { articleId: la.id, problemId: pa.id, position: 0 },
    })
    await prisma.lessonProgress.create({
        data: { userId, articleId: la.id, percent: 100, completedAt: new Date() },
    })
    await prisma.submission.create({
        data: { userId, problemId: pa.id, status: "ACCEPTED", code: "select 1" },
    })

    // M2: one lesson (unread), no checkpoints → 0%
    const lb = await article("lesson-b")
    await prisma.moduleLesson.create({
        data: { moduleId: m2.id, articleId: lb.id, position: 0 },
    })
})

after(async () => {
    await cleanup()
    await prisma.$disconnect()
    await pool.end()
})

describe("getTrackCurriculum", () => {
    it("returns null for an unknown track", async () => {
        assert.equal(await getTrackCurriculum("no-such-track", userId), null)
    })

    it("returns modules in position order", async () => {
        const c = await getTrackCurriculum(TRACK_SLUG, userId)
        assert.deepEqual(c?.modules.map((m) => m.slug), ["m1", "m2"])
    })

    it("marks a read lesson completed and a solved checkpoint solved", async () => {
        const c = await getTrackCurriculum(TRACK_SLUG, userId)
        const m1 = c!.modules[0]
        assert.equal(m1.lessons[0].completed, true)
        assert.equal(m1.lessons[0].checkpoints[0].solved, true)
        assert.equal(m1.rollup.percent, 100)
    })

    it("leaves the second module at 0%", async () => {
        const c = await getTrackCurriculum(TRACK_SLUG, userId)
        assert.equal(c!.modules[1].rollup.percent, 0)
    })

    it("unlocks module 2 because module 1 is complete", async () => {
        const c = await getTrackCurriculum(TRACK_SLUG, userId)
        assert.equal(c!.modules[0].unlocked, true)
        assert.equal(c!.modules[1].unlocked, true)
    })

    it("rolls the track up from the totals", async () => {
        const c = await getTrackCurriculum(TRACK_SLUG, userId)
        // 1 of 2 lessons + 1 of 1 problems = 2 of 3
        assert.equal(c!.rollup.percent, 67)
    })

    it("reports everything incomplete for an anonymous viewer", async () => {
        const c = await getTrackCurriculum(TRACK_SLUG, null)
        assert.equal(c!.rollup.percent, 0)
        assert.equal(c!.modules[0].lessons[0].completed, false)
        assert.equal(c!.modules[0].lessons[0].checkpoints[0].solved, false)
        // Module 1 is not complete for an anonymous viewer, so module 2 locks.
        assert.equal(c!.modules[1].unlocked, false)
    })
})
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
node --import tsx --test scripts/test-curriculum-actions.ts
```

Expected: FAIL — `Cannot find module '../actions/curriculum'`.

- [ ] **Step 3: Write the implementation**

Create `actions/curriculum.ts`:

```ts
"use server"

import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { excludeLockedProblems } from "@/lib/contest-locks"
import {
    clampProgressPercent,
    isModuleUnlocked,
    rollUpModule,
    rollUpTrack,
    type ModuleRollup,
    type TrackRollup,
} from "@/lib/curriculum-progress"

export type CurriculumCheckpoint = {
    problemId: string
    number: number
    slug: string
    title: string
    difficulty: "EASY" | "MEDIUM" | "HARD"
    solved: boolean
}

export type CurriculumLesson = {
    articleId: string
    slug: string
    title: string
    readingMinutes: number | null
    completed: boolean
    checkpoints: CurriculumCheckpoint[]
}

export type CurriculumModule = {
    id: string
    slug: string
    name: string
    description: string
    position: number
    unlocked: boolean
    lessons: CurriculumLesson[]
    rollup: ModuleRollup
}

export type TrackCurriculum = {
    trackId: string
    slug: string
    name: string
    modules: CurriculumModule[]
    rollup: TrackRollup
}

/**
 * The whole ordered curriculum for one track, with the viewer's state folded
 * in. Pass `userId: null` for anonymous viewers — everything reports
 * incomplete, which is exactly what the signed-out reader should render.
 *
 * `unlocked` is ADVISORY. It drives the "Locked until 02" affordance and
 * nothing else — no caller may use it to gate access.
 */
export async function getTrackCurriculum(
    trackSlug: string,
    userId: string | null,
): Promise<TrackCurriculum | null> {
    const track = await prisma.track.findUnique({
        where: { slug: trackSlug },
        select: {
            id: true,
            slug: true,
            name: true,
            modules: {
                orderBy: { position: "asc" },
                select: {
                    id: true,
                    slug: true,
                    name: true,
                    description: true,
                    position: true,
                    lessons: {
                        orderBy: { position: "asc" },
                        select: {
                            article: {
                                select: {
                                    id: true,
                                    slug: true,
                                    title: true,
                                    readingMinutes: true,
                                    checkpoints: {
                                        orderBy: { position: "asc" },
                                        select: {
                                            problem: {
                                                select: {
                                                    id: true,
                                                    number: true,
                                                    slug: true,
                                                    title: true,
                                                    difficulty: true,
                                                    status: true,
                                                },
                                            },
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
            },
        },
    })
    if (!track) return null

    const articleIds = track.modules.flatMap((m) =>
        m.lessons.map((l) => l.article.id),
    )
    const allProblemIds = track.modules.flatMap((m) =>
        m.lessons.flatMap((l) => l.article.checkpoints.map((c) => c.problem.id)),
    )

    // Contest-locked problems are hidden from learners, exactly as
    // lib/tracks.ts does for track items.
    const visibleProblems = allProblemIds.length
        ? await prisma.sQLProblem.findMany({
              where: excludeLockedProblems({
                  id: { in: allProblemIds },
                  status: "PUBLISHED",
              }),
              select: { id: true },
          })
        : []
    const visibleProblemIds = new Set(visibleProblems.map((p) => p.id))

    const completedArticleIds = new Set<string>()
    const solvedProblemIds = new Set<string>()

    if (userId) {
        if (articleIds.length) {
            const progress = await prisma.lessonProgress.findMany({
                where: {
                    userId,
                    articleId: { in: articleIds },
                    completedAt: { not: null },
                },
                select: { articleId: true },
            })
            for (const row of progress) completedArticleIds.add(row.articleId)
        }
        if (visibleProblemIds.size) {
            const accepted = await prisma.submission.findMany({
                where: {
                    userId,
                    status: "ACCEPTED",
                    problemId: { in: [...visibleProblemIds] },
                },
                select: { problemId: true },
                distinct: ["problemId"],
            })
            for (const row of accepted) solvedProblemIds.add(row.problemId)
        }
    }

    const rollups: ModuleRollup[] = []
    const modules: Omit<CurriculumModule, "unlocked">[] = track.modules.map(
        (m) => {
            const lessons: CurriculumLesson[] = m.lessons.map((l) => ({
                articleId: l.article.id,
                slug: l.article.slug,
                title: l.article.title,
                readingMinutes: l.article.readingMinutes,
                completed: completedArticleIds.has(l.article.id),
                checkpoints: l.article.checkpoints
                    .filter((c) => visibleProblemIds.has(c.problem.id))
                    .map((c) => ({
                        problemId: c.problem.id,
                        number: c.problem.number,
                        slug: c.problem.slug,
                        title: c.problem.title,
                        difficulty: c.problem.difficulty,
                        solved: solvedProblemIds.has(c.problem.id),
                    })),
            }))

            const rollup = rollUpModule({
                moduleId: m.id,
                lessons: lessons.map((l) => ({
                    articleId: l.articleId,
                    completed: l.completed,
                })),
                problems: lessons.flatMap((l) =>
                    l.checkpoints.map((c) => ({
                        problemId: c.problemId,
                        solved: c.solved,
                    })),
                ),
            })
            rollups.push(rollup)

            return {
                id: m.id,
                slug: m.slug,
                name: m.name,
                description: m.description,
                position: m.position,
                lessons,
                rollup,
            }
        },
    )

    return {
        trackId: track.id,
        slug: track.slug,
        name: track.name,
        modules: modules.map((m, i) => ({
            ...m,
            unlocked: isModuleUnlocked(rollups, i),
        })),
        rollup: rollUpTrack(rollups),
    }
}

/**
 * Record how far the signed-in reader has scrolled through a lesson.
 * Monotonic — the stored percent never decreases. Auto-completes at 100.
 * Anonymous callers are a silent no-op: reading is free, nothing persists.
 */
export async function recordLessonProgress(
    articleSlug: string,
    percent: number,
): Promise<{ ok: boolean; percent: number; completed: boolean }> {
    const session = await auth()
    const userId = session?.user?.id
    if (!userId) return { ok: false, percent: 0, completed: false }

    const article = await prisma.article.findUnique({
        where: { slug: articleSlug },
        select: { id: true },
    })
    if (!article) return { ok: false, percent: 0, completed: false }

    const existing = await prisma.lessonProgress.findUnique({
        where: { userId_articleId: { userId, articleId: article.id } },
        select: { percent: true, completedAt: true },
    })

    const next = clampProgressPercent(existing?.percent ?? 0, percent)
    const completedAt =
        existing?.completedAt ?? (next >= 100 ? new Date() : null)

    await prisma.lessonProgress.upsert({
        where: { userId_articleId: { userId, articleId: article.id } },
        create: {
            userId,
            articleId: article.id,
            percent: next,
            completedAt,
        },
        update: { percent: next, completedAt },
    })

    return { ok: true, percent: next, completed: completedAt !== null }
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
node --import tsx --test scripts/test-curriculum-actions.ts
```

Expected: PASS, 7 tests.

- [ ] **Step 5: Register the test script**

In `package.json`:

```json
"test:curriculum-actions": "node --import tsx --test scripts/test-curriculum-actions.ts",
```

- [ ] **Step 6: Typecheck and commit**

```bash
npx tsc --noEmit
git add actions/curriculum.ts scripts/test-curriculum-actions.ts package.json
git commit -m "feat(curriculum): track curriculum read layer and lesson progress writes"
```

---

## Task 10: Backfill checkpoints from `Article.relatedProblems`

**Files:**

- Create: `lib/checkpoint-backfill.ts`
- Create: `scripts/backfill-checkpoints.ts`
- Test: `scripts/test-checkpoint-backfill.ts`
- Modify: `package.json`

**Interfaces:**

- Consumes: nothing from earlier tasks
- Produces, from `lib/checkpoint-backfill.ts`:
  - `type BackfillPair = { articleId: string; articleCreatedAt: Date; problemId: string }`
  - `type BackfillPlan = { create: Array<{ articleId: string; problemId: string; position: number }>; skipped: Array<{ problemId: string; keptArticleId: string; droppedArticleId: string }> }`
  - `planCheckpointBackfill(pairs: BackfillPair[]): BackfillPlan`

- [ ] **Step 1: Write the failing test**

Create `scripts/test-checkpoint-backfill.ts`:

```ts
// Unit tests for the checkpoint backfill planner. Pure — no database.
//
// Run: node --import tsx --test scripts/test-checkpoint-backfill.ts

import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { planCheckpointBackfill } from "../lib/checkpoint-backfill"

const d = (iso: string) => new Date(iso)

describe("planCheckpointBackfill", () => {
    it("creates one checkpoint per unambiguous pair", () => {
        const plan = planCheckpointBackfill([
            { articleId: "a1", articleCreatedAt: d("2026-01-01"), problemId: "p1" },
            { articleId: "a2", articleCreatedAt: d("2026-01-02"), problemId: "p2" },
        ])
        assert.equal(plan.create.length, 2)
        assert.equal(plan.skipped.length, 0)
    })

    it("numbers positions from 0 within an article", () => {
        const plan = planCheckpointBackfill([
            { articleId: "a1", articleCreatedAt: d("2026-01-01"), problemId: "p1" },
            { articleId: "a1", articleCreatedAt: d("2026-01-01"), problemId: "p2" },
            { articleId: "a1", articleCreatedAt: d("2026-01-01"), problemId: "p3" },
        ])
        assert.deepEqual(plan.create.map((c) => c.position), [0, 1, 2])
    })

    it("keeps the earliest article when a problem is linked to two", () => {
        const plan = planCheckpointBackfill([
            { articleId: "later", articleCreatedAt: d("2026-02-01"), problemId: "p1" },
            { articleId: "earlier", articleCreatedAt: d("2026-01-01"), problemId: "p1" },
        ])
        assert.equal(plan.create.length, 1)
        assert.equal(plan.create[0].articleId, "earlier")
    })

    it("REPORTS the dropped pair rather than discarding it silently", () => {
        const plan = planCheckpointBackfill([
            { articleId: "later", articleCreatedAt: d("2026-02-01"), problemId: "p1" },
            { articleId: "earlier", articleCreatedAt: d("2026-01-01"), problemId: "p1" },
        ])
        assert.deepEqual(plan.skipped, [
            { problemId: "p1", keptArticleId: "earlier", droppedArticleId: "later" },
        ])
    })

    it("reports every dropped article when a problem is linked to three", () => {
        const plan = planCheckpointBackfill([
            { articleId: "a", articleCreatedAt: d("2026-01-01"), problemId: "p1" },
            { articleId: "b", articleCreatedAt: d("2026-01-02"), problemId: "p1" },
            { articleId: "c", articleCreatedAt: d("2026-01-03"), problemId: "p1" },
        ])
        assert.equal(plan.create.length, 1)
        assert.equal(plan.skipped.length, 2)
        assert.deepEqual(
            plan.skipped.map((s) => s.droppedArticleId).sort(),
            ["b", "c"],
        )
    })

    it("breaks a createdAt tie deterministically by articleId", () => {
        const same = d("2026-01-01")
        const plan = planCheckpointBackfill([
            { articleId: "zzz", articleCreatedAt: same, problemId: "p1" },
            { articleId: "aaa", articleCreatedAt: same, problemId: "p1" },
        ])
        assert.equal(plan.create[0].articleId, "aaa")
    })

    it("returns an empty plan for no pairs", () => {
        const plan = planCheckpointBackfill([])
        assert.deepEqual(plan, { create: [], skipped: [] })
    })
})
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
node --import tsx --test scripts/test-checkpoint-backfill.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Write the planner**

Create `lib/checkpoint-backfill.ts`:

```ts
// Pure planner for migrating Article.relatedProblems (the implicit
// ArticleProblems m2m) into LessonCheckpoint. No Prisma — the script in
// scripts/backfill-checkpoints.ts fetches the pairs and applies the plan.
//
// LessonCheckpoint has @@unique([problemId]): a problem checks exactly one
// lesson. Existing data may link one problem to several articles, so the
// planner picks a winner and REPORTS every pair it drops. Silent data loss
// during a migration is not acceptable.

export type BackfillPair = {
    articleId: string
    articleCreatedAt: Date
    problemId: string
}

export type BackfillPlan = {
    create: Array<{ articleId: string; problemId: string; position: number }>
    skipped: Array<{
        problemId: string
        keptArticleId: string
        droppedArticleId: string
    }>
}

/**
 * Tiebreak: earliest Article.createdAt wins; ties break on articleId
 * ascending so the plan is deterministic across runs.
 */
export function planCheckpointBackfill(pairs: BackfillPair[]): BackfillPlan {
    const byProblem = new Map<string, BackfillPair[]>()
    for (const pair of pairs) {
        const list = byProblem.get(pair.problemId)
        if (list) list.push(pair)
        else byProblem.set(pair.problemId, [pair])
    }

    const winners: BackfillPair[] = []
    const skipped: BackfillPlan["skipped"] = []

    for (const [problemId, candidates] of byProblem) {
        const sorted = [...candidates].sort((a, b) => {
            const byDate =
                a.articleCreatedAt.getTime() - b.articleCreatedAt.getTime()
            if (byDate !== 0) return byDate
            return a.articleId < b.articleId ? -1 : a.articleId > b.articleId ? 1 : 0
        })
        const [winner, ...losers] = sorted
        winners.push(winner)
        for (const loser of losers) {
            skipped.push({
                problemId,
                keptArticleId: winner.articleId,
                droppedArticleId: loser.articleId,
            })
        }
    }

    // Position within each article, in the winners' stable input order.
    const nextPosition = new Map<string, number>()
    const create = winners
        .sort((a, b) => {
            const byDate =
                a.articleCreatedAt.getTime() - b.articleCreatedAt.getTime()
            if (byDate !== 0) return byDate
            if (a.articleId !== b.articleId)
                return a.articleId < b.articleId ? -1 : 1
            return a.problemId < b.problemId ? -1 : a.problemId > b.problemId ? 1 : 0
        })
        .map((w) => {
            const position = nextPosition.get(w.articleId) ?? 0
            nextPosition.set(w.articleId, position + 1)
            return {
                articleId: w.articleId,
                problemId: w.problemId,
                position,
            }
        })

    return { create, skipped }
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
node --import tsx --test scripts/test-checkpoint-backfill.ts
```

Expected: PASS, 7 tests.

- [ ] **Step 5: Write the runner script**

Create `scripts/backfill-checkpoints.ts`:

```ts
// Backfill LessonCheckpoint from Article.relatedProblems.
//
// Dry run (default):  npx tsx scripts/backfill-checkpoints.ts
// Apply:              npx tsx scripts/backfill-checkpoints.ts --apply
//
// Existing LessonCheckpoint rows are left alone — the script only creates
// rows for problems that don't already check a lesson.

import "dotenv/config"
import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import pg from "pg"
import { planCheckpointBackfill, type BackfillPair } from "../lib/checkpoint-backfill"

const apply = process.argv.includes("--apply")

async function main() {
    const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })
    const prisma = new PrismaClient({ adapter: new PrismaPg(pool) })

    const articles = await prisma.article.findMany({
        select: {
            id: true,
            createdAt: true,
            relatedProblems: { select: { id: true } },
        },
    })

    const alreadyChecked = new Set(
        (
            await prisma.lessonCheckpoint.findMany({ select: { problemId: true } })
        ).map((c) => c.problemId),
    )

    const pairs: BackfillPair[] = articles.flatMap((a) =>
        a.relatedProblems
            .filter((p) => !alreadyChecked.has(p.id))
            .map((p) => ({
                articleId: a.id,
                articleCreatedAt: a.createdAt,
                problemId: p.id,
            })),
    )

    const plan = planCheckpointBackfill(pairs)

    console.log(`pairs considered: ${pairs.length}`)
    console.log(`checkpoints to create: ${plan.create.length}`)
    console.log(`pairs skipped (problem already claimed): ${plan.skipped.length}`)
    for (const s of plan.skipped) {
        console.log(
            `  SKIP problem=${s.problemId} kept=${s.keptArticleId} dropped=${s.droppedArticleId}`,
        )
    }

    if (!apply) {
        console.log("\nDry run. Re-run with --apply to write.")
        await prisma.$disconnect()
        await pool.end()
        return
    }

    for (const row of plan.create) {
        await prisma.lessonCheckpoint.create({ data: row })
    }
    console.log(`\nCreated ${plan.create.length} checkpoints.`)

    await prisma.$disconnect()
    await pool.end()
}

main().catch((err) => {
    console.error(err)
    process.exit(1)
})
```

- [ ] **Step 6: Dry-run it against the local database**

```bash
npx tsx scripts/backfill-checkpoints.ts
```

Expected: a summary with counts and no writes. Read the skip lines — if any appear, they are real data decisions and belong in the PR description.

- [ ] **Step 7: Register the scripts**

In `package.json`:

```json
"test:checkpoint-backfill": "node --import tsx --test scripts/test-checkpoint-backfill.ts",
"backfill:checkpoints": "tsx scripts/backfill-checkpoints.ts",
```

- [ ] **Step 8: Commit**

```bash
git add lib/checkpoint-backfill.ts scripts/backfill-checkpoints.ts scripts/test-checkpoint-backfill.ts package.json
git commit -m "feat(curriculum): backfill checkpoints from relatedProblems with a reported tiebreak"
```

---

## Task 11: MCP curriculum tools

**Files:**

- Create: `mcp-server/src/tools/curriculum.ts`
- Modify: `mcp-server/src/start.ts`
- Modify: `scripts/mcp-e2e-test.mjs`
- Modify: `mcp-server/README.md`

**Interfaces:**

- Consumes: the Zod shapes from `lib/admin-validation.ts` (Task 4) via the relative import `../../../lib/admin-validation`; `DataLearnClient`, `ApiError`, `toMcpError`
- Produces: `registerCurriculumTools(server: McpServer, client: DataLearnClient): void`, and 13 tools — `list_modules`, `get_module`, `create_module`, `update_module`, `delete_module`, `reorder_modules`, `add_lesson_to_module`, `remove_lesson_from_module`, `reorder_module_lessons`, `list_checkpoints`, `add_checkpoint`, `remove_checkpoint`, `reorder_checkpoints`, plus `get_curriculum`.

- [ ] **Step 1: Write the tool module**

Create `mcp-server/src/tools/curriculum.ts`:

```ts
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import {
    CheckpointAddInput,
    CheckpointReorderInput,
    ModuleCreateInput,
    ModuleLessonAddInput,
    ModuleLessonReorderInput,
    ModuleReorderInput,
    ModuleUpdateInput,
    SlugSchema,
} from "../../../lib/admin-validation"
import { ApiError, DataLearnClient } from "../client.js"
import { toMcpError } from "../errors.js"

function ok(payload: unknown) {
    return {
        content: [
            { type: "text" as const, text: JSON.stringify(payload, null, 2) },
        ],
    }
}

function notFound(err: unknown) {
    return err instanceof ApiError && err.status === 404
}

const enc = encodeURIComponent

export function registerCurriculumTools(
    server: McpServer,
    client: DataLearnClient,
): void {
    server.tool(
        "list_modules",
        "List a track's modules in curriculum order, with lesson counts.",
        { trackSlug: SlugSchema },
        async ({ trackSlug }) => {
            try {
                return ok(
                    await client.request(
                        "GET",
                        `/api/admin/tracks/${enc(trackSlug)}/modules`,
                    ),
                )
            } catch (err) {
                if (notFound(err)) return ok({ found: false })
                throw toMcpError(err)
            }
        },
    )

    server.tool(
        "get_module",
        "Fetch one module by track slug + module slug, including its ordered lessons. Returns {found:false} if it does not exist.",
        { trackSlug: SlugSchema, moduleSlug: SlugSchema },
        async ({ trackSlug, moduleSlug }) => {
            try {
                return ok(
                    await client.request(
                        "GET",
                        `/api/admin/tracks/${enc(trackSlug)}/modules/${enc(moduleSlug)}`,
                    ),
                )
            } catch (err) {
                if (notFound(err)) return ok({ found: false })
                throw toMcpError(err)
            }
        },
    )

    server.tool(
        "create_module",
        "Create a module in a track. Appends unless `position` is given. Creating modules NEVER publishes the track — publishing stays a deliberate human action in the admin portal.",
        {
            trackSlug: SlugSchema,
            name: ModuleCreateInput.shape.name,
            slug: ModuleCreateInput.shape.slug,
            description: ModuleCreateInput.shape.description,
            position: ModuleCreateInput.shape.position,
        },
        async ({ trackSlug, ...body }) => {
            try {
                return ok(
                    await client.request(
                        "POST",
                        `/api/admin/tracks/${enc(trackSlug)}/modules`,
                        body,
                    ),
                )
            } catch (err) {
                if (notFound(err)) return ok({ found: false })
                throw toMcpError(err)
            }
        },
    )

    server.tool(
        "update_module",
        "Rename a module or change its slug or description. `position` is NOT accepted — use reorder_modules.",
        {
            trackSlug: SlugSchema,
            moduleSlug: SlugSchema,
            name: ModuleUpdateInput.shape.name,
            newSlug: SlugSchema.optional(),
            description: ModuleUpdateInput.shape.description,
        },
        async ({ trackSlug, moduleSlug, newSlug, ...rest }) => {
            const body = {
                ...rest,
                ...(newSlug !== undefined && { slug: newSlug }),
            }
            try {
                return ok(
                    await client.request(
                        "PATCH",
                        `/api/admin/tracks/${enc(trackSlug)}/modules/${enc(moduleSlug)}`,
                        body,
                    ),
                )
            } catch (err) {
                if (notFound(err)) return ok({ found: false })
                throw toMcpError(err)
            }
        },
    )

    server.tool(
        "delete_module",
        "Delete a module and close the position gap. Its lessons are detached, not deleted — the underlying articles survive.",
        { trackSlug: SlugSchema, moduleSlug: SlugSchema },
        async ({ trackSlug, moduleSlug }) => {
            try {
                return ok(
                    await client.requestRaw(
                        "DELETE",
                        `/api/admin/tracks/${enc(trackSlug)}/modules/${enc(moduleSlug)}`,
                    ),
                )
            } catch (err) {
                if (notFound(err)) return ok({ found: false })
                throw toMcpError(err)
            }
        },
    )

    server.tool(
        "reorder_modules",
        "Set the full module order for a track. The payload must list EVERY current module slug exactly once.",
        {
            trackSlug: SlugSchema,
            moduleSlugs: ModuleReorderInput.shape.moduleSlugs,
        },
        async ({ trackSlug, moduleSlugs }) => {
            try {
                return ok(
                    await client.requestRaw(
                        "POST",
                        `/api/admin/tracks/${enc(trackSlug)}/modules/reorder`,
                        { moduleSlugs },
                    ),
                )
            } catch (err) {
                if (notFound(err)) return ok({ found: false })
                throw toMcpError(err)
            }
        },
    )

    server.tool(
        "add_lesson_to_module",
        "Attach a published article to a module as a lesson. Appends unless `position` is given. The same article may appear in more than one module.",
        {
            trackSlug: SlugSchema,
            moduleSlug: SlugSchema,
            articleSlug: ModuleLessonAddInput.shape.articleSlug,
            position: ModuleLessonAddInput.shape.position,
        },
        async ({ trackSlug, moduleSlug, ...body }) => {
            try {
                return ok(
                    await client.request(
                        "POST",
                        `/api/admin/tracks/${enc(trackSlug)}/modules/${enc(moduleSlug)}/lessons`,
                        body,
                    ),
                )
            } catch (err) {
                if (notFound(err)) return ok({ found: false })
                throw toMcpError(err)
            }
        },
    )

    server.tool(
        "remove_lesson_from_module",
        "Detach a lesson from a module. The article itself is not deleted.",
        {
            trackSlug: SlugSchema,
            moduleSlug: SlugSchema,
            articleSlug: SlugSchema,
        },
        async ({ trackSlug, moduleSlug, articleSlug }) => {
            try {
                return ok(
                    await client.requestRaw(
                        "DELETE",
                        `/api/admin/tracks/${enc(trackSlug)}/modules/${enc(moduleSlug)}/lessons/${enc(articleSlug)}`,
                    ),
                )
            } catch (err) {
                if (notFound(err)) return ok({ found: false })
                throw toMcpError(err)
            }
        },
    )

    server.tool(
        "reorder_module_lessons",
        "Set the full lesson order within a module. The payload must list EVERY current lesson's article slug exactly once.",
        {
            trackSlug: SlugSchema,
            moduleSlug: SlugSchema,
            articleSlugs: ModuleLessonReorderInput.shape.articleSlugs,
        },
        async ({ trackSlug, moduleSlug, articleSlugs }) => {
            try {
                return ok(
                    await client.requestRaw(
                        "POST",
                        `/api/admin/tracks/${enc(trackSlug)}/modules/${enc(moduleSlug)}/lessons/reorder`,
                        { articleSlugs },
                    ),
                )
            } catch (err) {
                if (notFound(err)) return ok({ found: false })
                throw toMcpError(err)
            }
        },
    )

    server.tool(
        "list_checkpoints",
        "List a lesson's checkpoint problems in order.",
        { articleSlug: SlugSchema },
        async ({ articleSlug }) => {
            try {
                return ok(
                    await client.request(
                        "GET",
                        `/api/admin/lessons/${enc(articleSlug)}/checkpoints`,
                    ),
                )
            } catch (err) {
                if (notFound(err)) return ok({ found: false })
                throw toMcpError(err)
            }
        },
    )

    server.tool(
        "add_checkpoint",
        "Attach a problem to a lesson as a checkpoint. A problem checks exactly ONE lesson — attaching a problem that already checks another lesson returns 409.",
        {
            articleSlug: SlugSchema,
            problemSlug: CheckpointAddInput.shape.problemSlug,
            position: CheckpointAddInput.shape.position,
        },
        async ({ articleSlug, ...body }) => {
            try {
                return ok(
                    await client.request(
                        "POST",
                        `/api/admin/lessons/${enc(articleSlug)}/checkpoints`,
                        body,
                    ),
                )
            } catch (err) {
                if (notFound(err)) return ok({ found: false })
                throw toMcpError(err)
            }
        },
    )

    server.tool(
        "remove_checkpoint",
        "Detach a checkpoint problem from a lesson. The problem itself is not deleted.",
        { articleSlug: SlugSchema, problemSlug: SlugSchema },
        async ({ articleSlug, problemSlug }) => {
            try {
                return ok(
                    await client.requestRaw(
                        "DELETE",
                        `/api/admin/lessons/${enc(articleSlug)}/checkpoints/${enc(problemSlug)}`,
                    ),
                )
            } catch (err) {
                if (notFound(err)) return ok({ found: false })
                throw toMcpError(err)
            }
        },
    )

    server.tool(
        "reorder_checkpoints",
        "Set the full checkpoint order for a lesson. The payload must list EVERY current checkpoint's problem slug exactly once.",
        {
            articleSlug: SlugSchema,
            problemSlugs: CheckpointReorderInput.shape.problemSlugs,
        },
        async ({ articleSlug, problemSlugs }) => {
            try {
                return ok(
                    await client.requestRaw(
                        "POST",
                        `/api/admin/lessons/${enc(articleSlug)}/checkpoints/reorder`,
                        { problemSlugs },
                    ),
                )
            } catch (err) {
                if (notFound(err)) return ok({ found: false })
                throw toMcpError(err)
            }
        },
    )

    server.tool(
        "get_curriculum",
        "Fetch a track's entire curriculum tree — modules, their ordered lessons, and each lesson's checkpoints — in one call. Use this before authoring so you can see current state without N round-trips.",
        { trackSlug: SlugSchema },
        async ({ trackSlug }) => {
            try {
                const modules = await client.request<
                    Array<{ slug: string; name: string; position: number }>
                >("GET", `/api/admin/tracks/${enc(trackSlug)}/modules`)

                const tree = []
                for (const m of modules) {
                    const detail = await client.request<{
                        slug: string
                        name: string
                        position: number
                        lessons: Array<{
                            position: number
                            article: { slug: string; title: string }
                        }>
                    }>(
                        "GET",
                        `/api/admin/tracks/${enc(trackSlug)}/modules/${enc(m.slug)}`,
                    )

                    const lessons = []
                    for (const l of detail.lessons) {
                        const checkpoints = await client.request(
                            "GET",
                            `/api/admin/lessons/${enc(l.article.slug)}/checkpoints`,
                        )
                        lessons.push({ ...l, checkpoints })
                    }
                    tree.push({ ...detail, lessons })
                }
                return ok({ trackSlug, modules: tree })
            } catch (err) {
                if (notFound(err)) return ok({ found: false })
                throw toMcpError(err)
            }
        },
    )
}
```

- [ ] **Step 2: Register the tools**

In `mcp-server/src/start.ts`, add the import next to the other tool imports:

```ts
import { registerCurriculumTools } from "./tools/curriculum.js"
```

and the call immediately after `registerTrackTools(server, client)`:

```ts
    registerCurriculumTools(server, client)
```

- [ ] **Step 3: Build the MCP server and verify bundle isolation**

```bash
cd mcp-server && npm run build && cd ..
npm run check:mcp-bundle-isolation
```

Expected: the tsup build succeeds and the isolation check passes. If the check fails, `lib/admin-validation.ts` gained a Prisma or Next import — revert it.

- [ ] **Step 4: Extend the e2e harness**

In `scripts/mcp-e2e-test.mjs`, add a curriculum section modelled on the existing track section. It must exercise, against the dev server:

```js
// Curriculum: create a module, attach a lesson, attach a checkpoint,
// reorder, then tear down. Slugs are prefixed so a failed run is easy
// to clean up by hand.
const trackSlug = `mcpe2e-track-${runId}`
await mcp.callTool("create_track", {
    name: `MCP e2e ${runId}`,
    summary: "s",
    description: "d",
})
await mcp.callTool("create_module", {
    trackSlug,
    name: "Foundations",
    description: "d",
})
await mcp.callTool("create_module", {
    trackSlug,
    name: "Joins",
    description: "d",
})

// reorder_modules must accept every slug exactly once
const reordered = await mcp.callTool("reorder_modules", {
    trackSlug,
    moduleSlugs: ["joins", "foundations"],
})
// a partial payload must be rejected
const partial = await mcp.callTool("reorder_modules", {
    trackSlug,
    moduleSlugs: ["joins"],
})
// get_curriculum must return the tree in the new order
const tree = await mcp.callTool("get_curriculum", { trackSlug })
// unknown track must return {found:false}, not throw
const missing = await mcp.callTool("list_modules", { trackSlug: "no-such-track" })
```

Assert: the reorder succeeds, the partial reorder reports an error, `get_curriculum` lists `joins` before `foundations`, and `list_modules` on an unknown track returns `{found:false}`. Then `delete_module` both modules and `delete_track` the track.

- [ ] **Step 5: Run the e2e harness**

With `npm run dev` running:

```bash
npm run mcp:e2e-test
```

Expected: all sections pass, including the new curriculum section.

- [ ] **Step 6: Document the tools**

In `mcp-server/README.md`, add a "Curriculum" section listing all 14 tools with their arguments, and state the two rules an authoring assistant must know:

- a problem checks exactly one lesson — `add_checkpoint` 409s on a problem that already checks another lesson;
- attaching curriculum never publishes a track.

- [ ] **Step 7: Commit**

```bash
git add mcp-server/src/tools/curriculum.ts mcp-server/src/start.ts mcp-server/README.md scripts/mcp-e2e-test.mjs
git commit -m "feat(mcp): curriculum tools for modules, lessons, and checkpoints"
```

---

## Task 12: Author the "Analyst interview prep" track

The dominant cost of this plan. The mechanism is the MCP tools from Task 11; the deliverable is content, and the acceptance criteria below are what "done" means for each lesson.

**Files:**

- No source files. Content is created through the API and lives in the database.
- Create: `docs/superpowers/plans/2026-08-01-curriculum-spine-content-log.md` — a running record of what was authored and what was mapped to existing problems.

**Interfaces:**

- Consumes: every tool from Task 11
- Produces: one `Track` with slug `analyst-interview-prep`, 5 modules, up to 17 lessons, and checkpoints attached to each lesson.

**Per-lesson acceptance criteria.** A lesson is done when all five hold:

1. It is a `PUBLISHED` `Article` with a `summary` and a non-null `readingMinutes`.
2. Its body teaches one idea and ends where an interview would — at a query, not a definition.
3. It carries at least one `TOPIC` tag so it appears under a topic.
4. It has at least one checkpoint problem attached via `add_checkpoint`.
5. It is attached to exactly one module in this track via `add_lesson_to_module`, at its intended position.

- [ ] **Step 1: Create the track and the five modules**

Through MCP (or curl against `/api/admin`), in this order so positions land correctly:

| position | slug | name |
| --- | --- | --- |
| 0 | `foundations` | Foundations |
| 1 | `joins` | Joins |
| 2 | `aggregation` | Aggregation |
| 3 | `window-functions` | Window functions |
| 4 | `interview-patterns` | Interview patterns |

Verify with `get_curriculum` that all five appear in that order.

- [ ] **Step 2: Inventory the existing problems against the checkpoints the design names**

The design names ten problems. Check which already exist:

```bash
cat > ./.dl-inv.mjs <<'EOF'
import dotenv from "dotenv"; dotenv.config({ path: ".env" })
const { PrismaClient } = await import("@prisma/client")
const { PrismaPg } = await import("@prisma/adapter-pg")
const { Pool } = await import("pg")
const p = new PrismaClient({ adapter: new PrismaPg(new Pool({ connectionString: process.env.DATABASE_URL })) })
const rows = await p.sQLProblem.findMany({
  where: { status: "PUBLISHED" },
  orderBy: { number: "asc" },
  select: { number: true, slug: true, title: true, difficulty: true },
})
console.table(rows)
await p.$disconnect()
EOF
node ./.dl-inv.mjs; rm -f ./.dl-inv.mjs
```

Record in the content log which of the ten named problems exist, which existing problems are good substitutes, and which must be authored with `create_problem`.

- [ ] **Step 3: Author module 04 — Window functions (do this first)**

Four lessons, in order: `what-a-window-actually-is`, `over-partition-by-and-frame-clauses`, `lag-lead-and-row-to-row-deltas`, `top-n-per-group-three-ways`.

Every mock in the handoff depicts this module, so it is the one that must look right. For each lesson: `create_article` → publish → `add_lesson_to_module` → `add_checkpoint`.

Verify with `get_curriculum` that module `window-functions` reports four lessons in that order, each with at least one checkpoint.

- [ ] **Step 4: Author module 01 — Foundations**

Four lessons, in order: `reading-a-query-plan-in-your-head`, `select-where-and-evaluation-order`, `null-is-not-a-value`, `sorting-paging-and-ties`.

This is the track's entry point, so it is the second non-negotiable module.

- [ ] **Step 5: Author modules 02, 03 and 05**

- **Joins** (3): `inner-left-and-the-unmatched-rows`, `semi-and-anti-joins`, `fan-out-and-row-multiplication`
- **Aggregation** (3): `group-by-and-the-grain-of-a-result`, `having-vs-where`, `count-star-vs-count-col`
- **Interview patterns** (3): `sessionisation`, `cohort-retention`, `metric-definitions-that-survive-review`

A module with zero lessons renders at 0% and is not a failure state — if writing time runs out here, stop and record it rather than shipping thin prose.

- [ ] **Step 6: Verify the whole curriculum end to end**

```bash
node --import tsx --test scripts/test-curriculum-actions.ts
```

Then, against the real track, confirm `getTrackCurriculum("analyst-interview-prep", <a user id>)` returns modules in order with sane rollups:

The helper must be a `.ts` file run through `tsx` — `actions/curriculum.ts` uses the `@/` path alias and TypeScript syntax, neither of which a plain `.mjs` can import.

```bash
cat > ./.dl-curric.ts <<'EOF'
import "dotenv/config"
import { getTrackCurriculum } from "./actions/curriculum"

const c = await getTrackCurriculum("analyst-interview-prep", null)
console.log(
    JSON.stringify(
        {
            track: c?.rollup,
            modules: c?.modules.map((m) => ({
                slug: m.slug,
                unlocked: m.unlocked,
                lessons: m.lessons.length,
                ...m.rollup,
            })),
        },
        null,
        2,
    ),
)
EOF
npx tsx ./.dl-curric.ts; rm -f ./.dl-curric.ts
```

Expected: five modules in order; module 0 unlocked, the rest locked for an anonymous viewer; lesson counts matching what was authored.

- [ ] **Step 7: Write the content log**

Create `docs/superpowers/plans/2026-08-01-curriculum-spine-content-log.md` recording: every lesson authored with its slug and module, every checkpoint mapping (which problem checks which lesson), every problem newly authored, and — explicitly — any lesson from the 17 that was **not** written, so the gap is visible rather than implied.

- [ ] **Step 8: Commit**

```bash
git add docs/superpowers/plans/2026-08-01-curriculum-spine-content-log.md
git commit -m "docs(content): authoring log for the analyst interview prep track"
```

---

## Task 13: Final verification and PR

**Files:**

- Modify: `docs/ROADMAP.md`
- Modify: `docs/TECHNICAL_DESIGN.md`
- Modify: `CLAUDE.md`

- [ ] **Step 1: Run the full new-test suite**

```bash
npm run test:curriculum-progress
npm run test:curriculum-admin-validation
npm run test:curriculum-admin
npm run test:curriculum-actions
npm run test:checkpoint-backfill
npm run check:mcp-bundle-isolation
```

Expected: all PASS. Paste the actual output into the PR body — not a summary of it.

- [ ] **Step 2: Run the pre-existing suites most likely to be affected**

```bash
npm run test:tracks
npm run test:article-publish-validation
npm run audit:dialects
```

Expected: all PASS. If `test:tracks` fails, the shared `Track` relation changes broke something — fix before proceeding.

- [ ] **Step 3: Typecheck, lint, build**

```bash
npx tsc --noEmit
npm run lint
npm run build
```

Expected: all PASS. `npm run build` already pins `--webpack`; do not override it.

- [ ] **Step 4: Update the docs**

- `docs/ROADMAP.md` — add the curriculum spine under shipped work.
- `docs/TECHNICAL_DESIGN.md` — add a Curriculum subsystem section: the four models, the `lib/curriculum-progress.ts` / `actions/curriculum.ts` split, and the rule that unlocking is advisory.
- `CLAUDE.md` — under "Things to avoid", add: *"Don't write `Module.position`, `ModuleLesson.position` or `LessonCheckpoint.position` outside their reorder transactions"*, and *"Don't enforce module unlocking — `isModuleUnlocked` is advisory and drives UI copy only."* Under "Project shape", note `lib/admin-curriculum.ts` and `actions/curriculum.ts`.

- [ ] **Step 5: Commit the docs**

```bash
git add docs/ROADMAP.md docs/TECHNICAL_DESIGN.md CLAUDE.md
git commit -m "docs: record the curriculum spine subsystem and its invariants"
```

- [ ] **Step 6: Open the PR**

```bash
gh pr create --base main \
  --title "feat(curriculum): ordered curriculum spine — modules, lessons, checkpoints" \
  --body-file <(cat <<'EOF'
## Summary

Sub-project 1 of the learning-platform redesign. Adds the ordered curriculum
spine the redesign is built on: track → module → lesson → checkpoint problems,
with per-user read state and progress rollups. Headless — no learner-facing UI.

See the spec: `docs/superpowers/specs/2026-08-01-curriculum-spine-design.md`

## Verified

<paste the actual output of every command from Steps 1-3>

## Not yet verified

<list anything that could not be run, and why>
EOF
)
```

**`--base main` is mandatory.** The repository's default branch is `production`; a forgotten flag deploys unfinished work to the live site.

---

## Self-review notes

Checked against the spec:

- **Deploy prerequisite** → Task 1. **Data model** → Task 2. **Progress semantics** → Tasks 3 and 9. **`relatedProblems` migration** → Task 10. **Admin API** → Tasks 7–8. **MCP tools** → Task 11. **Content** → Task 12. **Testing** → the test step of every task, gathered in Task 13.
- **Type consistency:** `CurriculumMutationResult` is defined once in Task 5 and consumed by Task 6; `ModuleRollup` / `TrackRollup` are defined in Task 3 and consumed by Task 9; the Zod schema names in Task 4 match their use in Tasks 7, 8 and 11.
- **Known gap, deliberate:** the spec's `TrackItem` deprecation is documented as out of scope and has no task, by design.
