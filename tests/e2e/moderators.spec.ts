import { test, expect } from "@playwright/test"
import {
    deleteUser,
    prisma,
    seedUser,
    sessionCookie,
    SESSION_COOKIE_NAME,
} from "./fixtures/db"
import type { SQLProblem } from "@prisma/client"

const RUN_ID = `${Date.now()}-${Math.random().toString(16).slice(2)}`
const PREFIX = `e2e-moderators-${RUN_ID}`
const PROBLEM_SLUG = "simple-select"
const BASE_URL =
    process.env.E2E_BASE_URL ?? `http://localhost:${process.env.E2E_PORT ?? "3100"}`

const adminEmail = `${PREFIX}-admin@example.test`
const moderatorEmail = `${PREFIX}-moderator@example.test`
const authorEmail = `${PREFIX}-author@example.test`
const emails = [adminEmail, moderatorEmail, authorEmail]

type ProblemRecord = Pick<SQLProblem, "id" | "slug">

let problem: ProblemRecord | null = null
let admin: Awaited<ReturnType<typeof seedUser>>
let moderator: Awaited<ReturnType<typeof seedUser>>
let author: Awaited<ReturnType<typeof seedUser>>
const createdCommentIds = new Set<string>()

function cookie(sessionToken: string): string {
    return `${SESSION_COOKIE_NAME}=${sessionToken}`
}

async function createComment(bodyMarkdown: string) {
    if (!problem) throw new Error(`${PROBLEM_SLUG} problem is not seeded`)
    const comment = await prisma.discussionComment.create({
        data: {
            problemId: problem.id,
            userId: author.id,
            bodyMarkdown,
        },
    })
    createdCommentIds.add(comment.id)
    return comment
}

test.describe.configure({ mode: "serial" })

test.beforeAll(async () => {
    problem = await prisma.sQLProblem.findUnique({
        where: { slug: PROBLEM_SLUG },
        select: { id: true, slug: true },
    })

    ;[admin, moderator, author] = await Promise.all([
        seedUser({ email: adminEmail, role: "ADMIN", name: "E2E Admin" }),
        seedUser({
            email: moderatorEmail,
            role: "MODERATOR",
            name: "E2E Moderator",
        }),
        seedUser({ email: authorEmail, name: "E2E Moderator Comment Author" }),
    ])
    await prisma.moderatorPermission.deleteMany({
        where: { userId: moderator.id },
    })
    await prisma.moderatorPermission.create({
        data: {
            userId: moderator.id,
            permission: "VIEW_DISCUSSION_QUEUE",
            grantedById: admin.id,
        },
    })
})

test.afterAll(async () => {
    const userIds = [admin?.id, moderator?.id, author?.id].filter(Boolean)
    await prisma.discussionModerationLog.deleteMany({
        where: {
            OR: [
                { targetId: { in: [...createdCommentIds, ...userIds] } },
                { actorId: { in: userIds } },
                { note: { contains: PREFIX } },
            ],
        },
    })
    await prisma.discussionComment.deleteMany({
        where: {
            OR: [
                { id: { in: [...createdCommentIds] } },
                { bodyMarkdown: { startsWith: PREFIX } },
            ],
        },
    })
    for (const email of emails) {
        await deleteUser(email)
    }
    await prisma.$disconnect()
})

test.describe("discussion moderators", () => {
    test("moderator with VIEW_DISCUSSION_QUEUE can access /admin/discussions", async ({
        page,
    }) => {
        await page.context().addCookies([
            sessionCookie(moderator.sessionToken, BASE_URL),
        ])

        await page.goto("/admin/discussions")

        await expect(
            page.getByRole("heading", { name: /discussion moderation/i })
        ).toBeVisible()
    })

    test("moderator cannot access /admin/problems", async ({ page }) => {
        await page.context().addCookies([
            sessionCookie(moderator.sessionToken, BASE_URL),
        ])

        await page.goto("/admin/problems")

        await expect(page).toHaveURL(`${BASE_URL}/`)
    })

    test("moderator without HIDE_COMMENT receives 403 on hide route", async ({
        request,
    }) => {
        test.skip(!problem, `${PROBLEM_SLUG} problem is not seeded`)
        const comment = await createComment(`${PREFIX} no hide permission target`)

        const res = await request.post(
            `/api/admin/discussions/${comment.id}/hide`,
            {
                headers: {
                    Origin: BASE_URL,
                    Cookie: cookie(moderator.sessionToken),
                },
                failOnStatusCode: false,
            }
        )

        expect(res.status()).toBe(403)
        expect((await res.json()).error).toMatch(/permission/i)
    })

    test("admin can grant HIDE_COMMENT, then moderator can hide", async ({
        request,
    }) => {
        test.skip(!problem, `${PROBLEM_SLUG} problem is not seeded`)
        const comment = await createComment(`${PREFIX} hide permission target`)

        const grantRes = await request.patch(
            `/api/admin/moderators/${moderator.id}`,
            {
                headers: {
                    Origin: BASE_URL,
                    "Content-Type": "application/json",
                    Cookie: cookie(admin.sessionToken),
                },
                data: {
                    permissions: ["VIEW_DISCUSSION_QUEUE", "HIDE_COMMENT"],
                },
                failOnStatusCode: false,
            }
        )
        expect(grantRes.status()).toBe(200)

        const hideRes = await request.post(
            `/api/admin/discussions/${comment.id}/hide`,
            {
                headers: {
                    Origin: BASE_URL,
                    Cookie: cookie(moderator.sessionToken),
                },
                failOnStatusCode: false,
            }
        )
        expect(hideRes.status()).toBe(200)

        const refreshed = await prisma.discussionComment.findUnique({
            where: { id: comment.id },
            select: { status: true, hiddenById: true },
        })
        expect(refreshed?.status).toBe("HIDDEN")
        expect(refreshed?.hiddenById).toBe(moderator.id)
    })

    test("moderator cannot access /admin/discussions/settings", async ({
        page,
    }) => {
        await page.context().addCookies([
            sessionCookie(moderator.sessionToken, BASE_URL),
        ])

        await page.goto("/admin/discussions/settings")

        await expect(page).toHaveURL(`${BASE_URL}/`)
    })
})
