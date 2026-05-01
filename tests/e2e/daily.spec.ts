import { test, expect } from "@playwright/test"
import {
    deleteUser,
    prisma,
    seedUser,
    sessionCookie,
} from "./fixtures/db"

const ADMIN_EMAIL = "e2e-daily-admin@example.test"
const USER_EMAIL = "e2e-daily-user@example.test"
const BASE_URL =
    process.env.E2E_BASE_URL ?? `http://localhost:${process.env.E2E_PORT ?? "3100"}`
const E2E_PREFIX = "e2e-daily-"

type DailySnapshot = {
    id: string
    date: Date
    problemId: string
    source: "AUTO" | "MANUAL"
    createdAt: Date
    updatedAt: Date
}

const dailySnapshots = new Map<string, DailySnapshot | null>()

function utcMidnight(d: Date): Date {
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
}

function currentDailyDate(): Date {
    return utcMidnight(new Date())
}

function dailyKey(date: Date): string {
    return date.toISOString().slice(0, 10)
}

function skipIfUtcDayChanged(date: Date): void {
    test.skip(
        currentDailyDate().getTime() !== date.getTime(),
        "UTC day changed while the test was exercising today's daily problem."
    )
}

test.describe.configure({ mode: "serial" })

async function deleteE2EDailyRows() {
    await prisma.dailyProblem.deleteMany({
        where: { problem: { slug: { startsWith: E2E_PREFIX } } },
    })
}

async function deleteE2EProblemsAndSchemas() {
    await prisma.sQLProblem.deleteMany({
        where: { slug: { startsWith: E2E_PREFIX } },
    })
    await prisma.sqlSchema.deleteMany({
        where: { name: { startsWith: E2E_PREFIX } },
    })
}

async function snapshotDailyDate(date: Date) {
    const key = dailyKey(date)
    if (dailySnapshots.has(key)) return

    const existing = await prisma.dailyProblem.findUnique({
        where: { date },
        include: { problem: { select: { slug: true } } },
    })
    if (!existing || existing.problem.slug.startsWith(E2E_PREFIX)) {
        dailySnapshots.set(key, null)
        return
    }

    dailySnapshots.set(key, {
        id: existing.id,
        date: existing.date,
        problemId: existing.problemId,
        source: existing.source,
        createdAt: existing.createdAt,
        updatedAt: existing.updatedAt,
    })
}

test.beforeAll(async () => {
    await deleteE2EDailyRows()
    await deleteE2EProblemsAndSchemas()
})

test.afterAll(async () => {
    const touchedDates = [...dailySnapshots.values()]
        .map((snapshot) => snapshot?.date)
        .filter((date): date is Date => date !== undefined)

    await deleteE2EDailyRows()
    if (touchedDates.length > 0) {
        await prisma.dailyProblem.deleteMany({
            where: { date: { in: touchedDates } },
        })
    }
    await deleteE2EProblemsAndSchemas()

    for (const snapshot of dailySnapshots.values()) {
        if (!snapshot) continue
        await prisma.dailyProblem.create({
            data: snapshot,
        })
    }

    await deleteUser(ADMIN_EMAIL)
    await deleteUser(USER_EMAIL)
    await prisma.$disconnect()
})

async function nextLowProblemNumber(): Promise<number> {
    const min = await prisma.sQLProblem.aggregate({ _min: { number: true } })
    return (min._min.number ?? 0) - 1
}

async function seedProblem(slug: string) {
    const schema = await prisma.sqlSchema.create({
        data: {
            name: `${E2E_PREFIX}${slug}`,
            sql: "CREATE TABLE t (id INTEGER); INSERT INTO t VALUES (1);",
        },
    })

    return prisma.sQLProblem.create({
        data: {
            number: await nextLowProblemNumber(),
            title: `Daily ${slug}`,
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

test("GET /daily auto-fills today and redirects to the selected published problem", async ({
    page,
}) => {
    const date = currentDailyDate()
    await snapshotDailyDate(date)
    const problem = await seedProblem(`${E2E_PREFIX}auto-${Date.now()}`)
    await prisma.dailyProblem.deleteMany({ where: { date } })

    await page.goto("/daily")
    skipIfUtcDayChanged(date)
    await expect(page).toHaveURL(new RegExp(`/practice/${problem.slug}$`))

    const row = await prisma.dailyProblem.findUnique({
        where: { date },
        include: { problem: true },
    })
    expect(row?.source).toBe("AUTO")
    expect(row?.problem.status).toBe("PUBLISHED")
    expect(row?.problem.slug).toBe(problem.slug)
})

test("admin can override an auto row with a manual published problem", async ({
    page,
}) => {
    const date = currentDailyDate()
    await snapshotDailyDate(date)
    const admin = await seedUser({ email: ADMIN_EMAIL, role: "ADMIN" })
    const manual = await seedProblem(`${E2E_PREFIX}manual-${Date.now()}`)

    await page.context().addCookies([sessionCookie(admin.sessionToken, BASE_URL)])
    await page.goto("/admin/daily")
    await page.getByLabel("Date").fill(dailyKey(date))
    await page.getByLabel("Published problem").selectOption(manual.id)
    await page.getByRole("button", { name: "Save manual daily" }).click()

    await expect(page.getByText("Daily problem saved.")).toBeVisible()

    const row = await prisma.dailyProblem.findUnique({
        where: { date },
        include: { problem: true },
    })
    expect(row?.source).toBe("MANUAL")
    expect(row?.problem.slug).toBe(manual.slug)
})

test("signed-in home shows daily solved state after accepted submission", async ({
    page,
}) => {
    const date = currentDailyDate()
    const user = await seedUser({ email: USER_EMAIL, role: "USER" })
    let daily = await prisma.dailyProblem.findUnique({
        where: { date },
        include: { problem: true },
    })

    if (!daily) {
        await snapshotDailyDate(date)
        const problem = await seedProblem(`${E2E_PREFIX}home-${Date.now()}`)
        daily = await prisma.dailyProblem.create({
            data: {
                date,
                problemId: problem.id,
                source: "MANUAL",
            },
            include: { problem: true },
        })
    }

    expect(daily).not.toBeNull()

    await prisma.submission.create({
        data: {
            userId: user.id,
            problemId: daily!.problemId,
            status: "ACCEPTED",
            code: "SELECT id FROM t",
        },
    })

    await page.context().addCookies([sessionCookie(user.sessionToken, BASE_URL)])
    await page.goto("/")
    skipIfUtcDayChanged(date)

    await expect(page.getByText("Daily problem")).toBeVisible()
    await expect(page.getByText("Solved today")).toBeVisible()
})
