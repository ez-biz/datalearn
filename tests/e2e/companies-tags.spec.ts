import { expect, test } from "@playwright/test"
import { prisma } from "./fixtures/db"

const PREFIX = "e2e-co-"
const TOPIC_SLUG = `${PREFIX}window-functions`
const TOPIC_NAME = `${PREFIX}Window Functions`

test.describe.configure({ mode: "serial" })

test.beforeEach(async () => {
    await cleanup()
})

test.afterEach(async () => {
    await cleanup()
})

test.afterAll(async () => {
    await prisma.$disconnect()
})

async function cleanup() {
    await prisma.sQLProblem.deleteMany({
        where: { slug: { startsWith: PREFIX } },
    })
    await prisma.tag.deleteMany({
        where: { slug: { startsWith: PREFIX } },
    })
    await prisma.sqlSchema.deleteMany({
        where: { name: { startsWith: PREFIX } },
    })
}

async function createSchema(name: string) {
    return prisma.sqlSchema.create({
        data: {
            name,
            sql: "CREATE TABLE t (id INTEGER);",
        },
    })
}

async function nextProblemNumber() {
    const max = await prisma.sQLProblem.aggregate({ _max: { number: true } })
    return (max._max.number ?? 0) + 20_000
}

async function seedTagWithProblems(input: {
    slug: string
    name: string
    kind?: "TOPIC" | "COMPANY"
    problemCount: number
    startingNumber: number
    schemaId: string
}) {
    await prisma.tag.create({
        data: {
            slug: input.slug,
            name: input.name,
            kind: input.kind ?? "TOPIC",
        },
    })

    for (let i = 0; i < input.problemCount; i++) {
        await prisma.sQLProblem.create({
            data: {
                number: input.startingNumber + i,
                slug: `${input.slug}-problem-${i}`,
                title: `${input.name} Problem ${i}`,
                description: "An end-to-end company tag test problem.",
                schemaDescription: "Test schema description.",
                schemaId: input.schemaId,
                difficulty: "EASY",
                status: "PUBLISHED",
                dialects: ["DUCKDB"],
                expectedOutput: "[]",
                tags: { connect: [{ slug: input.slug }] },
            },
        })
    }
}

async function seedTopic(schemaId: string, startingNumber: number) {
    await seedTagWithProblems({
        slug: TOPIC_SLUG,
        name: TOPIC_NAME,
        kind: "TOPIC",
        problemCount: 1,
        startingNumber,
        schemaId,
    })
}

async function seedCompanies(input: {
    schemaId: string
    startingNumber: number
    companyCount: number
    problemsPerCompany: number
}) {
    for (let i = 0; i < input.companyCount; i++) {
        await seedTagWithProblems({
            slug: `${PREFIX}company-${i}`,
            name: `${PREFIX}Company ${i}`,
            kind: "COMPANY",
            problemCount: input.problemsPerCompany,
            startingNumber:
                input.startingNumber + i * (input.problemsPerCompany + 1),
            schemaId: input.schemaId,
        })
    }
}

test.describe("Companies tag discovery", () => {
    test("hides Companies below the launch threshold", async ({ page }) => {
        const schema = await createSchema(`${PREFIX}below-threshold-schema`)
        const start = await nextProblemNumber()
        await seedTopic(schema.id, start)
        await seedCompanies({
            schemaId: schema.id,
            startingNumber: start + 10,
            companyCount: 4,
            problemsPerCompany: 3,
        })

        await page.goto("/practice/tags")

        await expect(
            page.getByRole("heading", { name: "Browse by tag" }),
        ).toBeVisible()
        await expect(
            page.getByRole("heading", { name: "Companies" }),
        ).toHaveCount(0)
        await expect(page.getByRole("link", { name: TOPIC_NAME })).toBeVisible()
    })

    test("shows Companies above Topics once the launch gate is met", async ({
        page,
    }) => {
        const schema = await createSchema(`${PREFIX}gate-met-schema`)
        const start = await nextProblemNumber()
        await seedTopic(schema.id, start)
        await seedCompanies({
            schemaId: schema.id,
            startingNumber: start + 10,
            companyCount: 5,
            problemsPerCompany: 3,
        })

        await page.goto("/practice/tags")

        const companies = page.getByRole("heading", { name: "Companies" })
        const topics = page.getByRole("heading", { name: "Topics" })
        await expect(companies).toBeVisible()
        await expect(topics).toBeVisible()
        await expect(
            page.getByRole("link", { name: "Companies" }),
        ).toBeVisible()
        await expect(page.getByRole("link", { name: "Topics" })).toBeVisible()

        const companiesBeforeTopics = await page
            .locator("body")
            .evaluate((body) => {
                const companiesHeading = body.querySelector("#companies")
                const topicsHeading = body.querySelector("#topics")
                if (!companiesHeading || !topicsHeading) return false
                return Boolean(
                    companiesHeading.compareDocumentPosition(topicsHeading) &
                    Node.DOCUMENT_POSITION_FOLLOWING,
                )
            })
        expect(companiesBeforeTopics).toBe(true)
    })

    test("company detail page uses interview-specific copy", async ({
        page,
    }) => {
        const schema = await createSchema(`${PREFIX}detail-schema`)
        const start = await nextProblemNumber()
        await seedTopic(schema.id, start)
        await seedTagWithProblems({
            slug: `${PREFIX}stripe`,
            name: `${PREFIX}Stripe`,
            kind: "COMPANY",
            problemCount: 3,
            startingNumber: start + 10,
            schemaId: schema.id,
        })
        await seedCompanies({
            schemaId: schema.id,
            startingNumber: start + 100,
            companyCount: 4,
            problemsPerCompany: 3,
        })

        await page.goto("/practice/tags")
        await page
            .getByRole("link", { name: `${PREFIX}Stripe` })
            .first()
            .click()

        await expect(page).toHaveURL(`/practice/tags/${PREFIX}stripe`)
        await expect(
            page.getByRole("heading", {
                level: 1,
                name: `${PREFIX}Stripe SQL interview questions`,
            }),
        ).toBeVisible()
        await expect(page).toHaveTitle(
            new RegExp(`${PREFIX}Stripe SQL interview questions`),
        )
        await expect(
            page.getByText(
                `Common SQL questions from ${PREFIX}Stripe interviews.`,
            ),
        ).toBeVisible()
    })

    test("topic tag detail page keeps the existing heading shape", async ({
        page,
    }) => {
        const schema = await createSchema(`${PREFIX}topic-detail-schema`)
        const start = await nextProblemNumber()
        await seedTopic(schema.id, start)

        await page.goto(`/practice/tags/${TOPIC_SLUG}`)

        await expect(
            page.getByRole("heading", { level: 1, name: TOPIC_NAME }),
        ).toBeVisible()
    })

    test("keeps Companies hidden when each company is below the per-tag minimum", async ({
        page,
    }) => {
        const schema = await createSchema(`${PREFIX}per-tag-min-schema`)
        const start = await nextProblemNumber()
        await seedTopic(schema.id, start)
        await seedCompanies({
            schemaId: schema.id,
            startingNumber: start + 10,
            companyCount: 5,
            problemsPerCompany: 2,
        })

        await page.goto("/practice/tags")

        await expect(
            page.getByRole("heading", { name: "Companies" }),
        ).toHaveCount(0)
        await expect(page.getByRole("link", { name: TOPIC_NAME })).toBeVisible()
    })
})
