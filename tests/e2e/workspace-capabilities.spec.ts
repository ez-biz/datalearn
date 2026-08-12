import { test, expect } from "@playwright/test"
import { prisma } from "./fixtures/db"

// Behaviours that existed before SP5's refactor, appear in none of the
// design screenshots, and would disappear silently if a future change to
// the workspace forgot them.

const FIXTURE_SLUG = "e2e-sp5-parser-null"

test.describe("workspace capabilities", () => {
    test("schema still renders when the server-side parser cannot read it", async ({
        page,
    }) => {
        // lib/schema-parser.ts recognises INSERT ... VALUES and returns null
        // for anything else. When it returns null the page must fall back to
        // DuckDB introspection (DESCRIBE + SELECT) rather than showing no
        // schema at all. Nothing in the seed exercises this path.
        const schema = await prisma.sqlSchema.create({
            data: {
                name: FIXTURE_SLUG,
                // CTAS: no column list for the parser to read, but valid
                // DuckDB. Verified with parseSchema() that this returns null —
                // an INSERT ... SELECT does NOT, because the CREATE TABLE is
                // still parseable and only the rows are lost.
                sql: "CREATE TABLE widgets AS SELECT 1 AS id, 'alpha' AS name;",
            },
        })
        const max = await prisma.sQLProblem.aggregate({ _max: { number: true } })
        const problem = await prisma.sQLProblem.create({
            data: {
                number: (max._max.number ?? 0) + 1,
                title: "Parser fallback fixture",
                slug: FIXTURE_SLUG,
                difficulty: "EASY",
                status: "PUBLISHED",
                description: "Fixture for the DuckDB schema fallback.",
                schemaDescription: "One table.",
                schemaId: schema.id,
                expectedOutput: JSON.stringify([{ id: 1, name: "alpha" }]),
            },
        })

        try {
            await page.setViewportSize({ width: 1440, height: 900 })
            await page.goto(`/practice/${FIXTURE_SLUG}`)
            // DuckDB has to download and run the DDL before introspection.
            await expect(
                page.getByRole("button", { name: /schema/i }).first()
            ).toBeVisible({ timeout: 30_000 })
            // The table name can only come from tableInfos, which on this
            // problem can only come from DuckDB introspection.
            await expect(page.getByText("widgets").first()).toBeVisible({
                timeout: 30_000,
            })
            await expect(page.getByText("id").first()).toBeVisible({
                timeout: 30_000,
            })
        } finally {
            await prisma.sQLProblem.delete({ where: { id: problem.id } })
            await prisma.sqlSchema.delete({ where: { id: schema.id } })
        }
    })

    test("the header keeps Add-to-list and Report", async ({ page }) => {
        await page.setViewportSize({ width: 1440, height: 900 })
        await page.goto("/practice/simple-select")
        // Signed out these render as sign-in affordances, but they must exist.
        await expect(page.getByText(/save/i).first()).toBeVisible()
        await expect(page.getByText(/report/i).first()).toBeVisible()
    })
})
