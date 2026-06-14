# Contest Standings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a read-only standings table to the contest page so participants can see ranks, points, and penalty time.

**Architecture:** Pure helpers (`lib/contests/leaderboard.ts`) compute display rank by sort position and format penalty time; a server action (`getContestLeaderboard`) reads ordered `ContestLeaderboardEntry` rows; a presentational server component (`ContestStandings`) renders the table; the contest page wires it in for LIVE/CLOSED contests. No schema changes.

**Tech Stack:** Next.js 16 App Router, Prisma 7, TypeScript, Tailwind v4, `node --import tsx --test` for unit tests, Playwright for e2e.

**Spec:** [`docs/superpowers/specs/2026-06-14-contest-standings-design.md`](../specs/2026-06-14-contest-standings-design.md)

---

## File Structure

- `lib/contests/leaderboard.ts` — **Create.** Pure: `LeaderboardRow` type, `toStandingsRows`, `formatPenalty`. No Prisma/React.
- `scripts/test-contest-leaderboard.ts` — **Create.** Unit tests for the pure helpers.
- `actions/contests.ts` — **Modify.** Add `getContestLeaderboard(contestId)`.
- `components/contests/ContestStandings.tsx` — **Create.** Presentational table + empty state.
- `app/contests/[slug]/page.tsx` — **Modify.** Fetch + render standings for LIVE/CLOSED.
- `package.json` — **Modify.** Add `test:contest-leaderboard` script.
- `tests/e2e/contest-standings.spec.ts` — **Create.** Seeds a LIVE contest + entries, asserts the table.

---

### Task 1: Pure helpers (`toStandingsRows`, `formatPenalty`)

**Files:**
- Create: `lib/contests/leaderboard.ts`
- Create: `scripts/test-contest-leaderboard.ts`
- Modify: `package.json` (scripts)

- [ ] **Step 1: Write the failing test**

Create `scripts/test-contest-leaderboard.ts`:

```ts
// Unit tests for contest standings pure helpers (no DB).
// Run: node --import tsx --test scripts/test-contest-leaderboard.ts
import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { formatPenalty, toStandingsRows } from "../lib/contests/leaderboard"

describe("formatPenalty", () => {
    it("formats as H:MM:SS with zero-padded minutes and seconds", () => {
        assert.equal(formatPenalty(0), "0:00:00")
        assert.equal(formatPenalty(750), "0:12:30")
        assert.equal(formatPenalty(3661), "1:01:01")
    })
})

describe("toStandingsRows", () => {
    it("assigns 1-based rank by position and preserves input order", () => {
        const rows = toStandingsRows([
            { userId: "a", points: 8, penaltySeconds: 750, solvedCount: 3, user: { id: "a", name: "Alice" } },
            { userId: "b", points: 5, penaltySeconds: 1210, solvedCount: 2, user: { id: "b", name: null } },
        ])
        assert.equal(rows.length, 2)
        assert.deepEqual(
            rows.map((r) => [r.rank, r.userId, r.participant]),
            [
                [1, "a", "Alice"],
                [2, "b", "Anonymous"],
            ]
        )
    })

    it("does not re-sort its input", () => {
        const rows = toStandingsRows([
            { userId: "low", points: 1, penaltySeconds: 10, solvedCount: 1, user: { id: "low", name: "Low" } },
            { userId: "high", points: 9, penaltySeconds: 10, solvedCount: 4, user: { id: "high", name: "High" } },
        ])
        assert.deepEqual(rows.map((r) => r.userId), ["low", "high"])
    })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --import tsx --test scripts/test-contest-leaderboard.ts`
Expected: FAIL — cannot find module `../lib/contests/leaderboard`.

- [ ] **Step 3: Write minimal implementation**

Create `lib/contests/leaderboard.ts`:

```ts
// Pure helpers for contest standings. No Prisma, no React — unit-testable
// without a DB. The persisted ContestLeaderboardEntry.rank is NOT maintained
// (always 0); rank is computed here from query order. See
// docs/superpowers/specs/2026-06-14-contest-standings-design.md.

export type LeaderboardRow = {
    rank: number
    userId: string
    participant: string
    solvedCount: number
    points: number
    penaltySeconds: number
}

export type RawLeaderboardEntry = {
    userId: string
    points: number
    penaltySeconds: number
    solvedCount: number
    user: { id: string; name: string | null }
}

/**
 * Map already-ordered leaderboard entries to display rows, assigning a 1-based
 * rank by position. Does NOT re-sort — ordering is owned by the DB query.
 */
export function toStandingsRows(entries: RawLeaderboardEntry[]): LeaderboardRow[] {
    return entries.map((entry, index) => ({
        rank: index + 1,
        userId: entry.userId,
        participant: entry.user.name ?? "Anonymous",
        solvedCount: entry.solvedCount,
        points: entry.points,
        penaltySeconds: entry.penaltySeconds,
    }))
}

/** Format penalty seconds as H:MM:SS (hours unpadded, minutes/seconds 2-digit). */
export function formatPenalty(seconds: number): string {
    const total = Math.max(0, Math.floor(seconds))
    const hours = Math.floor(total / 3600)
    const minutes = Math.floor((total % 3600) / 60)
    const secs = total % 60
    const pad = (n: number) => String(n).padStart(2, "0")
    return `${hours}:${pad(minutes)}:${pad(secs)}`
}
```

- [ ] **Step 4: Add the npm script**

In `package.json` scripts, after the line for `"test:tracks"`, add:

```json
"test:contest-leaderboard": "node --import tsx --test scripts/test-contest-leaderboard.ts",
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm run test:contest-leaderboard`
Expected: PASS — all tests green.

- [ ] **Step 6: Commit**

```bash
git add lib/contests/leaderboard.ts scripts/test-contest-leaderboard.ts package.json
git commit -m "feat(contests): pure standings helpers (rank-by-position, penalty format)"
```

---

### Task 2: Server action `getContestLeaderboard`

**Files:**
- Modify: `actions/contests.ts`

- [ ] **Step 1: Add the import**

At the top of `actions/contests.ts`, alongside the existing imports, add:

```ts
import { toStandingsRows, type LeaderboardRow } from "@/lib/contests/leaderboard"
```

- [ ] **Step 2: Add the action**

Append to `actions/contests.ts`:

```ts
/**
 * Standings for a contest, ordered by ICPC tie-break (points desc, penalty asc,
 * then userId for stable ties). Returns [] on error so the page never breaks.
 * Never selects user email.
 */
export async function getContestLeaderboard(
    contestId: string
): Promise<LeaderboardRow[]> {
    try {
        const entries = await prisma.contestLeaderboardEntry.findMany({
            where: { contestId },
            orderBy: [
                { points: "desc" },
                { penaltySeconds: "asc" },
                { userId: "asc" },
            ],
            select: {
                userId: true,
                points: true,
                penaltySeconds: true,
                solvedCount: true,
                user: { select: { id: true, name: true } },
            },
        })
        return toStandingsRows(entries)
    } catch {
        return []
    }
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS — no errors (the `select` shape matches `RawLeaderboardEntry`).

- [ ] **Step 4: Commit**

```bash
git add actions/contests.ts
git commit -m "feat(contests): getContestLeaderboard action"
```

---

### Task 3: `ContestStandings` presentational component

**Files:**
- Create: `components/contests/ContestStandings.tsx`

- [ ] **Step 1: Write the component**

Create `components/contests/ContestStandings.tsx`:

```tsx
import { Card } from "@/components/ui/Card"
import { EmptyState } from "@/components/ui/EmptyState"
import { cn } from "@/lib/utils"
import { formatPenalty, type LeaderboardRow } from "@/lib/contests/leaderboard"

type Props = {
    rows: LeaderboardRow[]
    viewerUserId: string | null
    status: "LIVE" | "CLOSED"
}

export function ContestStandings({ rows, viewerUserId, status }: Props) {
    return (
        <div className="mt-8">
            <h2 className="mb-3 text-base font-semibold">Standings</h2>
            {rows.length === 0 ? (
                <EmptyState
                    title={
                        status === "LIVE"
                            ? "No submissions yet"
                            : "No one solved a problem"
                    }
                    description={
                        status === "LIVE"
                            ? "Be the first to solve a problem and take the lead."
                            : "No participant solved a problem in this contest."
                    }
                />
            ) : (
                <Card className="overflow-hidden">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-border text-left text-xs uppercase text-muted-foreground">
                                <th className="px-5 py-3 font-medium">Rank</th>
                                <th className="px-5 py-3 font-medium">
                                    Participant
                                </th>
                                <th className="px-5 py-3 text-right font-medium">
                                    Solved
                                </th>
                                <th className="px-5 py-3 text-right font-medium">
                                    Points
                                </th>
                                <th className="px-5 py-3 text-right font-medium">
                                    Penalty
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {rows.map((row) => {
                                const isViewer = row.userId === viewerUserId
                                return (
                                    <tr
                                        key={row.userId}
                                        className={cn(
                                            isViewer && "bg-primary/5"
                                        )}
                                    >
                                        <td className="px-5 py-3 tabular-nums text-muted-foreground">
                                            {row.rank}
                                        </td>
                                        <td className="px-5 py-3 font-medium">
                                            {isViewer ? "You" : row.participant}
                                        </td>
                                        <td className="px-5 py-3 text-right tabular-nums">
                                            {row.solvedCount}
                                        </td>
                                        <td className="px-5 py-3 text-right tabular-nums">
                                            {row.points}
                                        </td>
                                        <td className="px-5 py-3 text-right tabular-nums text-muted-foreground">
                                            {formatPenalty(row.penaltySeconds)}
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </Card>
            )}
        </div>
    )
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS. (If `Card`/`EmptyState`/`cn` import paths differ, match the imports already used in `app/contests/[slug]/page.tsx`.)

- [ ] **Step 3: Commit**

```bash
git add components/contests/ContestStandings.tsx
git commit -m "feat(contests): ContestStandings table component"
```

---

### Task 4: Wire standings into the contest page

**Files:**
- Modify: `app/contests/[slug]/page.tsx`

- [ ] **Step 1: Add imports**

At the top of `app/contests/[slug]/page.tsx`, add to the imports:

```ts
import { getContestBySlug, getContestLeaderboard } from "@/actions/contests"
import { ContestStandings } from "@/components/contests/ContestStandings"
```

(Replace the existing `import { getContestBySlug } from "@/actions/contests"` line with the combined import above.)

- [ ] **Step 2: Fetch registration + standings together**

In `ContestDetailPage`, replace the existing `const registration = ...` block with:

```tsx
    const session = await auth()
    const viewerUserId = session?.user?.id ?? null
    const showStandings =
        contest.status === "LIVE" || contest.status === "CLOSED"

    const [registration, standings] = await Promise.all([
        viewerUserId
            ? prisma.contestRegistration.findUnique({
                  where: {
                      contestId_userId: {
                          contestId: contest.id,
                          userId: viewerUserId,
                      },
                  },
                  select: { contestId: true },
              })
            : Promise.resolve(null),
        showStandings
            ? getContestLeaderboard(contest.id)
            : Promise.resolve([]),
    ])
```

- [ ] **Step 3: Render the standings section**

In the left `<section>`, immediately after the closing `</div>` of the Problems block (the `<div className="mt-8">` that contains the Problems `<h2>`), add:

```tsx
                    {showStandings && (
                        <ContestStandings
                            rows={standings}
                            viewerUserId={viewerUserId}
                            status={contest.status}
                        />
                    )}
```

- [ ] **Step 4: Typecheck + build the route**

Run: `npx tsc --noEmit`
Expected: PASS.

Run: `npm run build`
Expected: Compiles successfully; `/contests/[slug]` listed in the route output.

- [ ] **Step 5: Commit**

```bash
git add app/contests/[slug]/page.tsx
git commit -m "feat(contests): show standings on contest page for live/closed contests"
```

---

### Task 5: E2E test for standings

**Files:**
- Create: `tests/e2e/contest-standings.spec.ts`

- [ ] **Step 1: Write the test**

Create `tests/e2e/contest-standings.spec.ts`:

```ts
import { expect, test } from "@playwright/test"
import { prisma, seedUser, sessionCookie, type SeededUser } from "./fixtures/db"

const PREFIX = "e2e-standings-"
const SLUG = `${PREFIX}contest`
const BASE_URL =
    process.env.E2E_BASE_URL ??
    `http://localhost:${process.env.E2E_PORT ?? "3100"}`

let viewer: SeededUser
let rival: SeededUser
let contestId: string

test.describe.configure({ mode: "serial" })

test.beforeAll(async () => {
    await cleanup()
    viewer = await seedUser({ email: `${PREFIX}viewer@example.test`, name: "Viewer" })
    rival = await seedUser({ email: `${PREFIX}rival@example.test`, name: "Rival" })

    // A LIVE contest: started in the past, ends in the future.
    const startsAt = new Date(Date.now() - 60 * 60 * 1000)
    const endsAt = new Date(Date.now() + 60 * 60 * 1000)
    const contest = await prisma.contest.create({
        data: {
            slug: SLUG,
            title: "E2E Standings Contest",
            description: "Standings e2e.",
            kind: "OFFICIAL",
            status: "SCHEDULED",
            visibility: "PUBLIC",
            startsAt,
            endsAt,
            durationMinutes: 120,
            rated: false,
        },
    })
    contestId = contest.id

    // Rival leads (more points); viewer second.
    await prisma.contestLeaderboardEntry.createMany({
        data: [
            { contestId, userId: rival.id, points: 8, penaltySeconds: 750, solvedCount: 3, rank: 0 },
            { contestId, userId: viewer.id, points: 5, penaltySeconds: 1210, solvedCount: 2, rank: 0 },
        ],
    })
})

test.afterAll(async () => {
    await cleanup()
    await prisma.$disconnect()
})

test("standings show ranked rows with the viewer highlighted as You", async ({
    browser,
}) => {
    const context = await browser.newContext({
        baseURL: BASE_URL,
        storageState: {
            cookies: [sessionCookie(viewer.sessionToken, BASE_URL)],
            origins: [],
        },
    })
    const page = await context.newPage()
    await page.goto(`/contests/${SLUG}`)

    await expect(
        page.getByRole("heading", { name: "Standings" })
    ).toBeVisible()

    const rows = page.locator("tbody tr")
    await expect(rows).toHaveCount(2)
    // Rank 1 is the rival (8 pts); rank 2 is the viewer, shown as "You".
    await expect(rows.nth(0)).toContainText("Rival")
    await expect(rows.nth(0)).toContainText("0:12:30")
    await expect(rows.nth(1)).toContainText("You")
    await expect(rows.nth(1)).toContainText("0:20:10")

    await context.close()
})

async function cleanup() {
    const ids = (
        await prisma.contest.findMany({
            where: { slug: { startsWith: PREFIX } },
            select: { id: true },
        })
    ).map((c) => c.id)
    await prisma.contestLeaderboardEntry.deleteMany({
        where: { contestId: { in: ids } },
    })
    await prisma.contest.deleteMany({ where: { slug: { startsWith: PREFIX } } })
    await prisma.user.deleteMany({ where: { email: { startsWith: PREFIX } } })
}
```

- [ ] **Step 2: Run the test against a local server**

Run (local Postgres + built app on port 3100):

```bash
DATABASE_URL="postgresql://anchitgupta@localhost:5432/datalearn" \
AUTH_TRUST_HOST=true E2E_PORT=3100 \
npx playwright test contest-standings.spec.ts --reporter=list
```

Expected: PASS — the standings table renders with the rival ranked first and the viewer's row showing "You".

> Note: `seedUser` must accept a `name`. It does (see `tests/e2e/fixtures/db.ts` — `seedUser({ email, role?, name? })`).

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/contest-standings.spec.ts
git commit -m "test(e2e): contest standings table renders ranked rows"
```

---

## Self-Review

**Spec coverage:**
- Data action with ICPC ordering, no email → Task 2. ✅
- Pure rank-by-position + `formatPenalty` (`750→0:12:30`, `3661→1:01:01`) → Task 1. ✅
- Component: table columns, `tabular-nums`, viewer highlight + "You", empty states → Task 3. ✅
- Integration: LIVE/CLOSED gating, `Promise.all` fetch, placement below Problems → Task 4. ✅
- Unit + e2e testing → Tasks 1 and 5. ✅
- No schema change; ignores stored `rank` → Tasks 1/2. ✅

**Placeholder scan:** none — every code step shows full content.

**Type consistency:** `LeaderboardRow` / `RawLeaderboardEntry` defined in Task 1 are used unchanged in Tasks 2–3; the Prisma `select` in Task 2 matches `RawLeaderboardEntry`; `ContestStandings` prop names (`rows`, `viewerUserId`, `status`) match the call site in Task 4. ✅
