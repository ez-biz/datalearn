import { test, expect } from "@playwright/test"
import { prisma } from "./fixtures/db"

const PREFIX = "e2e-tag-"
const TAG_SLUG = `${PREFIX}coverage`
const TAG_NAME = `${PREFIX}Coverage`
const PROBLEM_SLUG = `${PREFIX}sample-problem`

test.describe.configure({ mode: "serial" })

let createdProblemId: string | null = null
let createdTagId: string | null = null
let createdSchemaId: string | null = null

test.beforeAll(async () => {
    // Clean any leftover state from a previous failed run.
    await prisma.sQLProblem.deleteMany({
        where: { slug: { startsWith: PREFIX } },
    })
    await prisma.tag.deleteMany({
        where: { slug: { startsWith: PREFIX } },
    })
    await prisma.sqlSchema.deleteMany({
        where: { name: { startsWith: PREFIX } },
    })

    const schema = await prisma.sqlSchema.create({
        data: { name: `${PREFIX}schema`, sql: "CREATE TABLE t (id INTEGER);" },
    })
    createdSchemaId = schema.id

    const tag = await prisma.tag.create({
        data: { name: TAG_NAME, slug: TAG_SLUG },
    })
    createdTagId = tag.id

    const max = await prisma.sQLProblem.aggregate({ _max: { number: true } })
    const number = (max._max.number ?? 0) + 5000

    const problem = await prisma.sQLProblem.create({
        data: {
            number,
            slug: PROBLEM_SLUG,
            title: `${PREFIX}Sample Problem`,
            description: "An end-to-end test problem.",
            schemaDescription: "Test schema description.",
            schemaId: schema.id,
            difficulty: "EASY",
            status: "PUBLISHED",
            dialects: ["DUCKDB"],
            expectedOutput: "[]",
            tags: { connect: [{ slug: TAG_SLUG }] },
        },
    })
    createdProblemId = problem.id
})

test.afterAll(async () => {
    if (createdProblemId) {
        await prisma.sQLProblem
            .delete({ where: { id: createdProblemId } })
            .catch(() => {})
    }
    if (createdTagId) {
        await prisma.tag.delete({ where: { id: createdTagId } }).catch(() => {})
    }
    if (createdSchemaId) {
        await prisma.sqlSchema
            .delete({ where: { id: createdSchemaId } })
            .catch(() => {})
    }
    await prisma.$disconnect()
})

test.describe("Tag discovery", () => {
    test("tag index lists the seeded tag", async ({ page }) => {
        await page.goto("/practice/tags")
        await expect(
            page.getByRole("heading", { name: "Browse by tag" })
        ).toBeVisible()
        await expect(page.getByRole("link", { name: TAG_NAME })).toBeVisible()
    })

    test("clicking a tag in the index navigates to the tag detail page", async ({
        page,
    }) => {
        await page.goto("/practice/tags")
        await page.getByRole("link", { name: TAG_NAME }).first().click()
        await expect(page).toHaveURL(`/practice/tags/${TAG_SLUG}`)
        await expect(
            page.getByRole("heading", { level: 1, name: TAG_NAME })
        ).toBeVisible()
        // The seeded problem should appear in the filtered list.
        await expect(
            page.getByRole("heading", { name: `${PREFIX}Sample Problem` })
        ).toBeVisible()
    })

    test("unknown tag slug renders not-found page", async ({ page }) => {
        // Next 16's streaming RSC sends a 200 status before notFound() fires
        // during the React render, so we assert on the rendered body — which
        // is the global app/not-found.tsx with the "Page not found" heading.
        await page.goto(`/practice/tags/${PREFIX}does-not-exist-xyz`)
        await expect(
            page.getByRole("heading", { name: "Page not found" })
        ).toBeVisible()
    })
})
