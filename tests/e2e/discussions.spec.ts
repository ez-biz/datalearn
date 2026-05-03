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
const PREFIX = `e2e-discussions-${RUN_ID}`
const PROBLEM_SLUG = "simple-select"
const BASE_URL =
    process.env.E2E_BASE_URL ?? `http://localhost:${process.env.E2E_PORT ?? "3100"}`

const learnerEmail = `${PREFIX}-learner@example.test`
const anonymousSeedEmail = `${PREFIX}-anonymous-seed@example.test`
const lockedEmail = `${PREFIX}-locked@example.test`
const shareEmail = `${PREFIX}-share@example.test`
const authorEmail = `${PREFIX}-author@example.test`
const reporterOneEmail = `${PREFIX}-reporter-1@example.test`
const reporterTwoEmail = `${PREFIX}-reporter-2@example.test`
const adminEmail = `${PREFIX}-admin@example.test`
const emails = [
    learnerEmail,
    anonymousSeedEmail,
    lockedEmail,
    shareEmail,
    authorEmail,
    reporterOneEmail,
    reporterTwoEmail,
    adminEmail,
]

type ProblemRecord = Pick<SQLProblem, "id" | "slug">

let problem: ProblemRecord | null = null
let originalDiscussionMode: "OPEN" | "LOCKED" | "HIDDEN" | null = null
let originalSettings:
    | {
          globalEnabled: boolean
          reportThreshold: number
      }
    | null = null
const createdCommentIds = new Set<string>()

function cookie(sessionToken: string): string {
    return `${SESSION_COOKIE_NAME}=${sessionToken}`
}

async function setProblemMode(mode: "OPEN" | "LOCKED" | "HIDDEN") {
    if (!problem) return
    await prisma.problemDiscussionState.upsert({
        where: { problemId: problem.id },
        update: { mode },
        create: { problemId: problem.id, mode },
    })
}

async function restoreProblemMode() {
    if (!problem) return
    if (originalDiscussionMode) {
        await prisma.problemDiscussionState.upsert({
            where: { problemId: problem.id },
            update: { mode: originalDiscussionMode },
            create: { problemId: problem.id, mode: originalDiscussionMode },
        })
        return
    }
    await prisma.problemDiscussionState.deleteMany({
        where: { problemId: problem.id },
    })
}

async function createComment(input: { userId: string; bodyMarkdown: string }) {
    if (!problem) throw new Error(`${PROBLEM_SLUG} problem is not seeded`)
    const comment = await prisma.discussionComment.create({
        data: {
            problemId: problem.id,
            userId: input.userId,
            bodyMarkdown: input.bodyMarkdown,
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

    const [settings, state] = await Promise.all([
        prisma.discussionSettings.findUnique({ where: { id: "global" } }),
        problem
            ? prisma.problemDiscussionState.findUnique({
                  where: { problemId: problem.id },
                  select: { mode: true },
              })
            : Promise.resolve(null),
    ])
    originalSettings = settings
        ? {
              globalEnabled: settings.globalEnabled,
              reportThreshold: settings.reportThreshold,
          }
        : null
    originalDiscussionMode = state?.mode ?? null

    await prisma.discussionSettings.upsert({
        where: { id: "global" },
        update: { globalEnabled: true, reportThreshold: 2 },
        create: { id: "global", globalEnabled: true, reportThreshold: 2 },
    })
    await setProblemMode("OPEN")
})

test.afterAll(async () => {
    await prisma.discussionModerationLog.deleteMany({
        where: {
            OR: [
                { targetId: { in: [...createdCommentIds] } },
                { targetId: { startsWith: PREFIX } },
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
    await prisma.submission.deleteMany({
        where: { code: { startsWith: PREFIX } },
    })
    await restoreProblemMode()
    if (originalSettings) {
        await prisma.discussionSettings.update({
            where: { id: "global" },
            data: originalSettings,
        })
    }
    for (const email of emails) {
        await deleteUser(email)
    }
    await prisma.$disconnect()
})

test.describe("problem discussions", () => {
    test("signed-in learner can post a comment through the UI", async ({
        page,
    }) => {
        test.skip(!problem, `${PROBLEM_SLUG} problem is not seeded`)
        await setProblemMode("OPEN")

        const learner = await seedUser({
            email: learnerEmail,
            name: "E2E Discussion Learner",
        })
        await page.context().addCookies([
            sessionCookie(learner.sessionToken, BASE_URL),
        ])

        const body = `${PREFIX} learner UI comment`
        await page.goto(`/practice/${PROBLEM_SLUG}`)
        await page.getByRole("button", { name: "Discussion" }).click()
        await expect(
            page.getByRole("heading", { name: "Discussion", exact: true })
        ).toBeVisible()

        await page.getByLabel("Discussion comment").fill(body)
        const postResponsePromise = page.waitForResponse(
            (response) =>
                response.url().includes(`/api/problems/${PROBLEM_SLUG}/discussion`) &&
                response.request().method() === "POST"
        )
        await page.getByRole("button", { name: "Post", exact: true }).click()
        const postResponse = await postResponsePromise
        expect(postResponse.status()).toBe(201)
        const postBody = await postResponse.json()
        createdCommentIds.add(postBody.data.id)

        await expect(page.getByText(body)).toBeVisible()
        const created = await prisma.discussionComment.findFirst({
            where: { bodyMarkdown: body, userId: learner.id },
            select: { id: true },
        })
        expect(created?.id).toBeTruthy()
        if (created?.id) createdCommentIds.add(created.id)
    })

    test("signed-out report mutation opens the sign-in dialog", async ({
        page,
    }) => {
        test.skip(!problem, `${PROBLEM_SLUG} problem is not seeded`)
        await setProblemMode("OPEN")

        const author = await seedUser({
            email: anonymousSeedEmail,
            name: "E2E Anonymous Seed",
        })
        const comment = await createComment({
            userId: author.id,
            bodyMarkdown: `${PREFIX} signed-out report target`,
        })

        await page.goto(`/practice/${PROBLEM_SLUG}`)
        await page.getByRole("button", { name: "Discussion" }).click()
        await expect(page.getByText(comment.bodyMarkdown)).toBeVisible()

        await page
            .locator("article")
            .filter({ hasText: comment.bodyMarkdown })
            .getByRole("button", { name: "Report", exact: true })
            .click()
        await expect(
            page.getByRole("dialog", { name: /sign in to data learn/i })
        ).toBeVisible()
    })

    test("locked problem blocks the composer", async ({ page }) => {
        test.skip(!problem, `${PROBLEM_SLUG} problem is not seeded`)
        await setProblemMode("LOCKED")

        const learner = await seedUser({
            email: lockedEmail,
            name: "E2E Locked Learner",
        })
        await page.context().addCookies([
            sessionCookie(learner.sessionToken, BASE_URL),
        ])

        await page.goto(`/practice/${PROBLEM_SLUG}`)
        await page.getByRole("button", { name: "Discussion" }).click()

        await expect(page.getByText(/discussion is locked/i)).toBeVisible()
        await expect(page.getByLabel("Discussion comment")).toBeHidden()
    })

    test("hidden problem hides the discussion tab", async ({ page }) => {
        test.skip(!problem, `${PROBLEM_SLUG} problem is not seeded`)
        await setProblemMode("HIDDEN")

        await page.goto(`/practice/${PROBLEM_SLUG}`)

        await expect(
            page.getByRole("button", { name: "Discussion" })
        ).toHaveCount(0)
    })

    test("report threshold creates an admin queue entry", async ({
        request,
    }) => {
        test.skip(!problem, `${PROBLEM_SLUG} problem is not seeded`)
        await setProblemMode("OPEN")

        const [author, reporterOne, reporterTwo, admin] = await Promise.all([
            seedUser({ email: authorEmail, name: "E2E Report Author" }),
            seedUser({ email: reporterOneEmail, name: "E2E Reporter One" }),
            seedUser({ email: reporterTwoEmail, name: "E2E Reporter Two" }),
            seedUser({ email: adminEmail, role: "ADMIN", name: "E2E Admin" }),
        ])
        const comment = await createComment({
            userId: author.id,
            bodyMarkdown: `${PREFIX} report threshold target`,
        })

        for (const reporter of [reporterOne, reporterTwo]) {
            const res = await request.post(
                `/api/problems/${PROBLEM_SLUG}/discussion/${comment.id}/report`,
                {
                    headers: {
                        Origin: BASE_URL,
                        "Content-Type": "application/json",
                        Cookie: cookie(reporter.sessionToken),
                    },
                    data: {
                        reason: "OTHER",
                        message: `${PREFIX} threshold report`,
                    },
                    failOnStatusCode: false,
                }
            )
            expect(res.status()).toBe(201)
        }

        const queueRes = await request.get("/api/admin/discussions", {
            headers: { Cookie: cookie(admin.sessionToken) },
            failOnStatusCode: false,
        })
        expect(queueRes.status()).toBe(200)
        const body = await queueRes.json()
        expect(body.settings.reportThreshold).toBe(2)
        expect(
            body.data.needsReview.some(
                (queued: { id: string }) => queued.id === comment.id
            )
        ).toBe(true)
    })

    test("share approach pre-fills SQL after an accepted submission", async ({
        page,
    }) => {
        test.skip(!problem, `${PROBLEM_SLUG} problem is not seeded`)
        await setProblemMode("OPEN")

        const learner = await seedUser({
            email: shareEmail,
            name: "E2E Share Learner",
        })
        const sql = `${PREFIX} SELECT 1 AS id;`
        const submission = await prisma.submission.create({
            data: {
                userId: learner.id,
                problemId: problem!.id,
                status: "ACCEPTED",
                code: sql,
            },
        })
        await page.context().addCookies([
            sessionCookie(learner.sessionToken, BASE_URL),
        ])

        await page.goto(`/practice/${PROBLEM_SLUG}`)
        await page.getByRole("button", { name: /history/i }).click()
        await page.getByRole("button", { name: /accepted/i }).click()
        await page.getByRole("button", { name: /share approach/i }).click()

        await expect(page.getByRole("button", { name: "Discussion" })).toHaveAttribute(
            "aria-pressed",
            "true"
        )
        await expect(page.getByLabel("Discussion comment")).toHaveValue(
            new RegExp(`${PREFIX} SELECT 1 AS id;`)
        )

        await prisma.submission.delete({ where: { id: submission.id } })
    })
})
