# Contest Play Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a registered learner submit a contest problem to the server judge during a LIVE contest and see a verdict, on a dedicated play page with a countdown and timezone-correct times.

**Architecture:** A new route `/contests/[slug]/[problemSlug]` (server: fetch + gating) renders `ContestPlayClient`, which reuses the low-level `SqlEditor` + `ResultTable` + `useProblemDB` for editing and a local "Run", and POSTs raw SQL to the existing `/api/contests/[slug]/submit` judge endpoint. Pure helpers (verdict labels, countdown formatting, gating) are unit-tested; a `LocalTime` client component fixes server-timezone display.

**Tech Stack:** Next.js 16 App Router, Prisma 7, React 19, Monaco (`SqlEditor`), DuckDB-WASM/PGlite (`useProblemDB`), `node --import tsx --test`, Playwright.

**Spec:** [`docs/superpowers/specs/2026-06-14-contest-play-design.md`](../specs/2026-06-14-contest-play-design.md)

---

## File Structure

- `lib/contests/play.ts` — **Create.** Pure: `PlayMode`, `gatingFromStatus`, `verdictLabel`, `formatRemaining`. No Prisma/React (imports only the `ContestVerdict` type).
- `scripts/test-contest-play.ts` — **Create.** Unit tests for the pure helpers.
- `components/contests/play/ContestCountdown.tsx` — **Create.** Client countdown.
- `components/ui/LocalTime.tsx` — **Create.** Client local-timezone time render.
- `components/contests/play/ContestPlayClient.tsx` — **Create.** Editor + Run + Submit + verdict.
- `app/contests/[slug]/[problemSlug]/page.tsx` — **Create.** Server route + gating.
- `app/contests/[slug]/page.tsx` — **Modify.** Link problems to play route (LIVE); swap `toLocaleString` → `LocalTime`.
- `app/contests/page.tsx` — **Modify.** Swap `toLocaleString` → `LocalTime`.
- `package.json` — **Modify.** Add `test:contest-play`.
- `tests/e2e/contest-play.spec.ts` — **Create.** Seed LIVE contest + hidden data, submit, assert verdict.

---

### Task 1: Pure helpers (gating, verdict label, countdown format)

**Files:**
- Create: `lib/contests/play.ts`
- Create: `scripts/test-contest-play.ts`
- Modify: `package.json`

- [ ] **Step 1: Write the failing test** — create `scripts/test-contest-play.ts`:

```ts
// Unit tests for contest-play pure helpers (no DB, no React).
// Run: node --import tsx --test scripts/test-contest-play.ts
import { describe, it } from "node:test"
import assert from "node:assert/strict"
import {
    formatRemaining,
    gatingFromStatus,
    verdictLabel,
} from "../lib/contests/play"

describe("gatingFromStatus", () => {
    it("status gates apply to everyone; sign-in/registration only gate LIVE", () => {
        assert.equal(gatingFromStatus("SCHEDULED", true, true), "NOT_STARTED")
        assert.equal(gatingFromStatus("CLOSED", true, true), "ENDED")
        assert.equal(gatingFromStatus("LIVE", false, false), "SIGNED_OUT")
        assert.equal(gatingFromStatus("LIVE", true, false), "NOT_REGISTERED")
        assert.equal(gatingFromStatus("LIVE", true, true), "PLAY")
    })
})

describe("verdictLabel", () => {
    it("ACCEPTED includes points; others map to an error/neutral tone", () => {
        assert.deepEqual(verdictLabel("ACCEPTED", 3), {
            text: "Accepted (+3 pts)",
            tone: "success",
        })
        assert.equal(verdictLabel("WRONG_ANSWER", 3).tone, "error")
        assert.equal(verdictLabel("RUNTIME_ERROR", 3).tone, "error")
        assert.equal(verdictLabel("INTERNAL_ERROR", 3).tone, "neutral")
    })
})

describe("formatRemaining", () => {
    it("formats ms as H:MM:SS and clamps negatives to zero", () => {
        assert.equal(formatRemaining(0), "0:00:00")
        assert.equal(formatRemaining(750_000), "0:12:30")
        assert.equal(formatRemaining(3_661_000), "1:01:01")
        assert.equal(formatRemaining(-5_000), "0:00:00")
    })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --import tsx --test scripts/test-contest-play.ts`
Expected: FAIL — cannot find module `../lib/contests/play`.

- [ ] **Step 3: Write minimal implementation** — create `lib/contests/play.ts`:

```ts
// Pure helpers for the contest play UI. No Prisma client, no React — only the
// ContestVerdict type. See docs/superpowers/specs/2026-06-14-contest-play-design.md.
import type { ContestVerdict } from "@prisma/client"

export type PlayMode =
    | "SIGNED_OUT"
    | "NOT_STARTED"
    | "ENDED"
    | "NOT_REGISTERED"
    | "PLAY"

/**
 * Decide what the play page should render. Status gates (NOT_STARTED / ENDED)
 * apply to everyone; sign-in and registration only matter while LIVE.
 */
export function gatingFromStatus(
    status: "SCHEDULED" | "LIVE" | "CLOSED",
    signedIn: boolean,
    registered: boolean
): PlayMode {
    if (status === "SCHEDULED") return "NOT_STARTED"
    if (status === "CLOSED") return "ENDED"
    if (!signedIn) return "SIGNED_OUT"
    return registered ? "PLAY" : "NOT_REGISTERED"
}

export type VerdictTone = "success" | "error" | "neutral"

/** Verdict-only label (no hidden-data leak). ACCEPTED carries the points won. */
export function verdictLabel(
    verdict: ContestVerdict,
    points: number
): { text: string; tone: VerdictTone } {
    switch (verdict) {
        case "ACCEPTED":
            return { text: `Accepted (+${points} pts)`, tone: "success" }
        case "WRONG_ANSWER":
            return { text: "Wrong Answer", tone: "error" }
        case "TIME_LIMIT":
            return { text: "Time Limit Exceeded", tone: "error" }
        case "MEMORY_LIMIT":
            return { text: "Memory Limit Exceeded", tone: "error" }
        case "RUNTIME_ERROR":
            return { text: "Runtime Error", tone: "error" }
        case "COMPILE_ERROR":
            return { text: "Compile Error", tone: "error" }
        case "REJECTED":
            return { text: "Rejected", tone: "error" }
        case "INTERNAL_ERROR":
            return { text: "Internal Error", tone: "neutral" }
    }
}

/** Format remaining milliseconds as H:MM:SS, clamped at zero. */
export function formatRemaining(ms: number): string {
    const total = Math.max(0, Math.floor(ms / 1000))
    const hours = Math.floor(total / 3600)
    const minutes = Math.floor((total % 3600) / 60)
    const seconds = total % 60
    const pad = (n: number) => String(n).padStart(2, "0")
    return `${hours}:${pad(minutes)}:${pad(seconds)}`
}
```

- [ ] **Step 4: Add npm script** — in `package.json`, after the `"test:contest-leaderboard"` line, add:

```json
"test:contest-play": "node --import tsx --test scripts/test-contest-play.ts",
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm run test:contest-play`
Expected: PASS — all three describe blocks green.

- [ ] **Step 6: Commit**

```bash
git add lib/contests/play.ts scripts/test-contest-play.ts package.json
git commit -m "feat(contests): pure contest-play helpers (gating, verdict label, countdown)"
```

---

### Task 2: `ContestCountdown` client component

**Files:**
- Create: `components/contests/play/ContestCountdown.tsx`

- [ ] **Step 1: Write the component**

```tsx
"use client"

import { useEffect, useState } from "react"
import { formatRemaining } from "@/lib/contests/play"

type Props = {
    /** ISO timestamp of the contest end. */
    endsAt: string
    /** Called once when the countdown reaches zero. */
    onExpire?: () => void
}

export function ContestCountdown({ endsAt, onExpire }: Props) {
    const end = new Date(endsAt).getTime()
    // `null` until mounted so server and first client render match (no hydration
    // mismatch); the interval then drives the tick.
    const [now, setNow] = useState<number | null>(null)

    useEffect(() => {
        setNow(Date.now())
        const id = setInterval(() => setNow(Date.now()), 1000)
        return () => clearInterval(id)
    }, [])

    const expired = now !== null && end - now <= 0

    useEffect(() => {
        if (expired) onExpire?.()
    }, [expired, onExpire])

    if (now === null) {
        return <span className="tabular-nums text-muted-foreground">—</span>
    }
    if (expired) {
        return <span className="text-muted-foreground">Contest ended</span>
    }
    return (
        <span className="tabular-nums text-muted-foreground">
            {formatRemaining(end - now)} left
        </span>
    )
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add components/contests/play/ContestCountdown.tsx
git commit -m "feat(contests): live contest countdown component"
```

---

### Task 3: `LocalTime` client component

**Files:**
- Create: `components/ui/LocalTime.tsx`

- [ ] **Step 1: Write the component**

```tsx
"use client"

import { useEffect, useState } from "react"

/**
 * Render a timestamp in the viewer's timezone. Server components render times
 * with the server's TZ via `.toLocaleString()`; this fixes that. Falls back to
 * an explicit UTC string until mounted, so the server/client first render match.
 */
export function LocalTime({ value }: { value: string }) {
    const [local, setLocal] = useState<string | null>(null)

    useEffect(() => {
        setLocal(new Date(value).toLocaleString())
    }, [value])

    return (
        <span suppressHydrationWarning>
            {local ??
                `${new Date(value).toLocaleString("en-US", {
                    timeZone: "UTC",
                })} UTC`}
        </span>
    )
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add components/ui/LocalTime.tsx
git commit -m "feat(ui): LocalTime renders timestamps in the viewer timezone"
```

---

### Task 4: `ContestPlayClient` component

**Files:**
- Create: `components/contests/play/ContestPlayClient.tsx`

- [ ] **Step 1: Write the component**

```tsx
"use client"

import { useCallback, useState } from "react"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import type { Dialect } from "@/lib/use-problem-db"
import { useProblemDB } from "@/lib/use-problem-db"
import { SqlEditor } from "@/components/sql/SqlEditor"
import { ResultTable } from "@/components/sql/ResultTable"
import { Badge } from "@/components/ui/Badge"
import { cn } from "@/lib/utils"
import { verdictLabel, type PlayMode } from "@/lib/contests/play"
import type { ContestVerdict } from "@prisma/client"
import { ContestCountdown } from "./ContestCountdown"

type PlayProblem = {
    id: string
    number: number
    title: string
    slug: string
    schemaSql: string | null
    dialect: Dialect
}

type Props = {
    contestSlug: string
    contestTitle: string
    endsAt: string
    problem: PlayProblem
    points: number
    mode: PlayMode
}

export function ContestPlayClient({
    contestSlug,
    contestTitle,
    endsAt,
    problem,
    points,
    mode,
}: Props) {
    const [sql, setSql] = useState("")
    const [result, setResult] = useState<{
        rows: unknown[]
        error: string | null
    } | null>(null)
    const [running, setRunning] = useState(false)
    const [submitting, setSubmitting] = useState(false)
    const [expired, setExpired] = useState(false)
    const [submitError, setSubmitError] = useState<string | null>(null)
    const [verdict, setVerdict] = useState<{
        text: string
        tone: "success" | "error" | "neutral"
        attempt: number
    } | null>(null)

    const { ready, runQuery } = useProblemDB(problem.schemaSql, problem.dialect, {
        problemSlug: problem.slug,
    })

    const runLocal = useCallback(async () => {
        if (!ready || running || !sql.trim()) return
        setRunning(true)
        try {
            const out = await runQuery(sql)
            setResult({ rows: out.rows, error: null })
        } catch (err) {
            setResult({
                rows: [],
                error: err instanceof Error ? err.message : "Query failed",
            })
        } finally {
            setRunning(false)
        }
    }, [ready, running, sql, runQuery])

    const submit = useCallback(async () => {
        if (submitting || !sql.trim()) return
        setSubmitting(true)
        setSubmitError(null)
        try {
            const res = await fetch(`/api/contests/${contestSlug}/submit`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    problemId: problem.id,
                    sql,
                    dialect: problem.dialect,
                    idempotencyKey: crypto.randomUUID(),
                }),
            })
            const json = await res.json().catch(() => ({}))
            if (!res.ok) {
                setSubmitError(json.error ?? "Submission failed. Try again.")
                return
            }
            const data = json.data as {
                verdict: ContestVerdict
                attemptNumber: number
            }
            setVerdict({
                ...verdictLabel(data.verdict, points),
                attempt: data.attemptNumber,
            })
        } catch {
            setSubmitError("Network error. Try again.")
        } finally {
            setSubmitting(false)
        }
    }, [submitting, sql, contestSlug, problem.id, problem.dialect, points])

    if (mode === "SIGNED_OUT") {
        return <Gate>Sign in to compete in this contest.</Gate>
    }
    if (mode === "NOT_STARTED") {
        return <Gate>This contest hasn&apos;t started yet.</Gate>
    }
    if (mode === "NOT_REGISTERED") {
        return (
            <Gate>
                Register on the{" "}
                <Link
                    href={`/contests/${contestSlug}`}
                    className="text-primary hover:underline"
                >
                    contest page
                </Link>{" "}
                to compete.
            </Gate>
        )
    }

    const canSubmit = mode === "PLAY" && !expired

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <Link
                    href={`/contests/${contestSlug}`}
                    className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                >
                    <ArrowLeft className="h-3.5 w-3.5" />
                    {contestTitle}
                </Link>
                <div className="flex items-center gap-3 text-sm">
                    <Badge variant="outline">{points} pts</Badge>
                    <ContestCountdown
                        endsAt={endsAt}
                        onExpire={() => setExpired(true)}
                    />
                </div>
            </div>

            <h1 className="text-xl font-semibold tracking-tight">
                #{problem.number}. {problem.title}
            </h1>

            <SqlEditor
                value={sql}
                onChange={(v) => setSql(v ?? "")}
                onRun={runLocal}
                onSubmit={canSubmit ? submit : undefined}
                running={running || submitting}
                runDisabled={!ready}
                dialect={problem.dialect}
            />

            <div className="flex flex-wrap items-center gap-3">
                {canSubmit ? (
                    <button
                        type="button"
                        onClick={submit}
                        disabled={submitting || !sql.trim()}
                        className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary-hover disabled:opacity-50"
                    >
                        {submitting ? "Submitting…" : "Submit to contest"}
                    </button>
                ) : (
                    <span className="text-sm text-muted-foreground">
                        {mode === "ENDED"
                            ? "This contest has ended — submissions are closed."
                            : "Submissions are closed."}
                    </span>
                )}
                {verdict && (
                    <span
                        className={cn(
                            "text-sm font-medium",
                            verdict.tone === "success" && "text-easy-fg",
                            verdict.tone === "error" && "text-destructive",
                            verdict.tone === "neutral" && "text-muted-foreground"
                        )}
                    >
                        {verdict.text} · attempt {verdict.attempt}
                    </span>
                )}
                {submitError && (
                    <span className="text-sm text-destructive" role="alert">
                        {submitError}
                    </span>
                )}
            </div>

            <ResultTable data={result?.rows ?? []} error={result?.error} />
        </div>
    )
}

function Gate({ children }: { children: React.ReactNode }) {
    return (
        <div className="rounded-md border border-border bg-surface p-6 text-sm text-muted-foreground">
            {children}
        </div>
    )
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS. (If `runQuery`'s return field isn't `rows`, match `SqlQueryResult` in `lib/use-problem-db.ts` — adjust `out.rows`.)

- [ ] **Step 3: Commit**

```bash
git add components/contests/play/ContestPlayClient.tsx
git commit -m "feat(contests): ContestPlayClient — editor, local run, submit-to-judge, verdict"
```

---

### Task 5: Play route page (server + gating)

**Files:**
- Create: `app/contests/[slug]/[problemSlug]/page.tsx`

- [ ] **Step 1: Write the page**

```tsx
import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getContestBySlug } from "@/actions/contests"
import { getProblem } from "@/actions/problems"
import { gatingFromStatus } from "@/lib/contests/play"
import { ContestPlayClient } from "@/components/contests/play/ContestPlayClient"
import { Container } from "@/components/ui/Container"

export const dynamic = "force-dynamic"

type Props = { params: Promise<{ slug: string; problemSlug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { slug, problemSlug } = await params
    const contest = await getContestBySlug(slug)
    return { title: contest ? `${contest.title} — ${problemSlug}` : "Contest" }
}

export default async function ContestPlayPage({ params }: Props) {
    const { slug, problemSlug } = await params

    const [contest, problemResult, session] = await Promise.all([
        getContestBySlug(slug),
        getProblem(problemSlug),
        auth(),
    ])
    if (!contest) notFound()

    const problem = problemResult.data
    if (!problem) notFound()

    // The problem must be attached to this contest.
    const attached = contest.problems.find(
        (item) => item.problem.slug === problemSlug
    )
    if (!attached) notFound()

    const viewerUserId = session?.user?.id ?? null
    const registration = viewerUserId
        ? await prisma.contestRegistration.findUnique({
              where: {
                  contestId_userId: {
                      contestId: contest.id,
                      userId: viewerUserId,
                  },
              },
              select: { contestId: true },
          })
        : null

    const mode = gatingFromStatus(
        contest.status,
        Boolean(viewerUserId),
        Boolean(registration)
    )
    const dialect = problem.dialects?.[0] ?? "DUCKDB"

    return (
        <Container width="2xl" className="py-8">
            <ContestPlayClient
                contestSlug={contest.slug}
                contestTitle={contest.title}
                endsAt={contest.endsAt.toISOString()}
                problem={{
                    id: attached.problem.id,
                    number: attached.problem.number,
                    title: attached.problem.title,
                    slug: attached.problem.slug,
                    schemaSql: problem.schema?.sql ?? null,
                    dialect,
                }}
                points={attached.points}
                mode={mode}
            />
        </Container>
    )
}
```

> Note: `getContestBySlug` returns `problems: []` while `SCHEDULED` (problems hidden), so `attached` is undefined and the page `notFound()`s for not-yet-started contests — acceptable (nothing to play yet).

- [ ] **Step 2: Typecheck + build the route**

Run: `npx tsc --noEmit`
Expected: PASS.

Run: `npm run build`
Expected: Compiles; route list shows `/contests/[slug]/[problemSlug]`.

- [ ] **Step 3: Commit**

```bash
git add "app/contests/[slug]/[problemSlug]/page.tsx"
git commit -m "feat(contests): contest play route with status/registration gating"
```

---

### Task 6: Wire links + timezone-correct times

**Files:**
- Modify: `app/contests/[slug]/page.tsx`
- Modify: `app/contests/page.tsx`

- [ ] **Step 1: Link contest problems to the play route when LIVE**

In `app/contests/[slug]/page.tsx`, the problem list renders a `<Link href={`/practice/${item.problem.slug}`}>`. Replace that `href` so LIVE/CLOSED contests route into the play page:

```tsx
href={
    contest.status === "LIVE" || contest.status === "CLOSED"
        ? `/contests/${contest.slug}/${item.problem.slug}`
        : `/practice/${item.problem.slug}`
}
```

- [ ] **Step 2: Swap server `toLocaleString` for `LocalTime` (detail page)**

At the top of `app/contests/[slug]/page.tsx`, add:

```tsx
import { LocalTime } from "@/components/ui/LocalTime"
```

Replace `{contest.startsAt.toLocaleString()}` with `<LocalTime value={contest.startsAt.toISOString()} />` and `{contest.endsAt.toLocaleString()}` with `<LocalTime value={contest.endsAt.toISOString()} />`.

- [ ] **Step 3: Swap server `toLocaleString` for `LocalTime` (list page)**

In `app/contests/page.tsx`, add the same import and replace `{contest.startsAt.toLocaleString()}` with `<LocalTime value={contest.startsAt.toISOString()} />` (and any `endsAt.toLocaleString()` likewise).

- [ ] **Step 4: Typecheck + build**

Run: `npx tsc --noEmit && npm run build`
Expected: PASS / compiles.

- [ ] **Step 5: Commit**

```bash
git add "app/contests/[slug]/page.tsx" app/contests/page.tsx
git commit -m "feat(contests): route contest problems to the play page; show times in viewer TZ"
```

---

### Task 7: E2E — submit a contest problem and get a verdict

**Files:**
- Create: `tests/e2e/contest-play.spec.ts`

- [ ] **Step 1: Write the test**

```ts
import { expect, test } from "@playwright/test"
import { prisma, seedUser, sessionCookie, type SeededUser } from "./fixtures/db"

const PREFIX = "e2e-play-"
const SLUG = `${PREFIX}contest`
const BASE_URL =
    process.env.E2E_BASE_URL ??
    `http://localhost:${process.env.E2E_PORT ?? "3100"}`

let player: SeededUser
let problemSlug: string

test.describe.configure({ mode: "serial" })

test.beforeAll(async () => {
    await cleanup()
    player = await seedUser({ email: `${PREFIX}player@example.test`, name: "Player" })

    const schema = await prisma.sqlSchema.create({
        data: { name: `${PREFIX}schema`, sql: "CREATE TABLE t (x INT);" },
    })
    const max = await prisma.sQLProblem.aggregate({ _max: { number: true } })
    const problem = await prisma.sQLProblem.create({
        data: {
            number: (max._max.number ?? 0) + 60_000,
            slug: `${PREFIX}problem`,
            title: "E2E Play Problem",
            description: "Return x ordered.",
            schemaDescription: "One table t(x).",
            schemaId: schema.id,
            status: "PUBLISHED",
            dialects: ["DUCKDB"],
            expectedOutput: "[]",
            expectedOutputs: { DUCKDB: "[]" },
            solutionSql: "SELECT x FROM t ORDER BY x",
            solutions: { DUCKDB: "SELECT x FROM t ORDER BY x" },
            // Hidden data the server judge runs against.
            hiddenSchemas: {
                DUCKDB: "CREATE TABLE t (x INT); INSERT INTO t VALUES (1), (2);",
            },
            hiddenExpectedOutputs: { DUCKDB: [{ x: 1 }, { x: 2 }] },
        },
    })
    problemSlug = problem.slug

    // LIVE contest: started in the past, ends in the future.
    const contest = await prisma.contest.create({
        data: {
            slug: SLUG,
            title: "E2E Play Contest",
            description: "Play e2e.",
            kind: "WEEKLY",
            status: "SCHEDULED",
            visibility: "PUBLIC",
            startsAt: new Date(Date.now() - 60 * 60 * 1000),
            endsAt: new Date(Date.now() + 60 * 60 * 1000),
            durationMinutes: 120,
            rated: false,
            createdById: player.id,
            problems: {
                create: [{ problemId: problem.id, position: 1, points: 3 }],
            },
        },
    })
    await prisma.contestRegistration.create({
        data: { contestId: contest.id, userId: player.id },
    })
})

test.afterAll(async () => {
    await cleanup()
    await prisma.$disconnect()
})

test("registered player submits a correct solution and sees Accepted", async ({
    browser,
}) => {
    const context = await browser.newContext({
        baseURL: BASE_URL,
        storageState: {
            cookies: [sessionCookie(player.sessionToken, BASE_URL)],
            origins: [],
        },
    })
    const page = await context.newPage()
    await page.goto(`/contests/${SLUG}/${problemSlug}`)

    // Type the known-correct SQL into the Monaco editor.
    await page.locator(".monaco-editor textarea").first().click()
    await page.keyboard.type("SELECT x FROM t ORDER BY x")

    await page.getByRole("button", { name: /submit to contest/i }).click()

    await expect(page.getByText(/Accepted/i).first()).toBeVisible({
        timeout: 30_000,
    })

    // Leaderboard now lists the player on the contest page.
    await page.goto(`/contests/${SLUG}`)
    await expect(
        page.getByRole("heading", { name: "Standings", exact: true })
    ).toBeVisible()
    await expect(page.locator("tbody tr")).toContainText(["You"])

    await context.close()
})

async function cleanup() {
    const ids = (
        await prisma.contest.findMany({
            where: { slug: { startsWith: PREFIX } },
            select: { id: true },
        })
    ).map((c) => c.id)
    await prisma.contestProblemSolve.deleteMany({ where: { contestId: { in: ids } } })
    await prisma.contestSubmission.deleteMany({ where: { contestId: { in: ids } } })
    await prisma.contestLeaderboardEntry.deleteMany({ where: { contestId: { in: ids } } })
    await prisma.contestProblem.deleteMany({ where: { contestId: { in: ids } } })
    await prisma.contestRegistration.deleteMany({ where: { contestId: { in: ids } } })
    await prisma.contest.deleteMany({ where: { slug: { startsWith: PREFIX } } })
    await prisma.sQLProblem.deleteMany({ where: { slug: { startsWith: PREFIX } } })
    await prisma.sqlSchema.deleteMany({ where: { name: { startsWith: PREFIX } } })
    await prisma.user.deleteMany({ where: { email: { startsWith: PREFIX } } })
}
```

- [ ] **Step 2: Run against a local server (built with the judge worker)**

Run:

```bash
DATABASE_URL="postgresql://anchitgupta@localhost:5432/datalearn" \
AUTH_TRUST_HOST=true E2E_PORT=3100 \
npx playwright test contest-play.spec.ts --reporter=list
```

Expected: PASS — the judge runs the SQL against hidden data, returns ACCEPTED, the verdict shows, and the player appears in standings.

> Note: the server must be built with the contest judge worker. `npm run build` runs `prebuild` → `build:contest-worker`, so a normal build is sufficient. If the verdict never resolves, confirm `dist/contest-judge-worker.cjs` exists.

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/contest-play.spec.ts
git commit -m "test(e2e): contest play — submit correct solution, assert Accepted + standings"
```

---

## Self-Review

**Spec coverage:**
- Dedicated route + gating modes → Task 5 (+ pure `gatingFromStatus` in Task 1). ✅
- Editor + local Run + submit-to-judge + verdict (raw SQL, not result rows) → Task 4. ✅
- Verdict-only labels → Task 1 `verdictLabel` + Task 4 panel. ✅
- Countdown → Task 2; timezone fix via `LocalTime` → Task 3 + Task 6. ✅
- Wire contest problem links to the play route → Task 6. ✅
- Unit + e2e tests → Tasks 1 and 7. ✅
- No schema changes; reuses existing submit endpoint. ✅

**Placeholder scan:** none — every code step is complete.

**Type consistency:** `PlayMode` (Task 1) is consumed by Tasks 4–5; `verdictLabel` signature `(ContestVerdict, number) → {text, tone}` matches the Task 4 call; `Dialect` imported from `@/lib/use-problem-db` (the same source `SqlEditor` uses); `ContestPlayClient` props (`contestSlug, contestTitle, endsAt, problem{id,number,title,slug,schemaSql,dialect}, points, mode`) match the Task 5 call site; the submit body `{problemId, sql, dialect, idempotencyKey}` matches the API's `SubmitBody` zod schema; the API response `{ data: { verdict, attemptNumber } }` matches Task 4's read. ✅
