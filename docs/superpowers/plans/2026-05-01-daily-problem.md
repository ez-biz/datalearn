# Daily Problem v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a compact Daily Problem feature with stable auto-filled daily rows, admin override, `/daily` redirect, signed-in homepage card, and UserMenu entry.

**Architecture:** Add a `DailyProblem` table keyed by UTC-midnight date. Centralize date normalization and auto-pick ordering in pure helpers, then wrap Prisma access in `actions/daily.ts`. Learner surfaces consume those server actions; admin scheduling uses a server-rendered page plus server actions.

**Tech Stack:** Next.js 16 App Router, TypeScript strict, Prisma 7/Postgres, Server Actions, Playwright e2e, `node:test` helper script via `tsx`.

---

## File Map

- Modify `prisma/schema.prisma`: add `DailyProblem`, `DailyProblemSource`, and `SQLProblem.dailyProblems`.
- Create migration with `npx prisma migrate dev --name add_daily_problem`.
- Create `lib/daily-utils.ts`: pure UTC date normalization and candidate selection helpers.
- Create `scripts/test-daily-utils.ts`: `node:test` coverage for pure helpers.
- Create `actions/daily.ts`: Prisma-backed daily resolver, status lookup, admin list/set actions.
- Create `app/daily/page.tsx`: resolve today's daily and redirect to `/practice/[slug]`.
- Modify `app/page.tsx`: fetch daily status for signed-in users and pass it into `UserHome`.
- Modify `components/home/UserHome.tsx`: add compact Daily Problem card.
- Modify `components/layout/Navbar.tsx`: fetch daily solved state and pass it into menu/mobile nav.
- Modify `components/layout/UserMenu.tsx`: add Daily Problem menu item.
- Modify `components/admin/AdminNav.tsx`: add Daily nav item.
- Create `app/admin/daily/page.tsx`: compact schedule table and manual override form.
- Create `tests/e2e/daily.spec.ts`: redirect, auto-fill, admin override, and solved-state coverage.

---

## Task 1: Prisma Schema And Migration

**Files:**
- Modify: `prisma/schema.prisma`
- Generate: `prisma/migrations/<timestamp>_add_daily_problem/migration.sql`

- [ ] **Step 1: Update Prisma schema**

Add `dailyProblems DailyProblem[]` to `model SQLProblem` near `listItems`:

```prisma
  listItems         ProblemListItem[]
  dailyProblems     DailyProblem[]
  createdAt         DateTime   @default(now())
```

Add the new model and enum after `ProblemListItem`:

```prisma
/// One stable daily challenge for a UTC calendar date. Rows can be manually
/// scheduled by admins or auto-filled on first request.
model DailyProblem {
  id        String             @id @default(cuid())
  date      DateTime           @unique @db.Date
  problemId String
  problem   SQLProblem         @relation(fields: [problemId], references: [id], onDelete: Restrict)
  source    DailyProblemSource @default(AUTO)
  createdAt DateTime           @default(now())
  updatedAt DateTime           @updatedAt

  @@index([problemId])
}

enum DailyProblemSource {
  AUTO
  MANUAL
}
```

- [ ] **Step 2: Create migration and regenerate Prisma client**

Run:

```bash
npx prisma migrate dev --name add_daily_problem
```

Expected:

```text
Applying migration `..._add_daily_problem`
Generated Prisma Client
```

- [ ] **Step 3: Inspect migration**

Run:

```bash
sed -n '1,220p' prisma/migrations/*_add_daily_problem/migration.sql
```

Expected migration properties:

- creates enum `DailyProblemSource`
- creates table `DailyProblem`
- creates `date` as `DATE NOT NULL`
- adds unique index on `date`
- adds index on `problemId`
- adds FK from `DailyProblem.problemId` to `SQLProblem.id` with `ON DELETE RESTRICT`

- [ ] **Step 4: Commit schema task**

```bash
git add prisma/schema.prisma prisma/migrations/*_add_daily_problem/migration.sql
git commit -m "feat: add daily problem schema"
```

---

## Task 2: Pure Daily Helpers With Unit Tests

**Files:**
- Create: `lib/daily-utils.ts`
- Create: `scripts/test-daily-utils.ts`

- [ ] **Step 1: Write the failing helper tests**

Create `scripts/test-daily-utils.ts`:

```ts
import assert from "node:assert/strict"
import test from "node:test"
import {
    normalizeDailyDate,
    selectAutoDailyCandidate,
    toDailyKey,
    type DailyProblemCandidate,
} from "../lib/daily-utils"

test("normalizeDailyDate returns UTC midnight", () => {
    const d = new Date("2026-05-01T23:45:30.123Z")
    assert.equal(normalizeDailyDate(d).toISOString(), "2026-05-01T00:00:00.000Z")
})

test("toDailyKey formats the normalized UTC date", () => {
    assert.equal(toDailyKey(new Date("2026-05-01T23:45:30.123Z")), "2026-05-01")
})

test("selectAutoDailyCandidate prefers never-used published problems", () => {
    const rows: DailyProblemCandidate[] = [
        { id: "old", number: 1, lastDailyAt: new Date("2026-04-01T00:00:00.000Z") },
        { id: "never-high", number: 5, lastDailyAt: null },
        { id: "never-low", number: 2, lastDailyAt: null },
    ]
    assert.equal(selectAutoDailyCandidate(rows)?.id, "never-low")
})

test("selectAutoDailyCandidate prefers oldest-used problem when all were used", () => {
    const rows: DailyProblemCandidate[] = [
        { id: "recent", number: 1, lastDailyAt: new Date("2026-04-20T00:00:00.000Z") },
        { id: "old", number: 3, lastDailyAt: new Date("2026-04-01T00:00:00.000Z") },
        { id: "old-low", number: 2, lastDailyAt: new Date("2026-04-01T00:00:00.000Z") },
    ]
    assert.equal(selectAutoDailyCandidate(rows)?.id, "old-low")
})

test("selectAutoDailyCandidate returns null for an empty candidate set", () => {
    assert.equal(selectAutoDailyCandidate([]), null)
})
```

- [ ] **Step 2: Run tests and verify they fail**

Run:

```bash
npx tsx scripts/test-daily-utils.ts
```

Expected:

```text
Cannot find module '../lib/daily-utils'
```

- [ ] **Step 3: Implement pure helpers**

Create `lib/daily-utils.ts`:

```ts
const DAY_KEY_RE = /^\d{4}-\d{2}-\d{2}$/

export type DailyProblemCandidate = {
    id: string
    number: number
    lastDailyAt: Date | null
}

export function normalizeDailyDate(date: Date = new Date()): Date {
    return new Date(
        Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
    )
}

export function parseDailyDateKey(key: string): Date {
    if (!DAY_KEY_RE.test(key)) {
        throw new Error("Daily date must use YYYY-MM-DD format.")
    }
    const [year, month, day] = key.split("-").map(Number)
    return normalizeDailyDate(new Date(Date.UTC(year, month - 1, day)))
}

export function toDailyKey(date: Date): string {
    const normalized = normalizeDailyDate(date)
    const year = normalized.getUTCFullYear()
    const month = String(normalized.getUTCMonth() + 1).padStart(2, "0")
    const day = String(normalized.getUTCDate()).padStart(2, "0")
    return `${year}-${month}-${day}`
}

export function addUtcDays(date: Date, days: number): Date {
    const normalized = normalizeDailyDate(date)
    normalized.setUTCDate(normalized.getUTCDate() + days)
    return normalized
}

export function selectAutoDailyCandidate<T extends DailyProblemCandidate>(
    candidates: T[]
): T | null {
    if (candidates.length === 0) return null
    return [...candidates].sort((a, b) => {
        if (a.lastDailyAt === null && b.lastDailyAt !== null) return -1
        if (a.lastDailyAt !== null && b.lastDailyAt === null) return 1
        if (a.lastDailyAt !== null && b.lastDailyAt !== null) {
            const diff = a.lastDailyAt.getTime() - b.lastDailyAt.getTime()
            if (diff !== 0) return diff
        }
        return a.number - b.number
    })[0]
}
```

- [ ] **Step 4: Run helper tests**

Run:

```bash
npx tsx scripts/test-daily-utils.ts
```

Expected:

```text
# pass 5
```

- [ ] **Step 5: Commit helper task**

```bash
git add lib/daily-utils.ts scripts/test-daily-utils.ts
git commit -m "test: add daily problem helper coverage"
```

---

## Task 3: Daily Server Actions

**Files:**
- Create: `actions/daily.ts`

- [ ] **Step 1: Create daily server action module**

Create `actions/daily.ts`:

```ts
"use server"

import { revalidatePath } from "next/cache"
import type { Prisma } from "@prisma/client"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import {
    addUtcDays,
    normalizeDailyDate,
    parseDailyDateKey,
    selectAutoDailyCandidate,
    toDailyKey,
} from "@/lib/daily-utils"

export type DailyProblemSummary = {
    id: string
    date: Date
    source: "AUTO" | "MANUAL"
    updatedAt: Date
    problem: {
        id: string
        number: number
        slug: string
        title: string
        difficulty: string
    }
}

export type DailyStatus = {
    daily: DailyProblemSummary | null
    solvedToday: boolean
}

const DAILY_SELECT = {
    id: true,
    date: true,
    source: true,
    updatedAt: true,
    problem: {
        select: {
            id: true,
            number: true,
            slug: true,
            title: true,
            difficulty: true,
        },
    },
} as const

function toSummary(row: {
    id: string
    date: Date
    source: "AUTO" | "MANUAL"
    updatedAt: Date
    problem: {
        id: string
        number: number
        slug: string
        title: string
        difficulty: string
    }
}): DailyProblemSummary {
    return row
}

async function pickAutoProblem(tx: Prisma.TransactionClient): Promise<string | null> {
    const problems = await tx.sQLProblem.findMany({
        where: { status: "PUBLISHED" },
        select: {
            id: true,
            number: true,
            dailyProblems: {
                select: { date: true },
                orderBy: { date: "desc" },
                take: 1,
            },
        },
    })
    const candidate = selectAutoDailyCandidate(
        problems.map((p) => ({
            id: p.id,
            number: p.number,
            lastDailyAt: p.dailyProblems[0]?.date ?? null,
        }))
    )
    return candidate?.id ?? null
}

export async function getOrCreateDailyProblem(
    date: Date = new Date()
): Promise<DailyProblemSummary | null> {
    const dailyDate = normalizeDailyDate(date)

    const existing = await prisma.dailyProblem.findUnique({
        where: { date: dailyDate },
        select: DAILY_SELECT,
    })
    if (existing) return toSummary(existing)

    try {
        const created = await prisma.$transaction(async (tx) => {
            const existingInTx = await tx.dailyProblem.findUnique({
                where: { date: dailyDate },
                select: DAILY_SELECT,
            })
            if (existingInTx) return existingInTx

            const problemId = await pickAutoProblem(tx)
            if (!problemId) return null

            return tx.dailyProblem.create({
                data: {
                    date: dailyDate,
                    problemId,
                    source: "AUTO",
                },
                select: DAILY_SELECT,
            })
        })
        return created ? toSummary(created) : null
    } catch (e: any) {
        if (e?.code === "P2002") {
            const row = await prisma.dailyProblem.findUnique({
                where: { date: dailyDate },
                select: DAILY_SELECT,
            })
            return row ? toSummary(row) : null
        }
        throw e
    }
}

export async function getDailyStatusForCurrentUser(
    date: Date = new Date()
): Promise<DailyStatus> {
    const [session, daily] = await Promise.all([auth(), getOrCreateDailyProblem(date)])
    if (!daily || !session?.user?.id) {
        return { daily, solvedToday: false }
    }
    const nextDailyDate = addUtcDays(daily.date, 1)
    const accepted = await prisma.submission.findFirst({
        where: {
            userId: session.user.id,
            problemId: daily.problem.id,
            status: "ACCEPTED",
            createdAt: {
                gte: daily.date,
                lt: nextDailyDate,
            },
        },
        select: { id: true },
    })
    return { daily, solvedToday: Boolean(accepted) }
}

export async function listDailyProblems(center: Date = new Date()) {
    const today = normalizeDailyDate(center)
    const start = addUtcDays(today, -7)
    const end = addUtcDays(today, 14)
    return prisma.dailyProblem.findMany({
        where: {
            date: {
                gte: start,
                lte: end,
            },
        },
        orderBy: { date: "asc" },
        select: DAILY_SELECT,
    })
}

export async function setManualDailyProblem(input: {
    dateKey: string
    problemId: string
}): Promise<{ ok: true } | { ok: false; error: string }> {
    const session = await auth()
    if (session?.user?.role !== "ADMIN") {
        return { ok: false, error: "Admin access required." }
    }

    let date: Date
    try {
        date = parseDailyDateKey(input.dateKey)
    } catch (e: any) {
        return { ok: false, error: e?.message ?? "Invalid date." }
    }

    const problem = await prisma.sQLProblem.findUnique({
        where: { id: input.problemId },
        select: { id: true, status: true },
    })
    if (!problem || problem.status !== "PUBLISHED") {
        return { ok: false, error: "Pick a published problem." }
    }

    await prisma.dailyProblem.upsert({
        where: { date },
        update: { problemId: problem.id, source: "MANUAL" },
        create: { date, problemId: problem.id, source: "MANUAL" },
    })

    revalidatePath("/")
    revalidatePath("/daily")
    revalidatePath("/admin/daily")
    return { ok: true }
}

export { toDailyKey }
```

- [ ] **Step 2: Typecheck the module**

Run:

```bash
npx tsc --noEmit
```

Expected: no TypeScript errors.

- [ ] **Step 3: Commit server action task**

```bash
git add actions/daily.ts
git commit -m "feat: add daily problem server actions"
```

---

## Task 4: `/daily` Redirect

**Files:**
- Create: `app/daily/page.tsx`

- [ ] **Step 1: Add the redirect page**

Create `app/daily/page.tsx`:

```tsx
import { notFound, redirect } from "next/navigation"
import { getOrCreateDailyProblem } from "@/actions/daily"

export const dynamic = "force-dynamic"

export const metadata = {
    title: "Daily Problem",
}

export default async function DailyPage() {
    const daily = await getOrCreateDailyProblem()
    if (!daily) notFound()
    redirect(`/practice/${daily.problem.slug}`)
}
```

- [ ] **Step 2: Run route typecheck**

Run:

```bash
npx tsc --noEmit
```

Expected: no TypeScript errors.

- [ ] **Step 3: Commit redirect task**

```bash
git add app/daily/page.tsx
git commit -m "feat: add daily problem redirect"
```

---

## Task 5: Signed-In Homepage Daily Card

**Files:**
- Modify: `app/page.tsx`
- Modify: `components/home/UserHome.tsx`

- [ ] **Step 1: Fetch daily status on the signed-in homepage**

In `app/page.tsx`, add:

```ts
import { getDailyStatusForCurrentUser } from "@/actions/daily"
```

Replace the signed-in data fetch:

```tsx
const [stats, solvedSlugs] = await Promise.all([
    getUserStats(),
    getSolvedSlugs(),
])
```

with:

```tsx
const [stats, solvedSlugs, dailyStatus] = await Promise.all([
    getUserStats(),
    getSolvedSlugs(),
    getDailyStatusForCurrentUser(),
])
```

Then pass `dailyStatus` into `UserHome`:

```tsx
<UserHome
    name={session.user.name ?? null}
    stats={stats}
    problems={problems ?? []}
    solvedSlugs={solvedSlugs}
    dailyStatus={dailyStatus}
/>
```

- [ ] **Step 2: Add UserHome prop and card**

In `components/home/UserHome.tsx`, update imports:

```tsx
import {
    ArrowRight,
    BookOpen,
    CalendarCheck2,
    CheckCircle2,
    Clock,
    Compass,
    Sparkles,
    XCircle,
} from "lucide-react"
import type { DailyStatus } from "@/actions/daily"
```

Add `dailyStatus` to props:

```tsx
interface UserHomeProps {
    name: string | null
    stats: UserStats
    problems: PublicProblem[]
    solvedSlugs: string[]
    dailyStatus: DailyStatus
}
```

Update the component signature:

```tsx
export function UserHome({
    name,
    stats,
    problems,
    solvedSlugs,
    dailyStatus,
}: UserHomeProps) {
```

In the non-new-user grid, insert `DailyProblemCard` before `RecommendedCard`:

```tsx
<DailyProblemCard status={dailyStatus} />
<RecommendedCard problem={recommended} />
```

Add this component above `RecommendedCard`:

```tsx
function DailyProblemCard({ status }: { status: DailyStatus }) {
    const daily = status.daily
    return (
        <Card>
            <CardContent className="p-6">
                <SectionHeading
                    icon={<CalendarCheck2 className="h-3.5 w-3.5" />}
                    label="Daily problem"
                />
                {daily ? (
                    <Link
                        href="/daily"
                        className="group mt-4 -mx-2 flex items-start gap-3 rounded-md px-2 py-2 hover:bg-surface-muted transition-colors"
                    >
                        <div className="flex-1 min-w-0">
                            <h3 className="font-medium text-foreground truncate group-hover:text-primary transition-colors">
                                <span className="text-muted-foreground tabular-nums mr-1">
                                    {daily.problem.number}.
                                </span>
                                {daily.problem.title}
                            </h3>
                            <p className="mt-1 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                                {status.solvedToday ? (
                                    <>
                                        <CheckCircle2 className="h-3 w-3 text-easy-fg" />
                                        Solved today
                                    </>
                                ) : (
                                    "Not solved today"
                                )}
                            </p>
                        </div>
                        <DifficultyBadge difficulty={daily.problem.difficulty} />
                    </Link>
                ) : (
                    <p className="mt-3 text-sm text-muted-foreground">
                        No published problems are available for today's daily.
                    </p>
                )}
            </CardContent>
        </Card>
    )
}
```

- [ ] **Step 3: Use the daily problem in new-user hero**

Change `<NewUserHero />` to:

```tsx
<NewUserHero dailyStatus={dailyStatus} />
```

Change `NewUserHero` signature:

```tsx
function NewUserHero({ dailyStatus }: { dailyStatus: DailyStatus }) {
    const daily = dailyStatus.daily
    const href = daily ? "/daily" : "/practice/simple-select"
    const label = daily ? "Start today's daily" : "Start with an easy one"
```

In the primary button, use:

```tsx
<LinkButton href={href} size="md">
    {label}
</LinkButton>
```

- [ ] **Step 4: Typecheck homepage changes**

Run:

```bash
npx tsc --noEmit
```

Expected: no TypeScript errors.

- [ ] **Step 5: Commit homepage task**

```bash
git add app/page.tsx components/home/UserHome.tsx
git commit -m "feat: surface daily problem on home"
```

---

## Task 6: UserMenu, Mobile Nav, And Admin Schedule Page

**Files:**
- Modify: `components/layout/Navbar.tsx`
- Modify: `components/layout/UserMenu.tsx`
- Modify: `components/admin/AdminNav.tsx`
- Create: `app/admin/daily/page.tsx`

- [ ] **Step 1: Wire daily status into Navbar**

In `components/layout/Navbar.tsx`, add:

```ts
import { getDailyStatusForCurrentUser } from "@/actions/daily"
import { CalendarCheck2 } from "lucide-react"
```

The file already imports `PenSquare` and `Shield` from `lucide-react`; make that import:

```ts
import { CalendarCheck2, PenSquare, Shield } from "lucide-react"
```

Change `menuStats` to include `dailySolved`:

```ts
let menuStats: { solved: number; total: number; dailySolved: boolean } | null = null
```

Replace the session query block with:

```tsx
if (session?.user?.id) {
    const [solvedRows, total, dailyStatus] = await Promise.all([
        prisma.submission.findMany({
            where: { userId: session.user.id, status: "ACCEPTED" },
            select: { problemId: true },
            distinct: ["problemId"],
        }),
        prisma.sQLProblem.count({ where: { status: "PUBLISHED" } }),
        getDailyStatusForCurrentUser(),
    ])
    menuStats = {
        solved: solvedRows.length,
        total,
        dailySolved: dailyStatus.solvedToday,
    }
}
```

Pass into `UserMenu`:

```tsx
dailySolved={menuStats?.dailySolved ?? false}
```

Add Daily to mobile signed-in extra before Profile:

```tsx
<Link
    href="/daily"
    className="flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium hover:bg-surface-muted"
>
    <CalendarCheck2 className="h-4 w-4" />
    Daily problem
    {menuStats?.dailySolved && (
        <span className="ml-auto text-xs text-easy-fg">Solved</span>
    )}
</Link>
```

- [ ] **Step 2: Add Daily Problem to UserMenu**

In `components/layout/UserMenu.tsx`, add icon imports:

```tsx
import {
    Bookmark,
    CalendarCheck2,
    CheckCircle2,
    LogOut,
    PenSquare,
    Shield,
    User as UserIcon,
} from "lucide-react"
```

Add prop:

```tsx
dailySolved: boolean
```

Add to component signature:

```tsx
dailySolved,
```

Add menu item before Profile:

```tsx
<MenuItem
    href="/daily"
    icon={<CalendarCheck2 className="h-4 w-4" />}
    label="Daily problem"
    trailing={
        dailySolved ? (
            <span className="ml-auto inline-flex items-center gap-1 text-xs text-easy-fg">
                <CheckCircle2 className="h-3 w-3" />
                Solved
            </span>
        ) : null
    }
    onClick={() => setOpen(false)}
/>
```

Extend `MenuItem`:

```tsx
function MenuItem({
    href,
    icon,
    label,
    tone,
    trailing,
    onClick,
}: {
    href: string
    icon: React.ReactNode
    label: string
    tone?: "primary" | "accent"
    trailing?: React.ReactNode
    onClick?: () => void
}) {
```

And render:

```tsx
{icon}
<span>{label}</span>
{trailing}
```

- [ ] **Step 3: Add Admin Daily nav item**

In `components/admin/AdminNav.tsx`, add `CalendarCheck2` to the lucide import and add this item after Overview:

```ts
{ href: "/admin/daily", label: "Daily", icon: CalendarCheck2 },
```

- [ ] **Step 4: Create admin Daily page**

Create `app/admin/daily/page.tsx`:

```tsx
import { CalendarCheck2 } from "lucide-react"
import { setManualDailyProblem, listDailyProblems, toDailyKey } from "@/actions/daily"
import { getProblems } from "@/actions/problems"
import { Container } from "@/components/ui/Container"
import { Card } from "@/components/ui/Card"
import { Button } from "@/components/ui/Button"
import { Field, Input } from "@/components/ui/Input"
import { Badge, DifficultyBadge } from "@/components/ui/Badge"

export const dynamic = "force-dynamic"

export const metadata = {
    title: "Daily Problems",
    robots: { index: false, follow: false },
}

async function saveDailyProblem(formData: FormData) {
    "use server"
    const dateKey = String(formData.get("dateKey") ?? "")
    const problemId = String(formData.get("problemId") ?? "")
    await setManualDailyProblem({ dateKey, problemId })
}

export default async function AdminDailyPage() {
    const [rows, problemsResult] = await Promise.all([
        listDailyProblems(),
        getProblems(),
    ])
    const problems = problemsResult.data ?? []
    const todayKey = toDailyKey(new Date())

    return (
        <Container width="xl" className="py-10">
            <header className="mb-6">
                <h1 className="flex items-center gap-2 text-2xl sm:text-3xl font-bold tracking-tight">
                    <CalendarCheck2 className="h-6 w-6 text-primary" />
                    Daily problems
                </h1>
                <p className="mt-1 text-sm text-muted-foreground">
                    Schedule a published problem for a UTC date. Missing dates auto-fill on first request.
                </p>
            </header>

            <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
                <Card className="overflow-hidden">
                    <div className="hidden md:grid grid-cols-[8rem_1fr_7rem_10rem] gap-4 border-b border-border bg-surface-muted/40 px-5 py-3 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                        <span>Date</span>
                        <span>Problem</span>
                        <span>Source</span>
                        <span>Updated</span>
                    </div>
                    <ul className="divide-y divide-border">
                        {rows.map((row) => (
                            <li
                                key={row.id}
                                className="grid gap-3 px-5 py-3 md:grid-cols-[8rem_1fr_7rem_10rem] md:items-center"
                            >
                                <span className="text-sm tabular-nums text-muted-foreground">
                                    {toDailyKey(row.date)}
                                </span>
                                <div className="min-w-0">
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm font-medium truncate">
                                            <span className="mr-1 text-muted-foreground tabular-nums">
                                                {row.problem.number}.
                                            </span>
                                            {row.problem.title}
                                        </span>
                                        <DifficultyBadge difficulty={row.problem.difficulty} />
                                    </div>
                                </div>
                                <Badge variant={row.source === "MANUAL" ? "primary" : "secondary"}>
                                    {row.source.toLowerCase()}
                                </Badge>
                                <span className="text-xs text-muted-foreground tabular-nums">
                                    {row.updatedAt.toLocaleString()}
                                </span>
                            </li>
                        ))}
                        {rows.length === 0 && (
                            <li className="px-5 py-10 text-center text-sm text-muted-foreground">
                                No daily rows yet. Save a manual schedule or visit /daily to auto-fill today.
                            </li>
                        )}
                    </ul>
                </Card>

                <Card className="p-5">
                    <form action={saveDailyProblem} className="space-y-4">
                        <Field label="Date" htmlFor="dateKey" required>
                            <Input
                                id="dateKey"
                                name="dateKey"
                                type="date"
                                defaultValue={todayKey}
                                required
                            />
                        </Field>
                        <Field label="Published problem" htmlFor="problemId" required>
                            <select
                                id="problemId"
                                name="problemId"
                                required
                                className="block h-10 w-full rounded-md border border-border bg-surface px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            >
                                <option value="">Choose a problem</option>
                                {problems.map((p) => (
                                    <option key={p.id} value={p.id}>
                                        {p.number}. {p.title}
                                    </option>
                                ))}
                            </select>
                        </Field>
                        <Button type="submit" className="w-full">
                            Save manual daily
                        </Button>
                    </form>
                </Card>
            </div>
        </Container>
    )
}
```

- [ ] **Step 5: Typecheck navigation/admin changes**

Run:

```bash
npx tsc --noEmit
```

Expected: no TypeScript errors.

- [ ] **Step 6: Commit navigation/admin task**

```bash
git add components/layout/Navbar.tsx components/layout/UserMenu.tsx components/admin/AdminNav.tsx app/admin/daily/page.tsx
git commit -m "feat: add daily problem navigation and admin schedule"
```

---

## Task 7: E2E Coverage And Final Verification

**Files:**
- Create: `tests/e2e/daily.spec.ts`
- Modify: `tests/e2e/fixtures/db.ts` only if the generated Prisma client requires explicit cleanup helpers.

- [ ] **Step 1: Write daily e2e tests**

Create `tests/e2e/daily.spec.ts`:

```ts
import { test, expect } from "@playwright/test"
import {
    deleteUser,
    prisma,
    seedUser,
    SESSION_COOKIE_NAME,
} from "./fixtures/db"

const ADMIN_EMAIL = "e2e-daily-admin@example.test"
const USER_EMAIL = "e2e-daily-user@example.test"
const BASE_URL =
    process.env.E2E_BASE_URL ?? `http://localhost:${process.env.E2E_PORT ?? "3100"}`

function cookie(t: string): string {
    return `${SESSION_COOKIE_NAME}=${t}`
}

function utcMidnight(d = new Date()): Date {
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
}

test.describe.configure({ mode: "serial" })

test.afterAll(async () => {
    await prisma.dailyProblem.deleteMany({
        where: { problem: { slug: { startsWith: "e2e-daily-" } } },
    })
    await prisma.sQLProblem.deleteMany({
        where: { slug: { startsWith: "e2e-daily-" } },
    })
    await prisma.sqlSchema.deleteMany({
        where: { name: { startsWith: "e2e-daily-" } },
    })
    await deleteUser(ADMIN_EMAIL)
    await deleteUser(USER_EMAIL)
    await prisma.$disconnect()
})

async function seedProblem(slug: string) {
    const max = await prisma.sQLProblem.aggregate({ _max: { number: true } })
    const number = (max._max.number ?? 0) + 1
    const schema = await prisma.sqlSchema.create({
        data: {
            name: `e2e-daily-${slug}`,
            sql: "CREATE TABLE t (id INTEGER); INSERT INTO t VALUES (1);",
        },
    })
    return prisma.sQLProblem.create({
        data: {
            number,
            title: `Daily ${number}`,
            slug,
            difficulty: "EASY",
            status: "PUBLISHED",
            description: "Return one row.",
            schemaDescription: "One table.",
            schemaId: schema.id,
            expectedOutput: JSON.stringify([{ id: 1 }]),
            solutionSql: "SELECT id FROM t",
        },
    })
}

test("GET /daily auto-fills today and redirects to the selected problem", async ({
    request,
}) => {
    await seedProblem(`e2e-daily-auto-${Date.now()}`)
    await prisma.dailyProblem.deleteMany({ where: { date: utcMidnight() } })

    const res = await request.get("/daily", {
        maxRedirects: 0,
        failOnStatusCode: false,
    })
    expect([307, 308]).toContain(res.status())

    const row = await prisma.dailyProblem.findUnique({
        where: { date: utcMidnight() },
        include: { problem: true },
    })
    expect(row?.source).toBe("AUTO")
    expect(row?.problem.status).toBe("PUBLISHED")
    expect(res.headers()["location"]).toBe(`/practice/${row?.problem.slug}`)
})

test("admin can override an auto row with a manual problem", async ({ page }) => {
    const admin = await seedUser({ email: ADMIN_EMAIL, role: "ADMIN" })
    const manual = await seedProblem(`e2e-daily-manual-${Date.now()}`)
    const dateKey = utcMidnight().toISOString().slice(0, 10)
    await page.context().addCookies([
        {
            name: SESSION_COOKIE_NAME,
            value: admin.sessionToken,
            domain: new URL(BASE_URL).hostname,
            path: "/",
            httpOnly: true,
            secure: false,
            sameSite: "Lax",
            expires: Math.floor(Date.now() / 1000) + 24 * 60 * 60,
        },
    ])
    await page.goto("/admin/daily")
    await page.getByLabel("Date").fill(dateKey)
    await page.getByLabel("Published problem").selectOption(manual.id)
    await page.getByRole("button", { name: "Save manual daily" }).click()
    await expect(page.getByText("manual")).toBeVisible()

    const row = await prisma.dailyProblem.findUnique({
        where: { date: utcMidnight() },
        include: { problem: true },
    })
    expect(row?.source).toBe("MANUAL")
    expect(row?.problem.slug).toBe(manual.slug)
})

test("signed-in home shows daily solved state after accepted submission", async ({
    page,
}) => {
    const user = await seedUser({ email: USER_EMAIL, role: "USER" })
    const daily = await prisma.dailyProblem.findUnique({
        where: { date: utcMidnight() },
        include: { problem: true },
    })
    test.skip(!daily, "daily row was not created")
    await prisma.submission.create({
        data: {
            userId: user.id,
            problemId: daily!.problemId,
            status: "ACCEPTED",
            code: "SELECT id FROM t",
        },
    })
    await page.context().addCookies([
        {
            name: SESSION_COOKIE_NAME,
            value: user.sessionToken,
            domain: new URL(BASE_URL).hostname,
            path: "/",
            httpOnly: true,
            secure: false,
            sameSite: "Lax",
            expires: Math.floor(Date.now() / 1000) + 24 * 60 * 60,
        },
    ])
    await page.goto("/")
    await expect(page.getByText("Daily problem")).toBeVisible()
    await expect(page.getByText("Solved today")).toBeVisible()
})
```

- [ ] **Step 2: Run the new e2e test**

Run:

```bash
npm run build
npm run test:e2e -- daily.spec.ts
```

Expected:

```text
3 passed
```

- [ ] **Step 3: Run focused helper test**

Run:

```bash
npx tsx scripts/test-daily-utils.ts
```

Expected:

```text
# pass 5
```

- [ ] **Step 4: Run full verification**

Run:

```bash
npx tsc --noEmit
npm run build
npm run test:e2e
```

Expected:

- TypeScript exits `0`
- `next build --webpack` exits `0`
- Playwright exits `0`

- [ ] **Step 5: Compare implementation against the approved spec**

Run:

```bash
sed -n '1,220p' docs/superpowers/specs/2026-05-01-daily-problem-design.md
```

Expected: the implemented behavior matches the spec sections for data model, selection rules, learner surfaces, admin surface, existing streak interaction, and error handling.

- [ ] **Step 6: Commit final verification task**

```bash
git add tests/e2e/daily.spec.ts docs/superpowers/specs/2026-05-01-daily-problem-design.md
git commit -m "test: cover daily problem flow"
```

---

## Final Checks Before PR

- [ ] `git status --short` shows only intentional changes.
- [ ] `git log --oneline origin/main..HEAD` shows small commits matching the tasks.
- [ ] Confirm `docs/ROADMAP.md` release-tag wording is handled in a separate commit or separate branch; do not accidentally mix it into the Daily Problem implementation PR unless explicitly intended.
- [ ] Open a PR with screenshots for homepage card, UserMenu, and `/admin/daily`.
