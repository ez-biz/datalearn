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
    viewer = await seedUser({
        email: `${PREFIX}viewer@example.test`,
        name: "Viewer",
    })
    rival = await seedUser({
        email: `${PREFIX}rival@example.test`,
        name: "Rival",
    })

    // A LIVE contest: started in the past, ends in the future.
    const startsAt = new Date(Date.now() - 60 * 60 * 1000)
    const endsAt = new Date(Date.now() + 60 * 60 * 1000)
    const contest = await prisma.contest.create({
        data: {
            slug: SLUG,
            title: "E2E Standings Contest",
            description: "Standings e2e.",
            kind: "WEEKLY",
            status: "SCHEDULED",
            visibility: "PUBLIC",
            startsAt,
            endsAt,
            durationMinutes: 120,
            rated: false,
            createdById: rival.id,
        },
    })
    contestId = contest.id

    // Rival leads (more points); viewer second.
    await prisma.contestLeaderboardEntry.createMany({
        data: [
            {
                contestId,
                userId: rival.id,
                points: 8,
                penaltySeconds: 750,
                solvedCount: 3,
            },
            {
                contestId,
                userId: viewer.id,
                points: 5,
                penaltySeconds: 1210,
                solvedCount: 2,
            },
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
        page.getByRole("heading", { name: "Standings", exact: true })
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
